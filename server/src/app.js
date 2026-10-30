const path = require('path');
const fs = require('fs');
const express = require('express');
const { cabeceras } = require('./seguridad');

const app = express();
app.set('trust proxy', 1); // Render y otros servicios entregan la IP real en X-Forwarded-For
app.disable('x-powered-by');
app.use(cabeceras);
app.use(express.json({ limit: '50kb' }));

app.get('/api/salud', (req, res) => res.json({ ok: true }));
app.use('/api/auth', require('./routes/auth').router);
app.use('/api', require('./routes/publico'));
app.use('/api/solicitudes', require('./routes/solicitudes'));
app.use('/api/gestor', require('./routes/gestor'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));

// En producción el mismo servidor entrega la aplicación web ya compilada
const dist = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist, {
    setHeaders: (res, archivo) => {
      if (archivo.endsWith('sw.js') || archivo.endsWith('index.html')) res.set('Cache-Control', 'no-cache');
    },
  }));
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

// Manejador central de errores: no expone detalles internos al usuario
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.estado) return res.status(err.estado).json({ error: err.message });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Datos con formato incorrecto.' });
  if (err.code === '23503') return res.status(400).json({ error: 'Alguno de los datos seleccionados no existe.' });
  console.error(err);
  res.status(500).json({ error: 'Ocurrió un error inesperado. Intente de nuevo.' });
});

module.exports = app;
