-- Add DNI column to Personal table
-- DNI is optional but must be unique per organization when provided

-- Add DNI column
ALTER TABLE "Personal"
ADD COLUMN IF NOT EXISTS dni VARCHAR(12) NULL;

-- Add check constraint for DNI length (8-12 characters)
ALTER TABLE "Personal"
ADD CONSTRAINT personal_dni_length_check
CHECK (dni IS NULL OR (LENGTH(dni) >= 8 AND LENGTH(dni) <= 12));

-- Add unique constraint for DNI per organization
-- Using partial unique index to allow multiple NULL values
CREATE UNIQUE INDEX IF NOT EXISTS personal_dni_organizacion_unique
ON "Personal" (id_organizacion, dni)
WHERE dni IS NOT NULL;

-- Add comment
COMMENT ON COLUMN "Personal".dni IS 'Documento Nacional de Identidad (DNI) u otro documento de identidad. Único por organización.';
