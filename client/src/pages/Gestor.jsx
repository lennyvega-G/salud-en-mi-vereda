import { useState } from 'react';
import { api } from '../api';
import { enviarSolicitud } from '../cola';
import { Encabezado, BotonGrande, Mensaje, Estado, AvisoUrgencias, useDatos, fecha, ir } from '../comunes';
import { CamposPersona, personaVacia } from './Acceso';

export function InicioGestor({ usuario, pendientes }) {
  const { datos } = useDatos('/solicitudes');
  return (
    <>
      <Encabezado titulo="Gestor comunitario" />
      <section className="contenido">
        <p className="saludo">Hola, {usuario.nombres}</p>
        <BotonGrande titulo="Registrar a una persona" detalle="Para quien no puede crear su cuenta solo" onClick={() => ir('/registrar')} />
        <BotonGrande titulo="Enviar una solicitud por otra persona" detalle={pendientes ? `${pendientes} esperando señal` : 'Busque a la persona por su documento'} onClick={() => ir('/solicitud')} />
        <BotonGrande titulo="¿Dónde me atienden?" detalle="Directorio de servicios" onClick={() => ir('/directorio')} />
        <h2>Solicitudes que he registrado</h2>
        <p className="nota">Por privacidad, aquí solo ve el estado. El contenido lo ve la persona y el profesional.</p>
        {datos?.length === 0 && <p>Aún no ha registrado solicitudes.</p>}
        {datos?.map((s) => (
          <div key={s.id} className="tarjeta">
            <div className="fila"><strong>#{s.id} {s.usuario}</strong><Estado estado={s.estado} /></div>
            <small>{s.tipo} · {s.vereda} · {fecha(s.creado_en)}</small>
          </div>
        ))}
      </section>
    </>
  );
}

export function RegistroAsistido() {
  const [form, setForm] = useState(personaVacia);
  const [estado, setEstado] = useState({ error: '', ok: '' });

  async function enviar(e) {
    e.preventDefault();
    setEstado({});
    try {
      const persona = await api('/gestor/personas', { metodo: 'POST', body: form });
      setEstado({ ok: `${persona.nombres} quedó registrado(a). Ya puede enviar solicitudes por esta persona.` });
      setForm(personaVacia);
    } catch (err) {
      setEstado({ error: err.message });
    }
  }

  return (
    <>
      <Encabezado titulo="Registrar a una persona" volver="/" />
      <form className="contenido formulario" onSubmit={enviar}>
        <CamposPersona form={form} setForm={setForm} />
        <label className="casilla">
          <input type="checkbox" checked={form.acepta_politica} onChange={(e) => setForm({ ...form, acepta_politica: e.target.checked })} />
          <span>Le leí a la persona la <a href="#/politica">política de tratamiento de datos</a> y aceptó que sus datos se registren.</span>
        </label>
        <Mensaje tipo="error">{estado.error}</Mensaje>
        <Mensaje tipo="ok">{estado.ok}</Mensaje>
        <button className="principal" disabled={!form.acepta_politica}>Registrar</button>
      </form>
    </>
  );
}

export function SolicitudAsistida() {
  const { datos: tipos } = useDatos('/tipos-solicitud');
  const [documento, setDocumento] = useState('');
  const [persona, setPersona] = useState(null);
  const [form, setForm] = useState({ tipo_id: '', descripcion: '' });
  const [estado, setEstado] = useState({});

  async function buscar(e) {
    e.preventDefault();
    setEstado({});
    setPersona(null);
    try {
      setPersona(await api(`/gestor/personas?documento=${encodeURIComponent(documento)}`));
    } catch (err) {
      setEstado({ error: err.message });
    }
  }

  async function enviar(e) {
    e.preventDefault();
    setEstado({});
    try {
      const { enviada } = await enviarSolicitud({ usuario_id: persona.id, tipo_id: Number(form.tipo_id), descripcion: form.descripcion });
      setEstado({ ok: enviada ? 'Solicitud enviada.' : 'Sin señal: la solicitud quedó guardada y se enviará al volver la conexión.' });
      setForm({ tipo_id: '', descripcion: '' });
    } catch (err) {
      setEstado({ error: err.message });
    }
  }

  return (
    <>
      <Encabezado titulo="Solicitud por otra persona" volver="/" />
      <section className="contenido">
        <form className="formulario" onSubmit={buscar}>
          <label>Documento de la persona
            <input inputMode="numeric" value={documento} onChange={(e) => setDocumento(e.target.value)} required />
          </label>
          <button className="secundario">Buscar</button>
        </form>
        {persona && (
          <form className="formulario" onSubmit={enviar}>
            <p className="tarjeta"><strong>{persona.nombres} {persona.apellidos}</strong><br />{persona.vereda}</p>
            <label>¿Qué necesita?
              <select value={form.tipo_id} onChange={(e) => setForm({ ...form, tipo_id: e.target.value })} required>
                <option value="">Seleccione…</option>
                {tipos?.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
              </select>
            </label>
            <label>Caso contado por la persona
              <textarea rows={5} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} required minLength={5} />
            </label>
            <AvisoUrgencias />
            <button className="principal">Enviar solicitud</button>
          </form>
        )}
        <Mensaje tipo="error">{estado.error}</Mensaje>
        <Mensaje tipo="ok">{estado.ok}</Mensaje>
      </section>
    </>
  );
}
