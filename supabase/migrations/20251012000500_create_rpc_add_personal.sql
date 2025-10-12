-- Crear función RPC para añadir personal con verificación de permisos
--
-- Problema: Las políticas RLS con subconsultas crean dependencias circulares inevitables.
-- Cuando INSERT tiene subconsulta a Personal, y SELECT también, hay recursión infinita.
--
-- Solución: Usar funciones RPC (Remote Procedure Call) con SECURITY DEFINER que:
-- 1. Verifican permisos internamente sin depender de políticas RLS
-- 2. Ejecutan operaciones con privilegios elevados
-- 3. Son el patrón recomendado por Supabase para operaciones complejas
--
-- Este es un enfoque arquitectónico más limpio y mantenible.

-- Función para añadir personal
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

  -- Insertar nuevo personal (bypassing RLS porque es SECURITY DEFINER)
  INSERT INTO "Personal" (nombre, email, rol, id_organizacion, es_activo)
  VALUES (p_nombre, p_email, p_rol::user_role, p_id_organizacion, true)
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

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.add_personal_member TO authenticated;

-- Simplificar políticas INSERT/UPDATE: solo super admin puede hacerlo directamente
-- Los usuarios normales DEBEN usar la función RPC

-- Eliminar políticas problemáticas
DROP POLICY IF EXISTS "personal_insert_policy" ON "Personal";
DROP POLICY IF EXISTS "personal_update_policy" ON "Personal";

-- Política INSERT: Solo super admin puede insertar directamente
CREATE POLICY "personal_insert_policy" ON "Personal"
  FOR INSERT
  WITH CHECK (
    auth.uid() = '7f76aede-699d-463e-acf5-5c95a3e8b84e'::uuid
  );

-- Política UPDATE: Solo super admin puede actualizar directamente
CREATE POLICY "personal_update_policy" ON "Personal"
  FOR UPDATE
  USING (
    auth.uid() = '7f76aede-699d-463e-acf5-5c95a3e8b84e'::uuid
  );

-- NOTA: Las funciones RPC con SECURITY DEFINER bypassan RLS y ejecutan con
-- privilegios del owner (postgres), pero validan permisos internamente.
-- Esto es más seguro y mantenible que políticas RLS complejas.
