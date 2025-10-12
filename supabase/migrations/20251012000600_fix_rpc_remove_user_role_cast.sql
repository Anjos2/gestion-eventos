-- Corregir función RPC add_personal_member: remover cast a tipo inexistente
--
-- Problema: La función intenta hacer cast a 'user_role' que no existe.
-- La columna 'rol' en Personal es simplemente VARCHAR.
--
-- Solución: Remover el cast ::user_role y usar p_rol directamente.

CREATE OR REPLACE FUNCTION public.add_personal_member(
  p_nombre TEXT,
  p_email TEXT,
  p_rol TEXT,
  p_id_organizacion INTEGER
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_org INTEGER;
  v_user_rol TEXT;
  v_result json;
BEGIN
  -- Obtener organización y rol del usuario actual
  SELECT id_organizacion, rol::text
  INTO v_user_org, v_user_rol
  FROM "Personal"
  WHERE supabase_user_id = auth.uid()
  LIMIT 1;

  -- Verificar permisos: Super admin o ADMINISTRATIVO de la misma organización
  IF NOT (
    auth.uid() = '7f76aede-699d-463e-acf5-5c95a3e8b84e'::uuid
    OR (v_user_rol = 'ADMINISTRATIVO' AND v_user_org = p_id_organizacion)
  ) THEN
    RAISE EXCEPTION 'No tienes permisos para añadir personal a esta organización';
  END IF;

  -- Validar rol
  IF p_rol NOT IN ('OPERATIVO', 'ADMINISTRATIVO_APOYO', 'ADMINISTRATIVO') THEN
    RAISE EXCEPTION 'Rol inválido: %', p_rol;
  END IF;

  -- Insertar nuevo personal (SIN CAST a user_role, usar TEXT directamente)
  INSERT INTO "Personal" (nombre, email, rol, id_organizacion, es_activo)
  VALUES (p_nombre, p_email, p_rol, p_id_organizacion, true)
  RETURNING json_build_object(
    'id', id,
    'nombre', nombre,
    'email', email,
    'rol', rol,
    'id_organizacion', id_organizacion,
    'es_activo', es_activo,
    'supabase_user_id', supabase_user_id
  ) INTO v_result;

  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error al añadir personal: %', SQLERRM;
END;
$$;
