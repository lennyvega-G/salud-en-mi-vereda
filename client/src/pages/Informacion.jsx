import { useState } from 'react';
import { Encabezado, Mensaje, Cargando, useDatos, fecha } from '../comunes';

const TIPOS = { hospital: 'Hospital', puesto_salud: 'Puesto de salud', brigada: 'Brigada', otro: 'Otro' };

export function Directorio() {
  const { datos, error } = useDatos('/servicios');
  const { datos: veredas } = useDatos('/veredas');
  const [vereda, setVereda] = useState('');
  const lista = (datos || []).filter((s) => !vereda || String(s.vereda_id) === vereda || s.tipo === 'hospital');

  return (
    <>
      <Encabezado titulo="¿Dónde me atienden?" volver="/" />
      <section className="contenido">
        <label className="filtro">Buscar por vereda
          <select value={vereda} onChange={(e) => setVereda(e.target.value)}>
            <option value="">Todas</option>
            {veredas?.map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
          </select>
        </label>
        <Mensaje tipo="error">{error && 'No hay conexión y el directorio todavía no se ha guardado en este teléfono.'}</Mensaje>
        {!datos && !error && <Cargando />}
        {lista.map((s) => (
          <article key={s.id} className="tarjeta">
            <div className="fila"><strong>{s.nombre}</strong><span className="etiqueta">{TIPOS[s.tipo]}</span></div>
            {s.vereda && <p>{s.vereda}{s.direccion ? ` · ${s.direccion}` : ''}</p>}
            {s.horario && <p>🕘 {s.horario}</p>}
            {s.telefono && <p>📞 <a href={`tel:${s.telefono.replace(/\s/g, '')}`}>{s.telefono}</a></p>}
            {s.requisitos && <p className="resumen">Llevar: {s.requisitos}</p>}
            <small>Actualizado: {fecha(s.actualizado_en)}</small>
          </article>
        ))}
        {datos && lista.length === 0 && <p>No hay servicios registrados para esa vereda.</p>}
      </section>
    </>
  );
}

export function Aprenda() {
  const { datos, error } = useDatos('/contenidos');
  const [abierto, setAbierto] = useState(null);
  return (
    <>
      <Encabezado titulo="Aprenda sobre su salud" volver="/" />
      <section className="contenido">
        <Mensaje tipo="error">{error && 'No hay conexión y las guías todavía no se han guardado en este teléfono.'}</Mensaje>
        {!datos && !error && <Cargando />}
        {datos?.map((c) => (
          <article key={c.id} className="tarjeta">
            <button className="tarjeta-titulo" aria-expanded={abierto === c.id} onClick={() => setAbierto(abierto === c.id ? null : c.id)}>
              <span>{c.titulo}</span><span className="etiqueta">{c.tema}</span>
            </button>
            {abierto === c.id && <p className="texto-largo">{c.cuerpo}</p>}
          </article>
        ))}
      </section>
    </>
  );
}
