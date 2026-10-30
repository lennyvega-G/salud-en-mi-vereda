// RF08 contenidos, RF11 administración, RF12 auditoría y RF13 reportes
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const v = require('../validacion');
const { autenticar, permitir, auditar } = require('../seguridad');
const { ruta } = require('../utilidades');

const router = express.Router();
router.use(autenticar);

const ROLES = ['usuario', 'gestor', 'profesional', 'admin'];
const TIPOS_SERVICIO = ['hospital', 'puesto_salud', 'brigada', 'otro'];

// ---------- Usuarios ----------
router.get('/usuarios', permitir('admin'), ruta(async (req, res) => {
  const { rows } = await db.query(
    `SELECT u.id, u.tipo_documento, u.num_documento, u.nombres, u.apellidos, u.rol, u.activo,
            v.nombre AS vereda, u.creado_en
     FROM usuarios u LEFT JOIN veredas v ON v.id = u.vereda_id ORDER BY u.creado_en DESC`);
  res.json(rows);
}));

// Crear cuentas del personal (profesionales, gestores o administradores)
router.post('/usuarios', permitir('admin'), ruta(async (req, res) => {
  const rol = v.opcionDe(req.body.rol, 'rol', ['gestor', 'profesional', 'admin']);
  const numDocumento = v.documento(req.body.num_documento);
  const existe = await db.query('SELECT 1 FROM usuarios WHERE num_documento = $1', [numDocumento]);
  if (existe.rowCount) throw new v.ErrorValidacion('Ya existe una cuenta con ese número de documento.');
  const hash = await bcrypt.hash(v.contrasena(req.body.password), 10);
  const { rows } = await db.query(
    `INSERT INTO usuarios (tipo_documento, num_documento, nombres, apellidos, telefono, vereda_id, rol, hash_contrasena, registrado_por)
     VALUES ('CC', $1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, nombres, apellidos, rol`,
    [numDocumento, v.texto(req.body.nombres, 'nombres', { max: 80 }), v.texto(req.body.apellidos, 'apellidos', { max: 80 }),
      v.texto(req.body.telefono, 'teléfono', { max: 20, opcional: true }), v.entero(req.body.vereda_id, 'vereda', { opcional: true }),
      rol, hash, req.usuario.id]);
  await auditar(req, 'crear_cuenta_personal', 'usuario', rows[0].id);
  res.status(201).json(rows[0]);
}));

router.patch('/usuarios/:id', permitir('admin'), ruta(async (req, res) => {
  const id = v.entero(req.params.id, 'usuario');
  if (id === req.usuario.id) throw new v.ErrorValidacion('No puede cambiar su propia cuenta desde aquí.');
  const cambios = [];
  const valores = [id];
  if (req.body.rol !== undefined) { valores.push(v.opcionDe(req.body.rol, 'rol', ROLES)); cambios.push(`rol = $${valores.length}`); }
  if (req.body.activo !== undefined) { valores.push(Boolean(req.body.activo)); cambios.push(`activo = $${valores.length}`); }
  if (!cambios.length) throw new v.ErrorValidacion('No hay cambios para guardar.');
  const { rows } = await db.query(
    `UPDATE usuarios SET ${cambios.join(', ')} WHERE id = $1 RETURNING id, rol, activo`, valores);
  if (!rows[0]) return res.status(404).json({ error: 'El usuario no existe.' });
  await auditar(req, 'modificar_usuario', 'usuario', id);
  res.json(rows[0]);
}));

// ---------- Directorio de servicios ----------
function datosServicio(body) {
  return [
    v.texto(body.nombre, 'nombre', { max: 120 }),
    v.opcionDe(body.tipo, 'tipo', TIPOS_SERVICIO),
    v.texto(body.direccion, 'dirección', { max: 160, opcional: true }),
    v.texto(body.horario, 'horario', { max: 160, opcional: true }),
    v.texto(body.telefono, 'teléfono', { max: 40, opcional: true }),
    v.texto(body.requisitos, 'requisitos', { max: 1000, opcional: true }),
    v.entero(body.vereda_id, 'vereda', { opcional: true }),
  ];
}

router.post('/servicios', permitir('admin'), ruta(async (req, res) => {
  const { rows } = await db.query(
    `INSERT INTO servicios (nombre, tipo, direccion, horario, telefono, requisitos, vereda_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`, datosServicio(req.body));
  await auditar(req, 'crear_servicio', 'servicio', rows[0].id);
  res.status(201).json(rows[0]);
}));

