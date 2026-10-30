// Cliente de la API. Guarda la sesión en el navegador y distingue los errores de red.

export class ErrorRed extends Error {}

export const sesion = {
  get token() { return localStorage.getItem('token'); },
  get usuario() {
    try { return JSON.parse(localStorage.getItem('usuario')); } catch { return null; }
  },
  guardar(token, usuario) {
    localStorage.setItem('token', token);
    localStorage.setItem('usuario', JSON.stringify(usuario));
  },
  cerrar() {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
  },
};

export async function api(ruta, { metodo = 'GET', body } = {}) {
  let respuesta;
  try {
    respuesta = await fetch(`/api${ruta}`, {
      method: metodo,
      headers: {
        'Content-Type': 'application/json',
        ...(sesion.token ? { Authorization: `Bearer ${sesion.token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ErrorRed('No hay conexión a internet.');
  }
  if (respuesta.status === 401 && sesion.token) {
    sesion.cerrar();
    window.location.hash = '#/';
    window.location.reload();
  }
  if (respuesta.status === 204) return null;
  const datos = await respuesta.json().catch(() => null);
  if (!respuesta.ok) throw new Error(datos?.error || 'No se pudo completar la operación.');
  return datos;
}
