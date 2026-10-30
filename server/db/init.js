// Crea las tablas y carga datos de prueba (todos ficticios, salvo los nombres de las veredas)
// Uso: npm run db:init (borra y vuelve a crear todo) o npm run db:preparar (solo si está vacía)
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { pool } = require('../src/db');
const { cifrar } = require('../src/cifrado');

const VEREDAS = [
  ['Casco urbano', 'casco_urbano'],
  ['Las Camelias', 'centro_poblado'], ['La Cabaña', 'centro_poblado'], ['Albania', 'centro_poblado'],
  ['La Parroquia', 'centro_poblado'], ['El Hatillo', 'centro_poblado'], ['Pitalito', 'centro_poblado'],
  ['Las Marías', 'centro_poblado'],
  ['Pueblo Nuevo', 'vereda'], ['Las Lomas', 'vereda'], ['El Caucho', 'vereda'], ['Oritá', 'vereda'],
  ['El Porvenir', 'vereda'], ['San Juan', 'vereda'], ['San Jerónimo', 'vereda'],
  ['San Diego Alto', 'vereda'], ['San Diego Bajo', 'vereda'],
];

const TIPOS = ['Orientación general', 'Información sobre citas', 'Trámites y autorizaciones', 'Otra consulta'];

// Directorio de ejemplo: nombres, horarios y teléfonos son ficticios para el entorno de pruebas
const SERVICIOS = [
  ['Hospital municipal (dato de prueba)', 'hospital', 'Casco urbano', 'Calle de ejemplo # 1-23', 'Urgencias 24 horas. Consulta externa lunes a viernes 7:00 a. m. a 5:00 p. m.', '000 000 0000', 'Documento de identidad y carné o certificado de afiliación.'],
  ['Puesto de salud Las Camelias (dato de prueba)', 'puesto_salud', 'Las Camelias', 'Junto a la escuela', 'Martes y jueves 8:00 a. m. a 12:00 m.', '000 000 0001', 'Documento de identidad.'],
  ['Puesto de salud La Cabaña (dato de prueba)', 'puesto_salud', 'La Cabaña', 'Frente al parque', 'Lunes y miércoles 8:00 a. m. a 12:00 m.', '000 000 0002', 'Documento de identidad.'],
  ['Puesto de salud El Hatillo (dato de prueba)', 'puesto_salud', 'El Hatillo', 'Sede comunal', 'Viernes 8:00 a. m. a 1:00 p. m.', '000 000 0003', 'Documento de identidad.'],
  ['Brigada de salud Pueblo Nuevo (dato de prueba)', 'brigada', 'Pueblo Nuevo', 'Escuela de la vereda', 'Último sábado de cada mes, 8:00 a. m.', null, 'Llevar documento y carné de vacunas.'],
];

const CONTENIDOS = [
  ['Cuándo ir a urgencias', 'Prevención',
    'Vaya de inmediato a urgencias o llame al 123 si hay dificultad para respirar, dolor fuerte en el pecho, sangrado que no para, pérdida del conocimiento, convulsiones o fiebre muy alta en bebés. Esta aplicación no atiende urgencias.'],
  ['Cómo preparar una cita médica', 'Trámites',
    'Antes de salir de la vereda, confirme el horario del servicio en el directorio. Lleve su documento de identidad, el carné de afiliación y las fórmulas o exámenes anteriores. Escriba en un papel las preguntas que quiere hacer.'],
  ['Agua segura en casa', 'Autocuidado',
    'Hierva el agua de consumo durante un minuto después de que empiece a burbujear o use un filtro. Guárdela en recipientes limpios y tapados. Lave los tanques cada mes.'],
  ['Hidratación en clima caliente', 'Autocuidado',
    'En las horas de más calor tome agua con frecuencia, aunque no tenga sed. Evite el trabajo pesado al sol entre las 11:00 a. m. y las 3:00 p. m. Los niños y los adultos mayores necesitan más atención.'],
];

