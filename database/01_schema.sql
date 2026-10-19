-- =====================================================================
-- SGP Serfamilia · Esquema PostgreSQL 16
-- Convenciones: PK uuid · dinero NUMERIC(14,2) · timestamptz
--               baja lógica (deleted_at) solo en usuarios y proyectos
--               ON DELETE RESTRICT en todo el Marco Lógico
-- SQL puro (sin meta-comandos de psql) para poder usarlo en Docker,
-- en una migración de TypeORM o en cualquier cliente.
-- =====================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS citext;     -- emails sin distinguir mayúsculas
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- crypt() para el seed de desarrollo

-- ---------------------------------------------------------------------
-- 1. TIPOS ENUMERADOS
-- ---------------------------------------------------------------------
CREATE TYPE rol_usuario      AS ENUM ('DIRECTOR', 'TECNICO', 'FINANCIADOR');
CREATE TYPE moneda_tipo      AS ENUM ('BOB', 'USD');
CREATE TYPE estado_proyecto  AS ENUM ('PLANIFICACION', 'EN_EJECUCION', 'PAUSADO', 'CERRADO');
CREATE TYPE estado_actividad AS ENUM ('PENDIENTE', 'EN_CURSO', 'COMPLETADA', 'RETRASADA');  -- RN-11, RF-15
CREATE TYPE estado_tarea     AS ENUM ('PENDIENTE', 'EN_CURSO', 'COMPLETADA');
CREATE TYPE estado_avance    AS ENUM ('BORRADOR', 'ENVIADO', 'APROBADO', 'OBSERVADO', 'ANULADO');
CREATE TYPE estado_tramo     AS ENUM ('PENDIENTE', 'HABILITADO', 'DESEMBOLSADO');
CREATE TYPE tipo_condicion   AS ENUM ('IOV', 'RESULTADO', 'PROYECTO');

-- ---------------------------------------------------------------------
-- 2. FUNCIÓN GENÉRICA updated_at
-- ---------------------------------------------------------------------
CREATE FUNCTION fn_set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

