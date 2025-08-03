CREATE TABLE
  public."Configuracion_Plataforma" (
    clave character varying NOT NULL,
    valor character varying NOT NULL,
    CONSTRAINT "Configuracion_Plataforma_pkey" PRIMARY KEY (clave)
  ) TABLESPACE pg_default;

-- Insertar el valor inicial para el precio por registro
INSERT INTO public."Configuracion_Plataforma" (clave, valor) VALUES ('precio_por_registro', '0.10');
