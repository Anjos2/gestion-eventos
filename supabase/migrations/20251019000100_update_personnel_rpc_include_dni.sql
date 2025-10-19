-- Update RPC functions to include DNI field

-- Drop existing function to recreate with new signature
DROP FUNCTION IF EXISTS public.get_organization_personnel(INTEGER, INTEGER);

-- Recreate function with DNI field
CREATE OR REPLACE FUNCTION public.get_organization_personnel(
  p_limit INTEGER DEFAULT NULL,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id INTEGER,
  supabase_user_id UUID,
  id_organizacion INTEGER,
  nombre VARCHAR,
  email VARCHAR,
  rol VARCHAR,
  es_activo BOOLEAN,
  dni VARCHAR
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_org INTEGER;
  v_user_rol TEXT;
BEGIN
  -- Obtener organización y rol del usuario actual
  SELECT p.id_organizacion, p.rol::text
  INTO v_user_org, v_user_rol
  FROM "Personal" p
  WHERE p.supabase_user_id = auth.uid()
  LIMIT 1;

  -- Verificar permisos: Super admin o ADMINISTRATIVO
  IF NOT (
    auth.uid() = '7f76aede-699d-463e-acf5-5c95a3e8b84e'::uuid
    OR v_user_rol = 'ADMINISTRATIVO'
  ) THEN
    RAISE EXCEPTION 'No tienes permisos para consultar el personal';
  END IF;

  -- Para super admin: retornar todo el personal si no hay organización específica
  IF auth.uid() = '7f76aede-699d-463e-acf5-5c95a3e8b84e'::uuid AND v_user_org IS NULL THEN
    RETURN QUERY
    SELECT
      p.id,
      p.supabase_user_id,
      p.id_organizacion,
      p.nombre,
      p.email,
      p.rol,
      p.es_activo,
      p.dni
    FROM "Personal" p
    ORDER BY p.id DESC
    LIMIT p_limit
    OFFSET p_offset;
  ELSE
    -- Para admins normales: solo su organización
    RETURN QUERY
    SELECT
      p.id,
      p.supabase_user_id,
      p.id_organizacion,
      p.nombre,
      p.email,
      p.rol,
      p.es_activo,
      p.dni
    FROM "Personal" p
    WHERE p.id_organizacion = v_user_org
    ORDER BY p.id DESC
    LIMIT p_limit
    OFFSET p_offset;
  END IF;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_organization_personnel TO authenticated;
