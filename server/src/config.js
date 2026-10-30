// Configuración leída de variables de entorno (archivo .env en desarrollo)
require('dotenv').config();

function requerida(nombre) {
  const valor = process.env[nombre];
  if (!valor) {
    throw new Error(`Falta la variable de entorno ${nombre}. Revisa el archivo .env (ver .env.example).`);
  }
  return valor;
}

const config = {
  puerto: Number(process.env.PORT || 3000),
  databaseUrl: requerida('DATABASE_URL'),
  // Usa SSL cuando la base de datos está en la nube (Render, Neon)
  databaseSsl: process.env.DATABASE_SSL === 'true',
  jwtSecret: requerida('JWT_SECRET'),
  jwtExpira: process.env.JWT_EXPIRA || '8h',
  // Clave para cifrar solicitudes y mensajes (64 caracteres hexadecimales o un texto secreto largo)
  dataKey: requerida('DATA_KEY'),
  versionPolitica: '1.0',
  entorno: process.env.NODE_ENV || 'development',
};

if (config.dataKey.length < 32) {
  throw new Error('DATA_KEY debe tener al menos 32 caracteres.');
}

module.exports = config;
