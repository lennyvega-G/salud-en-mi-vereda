// RF04 creación, RF05 mensajería, RF06 seguimiento, RF07 avisos y RF10 bandeja del profesional
const express = require('express');
const db = require('../db');
const v = require('../validacion');
const { cifrar, descifrar } = require('../cifrado');
const { autenticar, permitir, auditar } = require('../seguridad');
const { ruta } = require('../utilidades');

const router = express.Router();
router.use(autenticar);

const ESTADOS = ['recibida', 'en_curso', 'respondida', 'cerrada'];

// Columnas comunes del listado (sin el texto de la solicitud)
const SELECT_LISTA = `
  SELECT s.id, s.estado, s.creado_en, s.actualizado_en, t.nombre AS tipo,
         s.usuario_id, u.nombres || ' ' || u.apellidos AS usuario, v.nombre AS vereda,
         s.profesional_id, p.nombres || ' ' || p.apellidos AS profesional,
         (s.registrada_por IS NOT NULL AND s.registrada_por <> s.usuario_id) AS asistida
  FROM solicitudes s
  JOIN tipos_solicitud t ON t.id = s.tipo_id
  JOIN usuarios u ON u.id = s.usuario_id
  LEFT JOIN veredas v ON v.id = u.vereda_id
  LEFT JOIN usuarios p ON p.id = s.profesional_id`;

// ¿Puede esta persona ver el contenido de la solicitud? (reserva de la información, Ley 23 de 1981)
function puedeVerContenido(usuario, solicitud) {
  if (usuario.rol === 'usuario') return solicitud.usuario_id === usuario.id;
  if (usuario.rol === 'profesional') return solicitud.profesional_id === null || solicitud.profesional_id === usuario.id;
  return false; // gestor y administrador solo ven datos generales
}

async function obtener(id) {
  const { rows } = await db.query('SELECT * FROM solicitudes WHERE id = $1', [id]);
  return rows[0];
}

// Crear solicitud. El gestor puede crearla en nombre de otra persona (RF09).
router.post('/', permitir('usuario', 'gestor'), ruta(async (req, res) => {
  const tipoId = v.entero(req.body.tipo_id, 'tipo de solicitud');
  const descripcion = v.texto(req.body.descripcion, 'descripción', { min: 5, max: 1000 });
  const clientUuid = v.uuidOpcional(req.body.client_uuid);

  let usuarioId = req.usuario.id;
  if (req.usuario.rol === 'gestor') {
    usuarioId = v.entero(req.body.usuario_id, 'persona');
    const destino = await db.query("SELECT 1 FROM usuarios WHERE id = $1 AND rol = 'usuario' AND activo", [usuarioId]);
    if (!destino.rowCount) throw new v.ErrorValidacion('La persona seleccionada no existe.');
  }

  // Si la solicitud ya llegó antes (reenvío desde la cola sin conexión), se devuelve la misma
  if (clientUuid) {
    const previa = await db.query('SELECT id, estado FROM solicitudes WHERE client_uuid = $1', [clientUuid]);
    if (previa.rowCount) return res.status(200).json({ ...previa.rows[0], duplicada: true });
  }

  const { rows } = await db.query(
    `INSERT INTO solicitudes (usuario_id, tipo_id, descripcion_cifrada, registrada_por, client_uuid)
     VALUES ($1, $2, $3, $4, $5) RETURNING id, estado, creado_en`,
    [usuarioId, tipoId, cifrar(descripcion), req.usuario.id, clientUuid]);
  await auditar(req, req.usuario.rol === 'gestor' ? 'crear_solicitud_asistida' : 'crear_solicitud', 'solicitud', rows[0].id);
  res.status(201).json(rows[0]);
}));

// Listado según el rol
router.get('/', ruta(async (req, res) => {
  const { rol, id } = req.usuario;
  const filtros = [];
  const valores = [];
  const agregar = (condicion, valor) => { valores.push(valor); filtros.push(condicion.replace('?', `$${valores.length}`)); };

  if (rol === 'usuario') agregar('s.usuario_id = ?', id);
  if (rol === 'gestor') agregar('s.registrada_por = ?', id);
  if (req.query.estado) agregar('s.estado = ?', v.opcionDe(req.query.estado, 'estado', ESTADOS));
  if (req.query.vereda_id) agregar('u.vereda_id = ?', v.entero(req.query.vereda_id, 'vereda'));

  let sql = SELECT_LISTA;
  if (rol === 'usuario') {
    sql = sql.replace('FROM solicitudes s', `,
      (SELECT COUNT(*)::int FROM mensajes m WHERE m.solicitud_id = s.id AND NOT m.leido AND m.autor_id <> s.usuario_id) AS nuevas
      FROM solicitudes s`);
  }
  if (filtros.length) sql += ` WHERE ${filtros.join(' AND ')}`;
  sql += ' ORDER BY s.actualizado_en DESC LIMIT 200';
  const { rows } = await db.query(sql, valores);
  res.json(rows);
}));

