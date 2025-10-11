-- Corregir política RLS de Personal para permitir acceso independientemente del estado de la organización
-- Esto permite que el contexto cargue correctamente y el sidebar se muestre
-- La lógica de bloqueo por suspensión ya está implementada en el layout del dashboard

-- Eliminar la política restrictiva anterior
DROP POLICY IF EXISTS "Allow access to active organizations on Personal" ON "Personal";

-- Crear nueva política que permite:
-- 1. Al super admin ver todo
-- 2. A cada usuario ver su propio registro independientemente del estado de la organización
-- 3. A usuarios de la misma organización verse entre sí (para funciones administrativas)
CREATE POLICY "personal_select_policy" ON "Personal"
  FOR SELECT
  USING (
    -- Super admin puede ver todo
    auth.uid() = '7f76aede-699d-463e-acf5-5c95a3e8b84e'::uuid
    OR
    -- El usuario puede ver su propio registro
    supabase_user_id = auth.uid()
    OR
    -- Usuarios de la misma organización pueden verse entre sí
    id_organizacion IN (
      SELECT id_organizacion
      FROM "Personal"
      WHERE supabase_user_id = auth.uid()
    )
  );

-- Mantener las restricciones de modificación solo para super admin
CREATE POLICY "personal_modify_policy" ON "Personal"
  FOR ALL
  USING (auth.uid() = '7f76aede-699d-463e-acf5-5c95a3e8b84e'::uuid);
