import { useEffect, useState } from 'react';
import { sesion } from './api';
import { sincronizar, listarPendientes } from './cola';
import { useRuta, useConexion, ir } from './comunes';
import { Ingreso, Registro, Politica } from './pages/Acceso';
import { InicioUsuario, NuevaSolicitud, MisSolicitudes, DetalleSolicitud } from './pages/Usuario';
import { Directorio, Aprenda } from './pages/Informacion';
import { InicioGestor, RegistroAsistido, SolicitudAsistida } from './pages/Gestor';
import { Bandeja, DetalleProfesional, PublicarContenido } from './pages/Profesional';
import { Administracion } from './pages/Admin';

export default function App() {
  const ruta = useRuta();
  const enLinea = useConexion();
  const [usuario, setUsuario] = useState(sesion.usuario);
  const [pendientes, setPendientes] = useState(0);

  // Cuenta las solicitudes en cola y las envía cuando vuelve la conexión
  useEffect(() => {
    const contar = async () => setPendientes((await listarPendientes()).length);
    const intentar = async () => { await sincronizar(); contar(); };
    contar();
    intentar();
    window.addEventListener('online', intentar);
    window.addEventListener('cola-cambio', contar);
    const intervalo = setInterval(intentar, 60000);
    return () => {
      window.removeEventListener('online', intentar);
      window.removeEventListener('cola-cambio', contar);
      clearInterval(intervalo);
    };
  }, []);

  const entrar = (token, datos) => { sesion.guardar(token, datos); setUsuario(datos); ir('/'); };
  const salir = () => { sesion.cerrar(); setUsuario(null); ir('/'); };

  let pantalla;
  const [, seccion, id] = ruta.split('/');

  if (seccion === 'directorio') pantalla = <Directorio />;
  else if (seccion === 'aprenda') pantalla = <Aprenda />;
  else if (seccion === 'politica') pantalla = <Politica />;
  else if (!usuario) pantalla = seccion === 'registro' ? <Registro onEntrar={entrar} /> : <Ingreso onEntrar={entrar} />;
  else if (usuario.rol === 'usuario') {
    if (seccion === 'nueva') pantalla = <NuevaSolicitud />;
    else if (seccion === 'solicitudes' && id) pantalla = <DetalleSolicitud id={id} />;
    else if (seccion === 'solicitudes') pantalla = <MisSolicitudes />;
    else pantalla = <InicioUsuario usuario={usuario} pendientes={pendientes} />;
  } else if (usuario.rol === 'gestor') {
    if (seccion === 'registrar') pantalla = <RegistroAsistido />;
    else if (seccion === 'solicitud') pantalla = <SolicitudAsistida />;
    else pantalla = <InicioGestor usuario={usuario} pendientes={pendientes} />;
  } else if (usuario.rol === 'profesional') {
    if (seccion === 'solicitudes' && id) pantalla = <DetalleProfesional id={id} />;
    else if (seccion === 'publicar') pantalla = <PublicarContenido />;
    else pantalla = <Bandeja usuario={usuario} />;
  } else {
    pantalla = <Administracion seccion={seccion} />;
  }

  return (
    <div className="app">
      {!enLinea && (
        <div className="sin-conexion" role="status">
          Sin conexión. Puede ver el directorio y las guías; lo que escriba se enviará cuando vuelva la señal.
        </div>
      )}
      {pendientes > 0 && enLinea && <div className="sin-conexion">Enviando {pendientes} solicitud(es) guardada(s)…</div>}
      <main>{pantalla}</main>
      {usuario && (
        <footer className="pie">
          <span>{usuario.nombres} · {nombreRol(usuario.rol)}</span>
          <button className="enlace" onClick={salir}>Cerrar sesión</button>
        </footer>
      )}
    </div>
  );
}

function nombreRol(rol) {
  return { usuario: 'Usuario', gestor: 'Gestor comunitario', profesional: 'Profesional de salud', admin: 'Administrador' }[rol];
}
