CREATE OR REPLACE VIEW public.vista_servicios_pendientes_por_personal AS
SELECT
    esa.id AS id_servicio_asignado,
    esa.monto_pactado,
    s.nombre AS servicio_nombre,
    c.id AS contrato_id,
    c.fecha_hora_evento,
    tc.nombre AS tipo_contrato_nombre,
    pp.estado_asistencia,
    pp.id_personal_participante
FROM
    "Evento_Servicios_Asignados" esa
JOIN
    "Servicios" s ON esa.id_servicio = s.id
JOIN
    "Participaciones_Personal" pp ON esa.id_participacion = pp.id
JOIN
    "Eventos_Contrato" ec ON pp.id_evento_contrato = ec.id
JOIN
    "Contratos" c ON ec.id_contrato = c.id
JOIN
    "Tipos_Contrato" tc ON c.id_tipo_contrato = tc.id
WHERE
    esa.estado_pago = 'PENDIENTE'
    AND c.estado = 'COMPLETADO';
