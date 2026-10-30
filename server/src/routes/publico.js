// Información pública que la PWA guarda en el teléfono para usarla sin conexión (RF03, RF08)
const express = require('express');
const db = require('../db');
const { ruta } = require('../utilidades');

const router = express.Router();

router.get('/veredas', ruta(async (req, res) => {
  const { rows } = await db.query('SELECT id, nombre, tipo FROM veredas ORDER BY tipo DESC, nombre');
  res.json(rows);
}));

router.get('/servicios', ruta(async (req, res) => {
  const { rows } = await db.query(
    `SELECT s.id, s.nombre, s.tipo, s.direccion, s.horario, s.telefono, s.requisitos,
            s.vereda_id, v.nombre AS vereda, s.actualizado_en
     FROM servicios s LEFT JOIN veredas v ON v.id = s.vereda_id
     WHERE s.activo
     ORDER BY CASE s.tipo WHEN 'hospital' THEN 1 WHEN 'puesto_salud' THEN 2 WHEN 'brigada' THEN 3 ELSE 4 END, s.nombre`);
  res.json(rows);
}));

router.get('/contenidos', ruta(async (req, res) => {
  const { rows } = await db.query(
    `SELECT id, titulo, tema, cuerpo, publicado_en FROM contenidos
     WHERE activo ORDER BY publicado_en DESC`);
  res.json(rows);
}));

router.get('/tipos-solicitud', ruta(async (req, res) => {
  const { rows } = await db.query('SELECT id, nombre FROM tipos_solicitud ORDER BY id');
  res.json(rows);
}));

module.exports = router;
