-- Migration: Create vista_control_diario_participante view
-- Description: Daily control view showing participant work details by day
-- This view is used to generate daily attendance and payment control reports

-- Drop the view if it exists (for idempotency)
DROP VIEW IF EXISTS public.vista_control_diario_participante;

-- Create the view
CREATE VIEW public.vista_control_diario_participante AS
SELECT
  ec.id_organizacion,
  pp.id_canal_pago_egreso AS id_canal_pago,
  c.id_tipo_contrato,
  tc.nombre AS tipo_contrato_nombre,
  DATE_TRUNC('month', c.fecha_hora_evento) AS mes,
  DATE(c.fecha_hora_evento) AS fecha_evento,
  pp.id_personal_participante,
  p.nombre AS participante_nombre,
  p.dni,
  esa.monto_pactado,
  c.fecha_hora_evento::TIME AS hora_evento,
  TO_CHAR(c.fecha_hora_evento, 'Day') AS dia_semana,
  c.id AS id_contrato,
  ec.id AS id_evento_contrato,
  pp.id AS id_participacion,
  pp.estado_asistencia,
  pp.hora_llegada
FROM "Participaciones_Personal" pp
INNER JOIN "Personal" p ON pp.id_personal_participante = p.id
INNER JOIN "Eventos_Contrato" ec ON pp.id_evento_contrato = ec.id
INNER JOIN "Contratos" c ON ec.id_contrato = c.id
INNER JOIN "Tipos_Contrato" tc ON c.id_tipo_contrato = tc.id
INNER JOIN "Evento_Servicios_Asignados" esa ON esa.id_participacion = pp.id
WHERE pp.incluir_en_calculos = true
  AND pp.estado_asistencia IN ('ASIGNADO', 'PRESENTE')
  AND p.es_activo = true
ORDER BY
  fecha_evento ASC,
  participante_nombre ASC,
  hora_evento ASC;

-- Add comment to document the view
COMMENT ON VIEW public.vista_control_diario_participante IS
'Daily control view for participant work tracking. Shows detailed day-by-day breakdown of participant
assignments including dates, times, and payment amounts. Used for daily attendance control and calendar views.
Only includes active personnel and participations marked to include in calculations.';
