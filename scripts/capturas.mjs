// Recorre el prototipo en un celular simulado, toma capturas y mide el peso de la carga inicial.
// Uso: con el servidor encendido en http://localhost:3000 -> node scripts/capturas.mjs
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const CARPETA = 'capturas';
mkdirSync(CARPETA, { recursive: true });

const navegador = await chromium.launch();
const resultados = [];
let n = 0;

async function nuevoCelular() {
  const contexto = await navegador.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'es-CO', isMobile: true, hasTouch: true });
  const pagina = await contexto.newPage();
  pagina.on('pageerror', (e) => resultados.push(`ERROR JS: ${e.message}`));
  return { contexto, pagina };
}

async function captura(pagina, nombre) {
  n += 1;
  await pagina.waitForTimeout(400);
  await pagina.screenshot({ path: `${CARPETA}/${String(n).padStart(2, '0')}-${nombre}.png`, fullPage: true });
}

async function entrar(pagina, documento) {
  await pagina.goto(BASE);
  await pagina.getByLabel('Número de documento').fill(documento);
  await pagina.getByLabel('Contraseña').fill('Prueba123');
  await pagina.getByRole('button', { name: 'Entrar' }).click();
  await pagina.waitForSelector('.pie');
}

// ---------- Peso de la carga inicial (RNF02) ----------
{
  const { contexto, pagina } = await nuevoCelular();
  let bytes = 0;
  pagina.on('response', async (r) => { try { bytes += (await r.body()).length; } catch { /* sin cuerpo */ } });
  const cdp = await contexto.newCDPSession(pagina);
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 300, downloadThroughput: (750 * 1024) / 8, uploadThroughput: (250 * 1024) / 8 });
  const inicio = Date.now();
  await pagina.goto(BASE, { waitUntil: 'load' });
  await pagina.waitForSelector('text=Entrar');
  const segundos = (Date.now() - inicio) / 1000;
  resultados.push(`Carga inicial: ${(bytes / 1024).toFixed(0)} KB en ${segundos.toFixed(1)} s con red 3G simulada (750 kbps, 300 ms)`);
  await captura(pagina, 'ingreso');
  await pagina.getByRole('button', { name: 'Crear una cuenta' }).click();
  await captura(pagina, 'registro');
  await contexto.close();
}

// ---------- Usuario rural ----------
{
  const { contexto, pagina } = await nuevoCelular();
  await entrar(pagina, '1000000001');
  await captura(pagina, 'usuario-inicio');
  await pagina.getByRole('button', { name: /Pedir orientación/ }).click();
  await pagina.getByLabel('¿Qué necesita?').selectOption({ label: 'Orientación general' });
  await pagina.getByLabel('Cuéntenos su caso').fill('Buenas tardes. ¿Qué documentos debo llevar para la jornada de vacunación de mi hija?');
  await captura(pagina, 'usuario-nueva-solicitud');
  await pagina.getByRole('button', { name: 'Enviar' }).click();
  await pagina.waitForSelector('text=Su solicitud fue enviada');
  await captura(pagina, 'usuario-solicitud-enviada');
  await pagina.getByRole('button', { name: 'Ver mis solicitudes' }).click();
  await pagina.waitForSelector('.tarjeta-boton');
  await captura(pagina, 'usuario-mis-solicitudes');
  await pagina.locator('.tarjeta-boton').last().click();
  await pagina.waitForSelector('.burbuja');
  await captura(pagina, 'usuario-detalle-respondida');
  await pagina.goto(`${BASE}/#/directorio`);
  await pagina.waitForSelector('article');
  await captura(pagina, 'directorio');
  await pagina.goto(`${BASE}/#/aprenda`);
  await pagina.waitForSelector('article');
  await pagina.locator('.tarjeta-titulo').first().click();
  await captura(pagina, 'aprenda');

  // Modo sin conexión (RNF03): el service worker ya guardó la app, el directorio y las guías
  await pagina.goto(BASE);
  await pagina.waitForTimeout(1500);
  await pagina.reload();
  await pagina.goto(`${BASE}/#/directorio`);
  await pagina.waitForSelector('article');
  await pagina.goto(`${BASE}/#/aprenda`);
  await pagina.waitForSelector('article');
  await contexto.setOffline(true);
  await pagina.goto(`${BASE}/#/directorio`);
  await pagina.waitForSelector('article', { timeout: 5000 }).catch(() => resultados.push('FALLA: el directorio no abrió sin conexión'));
  await captura(pagina, 'sin-conexion-directorio');
  await pagina.goto(`${BASE}/#/nueva`);
  await pagina.getByLabel('¿Qué necesita?').selectOption({ index: 1 });
  await pagina.getByLabel('Cuéntenos su caso').fill('Pregunta escrita sin señal en la vereda.');
  await pagina.getByRole('button', { name: 'Enviar' }).click();
  await pagina.waitForSelector('text=quedó guardada en el teléfono', { timeout: 5000 })
    .then(() => resultados.push('Sin conexión: la solicitud quedó en la cola del teléfono'))
    .catch(() => resultados.push('FALLA: la solicitud sin conexión no quedó en cola'));
  await captura(pagina, 'sin-conexion-solicitud-guardada');
  await contexto.setOffline(false);
  await pagina.evaluate(() => window.dispatchEvent(new Event('online')));
  await pagina.waitForTimeout(2500);
  await pagina.goto(`${BASE}/#/solicitudes`);
  await pagina.waitForSelector('.tarjeta-boton');
  const pendientes = await pagina.locator('text=Guardada en el teléfono').count();
  resultados.push(pendientes === 0 ? 'Al volver la señal la solicitud se envió sola' : 'FALLA: la solicitud siguió en cola');
  await captura(pagina, 'conexion-recuperada');
  await contexto.close();
}

