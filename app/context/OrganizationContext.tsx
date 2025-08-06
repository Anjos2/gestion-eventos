
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
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        setSession(currentSession);

        if (!currentSession) {
          resetState();
          return;
        }

        const SUPER_ADMIN_USER_ID = '7f76aede-699d-463e-acf5-5c95a3e8b84e';
        const isUserSuperAdmin = currentSession.user.id === SUPER_ADMIN_USER_ID;
        setIsSuperAdmin(isUserSuperAdmin);

        if (isUserSuperAdmin) {
          setOrganization(null);
          setUserRole(null);
          setBillingInfo(null);
          return;
        }

        const { data: personalData, error: personalError } = await supabase
          .from('Personal')
          .select('id_organizacion, rol')
          .eq('supabase_user_id', currentSession.user.id)
          .single();

        if (personalError || !personalData) {
          console.error('Error or no personal data found, cannot determine organization:', personalError);
          resetState();
          return;
        }

        setUserRole(personalData.rol as UserRole);

        const { data: orgData, error: orgError } = await supabase
          .from('Organizaciones')
          .select('id, nombre, estado, alerta_activa, mensaje_alerta, precio_por_registro')
          .eq('id', personalData.id_organizacion)
          .single();

        if (orgError || !orgData) {
          console.error('Error or no organization data found:', orgError);
          resetState();
          return;
        }

        setOrganization(orgData);

        // Fetch billing info
        const { data: usageData, error: usageError } = await supabase
          .from('Contadores_Uso')
          .select('conteo_registros_nuevos, ultimo_reseteo')
          .eq('id_organizacion', orgData.id)
          .single();

        if (usageError) {
          console.error('Error fetching usage data:', usageError);
          setBillingInfo(null);
        } else if (usageData) {
          const costo_actual = (usageData.conteo_registros_nuevos || 0) * (orgData.precio_por_registro || 0);
          setBillingInfo({
            ...usageData,
            costo_actual
          });
        }

      } catch (error) {
        console.error("Error loading organization context:", error);
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
