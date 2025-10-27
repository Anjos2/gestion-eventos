-- Migration: Create vista_balance_mensual_canal_tipo view
-- Description: Monthly balance view aggregating income and expenses by payment channel and contract type
-- This view calculates the financial balance for each combination of channel and contract type

-- Drop the view if it exists (for idempotency)
DROP VIEW IF EXISTS public.vista_balance_mensual_canal_tipo;

-- Create the view
CREATE VIEW public.vista_balance_mensual_canal_tipo AS
WITH ingresos AS (
  SELECT
    c.id_organizacion,
    c.id_canal_pago_ingreso AS id_canal_pago,
    c.id_tipo_contrato,
    tc.nombre AS tipo_contrato_nombre,
    DATE_TRUNC('month', c.fecha_hora_evento) AS mes,
    COUNT(DISTINCT c.id) AS cantidad_contratos,
    COALESCE(SUM(esa.monto_pactado), 0) AS total_ingresos
  FROM "Contratos" c
  INNER JOIN "Tipos_Contrato" tc ON c.id_tipo_contrato = tc.id
  INNER JOIN "Eventos_Contrato" ec ON ec.id_contrato = c.id
  INNER JOIN "Participaciones_Personal" pp ON pp.id_evento_contrato = ec.id
  INNER JOIN "Evento_Servicios_Asignados" esa ON esa.id_participacion = pp.id
  WHERE c.estado = 'COMPLETADO'
  GROUP BY c.id_organizacion, c.id_canal_pago_ingreso, c.id_tipo_contrato, tc.nombre, DATE_TRUNC('month', c.fecha_hora_evento)
),
egresos AS (
  SELECT
    ec.id_organizacion,
    pp.id_canal_pago_egreso AS id_canal_pago,
    c.id_tipo_contrato,
    tc.nombre AS tipo_contrato_nombre,
    DATE_TRUNC('month', c.fecha_hora_evento) AS mes,
    COUNT(DISTINCT pp.id) AS cantidad_participaciones,
    COALESCE(SUM(esa.monto_pactado), 0) AS total_egresos
  FROM "Participaciones_Personal" pp
  INNER JOIN "Eventos_Contrato" ec ON pp.id_evento_contrato = ec.id
  INNER JOIN "Contratos" c ON ec.id_contrato = c.id
  INNER JOIN "Tipos_Contrato" tc ON c.id_tipo_contrato = tc.id
  INNER JOIN "Evento_Servicios_Asignados" esa ON esa.id_participacion = pp.id
  WHERE pp.incluir_en_calculos = true
    AND pp.estado_asistencia IN ('ASIGNADO', 'PRESENTE')
  GROUP BY ec.id_organizacion, pp.id_canal_pago_egreso, c.id_tipo_contrato, tc.nombre, DATE_TRUNC('month', c.fecha_hora_evento)
)
SELECT
  COALESCE(i.id_organizacion, e.id_organizacion) AS id_organizacion,
  COALESCE(i.id_canal_pago, e.id_canal_pago) AS id_canal_pago,
  COALESCE(i.id_tipo_contrato, e.id_tipo_contrato) AS id_tipo_contrato,
  COALESCE(i.tipo_contrato_nombre, e.tipo_contrato_nombre) AS tipo_contrato_nombre,
  COALESCE(i.mes, e.mes) AS mes,
  COALESCE(i.cantidad_contratos, 0) AS cantidad_contratos,
  COALESCE(i.total_ingresos, 0) AS total_ingresos,
  COALESCE(e.cantidad_participaciones, 0) AS cantidad_participaciones,
  COALESCE(e.total_egresos, 0) AS total_egresos,
  COALESCE(i.total_ingresos, 0) - COALESCE(e.total_egresos, 0) AS neto
FROM ingresos i
FULL OUTER JOIN egresos e
  ON i.id_organizacion = e.id_organizacion
  AND i.id_canal_pago = e.id_canal_pago
  AND i.id_tipo_contrato = e.id_tipo_contrato
  AND i.mes = e.mes
ORDER BY mes DESC, id_canal_pago, id_tipo_contrato;

-- Add comment to document the view
COMMENT ON VIEW public.vista_balance_mensual_canal_tipo IS
'Monthly financial balance view. Aggregates contract income (ingresos) and personnel expenses (egresos)
grouped by payment channel and contract type. Includes net balance calculation.
Ingresos are calculated from id_canal_pago_ingreso in Contratos, egresos from id_canal_pago_egreso in Participaciones_Personal.
Only includes completed contracts and participations marked to include in calculations.';
