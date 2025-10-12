-- Arreglar política SELECT de Personal para permitir visibilidad organizacional
--
-- Problema: La política SELECT solo permite a cada usuario ver su propio registro.
-- Esto bloquea las subconsultas en INSERT/UPDATE que necesitan verificar
-- la organización y rol del usuario para otorgar permisos.
--
-- Solución: Permitir que usuarios ADMINISTRATIVO vean otros usuarios
-- de su misma organización. Esto habilita:
-- 1. Las subconsultas en políticas INSERT/UPDATE funcionen correctamente
-- 2. Los admins puedan gestionar su personal
-- 3. Queries futuras no tengan problemas de visibilidad

-- Eliminar política SELECT restrictiva actual
DROP POLICY IF EXISTS "personal_select_policy" ON "Personal";

-- Crear nueva política SELECT con visibilidad organizacional
CREATE POLICY "personal_select_policy" ON "Personal"
  FOR SELECT
  USING (
    -- Super admin puede ver todo
    auth.uid() = '7f76aede-699d-463e-acf5-5c95a3e8b84e'::uuid
    OR
    -- Cada usuario puede ver su propio registro
    supabase_user_id = auth.uid()
    OR
    -- Usuarios ADMINISTRATIVO pueden ver otros usuarios de su misma organización
    (
      id_organizacion IN (
        SELECT id_organizacion
        FROM "Personal"
        WHERE supabase_user_id = auth.uid()
          AND rol = 'ADMINISTRATIVO'
      )
    )
  );

-- NOTA: Esta política ahora permite que:
-- 1. Super admin ve absolutamente todo
-- 2. Usuarios normales ven solo su propio registro (privacidad)
-- 3. Admins ven todos los usuarios de su organización (gestión)
-- 4. Las subconsultas en INSERT/UPDATE ahora pueden funcionar correctamente
