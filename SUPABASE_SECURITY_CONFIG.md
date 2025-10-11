# Configuración de Seguridad en Supabase

Este documento contiene las configuraciones de seguridad que deben realizarse manualmente en el dashboard de Supabase.

## 🔐 Configuración de Autenticación

### 1. OTP Expiry (Expiración de Código de Un Uso)

**Estado actual:** Configurado a más de 1 hora
**Recomendación:** Reducir a 1 hora o menos

**Pasos:**
1. Ir al dashboard de Supabase: https://supabase.com/dashboard
2. Seleccionar tu proyecto
3. Navegar a: `Authentication` → `Providers` → `Email`
4. En la sección `Email OTP Configuration`:
   - Cambiar `OTP Expiry` a `3600` segundos (1 hora) o menos
5. Guardar cambios

**Razón:** Los códigos OTP de larga duración son un riesgo de seguridad. Si un código es interceptado, el atacante tiene más tiempo para usarlo.

---

### 2. Leaked Password Protection (Protección contra Contraseñas Filtradas)

**Estado actual:** Deshabilitado
**Recomendación:** Habilitar

**Pasos:**
1. Ir al dashboard de Supabase
2. Navegar a: `Authentication` → `Policies` → `Password`
3. Habilitar `Password leak protection`
4. Guardar cambios

**Razón:** Esta función verifica las contraseñas contra la base de datos de HaveIBeenPwned.org para prevenir que los usuarios usen contraseñas comprometidas conocidas.

---

### 3. Actualización de PostgreSQL

**Estado actual:** `supabase-postgres-17.4.1.064` - Tiene parches de seguridad disponibles
**Recomendación:** Actualizar a la última versión

**Pasos:**
1. Ir al dashboard de Supabase
2. Navegar a: `Settings` → `Infrastructure` → `Database`
3. Buscar la sección de `Postgres version`
4. Hacer clic en `Upgrade` si está disponible
5. Seguir las instrucciones del wizard de actualización

**IMPORTANTE:**
- Realizar un backup completo antes de actualizar
- Programar la actualización en horario de bajo tráfico
- Probar en un ambiente de staging primero si es posible

**Razón:** Las versiones antiguas de PostgreSQL pueden contener vulnerabilidades de seguridad conocidas.

---

## ✅ Correcciones Aplicadas Automáticamente

Las siguientes correcciones ya fueron aplicadas mediante migraciones:

### Seguridad en Base de Datos
- ✅ Row Level Security (RLS) habilitado en tablas críticas:
  - `Organizaciones`
  - `Contadores_Uso`
  - `Historial_Facturacion`
  - `Configuracion_Plataforma`

- ✅ Funciones con `search_path` seguro:
  - `get_total_facturado()`
  - `crear_contador_uso()`
  - `incrementar_contador_registros()`
  - `verificar_estado_organizacion()`

- ✅ Vistas sin SECURITY DEFINER (ahora respetan RLS):
  - `reporte_participacion_flat`
  - `dashboard_pagos_pendientes_flat`
  - `vista_servicios_pendientes_por_personal`

### Rendimiento
- ✅ Índices añadidos en foreign keys para mejor rendimiento

### Código
- ✅ Console.log de debug eliminados
- ✅ TypeScript strict mode habilitado
- ✅ Variables de entorno corregidas

---

## 📋 Checklist de Verificación

Marca cuando completes cada configuración:

- [ ] OTP Expiry reducido a 1 hora o menos
- [ ] Leaked Password Protection habilitado
- [ ] PostgreSQL actualizado a la última versión
- [ ] Backup completo realizado antes de cambios
- [ ] Configuración probada en staging (si aplica)

---

## 🔗 Enlaces Útiles

- [Documentación de Supabase Auth](https://supabase.com/docs/guides/auth)
- [Guía de Seguridad de Supabase](https://supabase.com/docs/guides/platform/going-into-prod#security)
- [Database Linter](https://supabase.com/docs/guides/database/database-linter)
- [HaveIBeenPwned](https://haveibeenpwned.com/)

---

**Última actualización:** 2025-01-11