async function main() {
  // Sin --reset, si la base ya tiene tablas no se toca (así no se borran datos al reiniciar el servidor)
  const reiniciar = process.argv.includes('--reset');
  const { rows: existe } = await pool.query("SELECT to_regclass('public.usuarios') AS tabla");
  if (existe[0].tabla && !reiniciar) {
    console.log('La base de datos ya existe; no se modificó. Use npm run db:init para reiniciarla.');
    await pool.end();
    return;
  }
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(schema);

  const veredas = {};
  for (const [nombre, tipo] of VEREDAS) {
    const { rows } = await pool.query('INSERT INTO veredas (nombre, tipo) VALUES ($1, $2) RETURNING id', [nombre, tipo]);
    veredas[nombre] = rows[0].id;
  }
  for (const t of TIPOS) await pool.query('INSERT INTO tipos_solicitud (nombre) VALUES ($1)', [t]);
  for (const [nombre, tipo, vereda, direccion, horario, telefono, requisitos] of SERVICIOS) {
    await pool.query(
      'INSERT INTO servicios (nombre, tipo, vereda_id, direccion, horario, telefono, requisitos) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [nombre, tipo, veredas[vereda], direccion, horario, telefono, requisitos]);
  }

  // Cuentas de demostración (contraseña para todas: Prueba123)
  const hash = await bcrypt.hash('Prueba123', 10);
  const cuentas = [
    ['1000000001', 'María', 'Ejemplo Rural', 'usuario', 'Las Camelias'],
    ['1000000002', 'José', 'Ejemplo Gestor', 'gestor', 'Pueblo Nuevo'],
    ['1000000003', 'Laura', 'Ejemplo Profesional', 'profesional', 'Casco urbano'],
    ['1000000004', 'Andrés', 'Ejemplo Admin', 'admin', 'Casco urbano'],
  ];
  const ids = {};
  for (const [doc, nombres, apellidos, rol, vereda] of cuentas) {
    const { rows } = await pool.query(
      `INSERT INTO usuarios (tipo_documento, num_documento, nombres, apellidos, telefono, vereda_id, rol, hash_contrasena)
       VALUES ('CC', $1, $2, $3, '3000000000', $4, $5, $6) RETURNING id`,
      [doc, nombres, apellidos, veredas[vereda], rol, hash]);
    ids[rol] = rows[0].id;
    await pool.query("INSERT INTO consentimientos (usuario_id, version_politica, medio) VALUES ($1, '1.0', 'propio')", [ids[rol]]);
  }
  for (const [titulo, tema, cuerpo] of CONTENIDOS) {
    await pool.query('INSERT INTO contenidos (titulo, tema, cuerpo, autor_id) VALUES ($1, $2, $3, $4)',
      [titulo, tema, cuerpo, ids.profesional]);
  }

  // Una solicitud ya respondida para que la demostración tenga historial
  const { rows } = await pool.query(
    `INSERT INTO solicitudes (usuario_id, tipo_id, descripcion_cifrada, estado, profesional_id, registrada_por)
     VALUES ($1, 2, $2, 'respondida', $3, $1) RETURNING id`,
    [ids.usuario, cifrar('Buenos días. ¿Qué días están atendiendo en el puesto de salud de Las Camelias para control de tensión?'), ids.profesional]);
  await pool.query('INSERT INTO mensajes (solicitud_id, autor_id, contenido_cifrado) VALUES ($1, $2, $3)',
    [rows[0].id, ids.profesional, cifrar('Hola, María. El puesto de Las Camelias atiende martes y jueves en la mañana. Lleve su documento y el carné de afiliación.')]);

  console.log('Base de datos lista. Cuentas de prueba (contraseña Prueba123):');
  cuentas.forEach(([doc, nombres, , rol]) => console.log(`  ${rol.padEnd(12)} ${doc}  (${nombres})`));
  await pool.end();
}

main().catch(async (e) => {
  console.error('Error preparando la base de datos:', e.message);
  await pool.end();
  process.exit(1);
});
