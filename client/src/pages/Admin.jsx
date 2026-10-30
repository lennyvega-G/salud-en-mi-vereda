import { useState } from 'react';
import { api } from '../api';
import { Encabezado, Mensaje, Cargando, useDatos, fecha, ir } from '../comunes';

const NOMBRES_ESTADO = { recibida: 'Recibidas', en_curso: 'En curso', respondida: 'Respondidas', cerrada: 'Cerradas' };
const SECCIONES = [['reportes', 'Reportes'], ['usuarios', 'Usuarios'], ['servicios', 'Directorio'], ['contenidos', 'Guías'], ['auditoria', 'Auditoría']];

export function Administracion({ seccion }) {
  const actual = SECCIONES.some(([s]) => s === seccion) ? seccion : 'reportes';
  return (
    <>
      <Encabezado titulo="Administración" />
      <section className="contenido ancho">
        <nav className="pestanas">
          {SECCIONES.map(([s, nombre]) => (
            <button key={s} className={actual === s ? 'activa' : ''} onClick={() => ir(`/${s}`)}>{nombre}</button>
          ))}
        </nav>
        {actual === 'reportes' && <Reportes />}
        {actual === 'usuarios' && <Usuarios />}
        {actual === 'servicios' && <Servicios />}
        {actual === 'contenidos' && <Contenidos />}
        {actual === 'auditoria' && <Auditoria />}
      </section>
    </>
  );
}

function Barras({ filas, etiqueta }) {
  const max = Math.max(1, ...filas.map((f) => f.total));
  return (
    <div className="barras">
      {filas.map((f) => (
        <div key={f[etiqueta]} className="barra-fila">
          <span>{f[etiqueta]}</span>
          <div className="barra"><div style={{ width: `${(f.total / max) * 100}%` }} /></div>
          <strong>{f.total}</strong>
        </div>
      ))}
    </div>
  );
}

function Reportes() {
  const { datos, error } = useDatos('/admin/reportes');
  if (error) return <Mensaje tipo="error">{error}</Mensaje>;
  if (!datos) return <Cargando />;
  const t = datos.totales;
  return (
    <>
      <div className="indicadores">
        <div><strong>{t.usuarios}</strong><span>Usuarios</span></div>
        <div><strong>{t.solicitudes}</strong><span>Solicitudes</span></div>
        <div><strong>{t.asistidas}</strong><span>Asistidas</span></div>
        <div><strong>{t.horas_primera_respuesta ?? '—'}</strong><span>Horas a 1.ª respuesta</span></div>
      </div>
      <h2>Por estado</h2><Barras filas={datos.porEstado.map((f) => ({ ...f, estado: NOMBRES_ESTADO[f.estado] || f.estado }))} etiqueta="estado" />
      <h2>Por tipo</h2><Barras filas={datos.porTipo} etiqueta="tipo" />
      <h2>Por vereda</h2><Barras filas={datos.porVereda} etiqueta="vereda" />
      <p className="nota">Los reportes no muestran datos personales ni el contenido de las solicitudes.</p>
    </>
  );
}

