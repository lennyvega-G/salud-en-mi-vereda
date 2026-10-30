-- Esquema de la base de datos de Salud en mi Vereda (prototipo académico)
-- Se ejecuta completo con: npm run db:init

DROP TABLE IF EXISTS auditoria, mensajes, solicitudes, tipos_solicitud, contenidos,
  servicios, consentimientos, usuarios, veredas CASCADE;

CREATE TABLE veredas (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(80) NOT NULL UNIQUE,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('vereda', 'centro_poblado', 'casco_urbano'))
);

CREATE TABLE usuarios (
  id SERIAL PRIMARY KEY,
  tipo_documento VARCHAR(5) NOT NULL CHECK (tipo_documento IN ('CC', 'TI', 'CE', 'PPT')),
  num_documento VARCHAR(20) NOT NULL UNIQUE,
  nombres VARCHAR(80) NOT NULL,
  apellidos VARCHAR(80) NOT NULL,
  telefono VARCHAR(20),
  vereda_id INTEGER REFERENCES veredas(id),
  rol VARCHAR(15) NOT NULL DEFAULT 'usuario'
    CHECK (rol IN ('usuario', 'gestor', 'profesional', 'admin')),
  hash_contrasena VARCHAR(100) NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  registrado_por INTEGER REFERENCES usuarios(id),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ley 1581 de 2012: se guarda la autorización de tratamiento de datos
CREATE TABLE consentimientos (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  version_politica VARCHAR(10) NOT NULL,
  medio VARCHAR(10) NOT NULL CHECK (medio IN ('propio', 'asistido')),
  fecha TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE servicios (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  tipo VARCHAR(30) NOT NULL CHECK (tipo IN ('hospital', 'puesto_salud', 'brigada', 'otro')),
  direccion VARCHAR(160),
  horario VARCHAR(160),
  telefono VARCHAR(40),
  requisitos TEXT,
  vereda_id INTEGER REFERENCES veredas(id),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE contenidos (
  id SERIAL PRIMARY KEY,
  titulo VARCHAR(120) NOT NULL,
  tema VARCHAR(60) NOT NULL,
  cuerpo TEXT NOT NULL,
  autor_id INTEGER REFERENCES usuarios(id),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  publicado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE tipos_solicitud (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(60) NOT NULL UNIQUE
);

CREATE TABLE solicitudes (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  tipo_id INTEGER NOT NULL REFERENCES tipos_solicitud(id),
  profesional_id INTEGER REFERENCES usuarios(id),
  descripcion_cifrada TEXT NOT NULL,
  estado VARCHAR(12) NOT NULL DEFAULT 'recibida'
    CHECK (estado IN ('recibida', 'en_curso', 'respondida', 'cerrada')),
  registrada_por INTEGER REFERENCES usuarios(id),
  client_uuid UUID UNIQUE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE mensajes (
  id SERIAL PRIMARY KEY,
  solicitud_id INTEGER NOT NULL REFERENCES solicitudes(id) ON DELETE CASCADE,
  autor_id INTEGER NOT NULL REFERENCES usuarios(id),
  contenido_cifrado TEXT NOT NULL,
  leido BOOLEAN NOT NULL DEFAULT FALSE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE auditoria (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER REFERENCES usuarios(id),
  accion VARCHAR(40) NOT NULL,
  entidad VARCHAR(30),
  entidad_id INTEGER,
  ip VARCHAR(60),
  fecha TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_solicitudes_usuario ON solicitudes(usuario_id);
CREATE INDEX idx_solicitudes_estado ON solicitudes(estado);
CREATE INDEX idx_mensajes_solicitud ON mensajes(solicitud_id);
CREATE INDEX idx_auditoria_fecha ON auditoria(fecha DESC);
