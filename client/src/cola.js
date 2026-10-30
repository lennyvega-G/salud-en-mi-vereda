// Cola de solicitudes pendientes (IndexedDB). Si no hay señal, la solicitud se guarda en el teléfono
// y se envía sola cuando vuelve la conexión. El client_uuid evita que se duplique en el servidor.
import { api, ErrorRed } from './api';

const BD = 'salud-vereda';
const ALMACEN = 'pendientes';

function abrir() {
  return new Promise((resolve, reject) => {
    const peticion = indexedDB.open(BD, 1);
    peticion.onupgradeneeded = () => peticion.result.createObjectStore(ALMACEN, { keyPath: 'client_uuid' });
    peticion.onsuccess = () => resolve(peticion.result);
    peticion.onerror = () => reject(peticion.error);
  });
}

async function transaccion(modo, fn) {
  const bd = await abrir();
  return new Promise((resolve, reject) => {
    const tx = bd.transaction(ALMACEN, modo);
    const resultado = fn(tx.objectStore(ALMACEN));
    tx.oncomplete = () => resolve(resultado?.result);
    tx.onerror = () => reject(tx.error);
  });
}

export const listarPendientes = () => transaccion('readonly', (s) => s.getAll());
const guardar = (item) => transaccion('readwrite', (s) => s.put(item));
const quitar = (id) => transaccion('readwrite', (s) => s.delete(id));

function avisar() {
  window.dispatchEvent(new Event('cola-cambio'));
}

// Envía la solicitud; si no hay red, la deja en la cola. Devuelve { enviada: boolean }.
export async function enviarSolicitud(datos) {
  const item = { ...datos, client_uuid: crypto.randomUUID(), guardada_en: new Date().toISOString() };
  try {
    await api('/solicitudes', { metodo: 'POST', body: item });
    return { enviada: true };
  } catch (e) {
    if (!(e instanceof ErrorRed)) throw e;
    await guardar(item);
    avisar();
    return { enviada: false };
  }
}

let sincronizando = false;
export async function sincronizar() {
  if (sincronizando || !navigator.onLine) return 0;
  sincronizando = true;
  let enviadas = 0;
  try {
    for (const item of await listarPendientes()) {
      try {
        await api('/solicitudes', { metodo: 'POST', body: item });
        await quitar(item.client_uuid);
        enviadas += 1;
      } catch (e) {
        if (e instanceof ErrorRed) break; // se perdió la señal otra vez
        await quitar(item.client_uuid); // error de datos: se descarta para no bloquear la cola
      }
    }
  } finally {
    sincronizando = false;
    if (enviadas) avisar();
  }
  return enviadas;
}