router.put('/servicios/:id', permitir('admin'), ruta(async (req, res) => {
  const id = v.entero(req.params.id, 'servicio');
  const { rows } = await db.query(
    `UPDATE servicios SET nombre = $2, tipo = $3, direccion = $4, horario = $5, telefono = $6,
       requisitos = $7, vereda_id = $8, actualizado_en = NOW() WHERE id = $1 RETURNING *`,
    [id, ...datosServicio(req.body)]);
  if (!rows[0]) return res.status(404).json({ error: 'El servicio no existe.' });
  await auditar(req, 'editar_servicio', 'servicio', id);
  res.json(rows[0]);
}));

router.delete('/servicios/:id', permitir('admin'), ruta(async (req, res) => {
  const id = v.entero(req.params.id, 'servicio');
  await db.query('UPDATE servicios SET activo = FALSE, actualizado_en = NOW() WHERE id = $1', [id]);
  await auditar(req, 'retirar_servicio', 'servicio', id);
  res.status(204).end();
}));

// ---------- Contenidos educativos (profesionales y administrador) ----------
router.post('/contenidos', permitir('profesional', 'admin'), ruta(async (req, res) => {
  const { rows } = await db.query(
    `INSERT INTO contenidos (titulo, tema, cuerpo, autor_id) VALUES ($1, $2, $3, $4) RETURNING *`,
    [v.texto(req.body.titulo, 'título', { max: 120 }), v.texto(req.body.tema, 'tema', { max: 60 }),
      v.texto(req.body.cuerpo, 'contenido', { min: 20, max: 5000 }), req.usuario.id]);
  await auditar(req, 'publicar_contenido', 'contenido', rows[0].id);
  res.status(201).json(rows[0]);
}));

router.delete('/contenidos/:id', permitir('profesional', 'admin'), ruta(async (req, res) => {
  const id = v.entero(req.params.id, 'contenido');
  await db.query('UPDATE contenidos SET activo = FALSE WHERE id = $1', [id]);
  await auditar(req, 'retirar_contenido', 'contenido', id);
  res.status(204).end();
}));

// ---------- Auditoría ----------
router.get('/auditoria', permitir('admin'), ruta(async (req, res) => {
  const { rows } = await db.query(
    `SELECT a.id, a.accion, a.entidad, a.entidad_id, a.ip, a.fecha,
            COALESCE(u.nombres || ' ' || u.apellidos, 'Sin sesión') AS usuario, u.rol
     FROM auditoria a LEFT JOIN usuarios u ON u.id = a.usuario_id
     ORDER BY a.fecha DESC LIMIT 300`);
  res.json(rows);
}));

// ---------- Reportes (sin datos personales) ----------
router.get('/reportes', permitir('admin'), ruta(async (req, res) => {
  const [porEstado, porTipo, porVereda, totales] = await Promise.all([
    db.query('SELECT estado, COUNT(*)::int AS total FROM solicitudes GROUP BY estado ORDER BY estado'),
    db.query(`SELECT t.nombre AS tipo, COUNT(s.id)::int AS total FROM tipos_solicitud t
              LEFT JOIN solicitudes s ON s.tipo_id = t.id GROUP BY t.nombre ORDER BY total DESC`),
    db.query(`SELECT COALESCE(v.nombre, 'Sin vereda') AS vereda, COUNT(*)::int AS total
              FROM solicitudes s JOIN usuarios u ON u.id = s.usuario_id
              LEFT JOIN veredas v ON v.id = u.vereda_id GROUP BY 1 ORDER BY total DESC`),
    db.query(`SELECT
              (SELECT COUNT(*)::int FROM usuarios WHERE rol = 'usuario') AS usuarios,
              (SELECT COUNT(*)::int FROM solicitudes) AS solicitudes,
              (SELECT COUNT(*)::int FROM solicitudes WHERE registrada_por <> usuario_id) AS asistidas,
              (SELECT ROUND(AVG(EXTRACT(EPOCH FROM (m.primera - s.creado_en)) / 3600)::numeric, 1)
                 FROM solicitudes s JOIN (SELECT solicitud_id, MIN(creado_en) AS primera FROM mensajes m
                 JOIN usuarios a ON a.id = m.autor_id WHERE a.rol = 'profesional' GROUP BY solicitud_id) m
                 ON m.solicitud_id = s.id) AS horas_primera_respuesta`),
  ]);
  res.json({ totales: totales.rows[0], porEstado: porEstado.rows, porTipo: porTipo.rows, porVereda: porVereda.rows });
}));

module.exports = router;