-- ---------------------------------------------------------------------
-- 3. IDENTIDAD Y ACCESO
-- ---------------------------------------------------------------------
CREATE TABLE financiadores (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre     varchar(200) NOT NULL,
  contacto   varchar(200),
  email      citext,
  activo     boolean      NOT NULL DEFAULT true,
  created_at timestamptz  NOT NULL DEFAULT now(),
  updated_at timestamptz  NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_financiadores_nombre ON financiadores (lower(nombre));

CREATE TABLE usuarios (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email                 citext       NOT NULL,
  password_hash         varchar(100) NOT NULL,            -- bcrypt, costo >= 12 (ADR-004)
  nombre                varchar(150) NOT NULL,
  rol                   rol_usuario  NOT NULL,
  financiador_id        uuid REFERENCES financiadores (id) ON DELETE RESTRICT,
  activo                boolean      NOT NULL DEFAULT true,
  intentos_fallidos     smallint     NOT NULL DEFAULT 0 CHECK (intentos_fallidos >= 0),
  bloqueado_hasta       timestamptz,
  debe_cambiar_password boolean      NOT NULL DEFAULT false,
  ultimo_login_at       timestamptz,
  created_at            timestamptz  NOT NULL DEFAULT now(),
  updated_at            timestamptz  NOT NULL DEFAULT now(),
  deleted_at            timestamptz,
  -- un usuario FINANCIADOR pertenece a un financiador; los demás roles no
  CONSTRAINT ck_usuario_financiador CHECK ((rol = 'FINANCIADOR') = (financiador_id IS NOT NULL))
);
CREATE UNIQUE INDEX uq_usuarios_email ON usuarios (email) WHERE deleted_at IS NULL;
CREATE INDEX ix_usuarios_rol ON usuarios (rol) WHERE deleted_at IS NULL;
CREATE INDEX ix_usuarios_financiador ON usuarios (financiador_id) WHERE financiador_id IS NOT NULL;

-- Refresh tokens rotativos (ADR-004). familia_id permite revocar toda la
-- cadena si se detecta reutilización de un token ya rotado.
CREATE TABLE refresh_tokens (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id     uuid        NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  familia_id     uuid        NOT NULL,
  token_hash     char(64)    NOT NULL UNIQUE,              -- SHA-256 hex del token
  expira_at      timestamptz NOT NULL,
  revocado_at    timestamptz,
  reemplazado_por uuid REFERENCES refresh_tokens (id) ON DELETE SET NULL,
  ip             inet,
  user_agent     varchar(300),
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_refresh_usuario ON refresh_tokens (usuario_id);
CREATE INDEX ix_refresh_familia ON refresh_tokens (familia_id);

CREATE TABLE password_reset_tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid        NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  token_hash char(64)    NOT NULL UNIQUE,
  expira_at  timestamptz NOT NULL,
  usado_at   timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_reset_usuario ON password_reset_tokens (usuario_id);

-- ---------------------------------------------------------------------
-- 4. PROYECTOS Y EQUIPO
-- ---------------------------------------------------------------------
CREATE TABLE proyectos (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo            varchar(30)      NOT NULL,
  nombre            varchar(250)     NOT NULL,
  descripcion       text,
  objetivo_general  text,
  financiador_id    uuid             NOT NULL REFERENCES financiadores (id) ON DELETE RESTRICT,
  presupuesto_total numeric(14,2)    NOT NULL DEFAULT 0 CHECK (presupuesto_total >= 0),
  moneda            moneda_tipo      NOT NULL DEFAULT 'BOB',
  fecha_inicio      date             NOT NULL,
  fecha_fin         date             NOT NULL,
  estado            estado_proyecto  NOT NULL DEFAULT 'PLANIFICACION',
  cumplimiento_pct  numeric(5,2)     NOT NULL DEFAULT 0 CHECK (cumplimiento_pct BETWEEN 0 AND 100),
  creado_por        uuid             NOT NULL REFERENCES usuarios (id) ON DELETE RESTRICT,
  created_at        timestamptz      NOT NULL DEFAULT now(),
  updated_at        timestamptz      NOT NULL DEFAULT now(),
  deleted_at        timestamptz,
  CONSTRAINT ck_proyecto_fechas CHECK (fecha_fin >= fecha_inicio)
);
CREATE UNIQUE INDEX uq_proyectos_codigo ON proyectos (codigo) WHERE deleted_at IS NULL;
CREATE INDEX ix_proyectos_financiador ON proyectos (financiador_id) WHERE deleted_at IS NULL;
CREATE INDEX ix_proyectos_estado ON proyectos (estado) WHERE deleted_at IS NULL;

-- Equipo: asignar y retirar técnicos conservando el historial.
CREATE TABLE proyecto_equipo (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id  uuid        NOT NULL REFERENCES proyectos (id) ON DELETE RESTRICT,
  usuario_id   uuid        NOT NULL REFERENCES usuarios (id)  ON DELETE RESTRICT,
  asignado_por uuid        NOT NULL REFERENCES usuarios (id)  ON DELETE RESTRICT,
  asignado_at  timestamptz NOT NULL DEFAULT now(),
  retirado_at  timestamptz,
  CONSTRAINT ck_equipo_retiro CHECK (retirado_at IS NULL OR retirado_at >= asignado_at)
);
-- Solo una asignación activa por (proyecto, usuario)
CREATE UNIQUE INDEX uq_equipo_activo ON proyecto_equipo (proyecto_id, usuario_id)
  WHERE retirado_at IS NULL;
CREATE INDEX ix_equipo_usuario ON proyecto_equipo (usuario_id) WHERE retirado_at IS NULL;
CREATE INDEX ix_equipo_proyecto_historial ON proyecto_equipo (proyecto_id);   -- historial completo

-- ---------------------------------------------------------------------
-- 5. MARCO LÓGICO: Proyecto → Resultado → I.O.V. / Actividad → Tarea
-- ---------------------------------------------------------------------
CREATE TABLE resultados (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id      uuid          NOT NULL REFERENCES proyectos (id) ON DELETE RESTRICT,
  codigo           varchar(20)   NOT NULL,
  descripcion      text          NOT NULL,
  peso             numeric(5,2)  NOT NULL DEFAULT 0 CHECK (peso BETWEEN 0 AND 100),
  cumplimiento_pct numeric(5,2)  NOT NULL DEFAULT 0 CHECK (cumplimiento_pct BETWEEN 0 AND 100),
  created_at       timestamptz   NOT NULL DEFAULT now(),
  updated_at       timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (proyecto_id, codigo)
);

-- I.O.V. = Indicador Objetivamente Verificable
CREATE TABLE iov (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resultado_id               uuid          NOT NULL REFERENCES resultados (id) ON DELETE RESTRICT,
  codigo                     varchar(20)   NOT NULL,
  descripcion                text          NOT NULL,
  unidad                     varchar(50)   NOT NULL,
  linea_base                 numeric(14,2) NOT NULL DEFAULT 0,
  meta                       numeric(14,2) NOT NULL,
  peso                       numeric(5,2)  NOT NULL DEFAULT 0 CHECK (peso BETWEEN 0 AND 100),
  tipo_fuente_verificacion   varchar(150)  NOT NULL,       -- p. ej. "Acta firmada", "Informe técnico"
  responsable_id             uuid REFERENCES usuarios (id) ON DELETE RESTRICT,
  valor_actual               numeric(14,2) NOT NULL DEFAULT 0, -- acumulado de avances aprobados
  cumplimiento_pct           numeric(5,2)  NOT NULL DEFAULT 0 CHECK (cumplimiento_pct BETWEEN 0 AND 100),
  created_at                 timestamptz   NOT NULL DEFAULT now(),
  updated_at                 timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (resultado_id, codigo),
  CONSTRAINT ck_iov_meta CHECK (meta <> linea_base),
  UNIQUE (id, resultado_id)                       -- habilita la FK compuesta de actividades
);
CREATE INDEX ix_iov_responsable ON iov (responsable_id);

CREATE TABLE actividades (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resultado_id     uuid             NOT NULL REFERENCES resultados (id) ON DELETE RESTRICT,
  iov_id           uuid,                                          -- opcional: indicador que alimenta
  codigo           varchar(20)      NOT NULL,
  nombre           varchar(250)     NOT NULL,
  descripcion      text,
  responsable_id   uuid REFERENCES usuarios (id) ON DELETE RESTRICT,
  fecha_inicio     date             NOT NULL,
  fecha_fin        date             NOT NULL,
  estado           estado_actividad NOT NULL DEFAULT 'PENDIENTE',
  meta_cuantitativa numeric(14,2),                                       -- RF-08: meta de la actividad (ej. 5 talleres)
  cumplimiento_pct  numeric(5,2)    NOT NULL DEFAULT 0 CHECK (cumplimiento_pct BETWEEN 0 AND 100),
  created_at        timestamptz     NOT NULL DEFAULT now(),
  updated_at        timestamptz     NOT NULL DEFAULT now(),
  UNIQUE (resultado_id, codigo),
  CONSTRAINT ck_actividad_fechas CHECK (fecha_fin >= fecha_inicio),
  -- el I.O.V. debe pertenecer al MISMO resultado que la actividad (si iov_id es NULL no se evalúa)
  FOREIGN KEY (iov_id, resultado_id) REFERENCES iov (id, resultado_id) ON DELETE RESTRICT
);
CREATE INDEX ix_actividades_iov ON actividades (iov_id);
CREATE INDEX ix_actividades_responsable ON actividades (responsable_id);
-- apoya el cron diario de actividades por vencer / vencidas
CREATE INDEX ix_actividades_vencimiento ON actividades (fecha_fin)
  WHERE estado IN ('PENDIENTE', 'EN_CURSO');

CREATE TABLE tareas (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actividad_id   uuid         NOT NULL REFERENCES actividades (id) ON DELETE RESTRICT,
  nombre         varchar(250) NOT NULL,
  responsable_id uuid         REFERENCES usuarios (id) ON DELETE RESTRICT,  -- RF-24
  estado         estado_tarea NOT NULL DEFAULT 'PENDIENTE',
  fecha_limite   date,
  cerrado_at     timestamptz,                                                -- RF-24: fecha de cierre al completar
  created_at     timestamptz  NOT NULL DEFAULT now(),
  updated_at     timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX ix_tareas_actividad ON tareas (actividad_id);

-- ---------------------------------------------------------------------
-- 6. SEGUIMIENTO: AVANCES Y EVIDENCIAS
-- ---------------------------------------------------------------------
CREATE TABLE avances (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  iov_id         uuid REFERENCES iov (id)         ON DELETE RESTRICT,
  actividad_id   uuid REFERENCES actividades (id) ON DELETE RESTRICT,
  autor_id       uuid          NOT NULL REFERENCES usuarios (id) ON DELETE RESTRICT,
  valor_reportado numeric(14,2) CHECK (valor_reportado >= 0),   -- aporte cuantitativo (solo I.O.V.)
  fecha_corte    date          NOT NULL DEFAULT current_date,
  descripcion    text,
  estado         estado_avance NOT NULL DEFAULT 'BORRADOR',
  enviado_at     timestamptz,
  revisado_por   uuid REFERENCES usuarios (id) ON DELETE RESTRICT,
  revisado_at    timestamptz,
  observacion    text,
  created_at     timestamptz   NOT NULL DEFAULT now(),
  updated_at     timestamptz   NOT NULL DEFAULT now(),
  -- un avance pertenece a un I.O.V. o a una actividad, nunca a ambos ni a ninguno
  CONSTRAINT ck_avance_objetivo CHECK ((iov_id IS NOT NULL) <> (actividad_id IS NOT NULL)),
  CONSTRAINT ck_avance_valor CHECK (iov_id IS NULL OR valor_reportado IS NOT NULL),
  CONSTRAINT ck_avance_revision CHECK (
    estado NOT IN ('APROBADO', 'OBSERVADO')
    OR (revisado_por IS NOT NULL AND revisado_at IS NOT NULL)),
  CONSTRAINT ck_avance_observacion CHECK (estado <> 'OBSERVADO' OR observacion IS NOT NULL)
);
CREATE INDEX ix_avances_iov       ON avances (iov_id);
CREATE INDEX ix_avances_actividad ON avances (actividad_id);
CREATE INDEX ix_avances_autor     ON avances (autor_id);
CREATE INDEX ix_avances_estado    ON avances (estado);

-- Fuentes de verificación. En la BD solo van los metadatos; el archivo
-- vive en MinIO / S3 bajo storage_key (ADR-003).
CREATE TABLE evidencias (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  avance_id       uuid         NOT NULL REFERENCES avances (id) ON DELETE RESTRICT,
  version         integer      NOT NULL DEFAULT 1 CHECK (version >= 1),
  reemplaza_a     uuid,
  storage_key     varchar(300) NOT NULL UNIQUE,              -- nombre UUID del objeto
  nombre_original varchar(255) NOT NULL,
  mime            varchar(100) NOT NULL
                  CHECK (mime IN ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  tamano_bytes    bigint       NOT NULL CHECK (tamano_bytes > 0 AND tamano_bytes <= 26214400), -- 25 MB
  sha256          char(64)     NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  subido_por      uuid         NOT NULL REFERENCES usuarios (id) ON DELETE RESTRICT,
  created_at      timestamptz  NOT NULL DEFAULT now(),
  UNIQUE (avance_id, id),
  -- la versión que reemplaza debe pertenecer al mismo avance
  FOREIGN KEY (avance_id, reemplaza_a) REFERENCES evidencias (avance_id, id) ON DELETE RESTRICT,
  CONSTRAINT ck_evidencia_version CHECK ((version = 1) = (reemplaza_a IS NULL))
);
CREATE UNIQUE INDEX uq_evidencia_reemplazo ON evidencias (reemplaza_a) WHERE reemplaza_a IS NOT NULL;
CREATE INDEX ix_evidencias_avance ON evidencias (avance_id);

-- ---------------------------------------------------------------------
-- 7. FINANZAS Y DESEMBOLSOS
-- ---------------------------------------------------------------------
CREATE TABLE partidas (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id    uuid          NOT NULL REFERENCES proyectos (id) ON DELETE RESTRICT,
  nombre         varchar(200)  NOT NULL,
  monto_asignado numeric(14,2) NOT NULL CHECK (monto_asignado >= 0),
  created_at     timestamptz   NOT NULL DEFAULT now(),
  updated_at     timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (proyecto_id, nombre)
);

CREATE TABLE gastos (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partida_id     uuid          NOT NULL REFERENCES partidas (id)    ON DELETE RESTRICT,
  actividad_id   uuid          REFERENCES actividades (id) ON DELETE RESTRICT,  -- RF-16
  monto          numeric(14,2) NOT NULL CHECK (monto > 0),
  fecha          date          NOT NULL,
  descripcion    varchar(500)  NOT NULL,
  registrado_por uuid          NOT NULL REFERENCES usuarios (id)    ON DELETE RESTRICT,
  created_at     timestamptz   NOT NULL DEFAULT now(),
  updated_at     timestamptz   NOT NULL DEFAULT now()
);
CREATE INDEX ix_gastos_partida    ON gastos (partida_id);
CREATE INDEX ix_gastos_actividad  ON gastos (actividad_id) WHERE actividad_id IS NOT NULL;

-- Tramos de desembolso del financiador
CREATE TABLE tramos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id     uuid          NOT NULL REFERENCES proyectos (id) ON DELETE RESTRICT,
  numero          integer       NOT NULL CHECK (numero >= 1),
  descripcion     varchar(300),
  monto           numeric(14,2) NOT NULL CHECK (monto > 0),
  fecha_prevista  date,
  estado          estado_tramo  NOT NULL DEFAULT 'PENDIENTE',
  habilitado_at   timestamptz,
  desembolsado_at timestamptz,
  created_at      timestamptz   NOT NULL DEFAULT now(),
  updated_at      timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (proyecto_id, numero),
  CONSTRAINT ck_tramo_fechas CHECK (desembolsado_at IS NULL OR habilitado_at IS NOT NULL)
);

-- Condiciones que habilitan un tramo automáticamente
CREATE TABLE tramo_condiciones (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tramo_id     uuid            NOT NULL REFERENCES tramos (id) ON DELETE CASCADE,
  tipo         tipo_condicion  NOT NULL,
  iov_id       uuid REFERENCES iov (id)        ON DELETE RESTRICT,
  resultado_id uuid REFERENCES resultados (id) ON DELETE RESTRICT,
  umbral_pct   numeric(5,2)    NOT NULL CHECK (umbral_pct BETWEEN 0 AND 100),
  created_at   timestamptz     NOT NULL DEFAULT now(),
  -- IOV → iov_id · RESULTADO → resultado_id · PROYECTO → ninguno (usa el proyecto del tramo)
  CONSTRAINT ck_condicion_referencia CHECK (
    (tipo = 'IOV'       AND iov_id IS NOT NULL AND resultado_id IS NULL) OR
    (tipo = 'RESULTADO' AND resultado_id IS NOT NULL AND iov_id IS NULL) OR
    (tipo = 'PROYECTO'  AND iov_id IS NULL AND resultado_id IS NULL))
);
CREATE INDEX ix_condiciones_tramo ON tramo_condiciones (tramo_id);
CREATE INDEX ix_condiciones_iov ON tramo_condiciones (iov_id) WHERE iov_id IS NOT NULL;
CREATE INDEX ix_condiciones_resultado ON tramo_condiciones (resultado_id) WHERE resultado_id IS NOT NULL;

-- Desembolsos recibidos por tramo (RF-31). El monto real puede diferir del estimado en el tramo.
CREATE TABLE desembolsos (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tramo_id       uuid          NOT NULL REFERENCES tramos (id) ON DELETE RESTRICT,
  monto          numeric(14,2) NOT NULL CHECK (monto > 0),
  fecha          date          NOT NULL,
  registrado_por uuid          NOT NULL REFERENCES usuarios (id) ON DELETE RESTRICT,
  created_at     timestamptz   NOT NULL DEFAULT now()
);
CREATE INDEX ix_desembolsos_tramo ON desembolsos (tramo_id);

-- Respaldos documentales de gastos y desembolsos (RF-16, RF-31)
CREATE TABLE documentos_soporte (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gasto_id        uuid REFERENCES gastos      (id) ON DELETE RESTRICT,
  desembolso_id   uuid REFERENCES desembolsos (id) ON DELETE RESTRICT,
  storage_key     varchar(300) NOT NULL UNIQUE,
  nombre_original varchar(255) NOT NULL,
  mime            varchar(100) NOT NULL
                  CHECK (mime IN ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  tamano_bytes    bigint       NOT NULL CHECK (tamano_bytes > 0 AND tamano_bytes <= 26214400),
  sha256          char(64)     NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  subido_por      uuid         NOT NULL REFERENCES usuarios (id) ON DELETE RESTRICT,
  created_at      timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT ck_soporte_dueno CHECK ((gasto_id IS NOT NULL) <> (desembolso_id IS NOT NULL))
);
CREATE INDEX ix_soporte_gasto       ON documentos_soporte (gasto_id);
CREATE INDEX ix_soporte_desembolso  ON documentos_soporte (desembolso_id);

-- ---------------------------------------------------------------------
-- 8. AUDITORÍA (bitácora append-only)
-- ---------------------------------------------------------------------
CREATE TABLE audit_log (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id     uuid REFERENCES usuarios (id) ON DELETE RESTRICT,  -- NULL = sistema o login fallido
  usuario_email  citext,                                            -- copia, útil si el login falla
  accion         varchar(60)  NOT NULL,                             -- CREAR, EDITAR, APROBAR, LOGIN_FALLIDO...
  entidad        varchar(60)  NOT NULL,
  entidad_id     varchar(64),
  valor_anterior jsonb,
  valor_nuevo    jsonb,
  ip             inet,
  user_agent     varchar(300),
  created_at     timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX ix_audit_entidad ON audit_log (entidad, entidad_id);
CREATE INDEX ix_audit_usuario ON audit_log (usuario_id, created_at DESC);
CREATE INDEX ix_audit_fecha   ON audit_log (created_at DESC);

-- ---------------------------------------------------------------------
-- 9. TRIGGERS DE REGLAS DE NEGOCIO (defensa en profundidad)
--    La lógica principal vive en los servicios NestJS (ADR-007); estas
--    reglas impiden que un bug o un acceso directo corrompa los datos.
-- ---------------------------------------------------------------------

-- 9.1 updated_at automático
CREATE TRIGGER trg_financiadores_upd BEFORE UPDATE ON financiadores FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_usuarios_upd      BEFORE UPDATE ON usuarios      FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_proyectos_upd     BEFORE UPDATE ON proyectos     FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_resultados_upd    BEFORE UPDATE ON resultados    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_iov_upd           BEFORE UPDATE ON iov           FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_actividades_upd   BEFORE UPDATE ON actividades   FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_tareas_upd        BEFORE UPDATE ON tareas        FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_avances_upd       BEFORE UPDATE ON avances       FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_partidas_upd      BEFORE UPDATE ON partidas      FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_gastos_upd        BEFORE UPDATE ON gastos        FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_tramos_upd        BEFORE UPDATE ON tramos        FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- 9.2 Máquina de estados del avance (ADR-007)
--     Borrador → Enviado → Aprobado | Observado ; Observado → Enviado ;
--     cualquier estado → Anulado. Un avance aprobado no cambia su valor.
CREATE FUNCTION fn_avance_transicion() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.estado = 'APROBADO' AND NEW.valor_reportado IS DISTINCT FROM OLD.valor_reportado THEN
    RAISE EXCEPTION 'Un avance aprobado no puede modificar su valor reportado'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.estado = OLD.estado OR NEW.estado = 'ANULADO' THEN
    RETURN NEW;
  END IF;

  IF (OLD.estado::text || '>' || NEW.estado::text) IN
     ('BORRADOR>ENVIADO', 'ENVIADO>APROBADO', 'ENVIADO>OBSERVADO', 'OBSERVADO>ENVIADO') THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Transición de avance no permitida: % -> %', OLD.estado, NEW.estado
    USING ERRCODE = '23514';
END $$;
CREATE TRIGGER trg_avance_transicion BEFORE UPDATE OF estado, valor_reportado ON avances
  FOR EACH ROW EXECUTE FUNCTION fn_avance_transicion();

-- 9.3 Un avance ENVIADO o APROBADO exige al menos una evidencia.
--     Se evalúa al confirmar la transacción (DEFERRED), para poder insertar
--     el avance y su evidencia en una sola transacción (Escenario A).
CREATE FUNCTION fn_avance_requiere_evidencia() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.estado IN ('ENVIADO', 'APROBADO')
     AND NOT EXISTS (SELECT 1 FROM evidencias WHERE avance_id = NEW.id) THEN
    RAISE EXCEPTION 'El avance % no puede estar % sin al menos una fuente de verificación',
      NEW.id, NEW.estado USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER trg_avance_requiere_evidencia
  AFTER INSERT OR UPDATE OF estado ON avances
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION fn_avance_requiere_evidencia();

-- 9.4 Evidencias inmutables: no se editan, solo se agregan versiones nuevas.
--     No se agregan a avances aprobados o anulados y solo se borran en borrador.
CREATE FUNCTION fn_evidencia_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_estado estado_avance;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Las evidencias son inmutables: suba una nueva versión'
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'INSERT' THEN
    SELECT estado INTO v_estado FROM avances WHERE id = NEW.avance_id;
    IF v_estado IN ('APROBADO', 'ANULADO') THEN
      RAISE EXCEPTION 'No se pueden agregar evidencias a un avance %', v_estado
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  SELECT estado INTO v_estado FROM avances WHERE id = OLD.avance_id;
  IF v_estado IS DISTINCT FROM 'BORRADOR' THEN
    RAISE EXCEPTION 'Solo se pueden eliminar evidencias de un avance en borrador'
      USING ERRCODE = '23514';
  END IF;
  RETURN OLD;
END $$;
CREATE TRIGGER trg_evidencia_guard BEFORE INSERT OR UPDATE OR DELETE ON evidencias
  FOR EACH ROW EXECUTE FUNCTION fn_evidencia_guard();

-- 9.5 Estados del proyecto (RN-09 asumida; ajustar si el documento dice otra cosa)
--     Planificación → En ejecución ⇄ Pausado → Cerrado. Cerrado es final.
CREATE FUNCTION fn_proyecto_transicion() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.estado = OLD.estado THEN
    RETURN NEW;
  END IF;
  IF (OLD.estado::text || '>' || NEW.estado::text) IN
     ('PLANIFICACION>EN_EJECUCION', 'EN_EJECUCION>PAUSADO', 'PAUSADO>EN_EJECUCION',
      'EN_EJECUCION>CERRADO', 'PAUSADO>CERRADO') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Transición de proyecto no permitida: % -> %', OLD.estado, NEW.estado
    USING ERRCODE = '23514';
END $$;
CREATE TRIGGER trg_proyecto_transicion BEFORE UPDATE OF estado ON proyectos
  FOR EACH ROW EXECUTE FUNCTION fn_proyecto_transicion();

-- 9.6 Estados del tramo (ADR-007): Pendiente → Habilitado → Desembolsado
CREATE FUNCTION fn_tramo_transicion() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.estado = OLD.estado THEN
    RETURN NEW;
  END IF;
  IF (OLD.estado::text || '>' || NEW.estado::text) IN
     ('PENDIENTE>HABILITADO', 'HABILITADO>DESEMBOLSADO') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Transición de tramo no permitida: % -> %', OLD.estado, NEW.estado
    USING ERRCODE = '23514';
END $$;
CREATE TRIGGER trg_tramo_transicion BEFORE UPDATE OF estado ON tramos
  FOR EACH ROW EXECUTE FUNCTION fn_tramo_transicion();

-- 9.7 Solo usuarios TECNICO activos pueden integrar el equipo de un proyecto
CREATE FUNCTION fn_equipo_solo_tecnicos() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_rol    rol_usuario;
  v_activo boolean;
BEGIN
  SELECT rol, (activo AND deleted_at IS NULL) INTO v_rol, v_activo
    FROM usuarios WHERE id = NEW.usuario_id;
  IF v_rol IS DISTINCT FROM 'TECNICO' THEN
    RAISE EXCEPTION 'Solo los usuarios con rol TECNICO pueden asignarse a un proyecto'
      USING ERRCODE = '23514';
  END IF;
  IF NOT v_activo THEN
    RAISE EXCEPTION 'No se puede asignar un usuario inactivo' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_equipo_solo_tecnicos BEFORE INSERT ON proyecto_equipo
  FOR EACH ROW EXECUTE FUNCTION fn_equipo_solo_tecnicos();

-- 9.8 Una condición de tramo solo puede referir I.O.V. o resultados de SU proyecto
CREATE FUNCTION fn_condicion_mismo_proyecto() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_proy_tramo uuid;
  v_proy_ref   uuid;
BEGIN
  SELECT proyecto_id INTO v_proy_tramo FROM tramos WHERE id = NEW.tramo_id;

  IF NEW.tipo = 'IOV' THEN
    SELECT r.proyecto_id INTO v_proy_ref
      FROM iov i JOIN resultados r ON r.id = i.resultado_id
     WHERE i.id = NEW.iov_id;
  ELSIF NEW.tipo = 'RESULTADO' THEN
    SELECT proyecto_id INTO v_proy_ref FROM resultados WHERE id = NEW.resultado_id;
  ELSE
    RETURN NEW;                       -- tipo PROYECTO: usa el proyecto del tramo
  END IF;

  IF v_proy_ref IS DISTINCT FROM v_proy_tramo THEN
    RAISE EXCEPTION 'La condición del tramo debe referir elementos del mismo proyecto'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_condicion_mismo_proyecto BEFORE INSERT OR UPDATE ON tramo_condiciones
  FOR EACH ROW EXECUTE FUNCTION fn_condicion_mismo_proyecto();

-- 9.9 RN-06: la suma de montos de tramos no puede exceder el presupuesto del proyecto
CREATE FUNCTION fn_tramos_presupuesto() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_presupuesto numeric(14,2);
  v_suma        numeric(14,2);
BEGIN
  SELECT presupuesto_total INTO v_presupuesto
    FROM proyectos WHERE id = NEW.proyecto_id;
  SELECT COALESCE(SUM(monto), 0) INTO v_suma
    FROM tramos WHERE proyecto_id = NEW.proyecto_id
      AND id IS DISTINCT FROM NEW.id;   -- excluye la propia fila en UPDATE
  IF v_suma + NEW.monto > v_presupuesto THEN
    RAISE EXCEPTION 'La suma de tramos (% + %) supera el presupuesto del proyecto (%)',
      v_suma, NEW.monto, v_presupuesto USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_tramos_presupuesto BEFORE INSERT OR UPDATE OF monto ON tramos
  FOR EACH ROW EXECUTE FUNCTION fn_tramos_presupuesto();

-- 9.10 RN-07: un gasto no puede superar el saldo desembolsado acumulado del proyecto
CREATE FUNCTION fn_gastos_saldo() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_proyecto_id uuid;
  v_desembolsado numeric(14,2);
  v_gastado      numeric(14,2);
BEGIN
  SELECT p.id INTO v_proyecto_id
    FROM partidas p WHERE p.id = NEW.partida_id;
  SELECT COALESCE(SUM(d.monto), 0) INTO v_desembolsado
    FROM desembolsos d JOIN tramos t ON t.id = d.tramo_id
   WHERE t.proyecto_id = v_proyecto_id;
  SELECT COALESCE(SUM(g.monto), 0) INTO v_gastado
    FROM gastos g JOIN partidas pa ON pa.id = g.partida_id
   WHERE pa.proyecto_id = v_proyecto_id
     AND g.id IS DISTINCT FROM NEW.id;
  IF v_gastado + NEW.monto > v_desembolsado THEN
    RAISE EXCEPTION 'El gasto supera el saldo desembolsado disponible (desembolsado: %, gastado: %, nuevo gasto: %)',
      v_desembolsado, v_gastado, NEW.monto USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_gastos_saldo BEFORE INSERT OR UPDATE OF monto ON gastos
  FOR EACH ROW EXECUTE FUNCTION fn_gastos_saldo();

-- 9.11 audit_log append-only: ni UPDATE, ni DELETE, ni TRUNCATE
CREATE FUNCTION fn_audit_inmutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_log es de solo inserción (append-only)' USING ERRCODE = '42501';
END $$;
CREATE TRIGGER trg_audit_no_modificar BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION fn_audit_inmutable();
CREATE TRIGGER trg_audit_no_truncate BEFORE TRUNCATE ON audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION fn_audit_inmutable();

-- ---------------------------------------------------------------------
-- 10. VISTAS DE APOYO
-- ---------------------------------------------------------------------

-- Versión vigente de cada evidencia (la que ninguna otra reemplaza)
CREATE VIEW vw_evidencias_vigentes AS
SELECT e.*
  FROM evidencias e
 WHERE NOT EXISTS (SELECT 1 FROM evidencias r WHERE r.reemplaza_a = e.id);

-- Resumen por proyecto para el panel del Director y del Financiador
CREATE VIEW vw_proyecto_resumen AS
SELECT p.id,
       p.codigo,
       p.nombre,
       p.estado,
       p.moneda,
       p.presupuesto_total,
       p.cumplimiento_pct,
       p.financiador_id,
       f.nombre AS financiador,
       COALESCE((SELECT SUM(g.monto)
                   FROM gastos g JOIN partidas pa ON pa.id = g.partida_id
                  WHERE pa.proyecto_id = p.id), 0)                       AS gastado,
       COALESCE((SELECT SUM(d.monto) FROM desembolsos d JOIN tramos t ON t.id = d.tramo_id
                  WHERE t.proyecto_id = p.id), 0)                            AS desembolsado,
       (SELECT COUNT(*) FROM tramos t
         WHERE t.proyecto_id = p.id AND t.estado = 'HABILITADO')         AS tramos_habilitados,
       (SELECT COUNT(*)
          FROM avances a
          LEFT JOIN iov i         ON i.id  = a.iov_id
          LEFT JOIN actividades c ON c.id  = a.actividad_id
          JOIN resultados r       ON r.id  = COALESCE(i.resultado_id, c.resultado_id)
         WHERE r.proyecto_id = p.id AND a.estado = 'ENVIADO')            AS avances_por_revisar
  FROM proyectos p
  JOIN financiadores f ON f.id = p.financiador_id
 WHERE p.deleted_at IS NULL;

COMMIT;
