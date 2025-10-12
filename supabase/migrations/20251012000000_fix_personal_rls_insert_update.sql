-- Arreglar políticas RLS de Personal para permitir a administradores gestionar su personal
--
-- Problema: La política personal_modify_policy solo permite al super admin modificar Personal,
-- bloqueando a los administradores de organización.
--
-- Solución: Crear políticas separadas para INSERT, UPDATE, DELETE que permitan a los
-- administradores gestionar el personal de su propia organización.

-- Eliminar política restrictiva actual
DROP POLICY IF EXISTS "personal_modify_policy" ON "Personal";

-- Política para INSERT: Permitir a super admin y a admins insertar en su propia organización
CREATE POLICY "personal_insert_policy" ON "Personal"
  FOR INSERT
  WITH CHECK (
    -- Super admin puede insertar cualquier registro
    auth.uid() = '7f76aede-699d-463e-acf5-5c95a3e8b84e'::uuid
    OR
    -- Usuario ADMINISTRATIVO puede insertar en su propia organización
    EXISTS (
      SELECT 1 FROM "Personal" AS p_admin
      WHERE p_admin.supabase_user_id = auth.uid()
        AND p_admin.rol = 'ADMINISTRATIVO'
        AND p_admin.id_organizacion = "Personal".id_organizacion
    )
  );

-- Política para UPDATE: Permitir a super admin y a admins actualizar personal de su organización
CREATE POLICY "personal_update_policy" ON "Personal"
  FOR UPDATE
  USING (
    -- Super admin puede actualizar cualquier registro
    auth.uid() = '7f76aede-699d-463e-acf5-5c95a3e8b84e'::uuid
    OR
    -- Usuario ADMINISTRATIVO puede actualizar personal de su propia organización
    EXISTS (
      SELECT 1 FROM "Personal" AS p_admin
      WHERE p_admin.supabase_user_id = auth.uid()
        AND p_admin.rol = 'ADMINISTRATIVO'
        AND p_admin.id_organizacion = "Personal".id_organizacion
    )
  )
  WITH CHECK (
    -- Super admin puede actualizar a cualquier valor
    auth.uid() = '7f76aede-699d-463e-acf5-5c95a3e8b84e'::uuid
    OR
    -- Admin solo puede actualizar dentro de su propia organización
    EXISTS (
      SELECT 1 FROM "Personal" AS p_admin
      WHERE p_admin.supabase_user_id = auth.uid()
        AND p_admin.rol = 'ADMINISTRATIVO'
        AND p_admin.id_organizacion = "Personal".id_organizacion
    )
  );

-- Política para DELETE: Solo super admin
CREATE POLICY "personal_delete_policy" ON "Personal"
  FOR DELETE
  USING (
    auth.uid() = '7f76aede-699d-463e-acf5-5c95a3e8b84e'::uuid
  );