function Usuarios() {
  const { datos, error, recargar } = useDatos('/admin/usuarios');
  const [aviso, setAviso] = useState({});
  const [form, setForm] = useState({ rol: 'profesional', num_documento: '', nombres: '', apellidos: '', password: '' });

  async function actualizar(id, cambios) {
    setAviso({});
    try { await api(`/admin/usuarios/${id}`, { metodo: 'PATCH', body: cambios }); recargar(); } catch (e) { setAviso({ error: e.message }); }
  }
  async function crear(e) {
    e.preventDefault();
    setAviso({});
    try {
      await api('/admin/usuarios', { metodo: 'POST', body: form });
      setAviso({ ok: 'Cuenta creada.' });
      setForm({ ...form, num_documento: '', nombres: '', apellidos: '', password: '' });
      recargar();
    } catch (err) { setAviso({ error: err.message }); }
  }

  return (
    <>
      <details className="tarjeta">
        <summary>Crear cuenta de personal</summary>
        <form className="formulario" onSubmit={crear}>
          <label>Rol
            <select value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value })}>
              <option value="profesional">Profesional de salud</option>
              <option value="gestor">Gestor comunitario</option>
              <option value="admin">Administrador</option>
            </select>
          </label>
          <label>Documento<input value={form.num_documento} onChange={(e) => setForm({ ...form, num_documento: e.target.value })} required /></label>
          <label>Nombres<input value={form.nombres} onChange={(e) => setForm({ ...form, nombres: e.target.value })} required /></label>
          <label>Apellidos<input value={form.apellidos} onChange={(e) => setForm({ ...form, apellidos: e.target.value })} required /></label>
          <label>Contraseña inicial<input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} /></label>
          <button className="principal">Crear</button>
        </form>
      </details>
      <Mensaje tipo="error">{error || aviso.error}</Mensaje>
      <Mensaje tipo="ok">{aviso.ok}</Mensaje>
      {!datos && !error && <Cargando />}
      <div className="tabla-scroll">
        <table>
          <thead><tr><th>Nombre</th><th>Documento</th><th>Vereda</th><th>Rol</th><th>Activo</th></tr></thead>
          <tbody>
            {datos?.map((u) => (
              <tr key={u.id}>
                <td>{u.nombres} {u.apellidos}</td>
                <td>{u.tipo_documento} {u.num_documento}</td>
                <td>{u.vereda || '—'}</td>
                <td>
                  <select value={u.rol} aria-label="Rol" onChange={(e) => actualizar(u.id, { rol: e.target.value })}>
                    <option value="usuario">Usuario</option><option value="gestor">Gestor</option>
                    <option value="profesional">Profesional</option><option value="admin">Admin</option>
                  </select>
                </td>
                <td><input type="checkbox" aria-label="Activo" checked={u.activo} onChange={(e) => actualizar(u.id, { activo: e.target.checked })} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

const servicioVacio = { nombre: '', tipo: 'puesto_salud', vereda_id: '', direccion: '', horario: '', telefono: '', requisitos: '' };

function Servicios() {
  const { datos, recargar } = useDatos('/servicios');
  const { datos: veredas } = useDatos('/veredas');
  const [form, setForm] = useState(servicioVacio);
  const [editando, setEditando] = useState(null);
  const [aviso, setAviso] = useState({});
  const campo = (c) => (e) => setForm({ ...form, [c]: e.target.value });

  async function guardar(e) {
    e.preventDefault();
    setAviso({});
    try {
      await api(editando ? `/admin/servicios/${editando}` : '/admin/servicios', { metodo: editando ? 'PUT' : 'POST', body: form });
      setAviso({ ok: 'Directorio actualizado.' });
      setForm(servicioVacio);
      setEditando(null);
      recargar();
    } catch (err) { setAviso({ error: err.message }); }
  }
  async function retirar(id) {
    if (!window.confirm('¿Retirar este servicio del directorio?')) return;
    await api(`/admin/servicios/${id}`, { metodo: 'DELETE' });
    recargar();
  }

  return (
    <>
      <form className="formulario tarjeta" onSubmit={guardar}>
        <strong>{editando ? 'Editar servicio' : 'Agregar servicio'}</strong>
        <label>Nombre<input value={form.nombre} onChange={campo('nombre')} required /></label>
        <label>Tipo
          <select value={form.tipo} onChange={campo('tipo')}>
            <option value="hospital">Hospital</option><option value="puesto_salud">Puesto de salud</option>
            <option value="brigada">Brigada</option><option value="otro">Otro</option>
          </select>
        </label>
        <label>Vereda
          <select value={form.vereda_id || ''} onChange={campo('vereda_id')}>
            <option value="">—</option>
            {veredas?.map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
          </select>
        </label>
        <label>Dirección<input value={form.direccion || ''} onChange={campo('direccion')} /></label>
        <label>Horario<input value={form.horario || ''} onChange={campo('horario')} /></label>
        <label>Teléfono<input value={form.telefono || ''} onChange={campo('telefono')} /></label>
        <label>Requisitos<textarea rows={2} value={form.requisitos || ''} onChange={campo('requisitos')} /></label>
        <Mensaje tipo="error">{aviso.error}</Mensaje>
        <Mensaje tipo="ok">{aviso.ok}</Mensaje>
        <button className="principal">Guardar</button>
        {editando && <button type="button" className="secundario" onClick={() => { setEditando(null); setForm(servicioVacio); }}>Cancelar</button>}
      </form>
      {datos?.map((s) => (
        <div key={s.id} className="tarjeta">
          <div className="fila"><strong>{s.nombre}</strong><span className="etiqueta">{s.vereda}</span></div>
          <small>{s.horario}</small>
          <div className="acciones">
            <button className="enlace" onClick={() => { setEditando(s.id); setForm({ ...servicioVacio, ...s }); window.scrollTo(0, 0); }}>Editar</button>
            <button className="enlace peligro" onClick={() => retirar(s.id)}>Retirar</button>
          </div>
        </div>
      ))}
    </>
  );
}

function Contenidos() {
  const { datos, recargar } = useDatos('/contenidos');
  async function retirar(id) {
    if (!window.confirm('¿Retirar esta guía?')) return;
    await api(`/admin/contenidos/${id}`, { metodo: 'DELETE' });
    recargar();
  }
  return (
    <>
      <p className="nota">Los profesionales de salud publican las guías desde su bandeja. Aquí puede retirarlas.</p>
      {datos?.map((c) => (
        <div key={c.id} className="tarjeta">
          <div className="fila"><strong>{c.titulo}</strong><span className="etiqueta">{c.tema}</span></div>
          <small>{fecha(c.publicado_en)}</small>
          <div className="acciones"><button className="enlace peligro" onClick={() => retirar(c.id)}>Retirar</button></div>
        </div>
      ))}
    </>
  );
}

const ACCIONES = {
  login: 'Inicio de sesión', login_fallido: 'Intento fallido de sesión', registro: 'Registro', registro_asistido: 'Registro asistido',
  crear_solicitud: 'Creó solicitud', crear_solicitud_asistida: 'Creó solicitud asistida', ver_solicitud: 'Consultó solicitud',
  enviar_mensaje: 'Envió mensaje', estado_en_curso: 'Tomó solicitud', estado_cerrada: 'Cerró solicitud',
};

function Auditoria() {
  const { datos, error } = useDatos('/admin/auditoria');
  if (error) return <Mensaje tipo="error">{error}</Mensaje>;
  if (!datos) return <Cargando />;
  return (
    <div className="tabla-scroll">
      <table>
        <thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Elemento</th></tr></thead>
        <tbody>
          {datos.map((a) => (
            <tr key={a.id}>
              <td>{fecha(a.fecha)}</td>
              <td>{a.usuario}{a.rol ? ` (${a.rol})` : ''}</td>
              <td>{ACCIONES[a.accion] || a.accion.replaceAll('_', ' ')}</td>
              <td>{a.entidad ? `${a.entidad} #${a.entidad_id}` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
