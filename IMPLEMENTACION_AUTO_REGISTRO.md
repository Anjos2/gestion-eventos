# Implementación de Registro Automático de Personal

## ✅ Cambios Implementados

### 1. **Nuevo API Route** - `/app/api/create-personal/route.ts`
- Crea usuarios automáticamente con contraseña "admin"
- Email pre-confirmado (sin necesidad de verificación)
- Usa `SUPABASE_SERVICE_ROLE_KEY` para privilegios administrativos
- Vincula automáticamente con tabla `Personal`
- Solo permite crear roles: `OPERATIVO` y `ADMINISTRATIVO_APOYO`

### 2. **Página de Personal Actualizada** - `app/dashboard/personal/page.tsx`
- Reemplaza llamada RPC por API route
- Elimina generación de links de invitación
- Muestra credenciales automáticas al admin:
  - Usuario: email
  - Contraseña: admin
- Toast personalizado con instrucciones

### 3. **Nueva Página de Cambio de Contraseña** - `app/dashboard/perfil/cambiar-password/page.tsx`
- Formulario completo de cambio de contraseña
- Validaciones de seguridad
- Disponible para todos los roles
- Interfaz intuitiva con consejos de seguridad

### 4. **Header Actualizado** - `app/components/ui/header.tsx`
- Menú desplegable mejorado
- Opción "Cambiar contraseña" agregada
- Separador visual entre opciones

### 5. **Documentación Actualizada**
- `ENV_SETUP.md`: Instrucciones para configurar `SUPABASE_SERVICE_ROLE_KEY`
- `.env.example`: Plantilla para variables de entorno

---

## 🚀 Pasos para Completar la Configuración

### Paso 1: Obtener Service Role Key

1. Ve a [Supabase Dashboard](https://supabase.com/dashboard)
2. Selecciona tu proyecto: `drevklsnlxrbsrlmjrpz`
3. Ve a `Settings` → `API`
4. Copia la clave **service_role** (secret)

### Paso 2: Configurar Variables de Entorno

**Desarrollo Local:**
1. Abre el archivo `.env.local`
2. Agrega la siguiente línea:
   ```bash
   SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key_copiada
   ```

**Producción (Vercel):**
1. Ve al dashboard de Vercel
2. Selecciona tu proyecto
3. Ve a `Settings` → `Environment Variables`
4. Agrega nueva variable:
   - Name: `SUPABASE_SERVICE_ROLE_KEY`
   - Value: `tu_service_role_key_copiada`
   - Environment: `Production`, `Preview`, `Development`
5. Haz un nuevo deploy para aplicar los cambios

### Paso 3: Reiniciar Servidor de Desarrollo

```bash
# Detén el servidor actual (Ctrl+C)
# Reinicia el servidor
npm run dev
```

---

## 📝 Nuevo Flujo de Trabajo

### Creación de Personal Operativo/Admin Apoyo

**Antes:**
1. Admin crea personal → Se inserta en base de datos
2. Admin genera link de invitación
3. Admin envía link al usuario
4. Usuario hace click en link
5. Usuario crea cuenta con email + contraseña
6. Usuario recibe email de confirmación
7. Usuario hace click en email
8. Usuario puede iniciar sesión

**Ahora:**
1. ✅ Admin crea personal → Usuario creado automáticamente
2. ✅ Sistema muestra credenciales:
   - Email: el proporcionado
   - Contraseña: admin
3. ✅ Usuario puede iniciar sesión inmediatamente
4. ✅ Usuario cambia su contraseña desde "Cambiar contraseña"

---

## 🔒 Consideraciones de Seguridad

### Service Role Key
- ⚠️ **NUNCA** exponer al cliente
- ⚠️ **NUNCA** commitear en git (ya está en .gitignore)
- ✅ Solo usar en server-side (API routes)
- ✅ Tiene privilegios de administrador
- ✅ Bypasea RLS

### Contraseña por Defecto
- Todos los usuarios se crean con contraseña `"admin"`
- Se recomienda al usuario cambiar su contraseña al primer acceso
- Los usuarios pueden cambiar su contraseña en cualquier momento desde el menú

### Validaciones
- API route valida que solo se creen usuarios OPERATIVO o ADMINISTRATIVO_APOYO
- Verifica que el email no esté duplicado
- Requiere autenticación del admin que crea el usuario

---

## 🧪 Cómo Probar

### 1. Crear un Usuario Operativo
1. Inicia sesión como ADMINISTRATIVO
2. Ve a `Personal`
3. Completa el formulario:
   - Nombre: "Juan Pérez"
   - Email: "juan.perez@test.com"
   - Rol: "Operativo"
4. Click en "Añadir personal"
5. Verifica que aparezca toast con credenciales
6. Copia las credenciales mostradas

### 2. Iniciar Sesión como Usuario Nuevo
1. Cierra sesión
2. Inicia sesión con:
   - Email: juan.perez@test.com
   - Contraseña: admin
3. Deberías poder acceder inmediatamente

### 3. Cambiar Contraseña
1. Click en el menú de usuario (arriba a la derecha)
2. Click en "Cambiar contraseña"
3. Completa el formulario:
   - Contraseña actual: admin
   - Nueva contraseña: tu_nueva_contraseña
   - Confirmar: tu_nueva_contraseña
4. Click en "Cambiar contraseña"
5. Deberías ver mensaje de éxito
6. Cierra sesión e inicia con la nueva contraseña

---

## 📊 Archivos Modificados

```
app/
├── api/
│   └── create-personal/
│       └── route.ts                    [NUEVO]
├── components/
│   └── ui/
│       └── header.tsx                   [MODIFICADO]
├── dashboard/
│   ├── perfil/
│   │   └── cambiar-password/
│   │       └── page.tsx                [NUEVO]
│   └── personal/
│       └── page.tsx                     [MODIFICADO]

.env.example                             [NUEVO]
ENV_SETUP.md                             [MODIFICADO]
IMPLEMENTACION_AUTO_REGISTRO.md          [NUEVO - Este archivo]
```

---

## ⚙️ Funcionalidad Deprecada

### `/auth/register-personal/page.tsx`
- Ya no se usa en el flujo principal
- Se mantiene por compatibilidad
- Puede eliminarse si no se necesita

---

## 🐛 Solución de Problemas

### Error: "No autorizado" al crear personal
- **Causa:** Falta el `SUPABASE_SERVICE_ROLE_KEY`
- **Solución:** Verifica que esté en `.env.local` y reinicia el servidor

### Error: "Error al crear usuario"
- **Causa:** Email ya existe en Supabase Auth
- **Solución:** Usar otro email o eliminar el usuario existente desde Supabase Dashboard

### Usuario no puede cambiar contraseña
- **Causa:** Contraseña actual incorrecta
- **Solución:** Verificar que esté usando "admin" si es recién creado

### Toast con credenciales no aparece
- **Causa:** Error en la creación del usuario
- **Solución:** Verificar console del navegador y logs del servidor

---

## 📞 Soporte

Si tienes problemas:
1. Revisa los logs del servidor (`npm run dev`)
2. Verifica la consola del navegador (F12)
3. Confirma que `SUPABASE_SERVICE_ROLE_KEY` esté correctamente configurada
4. Contacta al equipo de desarrollo

---

**Última actualización:** 2025-01-18
**Versión:** 2.0
