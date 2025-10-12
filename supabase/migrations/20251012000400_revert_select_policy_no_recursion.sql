-- Revertir política SELECT de Personal a versión simple sin recursión
--
-- Problema: La política SELECT con subconsulta que consulta Personal causa
-- recursión infinita: SELECT evalúa política → subconsulta → SELECT evalúa política → ...
-- Esto hace que OrganizationContext falle y el sidebar desaparezca.
--
-- Solución: Revertir a política SELECT simple que solo permite ver el propio registro.
-- Las políticas INSERT/UPDATE pueden funcionar porque sus subconsultas pueden acceder
-- al propio registro del admin gracias a la condición "supabase_user_id = auth.uid()".

-- Eliminar política SELECT con recursión
DROP POLICY IF EXISTS "personal_select_policy" ON "Personal";

-- Crear política SELECT simple sin recursión
CREATE POLICY "personal_select_policy" ON "Personal"
  FOR SELECT
  USING (
    -- Super admin puede ver todo
    auth.uid() = '7f76aede-699d-463e-acf5-5c95a3e8b84e'::uuid
    OR
    -- Cada usuario puede ver solo su propio registro
    supabase_user_id = auth.uid()
  );

-- NOTA IMPORTANTE:
-- Esta política NO tiene subconsultas que consulten Personal, evitando recursión.
-- Las políticas INSERT/UPDATE SÍ tienen subconsultas, pero funcionan porque:
-- 1. Sus subconsultas acceden al propio registro del usuario (permitido arriba)
-- 2. SELECT simple no causa recursión
-- 3. No hay dependencias circulares
