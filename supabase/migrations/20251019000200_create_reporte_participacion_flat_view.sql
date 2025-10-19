-- Migration: Create reporte_participacion_flat view
-- Description: Flattens the complex participation data structure for reporting
-- This view pre-joins the necessary tables to simplify queries and improve performance

-- Drop the view if it exists (for idempotency)
DROP VIEW IF EXISTS public.reporte_participacion_flat;

-- Create the view
CREATE VIEW public.reporte_participacion_flat AS
SELECT
    pp.id_personal_participante,
    pp.estado_asistencia,
    c.id AS id_contrato,
    c.fecha_hora_evento,
    ec.id_organizacion,
    tc.nombre AS tipo_contrato_nombre,
    s.nombre AS servicio_nombre,
    esa.monto_pactado
FROM
    "Participaciones_Personal" pp
    INNER JOIN "Eventos_Contrato" ec ON pp.id_evento_contrato = ec.id
    INNER JOIN "Contratos" c ON ec.id_contrato = c.id
    INNER JOIN "Tipos_Contrato" tc ON c.id_tipo_contrato = tc.id
    INNER JOIN "Evento_Servicios_Asignados" esa ON esa.id_participacion = pp.id
    INNER JOIN "Servicios" s ON esa.id_servicio = s.id
ORDER BY
    c.fecha_hora_evento DESC;

-- Add comment to document the view
COMMENT ON VIEW public.reporte_participacion_flat IS
'Flattened view of personnel participation in events. Combines data from Participaciones_Personal,
Eventos_Contrato, Contratos, Tipos_Contrato, Evento_Servicios_Asignados, and Servicios for
simplified reporting and improved query performance.';
