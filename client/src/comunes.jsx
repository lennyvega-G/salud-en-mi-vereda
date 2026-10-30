import { useCallback, useEffect, useState } from 'react';
import { api } from './api';

// Navegación simple por "hash" (#/ruta) para no depender de librerías externas
export function useRuta() {
  const leer = () => window.location.hash.replace(/^#/, '') || '/';
  const [ruta, setRuta] = useState(leer);
  useEffect(() => {
    const cambio = () => { setRuta(leer()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', cambio);
    return () => window.removeEventListener('hashchange', cambio);
  }, []);
  return ruta;
}
export const ir = (ruta) => { window.location.hash = `#${ruta}`; };

// Carga datos de la API y expone estado de carga y error
export function useDatos(ruta) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const cargar = useCallback(async () => {
    if (!ruta) return;
    setError('');
    try { setDatos(await api(ruta)); } catch (e) { setError(e.message); }
  }, [ruta]);
  useEffect(() => { cargar(); }, [cargar]);
  return { datos, error, recargar: cargar };
}

export function useConexion() {
  const [enLinea, setEnLinea] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setEnLinea(true);
    const off = () => setEnLinea(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return enLinea;
}

export function Encabezado({ titulo, volver }) {
  return (
    <header className="encabezado">
      {volver ? <button className="volver" onClick={() => ir(volver)} aria-label="Volver">←</button> : <span className="logo" aria-hidden>✚</span>}
      <h1>{titulo}</h1>
    </header>
  );
}

export function BotonGrande({ titulo, detalle, onClick, insignia }) {
  return (
    <button className="boton-grande" onClick={onClick}>
      <span className="boton-titulo">{titulo}{insignia ? <span className="insignia">{insignia}</span> : null}</span>
      {detalle && <span className="boton-detalle">{detalle}</span>}
    </button>
  );
}

export function Mensaje({ tipo = 'info', children }) {
  if (!children) return null;
  return <p className={`mensaje mensaje-${tipo}`} role={tipo === 'error' ? 'alert' : 'status'}>{children}</p>;
}

export const Cargando = () => <p className="cargando">Cargando…</p>;

const NOMBRES_ESTADO = { recibida: 'Recibida', en_curso: 'En curso', respondida: 'Respondida', cerrada: 'Cerrada', pendiente: 'Pendiente de envío' };
export const Estado = ({ estado }) => <span className={`estado estado-${estado}`}>{NOMBRES_ESTADO[estado] || estado}</span>;

export function fecha(valor) {
  return new Date(valor).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

export function AvisoUrgencias() {
  return (
    <p className="aviso-urgencias">
      Esta aplicación <strong>no atiende urgencias</strong>. Si es una emergencia llame al <a href="tel:123">123</a> o vaya al hospital.
    </p>
  );
}
