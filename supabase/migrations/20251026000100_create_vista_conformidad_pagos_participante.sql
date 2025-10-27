-- Migration: Create vista_conformidad_pagos_participante view
-- Description: Payment conformity view showing participant payments aggregated by contract type
-- This view is used to generate payment approval reports

-- Drop the view if it exists (for idempotency)
DROP VIEW IF EXISTS public.vista_conformidad_pagos_participante;

-- Create the view
CREATE VIEW public.vista_conformidad_pagos_participante AS
SELECT
  ec.id_organizacion,
  pp.id_canal_pago_egreso AS id_canal_pago,
  pp.id_personal_participante,
  p.nombre AS participante_nombre,
  p.dni,
  c.id_tipo_contrato,
  tc.nombre AS tipo_contrato_nombre,
  DATE_TRUNC('month', c.fecha_hora_evento) AS mes,
  COUNT(DISTINCT ec.id) AS cantidad_eventos,
  COALESCE(SUM(esa.monto_pactado), 0) AS total_monto,
  MAX(c.fecha_hora_evento) AS fecha_ultimo_evento
FROM "Participaciones_Personal" pp
INNER JOIN "Personal" p ON pp.id_personal_participante = p.id
INNER JOIN "Eventos_Contrato" ec ON pp.id_evento_contrato = ec.id
INNER JOIN "Contratos" c ON ec.id_contrato = c.id
INNER JOIN "Tipos_Contrato" tc ON c.id_tipo_contrato = tc.id
INNER JOIN "Evento_Servicios_Asignados" esa ON esa.id_participacion = pp.id
WHERE pp.incluir_en_calculos = true
  AND pp.estado_asistencia IN ('ASIGNADO', 'PRESENTE')
  AND c.estado = 'COMPLETADO'
  AND p.es_activo = true
GROUP BY
  ec.id_organizacion,
  pp.id_canal_pago_egreso,
  pp.id_personal_participante,
  p.nombre,
  p.dni,
  c.id_tipo_contrato,
  tc.nombre,
  DATE_TRUNC('month', c.fecha_hora_evento)
ORDER BY
  mes DESC,
  participante_nombre ASC,
  tipo_contrato_nombre ASC;

-- Add comment to document the view
COMMENT ON VIEW public.vista_conformidad_pagos_participante IS
'Payment conformity report view. Shows participant earnings aggregated by contract type for a given month.
Used to generate payment approval sheets (conformidad de pagos).
Only includes active personnel, completed contracts, and participations marked to include in calculations.';
