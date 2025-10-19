-- Migration: Create vista_lotes_pago_personal_detalle view
-- Description: Flattened view of payment batches with service details for personnel.
-- Replaces complex nested joins in operative user payment views.
-- This view pre-joins all necessary tables following the correct schema structure.

-- Drop the view if it exists (for idempotency)
DROP VIEW IF EXISTS public.vista_lotes_pago_personal_detalle;

-- Create the view
CREATE VIEW public.vista_lotes_pago_personal_detalle AS
SELECT
    lp.id AS id_lote,
    lp.id_organizacion,
    lp.id_personal,
    lp.monto_total,
    lp.fecha_pago,
    lp.estado,
    dlp.monto_pagado,
    dlp.estado_asistencia_registrado,
    dlp.descuento_aplicado_pct,
    s.nombre AS servicio_nombre,
    c.id AS contrato_id
FROM
    "Lotes_Pago" lp
    INNER JOIN "Detalles_Lote_Pago" dlp ON dlp.id_lote_pago = lp.id
    INNER JOIN "Evento_Servicios_Asignados" esa ON esa.id = dlp.id_evento_servicio_asignado
    INNER JOIN "Servicios" s ON s.id = esa.id_servicio
    INNER JOIN "Participaciones_Personal" pp ON pp.id = esa.id_participacion
    INNER JOIN "Eventos_Contrato" ec ON ec.id = pp.id_evento_contrato
    INNER JOIN "Contratos" c ON c.id = ec.id_contrato;

-- Add comment to document the view
COMMENT ON VIEW public.vista_lotes_pago_personal_detalle IS
'Flattened view of payment batches with full service details. Combines data from Lotes_Pago,
Detalles_Lote_Pago, Evento_Servicios_Asignados, Servicios, Participaciones_Personal,
Eventos_Contrato, and Contratos. Used for operative user payment history and pending approval views.
Follows the correct schema structure: Lotes_Pago → Detalles_Lote_Pago (via id_lote_pago) →
Evento_Servicios_Asignados (via id_evento_servicio_asignado) → Participaciones_Personal (via id_participacion) →
Eventos_Contrato (via id_evento_contrato) → Contratos (via id_contrato).';
