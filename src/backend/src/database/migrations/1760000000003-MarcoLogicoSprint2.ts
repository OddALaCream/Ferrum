import { MigrationInterface, QueryRunner } from 'typeorm';

/** Conserva los datos del esquema inicial y lo adapta al modelo de marco lógico de Sprint 2. */
export class MarcoLogicoSprint21760000000003 implements MigrationInterface {
  name = 'MarcoLogicoSprint21760000000003';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'rol_usuario'::regtype AND enumlabel = 'DIRECTOR')
           AND NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'rol_usuario'::regtype AND enumlabel = 'ADMINISTRADOR') THEN
          ALTER TYPE rol_usuario RENAME VALUE 'DIRECTOR' TO 'ADMINISTRADOR';
        END IF;
        IF EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'rol_usuario'::regtype AND enumlabel = 'ADMINISTRATIVO')
           AND NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'rol_usuario'::regtype AND enumlabel = 'SUPERVISOR') THEN
          ALTER TYPE rol_usuario RENAME VALUE 'ADMINISTRATIVO' TO 'SUPERVISOR';
        END IF;
      END $$;
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'proyectos' AND column_name = 'financiador_id') THEN
          ALTER TABLE proyectos ALTER COLUMN financiador_id DROP NOT NULL;
        END IF;
      END $$;
      ALTER TABLE resultados ADD COLUMN IF NOT EXISTS proyecto_id uuid REFERENCES proyectos(id) ON DELETE RESTRICT;
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'resultados' AND column_name = 'objetivo_especifico_id') THEN
          UPDATE resultados r SET proyecto_id = oe.proyecto_id
            FROM objetivos_especificos oe WHERE r.objetivo_especifico_id = oe.id AND r.proyecto_id IS NULL;
          ALTER TABLE resultados ALTER COLUMN objetivo_especifico_id DROP NOT NULL;
        END IF;
      END $$;
      ALTER TABLE resultados ALTER COLUMN proyecto_id SET NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS uq_resultados_proyecto_codigo ON resultados(proyecto_id, codigo);
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'actividades' AND column_name = 'fecha_planificada_inicio')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'actividades' AND column_name = 'fecha_inicio') THEN
          ALTER TABLE actividades RENAME COLUMN fecha_planificada_inicio TO fecha_inicio;
          ALTER TABLE actividades RENAME COLUMN fecha_planificada_fin TO fecha_fin;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_cronograma') THEN
          CREATE TYPE tipo_cronograma AS ENUM ('CONTINUO', 'DISCRETO');
        END IF;
      END $$;
      ALTER TABLE actividades ADD COLUMN IF NOT EXISTS tipo_cronograma tipo_cronograma NOT NULL DEFAULT 'CONTINUO';
      ALTER TABLE actividades ADD COLUMN IF NOT EXISTS unidad_meta varchar(150);
      ALTER TABLE actividades ADD COLUMN IF NOT EXISTS fuentes_verificacion text;
      ALTER TABLE iov ALTER COLUMN tipo_fuente_verificacion TYPE text;
      CREATE TABLE IF NOT EXISTS actividad_sesiones (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        actividad_id uuid NOT NULL REFERENCES actividades(id) ON DELETE CASCADE,
        fecha date NOT NULL,
        realizada boolean NOT NULL DEFAULT false,
        realizada_at timestamptz,
        realizada_por uuid REFERENCES usuarios(id) ON DELETE RESTRICT,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (actividad_id, fecha)
      );
    `);
  }

  async down(): Promise<void> {
    throw new Error('La reversión del modelo de Sprint 2 requiere restaurar una copia de seguridad para conservar sus datos.');
  }
}
