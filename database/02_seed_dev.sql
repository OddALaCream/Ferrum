-- =====================================================================
-- SGP Serfamilia · Datos de DESARROLLO (nunca en producción)
-- Idempotente: se puede ejecutar varias veces.
-- Contraseña de los cuatro usuarios de prueba:  Cambiar123!
-- (bcrypt costo 12 generado con pgcrypto; compatible con la librería bcrypt de Node)
-- =====================================================================

-- 1. Financiador
INSERT INTO financiadores (id, nombre, contacto, email) VALUES
  ('11111111-1111-4111-8111-111111111111', 'Financiador Demo', 'Contacto Demo', 'contacto@financiador-demo.test')
ON CONFLICT (id) DO NOTHING;

-- 2. Usuarios (Ahora son 4 roles)
INSERT INTO usuarios (id, email, password_hash, nombre, rol, financiador_id) VALUES
  ('22222222-2222-4222-8222-222222222221', 'director@serfamilia.test',
   crypt('Cambiar123!', gen_salt('bf', 12)), 'Director Demo', 'DIRECTOR', NULL),
  ('22222222-2222-4222-8222-222222222222', 'tecnico@serfamilia.test',
   crypt('Cambiar123!', gen_salt('bf', 12)), 'Técnico Demo', 'TECNICO', NULL),
  ('22222222-2222-4222-8222-222222222223', 'financiador@serfamilia.test',
   crypt('Cambiar123!', gen_salt('bf', 12)), 'Financiador Demo', 'FINANCIADOR',
   '11111111-1111-4111-8111-111111111111'),
  ('22222222-2222-4222-8222-222222222224', 'admin@serfamilia.test',
   crypt('Cambiar123!', gen_salt('bf', 12)), 'Administrativo Demo', 'ADMINISTRATIVO', NULL)
ON CONFLICT (id) DO NOTHING;

-- 3. Proyecto
INSERT INTO proyectos (id, codigo, nombre, descripcion, objetivo_general, financiador_id, presupuesto_total, moneda,
                       fecha_inicio, fecha_fin, estado, creado_por) VALUES
  ('33333333-3333-4333-8333-333333333333', 'PRY-DEMO-001', 'Proyecto de demostración',
   'Proyecto de ejemplo para desarrollo y pruebas.', 'Mejorar las condiciones familiares en la región', '11111111-1111-4111-8111-111111111111',
   100000.00, 'BOB', '2026-01-01', '2026-12-31', 'EN_EJECUCION',
   '22222222-2222-4222-8222-222222222221')
ON CONFLICT (id) DO NOTHING;

-- 4. Asignación de Equipo
INSERT INTO proyecto_equipo (id, proyecto_id, usuario_id, asignado_por) VALUES
  ('44444444-4444-4444-8444-444444444444', '33333333-3333-4333-8333-333333333333',
   '22222222-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222221')
ON CONFLICT (id) DO NOTHING;

-- 5. Marco Lógico: Objetivo Específico
INSERT INTO objetivos_especificos (id, proyecto_id, codigo, descripcion) VALUES
  ('55555555-5555-4555-8555-555555555551', '33333333-3333-4333-8333-333333333333', 'OE.1',
   'Desarrollar habilidades parentales en familias en situación de riesgo')
ON CONFLICT (id) DO NOTHING;

-- 6. Marco Lógico: Resultado (ahora vinculado a Objetivo Específico)
INSERT INTO resultados (id, objetivo_especifico_id, codigo, descripcion, peso) VALUES
  ('55555555-5555-4555-8555-555555555555', '55555555-5555-4555-8555-555555555551', 'R1',
   'Familias capacitadas en habilidades parentales', 100.00)
ON CONFLICT (id) DO NOTHING;

-- 7. Marco Lógico: Indicador (I.O.V.)
INSERT INTO iov (id, resultado_id, codigo, descripcion, unidad, linea_base, meta, peso,
                 tipo_fuente_verificacion, responsable_id) VALUES
  ('66666666-6666-4666-8666-666666666666', '55555555-5555-4555-8555-555555555555', 'R1-I1',
   'Número de familias que completan el ciclo de talleres', 'familias', 0, 50, 50.00,
   'Lista de asistencia firmada', '22222222-2222-4222-8222-222222222222')
ON CONFLICT (id) DO NOTHING;

-- 8. Marco Lógico: Actividad (Para que el técnico pruebe el Cronograma y Desembolsos)
INSERT INTO actividades (id, resultado_id, iov_id, codigo, nombre, descripcion, responsable_id,
                         fecha_planificada_inicio, fecha_planificada_fin, estado, meta_cuantitativa, cumplimiento_pct) VALUES
  ('77777777-7777-4777-8777-777777777777', '55555555-5555-4555-8555-555555555555', '66666666-6666-4666-8666-666666666666', 
   'A1.1', 'Taller introductorio a la comunidad', 'Primer taller presencial en campo', 
   '22222222-2222-4222-8222-222222222222', '2026-03-01', '2026-03-15', 'PENDIENTE', 1, 0)
ON CONFLICT (id) DO NOTHING;