import { useState } from 'react';
import { api } from '../api';
import { Encabezado, Mensaje, useDatos, ir } from '../comunes';

export function Ingreso({ onEntrar }) {
  const [form, setForm] = useState({ num_documento: '', password: '' });
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      const { token, usuario } = await api('/auth/login', { metodo: 'POST', body: form });
      onEntrar(token, usuario);
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <Encabezado titulo="Salud en mi Vereda" />
      <section className="contenido">
        <p className="intro">Información de los servicios de salud, preguntas de orientación y seguimiento de sus solicitudes.</p>
        <form onSubmit={enviar} className="formulario">
          <label>Número de documento
            <input inputMode="numeric" autoComplete="username" value={form.num_documento}
              onChange={(e) => setForm({ ...form, num_documento: e.target.value })} required />
          </label>
          <label>Contraseña
            <input type="password" autoComplete="current-password" value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          </label>
          <Mensaje tipo="error">{error}</Mensaje>
          <button className="principal" disabled={enviando}>{enviando ? 'Entrando…' : 'Entrar'}</button>
        </form>
        <button className="secundario" onClick={() => ir('/registro')}>Crear una cuenta</button>
        <div className="separador">Sin iniciar sesión también puede:</div>
        <button className="secundario" onClick={() => ir('/directorio')}>¿Dónde me atienden?</button>
        <button className="secundario" onClick={() => ir('/aprenda')}>Aprenda sobre su salud</button>
        <p className="nota">Prototipo académico — UNAD, Proyecto de Grado. Use solo datos de prueba.</p>
      </section>
    </>
  );
}

// Campos de registro que comparten el registro propio y el asistido
export function CamposPersona({ form, setForm }) {
  const { datos: veredas } = useDatos('/veredas');
  const cambiar = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });
  return (
    <>
      <label>Tipo de documento
        <select value={form.tipo_documento} onChange={cambiar('tipo_documento')}>
          <option value="CC">Cédula de ciudadanía</option>
          <option value="CE">Cédula de extranjería</option>
          <option value="PPT">Permiso por protección temporal</option>
        </select>
      </label>
      <label>Número de documento
        <input inputMode="numeric" value={form.num_documento} onChange={cambiar('num_documento')} required />
      </label>
      <label>Nombres<input value={form.nombres} onChange={cambiar('nombres')} required /></label>
      <label>Apellidos<input value={form.apellidos} onChange={cambiar('apellidos')} required /></label>
      <label>Teléfono (opcional)<input inputMode="tel" value={form.telefono} onChange={cambiar('telefono')} /></label>
      <label>Vereda o centro poblado
        <select value={form.vereda_id} onChange={cambiar('vereda_id')} required>
          <option value="">Seleccione…</option>
          {veredas?.map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
        </select>
      </label>
      <label>Contraseña (mínimo 6 caracteres)
        <input type="password" autoComplete="new-password" value={form.password} onChange={cambiar('password')} required minLength={6} />
      </label>
    </>
  );
}

export const personaVacia = {
  tipo_documento: 'CC', num_documento: '', nombres: '', apellidos: '', telefono: '', vereda_id: '', password: '', acepta_politica: false,
};

export function Registro({ onEntrar }) {
  const [form, setForm] = useState(personaVacia);
  const [error, setError] = useState('');

  async function enviar(e) {
    e.preventDefault();
    setError('');
    try {
      const { token, usuario } = await api('/auth/registro', { metodo: 'POST', body: form });
      onEntrar(token, usuario);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <Encabezado titulo="Crear cuenta" volver="/" />
      <form className="contenido formulario" onSubmit={enviar}>
        <CamposPersona form={form} setForm={setForm} />
        <label className="casilla">
          <input type="checkbox" checked={form.acepta_politica}
            onChange={(e) => setForm({ ...form, acepta_politica: e.target.checked })} />
          <span>Autorizo el tratamiento de mis datos según la <a href="#/politica">política de tratamiento de datos</a> (Ley 1581 de 2012).</span>
        </label>
        <Mensaje tipo="error">{error}</Mensaje>
        <button className="principal" disabled={!form.acepta_politica}>Crear cuenta</button>
      </form>
    </>
  );
}

export function Politica() {
  return (
    <>
      <Encabezado titulo="Tratamiento de datos" volver="/" />
      <section className="contenido texto-largo">
        <p><strong>Versión 1.0 — Prototipo académico.</strong></p>
        <p>Salud en mi Vereda es un prototipo desarrollado en el curso Proyecto de Grado de la Universidad Nacional Abierta y a Distancia (UNAD). No es un servicio de salud ni reemplaza la atención presencial.</p>
        <p><strong>Qué datos pedimos:</strong> tipo y número de documento, nombres, teléfono opcional, vereda y el texto de las solicitudes que usted escriba. No pedimos historia clínica.</p>
        <p><strong>Para qué:</strong> crear su cuenta, responder sus solicitudes de orientación y mostrarle su estado. Los reportes que ve el administrador no contienen datos personales.</p>
        <p><strong>Cómo los protegemos:</strong> las contraseñas se guardan cifradas, el texto de las solicitudes y mensajes se guarda cifrado y solo lo puede leer el profesional que atiende su caso. Toda la comunicación viaja por conexión segura (HTTPS) y cada acceso queda registrado.</p>
        <p><strong>Sus derechos:</strong> según la Ley 1581 de 2012 puede conocer, actualizar, rectificar y pedir que se eliminen sus datos, y revocar esta autorización, escribiendo a las responsables del proyecto.</p>
        <p>Durante las pruebas del prototipo solo se usan datos ficticios.</p>
      </section>
    </>
  );
}
