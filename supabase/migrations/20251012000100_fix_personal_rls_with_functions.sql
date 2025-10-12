-- Arreglar políticas RLS de Personal usando funciones helper
--
-- Problema: La política INSERT con EXISTS causaba referencias ambiguas
-- cuando PostgreSQL evaluaba "Personal".id_organizacion durante el INSERT.
--
-- Solución: Crear funciones helper que devuelvan la organización y rol del usuario actual,
-- eliminando la necesidad de subconsultas complejas en las políticas.

-- Función 1: Obtener el id de organización del usuario actual
CREATE OR REPLACE FUNCTION public.get_user_organization_id()
RETURNS INTEGER
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT id_organizacion
  FROM public."Personal"
  WHERE supabase_user_id = auth.uid()
  LIMIT 1;
$$;

-- Función 2: Obtener el rol del usuario actual
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT rol::text
  FROM public."Personal"
  WHERE supabase_user_id = auth.uid()
  LIMIT 1;
$$;

-- Función 3: Verificar si el usuario es admin de una organización específica
CREATE OR REPLACE FUNCTION public.is_admin_of_organization(org_id INTEGER)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public."Personal"
    WHERE supabase_user_id = auth.uid()
      AND rol = 'ADMINISTRATIVO'
      AND id_organizacion = org_id
  );
$$;

-- Eliminar políticas anteriores
DROP POLICY IF EXISTS "personal_insert_policy" ON "Personal";
DROP POLICY IF EXISTS "personal_update_policy" ON "Personal";
DROP POLICY IF EXISTS "personal_delete_policy" ON "Personal";

-- Política INSERT: Super admin o admin de la organización especificada
CREATE POLICY "personal_insert_policy" ON "Personal"
  FOR INSERT
  WITH CHECK (
    -- Super admin puede insertar cualquier registro
    auth.uid() = '7f76aede-699d-463e-acf5-5c95a3e8b84e'::uuid
    OR
    -- Admin puede insertar en su propia organización
    (
      public.get_user_role() = 'ADMINISTRATIVO'
      AND public.is_admin_of_organization(id_organizacion)
    )
  );

-- Política UPDATE: Super admin o admin de la organización
CREATE POLICY "personal_update_policy" ON "Personal"
  FOR UPDATE
  USING (
    -- Super admin puede actualizar cualquier registro
    auth.uid() = '7f76aede-699d-463e-acf5-5c95a3e8b84e'::uuid
    OR
    -- Admin puede actualizar personal de su organización
    (
      public.get_user_role() = 'ADMINISTRATIVO'
      AND public.is_admin_of_organization(id_organizacion)
    )
  )
  WITH CHECK (
    -- Verificar que el UPDATE mantenga el registro en la misma organización
    auth.uid() = '7f76aede-699d-463e-acf5-5c95a3e8b84e'::uuid
    OR
    (
      public.get_user_role() = 'ADMINISTRATIVO'
      AND public.is_admin_of_organization(id_organizacion)
    )
  );

-- Política DELETE: Solo super admin
CREATE POLICY "personal_delete_policy" ON "Personal"
  FOR DELETE
  USING (
    auth.uid() = '7f76aede-699d-463e-acf5-5c95a3e8b84e'::uuid
  );
