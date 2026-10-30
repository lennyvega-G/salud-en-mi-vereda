// Pruebas funcionales de la API. Requieren una base de datos preparada con: npm run db:init
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const app = require('../src/app');
const { pool } = require('../src/db');

let servidor;
let base;
const tokens = {};

async function api(metodo, ruta, { token, body } = {}) {
  const res = await fetch(base + ruta, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const texto = await res.text();
  return { estado: res.status, datos: texto ? JSON.parse(texto) : null, headers: res.headers };
}

async function login(documento) {
  const r = await api('POST', '/api/auth/login', { body: { num_documento: documento, password: 'Prueba123' } });
  assert.equal(r.estado, 200, `login ${documento}`);
  return r.datos.token;
}

before(async () => {
  servidor = app.listen(0);
  base = `http://127.0.0.1:${servidor.address().port}`;
  tokens.usuario = await login('1000000001');
  tokens.gestor = await login('1000000002');
  tokens.profesional = await login('1000000003');
  tokens.admin = await login('1000000004');
});

after(async () => {
  servidor.close();
  await pool.end();
});

const documentoNuevo = () => String(2000000000 + Math.floor(Math.random() * 99999999));

test('CP01 - el registro exige aceptar la política de datos', async () => {
  const r = await api('POST', '/api/auth/registro', {
    body: { num_documento: documentoNuevo(), nombres: 'Ana', apellidos: 'Prueba', vereda_id: 2, password: 'clave123', acepta_politica: false },
  });
  assert.equal(r.estado, 400);
});

test('CP02 - registro con consentimiento crea la cuenta y guarda la autorización', async () => {
  const r = await api('POST', '/api/auth/registro', {
    body: { num_documento: documentoNuevo(), nombres: 'Ana', apellidos: 'Prueba', vereda_id: 2, password: 'clave123', acepta_politica: true },
  });
  assert.equal(r.estado, 201);
  assert.ok(r.datos.token);
  const c = await pool.query('SELECT medio FROM consentimientos WHERE usuario_id = $1', [r.datos.usuario.id]);
  assert.equal(c.rows[0].medio, 'propio');
});

test('CP03 - la contraseña se guarda cifrada con bcrypt', async () => {
  const { rows } = await pool.query("SELECT hash_contrasena FROM usuarios WHERE num_documento = '1000000001'");
  assert.match(rows[0].hash_contrasena, /^\$2[aby]\$10\$/);
});

test('CP04 - inicio de sesión con contraseña incorrecta es rechazado', async () => {
  const r = await api('POST', '/api/auth/login', { body: { num_documento: '1000000001', password: 'mala' } });
  assert.equal(r.estado, 401);
});

test('CP05 - las rutas privadas exigen sesión', async () => {
  const r = await api('GET', '/api/solicitudes');
  assert.equal(r.estado, 401);
});

test('CP06 - el directorio y los contenidos son públicos para guardarse sin conexión', async () => {
  const s = await api('GET', '/api/servicios');
  const c = await api('GET', '/api/contenidos');
  assert.equal(s.estado, 200);
  assert.ok(s.datos.length >= 1);
  assert.equal(c.estado, 200);
});

let solicitudId;
const uuid = crypto.randomUUID();

test('CP07 - el usuario crea una solicitud y el texto queda cifrado en la base de datos', async () => {
  const r = await api('POST', '/api/solicitudes', {
    token: tokens.usuario, body: { tipo_id: 1, descripcion: 'Quiero saber cuándo hay brigada en mi vereda', client_uuid: uuid },
  });
  assert.equal(r.estado, 201);
  solicitudId = r.datos.id;
  const { rows } = await pool.query('SELECT descripcion_cifrada FROM solicitudes WHERE id = $1', [solicitudId]);
  assert.ok(!rows[0].descripcion_cifrada.includes('brigada'));
});

test('CP08 - reenviar la misma solicitud desde la cola sin conexión no la duplica', async () => {
  const r = await api('POST', '/api/solicitudes', {
    token: tokens.usuario, body: { tipo_id: 1, descripcion: 'Quiero saber cuándo hay brigada en mi vereda', client_uuid: uuid },
  });
  assert.equal(r.estado, 200);
  assert.equal(r.datos.id, solicitudId);
});

test('CP09 - otra persona no puede ver la solicitud', async () => {
  const reg = await api('POST', '/api/auth/registro', {
    body: { num_documento: documentoNuevo(), nombres: 'Pedro', apellidos: 'Prueba', vereda_id: 3, password: 'clave123', acepta_politica: true },
  });
  const r = await api('GET', `/api/solicitudes/${solicitudId}`, { token: reg.datos.token });
  assert.equal(r.estado, 403);
});

test('CP10 - el administrador no puede leer el contenido de las solicitudes', async () => {
  const r = await api('GET', `/api/solicitudes/${solicitudId}`, { token: tokens.admin });
  assert.equal(r.estado, 403);
});

test('CP11 - el profesional responde y la solicitud pasa a "respondida"', async () => {
  const bandeja = await api('GET', '/api/solicitudes?estado=recibida', { token: tokens.profesional });
  assert.ok(bandeja.datos.some((s) => s.id === solicitudId));
  const r = await api('POST', `/api/solicitudes/${solicitudId}/mensajes`, {
    token: tokens.profesional, body: { contenido: 'La próxima brigada es el último sábado del mes.' },
  });
  assert.equal(r.estado, 201);
  const d = await api('GET', `/api/solicitudes/${solicitudId}`, { token: tokens.profesional });
  assert.equal(d.datos.estado, 'respondida');
});

test('CP12 - el usuario recibe el aviso de respuesta nueva y lo marca como leído', async () => {
  const antes = await api('GET', '/api/solicitudes/avisos', { token: tokens.usuario });
  assert.ok(antes.datos.nuevas >= 1);
  const d = await api('GET', `/api/solicitudes/${solicitudId}`, { token: tokens.usuario });
  assert.equal(d.datos.mensajes.at(-1).contenido, 'La próxima brigada es el último sábado del mes.');
  const despues = await api('GET', '/api/solicitudes/avisos', { token: tokens.usuario });
  assert.equal(despues.datos.nuevas, antes.datos.nuevas - 1);
});

test('CP13 - el profesional cierra la solicitud y ya no recibe mensajes', async () => {
  const r = await api('PATCH', `/api/solicitudes/${solicitudId}`, { token: tokens.profesional, body: { estado: 'cerrada' } });
  assert.equal(r.estado, 200);
  const m = await api('POST', `/api/solicitudes/${solicitudId}/mensajes`, { token: tokens.usuario, body: { contenido: 'Gracias' } });
  assert.equal(m.estado, 409);
});

test('CP14 - el gestor registra a una persona y le crea una solicitud (registro asistido)', async () => {
  const doc = documentoNuevo();
  const p = await api('POST', '/api/gestor/personas', {
    token: tokens.gestor, body: { num_documento: doc, nombres: 'Rosa', apellidos: 'Prueba', vereda_id: 9, password: 'clave123', acepta_politica: true },
  });
  assert.equal(p.estado, 201);
  const c = await pool.query('SELECT medio FROM consentimientos WHERE usuario_id = $1', [p.datos.id]);
  assert.equal(c.rows[0].medio, 'asistido');
  const buscada = await api('GET', `/api/gestor/personas?documento=${doc}`, { token: tokens.gestor });
  assert.equal(buscada.datos.id, p.datos.id);
  const s = await api('POST', '/api/solicitudes', {
    token: tokens.gestor, body: { usuario_id: p.datos.id, tipo_id: 3, descripcion: 'Necesita saber cómo pedir una autorización' },
  });
  assert.equal(s.estado, 201);
});

test('CP15 - un usuario común no puede entrar a la administración', async () => {
  const r = await api('GET', '/api/admin/usuarios', { token: tokens.usuario });
  assert.equal(r.estado, 403);
});

test('CP16 - las acciones quedan en la auditoría y los reportes no exponen datos personales', async () => {
  const a = await api('GET', '/api/admin/auditoria', { token: tokens.admin });
  assert.ok(a.datos.some((e) => e.accion === 'crear_solicitud'));
  const rep = await api('GET', '/api/admin/reportes', { token: tokens.admin });
  assert.equal(rep.estado, 200);
  assert.ok(!JSON.stringify(rep.datos).includes('brigada'));
});

test('CP17 - el administrador agrega un servicio al directorio', async () => {
  const r = await api('POST', '/api/admin/servicios', {
    token: tokens.admin, body: { nombre: 'Jornada de vacunación (prueba)', tipo: 'brigada', vereda_id: 4, horario: 'Sábado 8:00 a. m.' },
  });
  assert.equal(r.estado, 201);
});

test('CP18 - la API envía cabeceras de seguridad', async () => {
  const r = await api('GET', '/api/salud');
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(r.headers.get('x-frame-options'), 'DENY');
  assert.equal(r.headers.get('x-powered-by'), null);
});

test('CP19 - datos inválidos devuelven un mensaje claro', async () => {
  const r = await api('POST', '/api/solicitudes', { token: tokens.usuario, body: { tipo_id: 1, descripcion: 'ok' } });
  assert.equal(r.estado, 400);
  assert.match(r.datos.error, /descripción/);
});

test('CP20 - se bloquean los intentos repetidos de inicio de sesión', async () => {
  let ultimo;
  for (let i = 0; i < 12; i += 1) {
    ultimo = await api('POST', '/api/auth/login', { body: { num_documento: '1999999999', password: 'x' } });
  }
  assert.equal(ultimo.estado, 429);
});
