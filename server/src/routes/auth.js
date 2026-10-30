// RF01 registro con consentimiento y RF02 inicio de sesión
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const config = require('../config');
const v = require('../validacion');
const { firmarToken, autenticar, limitarIntentos, auditar } = require('../seguridad');
const { ruta } = require('../utilidades');

const router = express.Router();
const limiteLogin = limitarIntentos({ maximo: 10, ventanaMs: 10 * 60 * 1000 });

// Crea un usuario con rol "usuario" y guarda su consentimiento. Se usa también en el registro asistido.
async function crearUsuario(datos, { medio, registradoPor = null }) {
  if (datos.acepta_politica !== true) {
    throw new v.ErrorValidacion('Para registrarse debe aceptar la política de tratamiento de datos.');
  }
  const tipoDocumento = v.opcionDe(datos.tipo_documento || 'CC', 'tipo de documento', ['CC', 'TI', 'CE', 'PPT']);
  const numDocumento = v.documento(datos.num_documento);
  const nombres = v.texto(datos.nombres, 'nombres', { max: 80 });
  const apellidos = v.texto(datos.apellidos, 'apellidos', { max: 80 });
  const telefono = v.texto(datos.telefono, 'teléfono', { max: 20, opcional: true });
  const veredaId = v.entero(datos.vereda_id, 'vereda');
  const clave = v.contrasena(datos.password);

  const existe = await db.query('SELECT 1 FROM usuarios WHERE num_documento = $1', [numDocumento]);
  if (existe.rowCount) throw new v.ErrorValidacion('Ya existe una cuenta con ese número de documento.');

  const hash = await bcrypt.hash(clave, 10);
  const cliente = await db.pool.connect();
  try {
    await cliente.query('BEGIN');
    const { rows } = await cliente.query(
      `INSERT INTO usuarios (tipo_documento, num_documento, nombres, apellidos, telefono, vereda_id, hash_contrasena, registrado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, nombres, apellidos, rol, vereda_id`,
      [tipoDocumento, numDocumento, nombres, apellidos, telefono, veredaId, hash, registradoPor]);
    await cliente.query(
      'INSERT INTO consentimientos (usuario_id, version_politica, medio) VALUES ($1, $2, $3)',
      [rows[0].id, config.versionPolitica, medio]);
    await cliente.query('COMMIT');
    return rows[0];
  } catch (e) {
    await cliente.query('ROLLBACK');
    throw e;
  } finally {
    cliente.release();
  }
}

router.post('/registro', ruta(async (req, res) => {
  const usuario = await crearUsuario(req.body, { medio: 'propio' });
  await auditar(req, 'registro', 'usuario', usuario.id, usuario.id);
  res.status(201).json({ token: firmarToken(usuario), usuario });
}));

router.post('/login', limiteLogin, ruta(async (req, res) => {
  const numDocumento = String(req.body.num_documento || '').trim();
  const clave = String(req.body.password || '');
  const { rows } = await db.query(
    'SELECT id, nombres, apellidos, rol, vereda_id, hash_contrasena, activo FROM usuarios WHERE num_documento = $1',
    [numDocumento]);
  const usuario = rows[0];
  const valido = usuario && usuario.activo && (await bcrypt.compare(clave, usuario.hash_contrasena));
  if (!valido) {
    await auditar(req, 'login_fallido', 'usuario', usuario?.id ?? null, null);
    return res.status(401).json({ error: 'Documento o contraseña incorrectos.' });
  }
  delete usuario.hash_contrasena;
  delete usuario.activo;
  await auditar(req, 'login', 'usuario', usuario.id, usuario.id);
  res.json({ token: firmarToken(usuario), usuario });
}));

router.get('/yo', autenticar, ruta(async (req, res) => {
  const { rows } = await db.query(
    `SELECT u.id, u.nombres, u.apellidos, u.rol, u.vereda_id, v.nombre AS vereda
     FROM usuarios u LEFT JOIN veredas v ON v.id = u.vereda_id WHERE u.id = $1`, [req.usuario.id]);
  res.json(rows[0]);
}));

module.exports = { router, crearUsuario };
