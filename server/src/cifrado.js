// Cifrado AES-256-GCM para el texto de solicitudes y mensajes (RNF08)
const crypto = require('crypto');
const config = require('./config');

// Si DATA_KEY son 64 caracteres hexadecimales se usa directo; si es otro texto se deriva con SHA-256
const clave = /^[0-9a-fA-F]{64}$/.test(config.dataKey)
  ? Buffer.from(config.dataKey, 'hex')
  : crypto.createHash('sha256').update(config.dataKey).digest();

function cifrar(texto) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', clave, iv);
  const cifrado = Buffer.concat([cipher.update(String(texto), 'utf8'), cipher.final()]);
  const etiqueta = cipher.getAuthTag();
  return [iv, etiqueta, cifrado].map((b) => b.toString('base64')).join(':');
}

function descifrar(valor) {
  const [iv, etiqueta, cifrado] = valor.split(':').map((p) => Buffer.from(p, 'base64'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', clave, iv);
  decipher.setAuthTag(etiqueta);
  return Buffer.concat([decipher.update(cifrado), decipher.final()]).toString('utf8');
}

module.exports = { cifrar, descifrar };
