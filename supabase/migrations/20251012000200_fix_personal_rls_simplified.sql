-- Arreglar políticas RLS de Personal - versión simplificada sin funciones helper
--
-- Problema: Las funciones SECURITY DEFINER aún están sujetas a RLS de la tabla Personal,
-- creando dependencias circulares que impiden que funcionen correctamente.
--
-- Solución: Eliminar funciones helper y usar subconsultas directas en las políticas RLS
-- con sintaxis clara que evite ambigüedades.

-- Eliminar políticas anteriores PRIMERO (dependen de las funciones)
DROP POLICY IF EXISTS "personal_insert_policy" ON "Personal";
DROP POLICY IF EXISTS "personal_update_policy" ON "Personal";
DROP POLICY IF EXISTS "personal_delete_policy" ON "Personal";

-- Ahora eliminar funciones helper (no funcionan con RLS)
DROP FUNCTION IF EXISTS public.get_user_organization_id();
DROP FUNCTION IF EXISTS public.get_user_role();
DROP FUNCTION IF EXISTS public.is_admin_of_organization(INTEGER);

-- Política INSERT: Super admin o admin insertando en su propia organización
CREATE POLICY "personal_insert_policy" ON "Personal"
  FOR INSERT
  WITH CHECK (
    -- Super admin puede insertar cualquier registro
    auth.uid() = '7f76aede-699d-463e-acf5-5c95a3e8b84e'::uuid
    OR
    -- Admin puede insertar solo en su propia organización
    -- La subconsulta retorna la organización del usuario actual si es ADMINISTRATIVO
    id_organizacion IN (
      SELECT id_organizacion
      FROM "Personal"
      WHERE supabase_user_id = auth.uid()
        AND rol = 'ADMINISTRATIVO'
    )
  );

-- Política UPDATE: Super admin o admin actualizando en su propia organización
CREATE POLICY "personal_update_policy" ON "Personal"
  FOR UPDATE
  USING (
    -- Super admin puede actualizar cualquier registro
    auth.uid() = '7f76aede-699d-463e-acf5-5c95a3e8b84e'::uuid
    OR
    -- Admin puede actualizar solo personal de su organización
    id_organizacion IN (
      SELECT id_organizacion
      FROM "Personal"
      WHERE supabase_user_id = auth.uid()
        AND rol = 'ADMINISTRATIVO'
    )
  )
  WITH CHECK (
    -- Verificar que el UPDATE mantenga el registro en la organización permitida
    auth.uid() = '7f76aede-699d-463e-acf5-5c95a3e8b84e'::uuid
    OR
    id_organizacion IN (
      SELECT id_organizacion
      FROM "Personal"
      WHERE supabase_user_id = auth.uid()
        AND rol = 'ADMINISTRATIVO'
    )
  );

-- Política DELETE: Solo super admin
CREATE POLICY "personal_delete_policy" ON "Personal"
  FOR DELETE
  USING (
    auth.uid() = '7f76aede-699d-463e-acf5-5c95a3e8b84e'::uuid
  );

-- NOTA IMPORTANTE: Esta versión funciona porque:
-- 1. La subconsulta es simple y clara: retorna la organización del usuario actual
-- 2. En INSERT: "id_organizacion" se refiere a la columna de la fila que se está insertando
-- 3. La subconsulta solo consulta el propio registro del usuario (permitido por política SELECT)
-- 4. No hay ambigüedad en las referencias de tabla
