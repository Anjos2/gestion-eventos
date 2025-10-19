-- Migration: Drop obsolete dashboard_pagos_pendientes_flat view
-- Description: This view was created for the old dashboard flow but is no longer used.
-- The current dashboard uses direct queries with simple filters (count only).

-- Drop the obsolete view
DROP VIEW IF EXISTS public.dashboard_pagos_pendientes_flat;

-- Add comment to document why this view was removed
COMMENT ON SCHEMA public IS
'Removed dashboard_pagos_pendientes_flat view in migration 20251019000300 as it was not used in any current code.';
