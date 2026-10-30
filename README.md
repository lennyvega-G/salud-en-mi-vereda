# Salud en mi Vereda

Prototipo funcional de una plataforma web de telesalud para las comunidades rurales de San Sebastián de Mariquita, Tolima. Permite consultar el directorio de servicios de salud, enviar solicitudes de orientación no clínica, hacer seguimiento a esas solicitudes y leer guías de autocuidado, incluso con conexión intermitente.

Proyecto de Grado, Ingeniería de Sistemas, Universidad Nacional Abierta y a Distancia (UNAD), grupo 73.
Autoras: Daniela Orjuela Velásquez y Lenny Yohana Vega Giraldo.

> Es un prototipo académico. No presta servicios de salud, no hace diagnósticos y no atiende urgencias. Use solo datos ficticios.

## Qué hace

| Requerimiento | Función en el prototipo |
| --- | --- |
| RF01 | Registro con aceptación de la política de tratamiento de datos (Ley 1581 de 2012) |
| RF02 | Inicio de sesión con número de documento y contraseña |
| RF03 | Directorio de servicios de salud por vereda, disponible sin conexión |
| RF04 | Envío de solicitudes de orientación, citas o trámites |
| RF05 | Mensajes entre la persona y el profesional asignado |
| RF06 | Estado de cada solicitud: recibida, en curso, respondida o cerrada |
| RF07 | Aviso de respuestas nuevas en la pantalla de inicio |
| RF08 | Guías de autocuidado que se guardan en el teléfono |
| RF09 | Registro y solicitudes asistidas por un gestor comunitario |
| RF10 | Bandeja del profesional con filtros por estado y vereda |
| RF11 | Administración de usuarios, roles, directorio y guías |
| RF12 | Registro de auditoría de accesos y acciones |
| RF13 | Reportes sin datos personales |
| RF14 | Aviso de que la plataforma no atiende urgencias (línea 123) |

Requerimientos no funcionales cubiertos: diseño para celular, aplicación web progresiva (PWA) que funciona sin conexión con cola de envíos, contraseñas con bcrypt, sesiones con JWT, permisos por rol, cifrado AES-256-GCM del texto de solicitudes y mensajes, consultas SQL parametrizadas, cabeceras de seguridad y límite de intentos de inicio de sesión.

## Tecnologías

- **Cliente:** React 18 con Vite, service worker propio e IndexedDB para la cola sin conexión.
- **Servidor:** Node.js 20 con Express 4 (API REST).
- **Base de datos:** PostgreSQL 16 con el controlador `pg`.
- **Pruebas:** `node:test` (20 casos de prueba de la API) y Playwright (recorrido y capturas en celular).
- **Integración continua:** GitHub Actions.
- **Despliegue:** Render (servicio web y PostgreSQL en plan gratuito).

## Estructura

```
client/          Aplicación web (React + PWA)
  public/sw.js   Service worker: caché de la app y de los datos públicos
  src/cola.js    Cola de solicitudes guardadas sin conexión
  src/pages/     Pantallas por rol
server/          API REST (Express)
  db/schema.sql  Tablas de la base de datos
  db/init.js     Creación de tablas y datos de prueba
  src/routes/    Rutas: auth, publico, solicitudes, gestor, admin
  test/          Casos de prueba CP01 a CP20
scripts/         Recorrido automático con capturas de pantalla
```

## Cómo ejecutarlo en el computador

Necesita [Node.js 20 o superior](https://nodejs.org) y [PostgreSQL 16](https://www.postgresql.org/download/).

1. Cree una base de datos llamada `salud_vereda` (por ejemplo, desde pgAdmin).
2. En la carpeta `server`, copie `.env.example` como `.env` y ajuste `DATABASE_URL` con su usuario y contraseña de PostgreSQL. Para `DATA_KEY` ejecute:
   ```
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
3. En la carpeta principal del proyecto:
   ```
   npm run instalar
   npm run db:init
   ```
4. Abra dos terminales:
   ```
   npm run dev:server
   npm run dev:client
   ```
5. Entre a http://localhost:5173

Para probar la versión instalable y sin conexión, compile y ejecute el servidor solo: `npm run build --prefix client` y luego `npm start`. La app queda en http://localhost:3000.

### Cuentas de prueba

Contraseña para todas: `Prueba123`

| Rol | Documento |
| --- | --- |
| Usuario rural | 1000000001 |
| Gestor comunitario | 1000000002 |
| Profesional de salud | 1000000003 |
| Administrador | 1000000004 |

## Pruebas

```
npm test
```

Ejecuta los casos CP01 a CP20 contra la base de datos (primero `npm run db:init`). Cada cambio que se sube a GitHub corre las pruebas, compila la aplicación y genera capturas de pantalla en la pestaña **Actions** (artefacto `capturas`).

## Despliegue en Render

1. Cree una cuenta en [render.com](https://render.com) con su usuario de GitHub.
2. Seleccione **New → Blueprint** y elija este repositorio. Render lee el archivo `render.yaml` y crea el servicio web y la base de datos.
3. Cuando termine, abra la dirección `https://salud-en-mi-vereda-xxxx.onrender.com`.

En el plan gratuito el servicio se apaga si no se usa por un rato; la primera visita puede tardar cerca de un minuto en responder.

## Licencia

MIT. Desarrollado con fines académicos.
