CREATE OR REPLACE FUNCTION get_servicios_pendientes_por_personal(p_id_personal_participante INT)
RETURNS TABLE (
    id_servicio_asignado INT,
    monto_pactado DECIMAL,
    servicio_nombre VARCHAR,
    contrato_id INT,
    fecha_evento TIMESTAMP WITH TIME ZONE,
    tipo_contrato_nombre VARCHAR,
    estado_asistencia VARCHAR
)
AS $$
BEGIN
    RETURN QUERY
    SELECT
        esa.id AS id_servicio_asignado,
        esa.monto_pactado,
        s.nombre AS servicio_nombre,
        c.id AS contrato_id,
        c.fecha_hora_evento AS fecha_evento,
        tc.nombre AS tipo_contrato_nombre,
        pp.estado_asistencia
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
        pp.id_personal_participante = p_id_personal_participante
        AND esa.estado_pago = 'PENDIENTE'
        AND c.estado = 'COMPLETADO'
    ORDER BY
        c.fecha_hora_evento DESC;
END;
$$ LANGUAGE plpgsql;