// ---------- Gestor comunitario ----------
{
  const { contexto, pagina } = await nuevoCelular();
  await entrar(pagina, '1000000002');
  await captura(pagina, 'gestor-inicio');
  await pagina.getByRole('button', { name: /Registrar a una persona/ }).click();
  await pagina.getByLabel('Número de documento').fill('1000000099');
  await pagina.getByLabel('Nombres').fill('Rosa');
  await pagina.getByLabel('Apellidos').fill('Ejemplo Asistida');
  await pagina.getByLabel('Vereda o centro poblado').selectOption({ label: 'Pueblo Nuevo' });
  await pagina.getByLabel(/Contraseña/).fill('Rosa2026');
  await pagina.locator('.casilla input').check();
  await captura(pagina, 'gestor-registro-asistido');
  await pagina.getByRole('button', { name: 'Registrar' }).click();
  await pagina.waitForSelector('text=quedó registrado');
  await pagina.goto(`${BASE}/#/solicitud`);
  await pagina.getByLabel('Documento de la persona').fill('1000000099');
  await pagina.getByRole('button', { name: 'Buscar' }).click();
  await pagina.getByLabel('¿Qué necesita?').selectOption({ label: 'Trámites y autorizaciones' });
  await pagina.getByLabel('Caso contado por la persona').fill('La señora necesita saber cómo pedir la autorización de un examen.');
  await pagina.getByRole('button', { name: 'Enviar solicitud' }).click();
  await pagina.waitForSelector('text=Solicitud enviada');
  await captura(pagina, 'gestor-solicitud-asistida');
  await contexto.close();
}

// ---------- Profesional de salud ----------
{
  const { contexto, pagina } = await nuevoCelular();
  await entrar(pagina, '1000000003');
  await pagina.waitForSelector('.tarjeta-boton');
  await captura(pagina, 'profesional-bandeja');
  await pagina.locator('.tarjeta-boton').first().click();
  await pagina.waitForSelector('.burbuja');
  await pagina.getByLabel('Escribir mensaje').fill('Hola. Lleve el documento de identidad de la niña y el carné de vacunas. La jornada es el sábado a las 8:00 a. m.');
  await pagina.getByRole('button', { name: 'Enviar mensaje' }).click();
  await pagina.waitForSelector('.estado-respondida');
  await captura(pagina, 'profesional-respuesta');
  await contexto.close();
}

// ---------- Administrador (pantalla de computador) ----------
{
  const contexto = await navegador.newContext({ viewport: { width: 1280, height: 800 }, locale: 'es-CO' });
  const pagina = await contexto.newPage();
  await entrar(pagina, '1000000004');
  await pagina.waitForSelector('.indicadores');
  await captura(pagina, 'admin-reportes');
  await pagina.getByRole('button', { name: 'Usuarios' }).click();
  await pagina.waitForSelector('table');
  await captura(pagina, 'admin-usuarios');
  await pagina.getByRole('button', { name: 'Directorio' }).click();
  await captura(pagina, 'admin-directorio');
  await pagina.getByRole('button', { name: 'Auditoría' }).click();
  await pagina.waitForSelector('table');
  await captura(pagina, 'admin-auditoria');
  await contexto.close();
}

await navegador.close();
writeFileSync(`${CARPETA}/resultados.txt`, resultados.join('\n') + '\n');
console.log(resultados.join('\n'));
if (resultados.some((r) => r.startsWith('FALLA') || r.startsWith('ERROR'))) process.exit(1);