// Cantidad de respuestas sin leer (aviso en la pantalla de inicio, RF07)
router.get('/avisos', permitir('usuario'), ruta(async (req, res) => {
  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS nuevas FROM mensajes m JOIN solicitudes s ON s.id = m.solicitud_id
     WHERE s.usuario_id = $1 AND NOT m.leido AND m.autor_id <> $1`, [req.usuario.id]);
  res.json(rows[0]);
}));

// Detalle con mensajes
router.get('/:id', ruta(async (req, res) => {
  const id = v.entero(req.params.id, 'solicitud');
  const solicitud = await obtener(id);
  if (!solicitud) return res.status(404).json({ error: 'La solicitud no existe.' });
  if (!puedeVerContenido(req.usuario, solicitud)) return res.status(403).json({ error: 'No tiene permiso para ver esta solicitud.' });

  const lista = await db.query(`${SELECT_LISTA} WHERE s.id = $1`, [id]);
  const mensajes = await db.query(
    `SELECT m.id, m.autor_id, m.contenido_cifrado, m.creado_en, a.rol AS autor_rol,
            a.nombres || ' ' || a.apellidos AS autor
     FROM mensajes m JOIN usuarios a ON a.id = m.autor_id
     WHERE m.solicitud_id = $1 ORDER BY m.creado_en`, [id]);

  if (req.usuario.rol === 'usuario') {
    await db.query('UPDATE mensajes SET leido = TRUE WHERE solicitud_id = $1 AND autor_id <> $2', [id, req.usuario.id]);
  }
  await auditar(req, 'ver_solicitud', 'solicitud', id);
  res.json({
    ...lista.rows[0],
    descripcion: descifrar(solicitud.descripcion_cifrada),
    mensajes: mensajes.rows.map(({ contenido_cifrado, ...m }) => ({ ...m, contenido: descifrar(contenido_cifrado) })),
  });
}));

// Enviar un mensaje. Si responde el profesional, la solicitud queda asignada a él y pasa a "respondida".
router.post('/:id/mensajes', permitir('usuario', 'profesional'), ruta(async (req, res) => {
  const id = v.entero(req.params.id, 'solicitud');
  const contenido = v.texto(req.body.contenido, 'mensaje', { max: 1000 });
  const solicitud = await obtener(id);
  if (!solicitud) return res.status(404).json({ error: 'La solicitud no existe.' });
  if (!puedeVerContenido(req.usuario, solicitud)) return res.status(403).json({ error: 'No tiene permiso sobre esta solicitud.' });
  if (solicitud.estado === 'cerrada') return res.status(409).json({ error: 'La solicitud está cerrada.' });

  const { rows } = await db.query(
    'INSERT INTO mensajes (solicitud_id, autor_id, contenido_cifrado) VALUES ($1, $2, $3) RETURNING id, creado_en',
    [id, req.usuario.id, cifrar(contenido)]);
  if (req.usuario.rol === 'profesional') {
    await db.query(
      `UPDATE solicitudes SET estado = 'respondida', profesional_id = $2, actualizado_en = NOW() WHERE id = $1`,
      [id, req.usuario.id]);
  } else {
    await db.query(
      `UPDATE solicitudes SET estado = CASE WHEN estado = 'respondida' THEN 'en_curso' ELSE estado END,
       actualizado_en = NOW() WHERE id = $1`, [id]);
  }
  await auditar(req, 'enviar_mensaje', 'solicitud', id);
  res.status(201).json(rows[0]);
}));

// Cambiar estado: el profesional toma la solicitud (en_curso) o la cierra
router.patch('/:id', permitir('profesional'), ruta(async (req, res) => {
  const id = v.entero(req.params.id, 'solicitud');
  const estado = v.opcionDe(req.body.estado, 'estado', ['en_curso', 'cerrada']);
  const solicitud = await obtener(id);
  if (!solicitud) return res.status(404).json({ error: 'La solicitud no existe.' });
  if (!puedeVerContenido(req.usuario, solicitud)) return res.status(403).json({ error: 'La solicitud está asignada a otro profesional.' });

  const { rows } = await db.query(
    `UPDATE solicitudes SET estado = $2, profesional_id = $3, actualizado_en = NOW()
     WHERE id = $1 RETURNING id, estado`, [id, estado, req.usuario.id]);
  await auditar(req, `estado_${estado}`, 'solicitud', id);
  res.json(rows[0]);
}));

module.exports = router;
