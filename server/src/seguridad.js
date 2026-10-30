// Autenticación, autorización por rol, cabeceras de seguridad, límite de intentos y auditoría
const jwt = require('jsonwebtoken');
const config = require('./config');
const db = require('./db');

function firmarToken(usuario) {
  return jwt.sign({ id: usuario.id, rol: usuario.rol }, config.jwtSecret, { expiresIn: config.jwtExpira });
}

// Exige un token válido y deja al usuario en req.usuario
async function autenticar(req, res, next) {
  const encabezado = req.headers.authorization || '';
  const token = encabezado.startsWith('Bearer ') ? encabezado.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Debe iniciar sesión.' });
  try {
    const datos = jwt.verify(token, config.jwtSecret);
    const { rows } = await db.query(
      'SELECT id, rol, nombres, activo FROM usuarios WHERE id = $1', [datos.id]);
    if (!rows[0] || !rows[0].activo) return res.status(401).json({ error: 'La cuenta no está activa.' });
    req.usuario = rows[0];
    next();
  } catch {
    return res.status(401).json({ error: 'La sesión expiró. Vuelva a iniciar sesión.' });
  }
}

// Permite el paso solo a los roles indicados
function permitir(...roles) {
  return (req, res, next) => {
    if (!req.usuario || !roles.includes(req.usuario.rol)) {
      return res.status(403).json({ error: 'No tiene permiso para esta acción.' });
    }
    next();
  };
}

// Cabeceras básicas de seguridad (equivalentes a las principales de Helmet)
function cabeceras(req, res, next) {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Content-Security-Policy':
      "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'",
  });
  if (config.entorno === 'production') {
    res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
}

// Límite simple de intentos por IP (protege el inicio de sesión de ataques de fuerza bruta)
function limitarIntentos({ maximo, ventanaMs }) {
  const intentos = new Map();
  return (req, res, next) => {
    const ahora = Date.now();
    const clave = req.ip;
    const registro = intentos.get(clave);
    if (!registro || ahora - registro.inicio > ventanaMs) {
      intentos.set(clave, { inicio: ahora, cuenta: 1 });
      return next();
    }
    registro.cuenta += 1;
    if (registro.cuenta > maximo) {
      return res.status(429).json({ error: 'Demasiados intentos. Espere unos minutos e intente de nuevo.' });
    }
    next();
  };
}

// Registro de auditoría (RF12). Si falla, no interrumpe la operación principal.
async function auditar(req, accion, entidad = null, entidadId = null, usuarioId = null) {
  try {
    await db.query(
      'INSERT INTO auditoria (usuario_id, accion, entidad, entidad_id, ip) VALUES ($1, $2, $3, $4, $5)',
      [usuarioId ?? req.usuario?.id ?? null, accion, entidad, entidadId, req.ip]);
  } catch (e) {
    console.error('No se pudo registrar la auditoría:', e.message);
  }
}

module.exports = { firmarToken, autenticar, permitir, cabeceras, limitarIntentos, auditar };
