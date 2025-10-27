-- Migration: Create vista_pagos_pendientes_participante view
-- Description: Pending payments view showing participant work awaiting payment
-- This view is used to track and generate reports of pending payments to personnel

-- Drop the view if it exists (for idempotency)
DROP VIEW IF EXISTS public.vista_pagos_pendientes_participante;

-- Create the view
CREATE VIEW public.vista_pagos_pendientes_participante AS
SELECT
  ec.id_organizacion,
  pp.id_canal_pago_egreso AS id_canal_pago,
  cp.nombre AS canal_pago_nombre,
  cp.es_principal AS canal_es_principal,
  pp.id_personal_participante,
  p.nombre AS participante_nombre,
  p.dni,
  c.id_tipo_contrato,
  tc.nombre AS tipo_contrato_nombre,
  DATE_TRUNC('month', c.fecha_hora_evento) AS mes,
  DATE(c.fecha_hora_evento) AS fecha_evento,
  c.fecha_hora_evento,
  COUNT(DISTINCT ec.id) AS cantidad_eventos,
  COALESCE(SUM(esa.monto_pactado), 0) AS total_monto,
  MIN(c.fecha_hora_evento) AS fecha_primer_evento,
  MAX(c.fecha_hora_evento) AS fecha_ultimo_evento,
  STRING_AGG(DISTINCT tc.nombre, ', ' ORDER BY tc.nombre) AS tipos_contrato_detalle
FROM "Participaciones_Personal" pp
INNER JOIN "Personal" p ON pp.id_personal_participante = p.id
INNER JOIN "Eventos_Contrato" ec ON pp.id_evento_contrato = ec.id
INNER JOIN "Contratos" c ON ec.id_contrato = c.id
INNER JOIN "Tipos_Contrato" tc ON c.id_tipo_contrato = tc.id
INNER JOIN "Evento_Servicios_Asignados" esa ON esa.id_participacion = pp.id
INNER JOIN "Canales_Pago" cp ON pp.id_canal_pago_egreso = cp.id
WHERE pp.incluir_en_calculos = true
  AND pp.estado_asistencia IN ('ASIGNADO', 'PRESENTE')
  AND c.estado = 'COMPLETADO'
  AND p.es_activo = true
  AND cp.es_activo = true
GROUP BY
  ec.id_organizacion,
  pp.id_canal_pago_egreso,
  cp.nombre,
  cp.es_principal,
  pp.id_personal_participante,
  p.nombre,
  p.dni,
  c.id_tipo_contrato,
  tc.nombre,
  DATE_TRUNC('month', c.fecha_hora_evento),
  DATE(c.fecha_hora_evento),
  c.fecha_hora_evento
ORDER BY
  mes DESC,
  fecha_evento DESC,
  participante_nombre ASC;

-- Add comment to document the view
COMMENT ON VIEW public.vista_pagos_pendientes_participante IS
'Pending payments view. Shows all participant work from completed events that should be paid.
Aggregates payment amounts by participant, contract type, payment channel, and date.
Used to generate pending payment reports and track outstanding payments before processing payroll.
Only includes active personnel, active payment channels, completed contracts, and participations marked to include in calculations.';
