import { useEffect, useState } from 'react';
import { api } from '../api';
import { enviarSolicitud, listarPendientes } from '../cola';
import { Encabezado, BotonGrande, Mensaje, Cargando, Estado, AvisoUrgencias, useDatos, fecha, ir } from '../comunes';

export function InicioUsuario({ usuario, pendientes }) {
  const { datos: avisos } = useDatos('/solicitudes/avisos');
  const nuevas = avisos?.nuevas || 0;
  return (
    <>
      <Encabezado titulo="Salud en mi Vereda" />
      <section className="contenido">
        <p className="saludo">Hola, {usuario.nombres}</p>
        <BotonGrande titulo="Pedir orientación" detalle="Escriba su pregunta a un profesional" onClick={() => ir('/nueva')} />
        <BotonGrande titulo="Mis solicitudes" onClick={() => ir('/solicitudes')} insignia={nuevas || null}
          detalle={nuevas ? `${nuevas} respuesta(s) nueva(s)` : pendientes ? `${pendientes} esperando señal para enviarse` : 'Vea en qué va cada una'} />
        <BotonGrande titulo="¿Dónde me atienden?" detalle="Puestos de salud, horarios y teléfonos" onClick={() => ir('/directorio')} />
        <BotonGrande titulo="Aprenda sobre su salud" detalle="Guías disponibles sin internet" onClick={() => ir('/aprenda')} />
      </section>
    </>
  );
}

export function NuevaSolicitud() {
  const { datos: tipos } = useDatos('/tipos-solicitud');
  const [form, setForm] = useState({ tipo_id: '', descripcion: '' });
  const [estado, setEstado] = useState({ error: '', ok: '' });
  const [enviando, setEnviando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    setEnviando(true);
    setEstado({ error: '', ok: '' });
    try {
      const { enviada } = await enviarSolicitud({ tipo_id: Number(form.tipo_id), descripcion: form.descripcion });
      setEstado({ ok: enviada
        ? 'Su solicitud fue enviada. Le avisaremos cuando tenga respuesta.'
        : 'No hay señal. La solicitud quedó guardada en el teléfono y se enviará sola cuando vuelva la conexión.' });
      setForm({ tipo_id: '', descripcion: '' });
    } catch (err) {
      setEstado({ error: err.message });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <Encabezado titulo="Nueva solicitud" volver="/" />
      <form className="contenido formulario" onSubmit={enviar}>
        <label>¿Qué necesita?
          <select value={form.tipo_id} onChange={(e) => setForm({ ...form, tipo_id: e.target.value })} required>
            <option value="">Seleccione…</option>
            {tipos?.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
        </label>
        <label>Cuéntenos su caso
          <textarea rows={5} maxLength={1000} value={form.descripcion} placeholder="Escriba aquí su pregunta"
            onChange={(e) => setForm({ ...form, descripcion: e.target.value })} required minLength={5} />
        </label>
        <AvisoUrgencias />
        <Mensaje tipo="error">{estado.error}</Mensaje>
        <Mensaje tipo="ok">{estado.ok}</Mensaje>
        <button className="principal" disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar'}</button>
        {estado.ok && <button type="button" className="secundario" onClick={() => ir('/solicitudes')}>Ver mis solicitudes</button>}
      </form>
    </>
  );
}

export function MisSolicitudes() {
  const { datos, error } = useDatos('/solicitudes');
  const [pendientes, setPendientes] = useState([]);
  useEffect(() => {
    const cargar = async () => setPendientes(await listarPendientes());
    cargar();
    window.addEventListener('cola-cambio', cargar);
    return () => window.removeEventListener('cola-cambio', cargar);
  }, []);

  return (
    <>
      <Encabezado titulo="Mis solicitudes" volver="/" />
      <section className="contenido">
        <Mensaje tipo="error">{error}</Mensaje>
        {pendientes.map((p) => (
          <div key={p.client_uuid} className="tarjeta">
            <div className="fila"><strong>Guardada en el teléfono</strong><Estado estado="pendiente" /></div>
            <p className="resumen">{p.descripcion}</p>
          </div>
        ))}
        {!datos && !error && <Cargando />}
        {datos?.length === 0 && pendientes.length === 0 && <p>Todavía no tiene solicitudes.</p>}
        {datos?.map((s) => (
          <button key={s.id} className="tarjeta tarjeta-boton" onClick={() => ir(`/solicitudes/${s.id}`)}>
            <div className="fila"><strong>#{s.id} {s.tipo}</strong><Estado estado={s.estado} /></div>
            <small>{fecha(s.actualizado_en)}{s.nuevas ? ` · ${s.nuevas} respuesta(s) nueva(s)` : ''}</small>
          </button>
        ))}
      </section>
    </>
  );
}

// Conversación de una solicitud (la usan el usuario y el profesional)
export function Conversacion({ solicitud, puedeEscribir, onEnviado, propio }) {
  const [texto, setTexto] = useState('');
  const [error, setError] = useState('');
  async function enviar(e) {
    e.preventDefault();
    setError('');
    try {
      await api(`/solicitudes/${solicitud.id}/mensajes`, { metodo: 'POST', body: { contenido: texto } });
      setTexto('');
      onEnviado();
    } catch (err) {
      setError(err.message);
    }
  }
  return (
    <>
      <div className="burbuja burbuja-usuario">
        <small>{solicitud.usuario} · {fecha(solicitud.creado_en)}</small>
        <p>{solicitud.descripcion}</p>
      </div>
      {solicitud.mensajes.map((m) => (
        <div key={m.id} className={`burbuja ${m.autor_rol === 'profesional' ? 'burbuja-profesional' : 'burbuja-usuario'}`}>
          <small>{m.autor_id === propio ? 'Usted' : m.autor} · {fecha(m.creado_en)}</small>
          <p>{m.contenido}</p>
        </div>
      ))}
      {puedeEscribir && (
        <form onSubmit={enviar} className="formulario">
          <label>Escribir mensaje
            <textarea rows={3} maxLength={1000} value={texto} onChange={(e) => setTexto(e.target.value)} required />
          </label>
          <Mensaje tipo="error">{error}</Mensaje>
          <button className="principal">Enviar mensaje</button>
        </form>
      )}
    </>
  );
}

export function DetalleSolicitud({ id }) {
  const { datos, error, recargar } = useDatos(`/solicitudes/${id}`);
  return (
    <>
      <Encabezado titulo={`Solicitud #${id}`} volver="/solicitudes" />
      <section className="contenido">
        <Mensaje tipo="error">{error}</Mensaje>
        {!datos && !error && <Cargando />}
        {datos && (
          <>
            <div className="fila"><span>{datos.tipo}</span><Estado estado={datos.estado} /></div>
            <Conversacion solicitud={datos} propio={datos.usuario_id} puedeEscribir={datos.estado !== 'cerrada'} onEnviado={recargar} />
            <AvisoUrgencias />
          </>
        )}
      </section>
    </>
  );
}
