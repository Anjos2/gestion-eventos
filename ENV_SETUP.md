# Configuración de Variables de Entorno

Este documento explica cómo configurar las variables de entorno para diferentes ambientes.

## Variables Requeridas

```bash
# URLs de Supabase (igual para todos los entornos)
NEXT_PUBLIC_SUPABASE_URL=https://drevklsnlxrbsrlmjrpz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRyZXZrbHNubHhyYnNybG1qcnB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM2NTY3NzksImV4cCI6MjA2OTIzMjc3OX0.wJJzW4iIRJ8b7Rjnr_JBlcyK4EUKd1TGSeKTthe-3xQ

# Supabase Service Role Key (⚠️ SOLO PARA SERVER-SIDE)
# Obtener de: Dashboard de Supabase → Settings → API → service_role (secret)
# ⚠️ NUNCA exponer al cliente, NUNCA commitear en git
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key_aqui

# Super Admin ID (igual para todos los entornos)
NEXT_PUBLIC_SUPER_ADMIN_ID=7f76aede-699d-463e-acf5-5c95a3e8b84e

# URL del sitio (CAMBIA según el entorno)
NEXT_PUBLIC_SITE_URL=http://localhost:3000  # Para desarrollo
# NEXT_PUBLIC_SITE_URL=https://gestion-eventos-iota.vercel.app  # Para producción
```

## Configuración por Entorno

### Desarrollo Local
En `.env.local`:
```bash
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### Producción (Vercel)
En el dashboard de Vercel → Settings → Environment Variables:
```bash
NEXT_PUBLIC_SITE_URL=https://gestion-eventos-iota.vercel.app
```

### Staging (si aplica)
```bash
NEXT_PUBLIC_SITE_URL=https://gestion-eventos-staging.vercel.app
```

## Uso en el Código

**✅ CORRECTO:**
```typescript
const url = `${process.env.NEXT_PUBLIC_SITE_URL}/auth/set-password`;
```

**❌ INCORRECTO:**
```typescript
const url = `https://gestion-eventos-iota.vercel.app/auth/set-password`;
const url = `http://localhost:3000/auth/set-password`;
```

## Configuración en Supabase

En el dashboard de Supabase → Authentication → URL Configuration:

**Site URL:**
- Desarrollo: `http://localhost:3000`
- Producción: `https://gestion-eventos-iota.vercel.app`

**Redirect URLs:**
- `http://localhost:3000/auth/set-password` (desarrollo)
- `https://gestion-eventos-iota.vercel.app/auth/set-password` (producción)

## Archivos que Usan Variables de Entorno

### NEXT_PUBLIC_SITE_URL
1. `app/auth/login/page.tsx` - Reset de contraseña
2. `app/auth/register-personal/page.tsx` - Registro de personal (deprecado)

### SUPABASE_SERVICE_ROLE_KEY (Server-side only)
1. `app/api/create-personal/route.ts` - Creación automática de usuarios

## Cómo Obtener el Service Role Key

1. Ve al [Dashboard de Supabase](https://supabase.com/dashboard)
2. Selecciona tu proyecto
3. Ve a `Settings` → `API`
4. En la sección **Project API keys**, copia la clave `service_role` (secret)
5. Pégala en tu archivo `.env.local` como `SUPABASE_SERVICE_ROLE_KEY`

⚠️ **IMPORTANTE:** Esta clave tiene privilegios de administrador y bypasea RLS. Solo debe usarse en server-side (API routes).

## Notas Importantes

- ✅ **Nunca hardcodear URLs** en el código
- ✅ **Siempre usar** `process.env.NEXT_PUBLIC_SITE_URL`
- ✅ **Fallback** a `window.location.origin` si la variable no existe
- ✅ **Configurar en Vercel** todas las variables de entorno
- ✅ **Actualizar Supabase** URLs según el entorno
- 🔒 **NUNCA commitear** `SUPABASE_SERVICE_ROLE_KEY` en git (está en .gitignore)
- 🔒 **Service Role Key** solo se usa en API routes (server-side), nunca en cliente