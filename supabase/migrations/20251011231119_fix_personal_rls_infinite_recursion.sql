-- Arreglar recursión infinita en política RLS de Personal
--
-- Problema: La política personal_select_policy tiene una subconsulta que consulta
-- a la misma tabla Personal, causando recursión infinita cuando se evalúa la política.
--
-- Solución: Eliminar la tercera condición que causa recursión. Las dos primeras
-- condiciones (super admin y propio registro) son suficientes para el funcionamiento.

-- Eliminar política problemática
DROP POLICY IF EXISTS "personal_select_policy" ON "Personal";

-- Recrear política sin recursión
CREATE POLICY "personal_select_policy" ON "Personal"
  FOR SELECT
  USING (
    -- Super admin puede ver todo
    auth.uid() = '7f76aede-699d-463e-acf5-5c95a3e8b84e'::uuid
    OR
    -- El usuario puede ver su propio registro
    supabase_user_id = auth.uid()
  );

-- Nota: Se eliminó la condición recursiva que permitía ver usuarios de la misma
-- organización, ya que:
-- 1. Causaba recursión infinita en la evaluación de políticas
-- 2. No es necesaria para el funcionamiento actual del frontend
-- 3. Si se necesita en el futuro, se implementará con una query específica
--    que utilice el rol del usuario autenticado
