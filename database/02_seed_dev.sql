-- =====================================================================
-- SGP Serfamilia · Datos de DESARROLLO (nunca en producción)
-- Idempotente: se puede ejecutar varias veces.
-- Contraseña de los tres usuarios de prueba:  Cambiar123!
-- (bcrypt costo 12 generado con pgcrypto; compatible con la librería bcrypt de Node)
-- =====================================================================

INSERT INTO financiadores (id, nombre, contacto, email) VALUES
  ('11111111-1111-4111-8111-111111111111', 'Financiador Demo', 'Contacto Demo', 'contacto@financiador-demo.test')
ON CONFLICT (id) DO NOTHING;

INSERT INTO usuarios (id, email, password_hash, nombre, rol, financiador_id) VALUES
  ('22222222-2222-4222-8222-222222222221', 'director@serfamilia.test',
   crypt('Cambiar123!', gen_salt('bf', 12)), 'Director Demo', 'DIRECTOR', NULL),
  ('22222222-2222-4222-8222-222222222222', 'tecnico@serfamilia.test',
   crypt('Cambiar123!', gen_salt('bf', 12)), 'Técnico Demo', 'TECNICO', NULL),
  ('22222222-2222-4222-8222-222222222223', 'financiador@serfamilia.test',
   crypt('Cambiar123!', gen_salt('bf', 12)), 'Financiador Demo', 'FINANCIADOR',
   '11111111-1111-4111-8111-111111111111')
ON CONFLICT (id) DO NOTHING;

INSERT INTO proyectos (id, codigo, nombre, descripcion, financiador_id, presupuesto_total, moneda,
                       fecha_inicio, fecha_fin, estado, creado_por) VALUES
  ('33333333-3333-4333-8333-333333333333', 'PRY-DEMO-001', 'Proyecto de demostración',
   'Proyecto de ejemplo para desarrollo y pruebas.', '11111111-1111-4111-8111-111111111111',
   100000.00, 'BOB', '2026-01-01', '2026-12-31', 'EN_EJECUCION',
   '22222222-2222-4222-8222-222222222221')
ON CONFLICT (id) DO NOTHING;

INSERT INTO proyecto_equipo (id, proyecto_id, usuario_id, asignado_por) VALUES
  ('44444444-4444-4444-8444-444444444444', '33333333-3333-4333-8333-333333333333',
   '22222222-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222221')
ON CONFLICT (id) DO NOTHING;

INSERT INTO resultados (id, proyecto_id, codigo, descripcion, peso) VALUES
  ('55555555-5555-4555-8555-555555555555', '33333333-3333-4333-8333-333333333333', 'R1',
   'Familias capacitadas en habilidades parentales', 100.00)
ON CONFLICT (id) DO NOTHING;

INSERT INTO iov (id, resultado_id, codigo, descripcion, unidad, linea_base, meta, peso,
                 tipo_fuente_verificacion, responsable_id) VALUES
  ('66666666-6666-4666-8666-666666666666', '55555555-5555-4555-8555-555555555555', 'R1-I1',
   'Número de familias que completan el ciclo de talleres', 'familias', 0, 50, 100.00,
   'Lista de asistencia firmada', '22222222-2222-4222-8222-222222222222')
ON CONFLICT (id) DO NOTHING;
