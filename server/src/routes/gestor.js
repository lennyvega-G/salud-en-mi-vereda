// RF09 registro asistido por el gestor comunitario
const express = require('express');
const db = require('../db');
const v = require('../validacion');
const { autenticar, permitir, auditar } = require('../seguridad');
const { crearUsuario } = require('./auth');
const { ruta } = require('../utilidades');

const router = express.Router();
router.use(autenticar, permitir('gestor'));

// Buscar a una persona por documento para crearle una solicitud
router.get('/personas', ruta(async (req, res) => {
  const numDocumento = v.documento(req.query.documento);
  const { rows } = await db.query(
    `SELECT u.id, u.nombres, u.apellidos, v.nombre AS vereda
     FROM usuarios u LEFT JOIN veredas v ON v.id = u.vereda_id
     WHERE u.num_documento = $1 AND u.rol = 'usuario' AND u.activo`, [numDocumento]);
  if (!rows[0]) return res.status(404).json({ error: 'No hay ninguna persona registrada con ese documento.' });
  res.json(rows[0]);
}));

// Registrar a una persona que no puede hacerlo sola. El consentimiento queda como "asistido".
router.post('/personas', ruta(async (req, res) => {
  const usuario = await crearUsuario(req.body, { medio: 'asistido', registradoPor: req.usuario.id });
  await auditar(req, 'registro_asistido', 'usuario', usuario.id);
  res.status(201).json(usuario);
}));

module.exports = router;
