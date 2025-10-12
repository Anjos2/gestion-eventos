
'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Session } from '@supabase/supabase-js'

// --- INTERFACES ---
interface Organization {
  id: number
  nombre: string
  estado: 'ACTIVA' | 'SUSPENDIDA'
  alerta_activa: boolean
  mensaje_alerta: string | null
  precio_por_registro: number | null;
}

interface BillingInfo {
  conteo_registros_nuevos: number;
  ultimo_reseteo: string | null;
  costo_actual: number;
}

type UserRole = 'ADMINISTRATIVO' | 'OPERATIVO' | 'ADMINISTRATIVO_APOYO';

interface OrganizationContextType {
  organization: Organization | null
  session: Session | null
  userRole: UserRole | null
  isSuperAdmin: boolean
  isLoading: boolean
  supabase: any
  billingInfo: BillingInfo | null;
}

// --- CONTEXTO ---
const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined)

// --- PROVEEDOR DEL CONTEXTO ---
export const OrganizationProvider = ({ children }: { children: ReactNode }) => {
  const [supabase] = useState(() => createClientComponentClient());
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true)
  const [billingInfo, setBillingInfo] = useState<BillingInfo | null>(null);

  const resetState = () => {
    setOrganization(null);
    setUserRole(null);
    setIsSuperAdmin(false);
    setBillingInfo(null);
  };

  useEffect(() => {
    const getSessionAndOrg = async () => {
      try {
        setIsLoading(true);
        console.log('[OrganizationContext] 🔄 Iniciando carga de contexto...');

        const { data: { session: currentSession } } = await supabase.auth.getSession();
        console.log('[OrganizationContext] 👤 Sesión obtenida:', currentSession ? `Usuario: ${currentSession.user.id}` : 'No hay sesión');
        setSession(currentSession);

        if (!currentSession) {
          console.log('[OrganizationContext] ⚠️ No hay sesión activa, reseteando estado');
          resetState();
          return;
        }

        const SUPER_ADMIN_USER_ID = process.env.NEXT_PUBLIC_SUPER_ADMIN_ID ?? '';
        const isUserSuperAdmin = SUPER_ADMIN_USER_ID !== '' && currentSession.user.id === SUPER_ADMIN_USER_ID;
        console.log('[OrganizationContext] 🔐 ¿Es super admin?', isUserSuperAdmin, `(comparando ${currentSession.user.id} con ${SUPER_ADMIN_USER_ID})`);
        setIsSuperAdmin(isUserSuperAdmin);

        if (isUserSuperAdmin) {
          console.log('[OrganizationContext] ✅ Super admin detectado, omitiendo carga de organización');
          setOrganization(null);
          setUserRole(null);
          setBillingInfo(null);
          return;
        }

        console.log('[OrganizationContext] 📊 Consultando datos de Personal para usuario:', currentSession.user.id);
        const { data: personalData, error: personalError } = await supabase
          .from('Personal')
          .select('id_organizacion, rol')
          .eq('supabase_user_id', currentSession.user.id)
          .single();

        if (personalError) {
          console.error('[OrganizationContext] ❌ ERROR en query Personal:', {
            code: personalError.code,
            message: personalError.message,
            details: personalError.details,
            hint: personalError.hint
          });
          resetState();
          return;
        }

        if (!personalData) {
          console.error('[OrganizationContext] ❌ No se encontró registro de Personal para el usuario:', currentSession.user.id);
          resetState();
          return;
        }

        console.log('[OrganizationContext] ✅ Datos de Personal encontrados:', {
          id_organizacion: personalData.id_organizacion,
          rol: personalData.rol
        });
        setUserRole(personalData.rol as UserRole);

        console.log('[OrganizationContext] 📊 Consultando datos de Organización:', personalData.id_organizacion);
        const { data: orgData, error: orgError } = await supabase
          .from('Organizaciones')
          .select('id, nombre, estado, alerta_activa, mensaje_alerta, precio_por_registro')
          .eq('id', personalData.id_organizacion)
          .single();

        if (orgError) {
          console.error('[OrganizationContext] ❌ ERROR en query Organizaciones:', {
            code: orgError.code,
            message: orgError.message,
            details: orgError.details,
            hint: orgError.hint
          });
          resetState();
          return;
        }

        if (!orgData) {
          console.error('[OrganizationContext] ❌ No se encontró organización con ID:', personalData.id_organizacion);
          resetState();
          return;
        }

        console.log('[OrganizationContext] ✅ Datos de Organización encontrados:', {
          id: orgData.id,
          nombre: orgData.nombre,
          estado: orgData.estado
        });
        setOrganization(orgData);

        // Fetch billing info
        console.log('[OrganizationContext] 📊 Consultando Contadores_Uso para organización:', orgData.id);
        const { data: usageData, error: usageError } = await supabase
          .from('Contadores_Uso')
          .select('conteo_registros_nuevos, ultimo_reseteo')
          .eq('id_organizacion', orgData.id)
          .single();

        if (usageError) {
          console.error('[OrganizationContext] ⚠️ Error al obtener Contadores_Uso (no crítico):', {
            code: usageError.code,
            message: usageError.message,
            details: usageError.details,
            hint: usageError.hint
          });
          setBillingInfo(null);
        } else if (usageData) {
          // Calcular costo actual con fallback a 0 si no hay precio
          const precioRegistro = orgData.precio_por_registro ?? 0;
          const conteoRegistros = usageData.conteo_registros_nuevos || 0;
          const costo_actual = conteoRegistros * precioRegistro;

          console.log('[OrganizationContext] ✅ Contadores_Uso obtenidos:', {
            registros: conteoRegistros,
            precio_por_registro: precioRegistro,
            costo_actual
          });
          setBillingInfo({
            ...usageData,
            costo_actual
          });
        } else {
          console.log('[OrganizationContext] ⚠️ No se encontraron Contadores_Uso para organización:', orgData.id);
          // Intentar crear un billing info básico con valores en 0
          setBillingInfo({
            conteo_registros_nuevos: 0,
            ultimo_reseteo: null,
            costo_actual: 0
          });
        }

        console.log('[OrganizationContext] ✅ Contexto cargado exitosamente');

      } catch (error) {
        console.error("[OrganizationContext] ❌ ERROR CRÍTICO al cargar contexto:", error);
        resetState();
      } finally {
        setIsLoading(false);
      }
    };

    getSessionAndOrg();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (session?.access_token !== newSession?.access_token) {
        getSessionAndOrg();
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [supabase]);

  return (
    <OrganizationContext.Provider value={{ organization, session, userRole, isSuperAdmin, isLoading, supabase, billingInfo }}>
      {children}
    </OrganizationContext.Provider>
  )
}

// --- HOOK PERSONALIZADO ---
export const useOrganization = () => {
  const context = useContext(OrganizationContext)
  if (context === undefined) {
    throw new Error('useOrganization must be used within an OrganizationProvider')
  }
  return context
}
