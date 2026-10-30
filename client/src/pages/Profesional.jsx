import { useState } from 'react';
import { api } from '../api';
import { Encabezado, Mensaje, Cargando, Estado, useDatos, fecha, ir } from '../comunes';
import { Conversacion } from './Usuario';

const FILTROS = [['', 'Todas'], ['recibida', 'Nuevas'], ['en_curso', 'En curso'], ['respondida', 'Respondidas'], ['cerrada', 'Cerradas']];

export function Bandeja({ usuario }) {
  const [estado, setEstado] = useState('recibida');
  const [vereda, setVereda] = useState('');
  const { datos: veredas } = useDatos('/veredas');
  const consulta = new URLSearchParams({ ...(estado && { estado }), ...(vereda && { vereda_id: vereda }) }).toString();
  const { datos, error } = useDatos(`/solicitudes${consulta ? `?${consulta}` : ''}`);

  return (
    <>
      <Encabezado titulo="Bandeja del profesional" />
      <section className="contenido">
        <p className="saludo">Hola, {usuario.nombres}</p>
        <div className="pestanas" role="tablist">
          {FILTROS.map(([valor, nombre]) => (
            <button key={valor} role="tab" aria-selected={estado === valor} className={estado === valor ? 'activa' : ''} onClick={() => setEstado(valor)}>{nombre}</button>
          ))}
        </div>
        <label className="filtro">Vereda
          <select value={vereda} onChange={(e) => setVereda(e.target.value)}>
            <option value="">Todas</option>
            {veredas?.map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
          </select>
        </label>
        <Mensaje tipo="error">{error}</Mensaje>
        {!datos && !error && <Cargando />}
        {datos?.length === 0 && <p>No hay solicitudes con este filtro.</p>}
        {datos?.map((s) => (
          <button key={s.id} className="tarjeta tarjeta-boton" onClick={() => ir(`/solicitudes/${s.id}`)}>
            <div className="fila"><strong>#{s.id} {s.tipo}</strong><Estado estado={s.estado} /></div>
            <small>{s.vereda} · {fecha(s.creado_en)}{s.asistida ? ' · Registrada por gestor' : ''}{s.profesional ? ` · ${s.profesional}` : ''}</small>
          </button>
        ))}
        <button className="secundario" onClick={() => ir('/publicar')}>Publicar una guía de salud</button>
      </section>
    </>
  );
}

export function DetalleProfesional({ id }) {
  const { datos, error, recargar } = useDatos(`/solicitudes/${id}`);
  const [aviso, setAviso] = useState('');

  async function cambiarEstado(estado) {
    setAviso('');
    try {
      await api(`/solicitudes/${id}`, { metodo: 'PATCH', body: { estado } });
      recargar();
    } catch (e) {
      setAviso(e.message);
    }
  }

  return (
    <>
      <Encabezado titulo={`Solicitud #${id}`} volver="/" />
      <section className="contenido">
        <Mensaje tipo="error">{error || aviso}</Mensaje>
        {!datos && !error && <Cargando />}
        {datos && (
          <>
            <div className="fila"><span>{datos.tipo} · {datos.vereda}</span><Estado estado={datos.estado} /></div>
            {datos.asistida && <p className="nota">Registrada por un gestor comunitario.</p>}
            <Conversacion solicitud={datos} propio={null} puedeEscribir={datos.estado !== 'cerrada'} onEnviado={recargar} />
            <div className="acciones">
              {datos.estado === 'recibida' && <button className="secundario" onClick={() => cambiarEstado('en_curso')}>Tomar la solicitud</button>}
              {datos.estado !== 'cerrada' && <button className="secundario" onClick={() => cambiarEstado('cerrada')}>Cerrar solicitud</button>}
            </div>
            <p className="nota">Recuerde: esta herramienta es solo para orientación. No se hacen diagnósticos ni se formulan medicamentos.</p>
          </>
        )}
      </section>
    </>
  );
}

export function PublicarContenido() {
  const [form, setForm] = useState({ titulo: '', tema: 'Autocuidado', cuerpo: '' });
  const [estado, setEstado] = useState({});
  async function enviar(e) {
    e.preventDefault();
    setEstado({});
    try {
      await api('/admin/contenidos', { metodo: 'POST', body: form });
      setEstado({ ok: 'La guía quedó publicada.' });
      setForm({ titulo: '', tema: 'Autocuidado', cuerpo: '' });
    } catch (err) {
      setEstado({ error: err.message });
    }
  }
  return (
    <>
      <Encabezado titulo="Publicar guía" volver="/" />
      <form className="contenido formulario" onSubmit={enviar}>
        <label>Título<input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} required /></label>
        <label>Tema
          <select value={form.tema} onChange={(e) => setForm({ ...form, tema: e.target.value })}>
            {['Autocuidado', 'Prevención', 'Trámites', 'Salud infantil', 'Adulto mayor'].map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
        <label>Contenido (lenguaje sencillo)
          <textarea rows={8} value={form.cuerpo} onChange={(e) => setForm({ ...form, cuerpo: e.target.value })} required minLength={20} />
        </label>
        <Mensaje tipo="error">{estado.error}</Mensaje>
        <Mensaje tipo="ok">{estado.ok}</Mensaje>
        <button className="principal">Publicar</button>
      </form>
    </>
  );
}
