// Validaciones sencillas de los datos que llegan del cliente

class ErrorValidacion extends Error {
  constructor(mensaje) {
    super(mensaje);
    this.estado = 400;
  }
}

function texto(valor, campo, { min = 1, max = 500, opcional = false } = {}) {
  if (valor === undefined || valor === null || String(valor).trim() === '') {
    if (opcional) return null;
    throw new ErrorValidacion(`El campo "${campo}" es obligatorio.`);
  }
  const limpio = String(valor).trim();
  if (limpio.length < min) throw new ErrorValidacion(`El campo "${campo}" debe tener al menos ${min} caracteres.`);
  if (limpio.length > max) throw new ErrorValidacion(`El campo "${campo}" admite máximo ${max} caracteres.`);
  return limpio;
}

function entero(valor, campo, { opcional = false } = {}) {
  if (valor === undefined || valor === null || valor === '') {
    if (opcional) return null;
    throw new ErrorValidacion(`El campo "${campo}" es obligatorio.`);
  }
  const n = Number(valor);
  if (!Number.isInteger(n) || n <= 0) throw new ErrorValidacion(`El campo "${campo}" no es válido.`);
  return n;
}

function documento(valor) {
  const limpio = texto(valor, 'número de documento', { min: 5, max: 15 });
  if (!/^[0-9]+$/.test(limpio)) throw new ErrorValidacion('El número de documento solo debe tener números.');
  return limpio;
}

function contrasena(valor) {
  const limpio = String(valor ?? '');
  if (limpio.length < 6) throw new ErrorValidacion('La contraseña debe tener al menos 6 caracteres.');
  if (limpio.length > 72) throw new ErrorValidacion('La contraseña es demasiado larga.');
  return limpio;
}

function opcionDe(valor, campo, opciones) {
  if (!opciones.includes(valor)) throw new ErrorValidacion(`El campo "${campo}" no es válido.`);
  return valor;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function uuidOpcional(valor) {
  if (valor === undefined || valor === null || valor === '') return null;
  if (!UUID.test(valor)) throw new ErrorValidacion('Identificador de envío no válido.');
  return valor;
}

module.exports = { ErrorValidacion, texto, entero, documento, contrasena, opcionDe, uuidOpcional };
