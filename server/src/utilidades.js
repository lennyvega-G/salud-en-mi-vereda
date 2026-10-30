// Envuelve un controlador asíncrono para que los errores lleguen al manejador central
function ruta(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = { ruta };
