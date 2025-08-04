
'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Session } from '@supabase/supabase-js'

// Definir el tipo para los datos de la organización
interface Organization {
  id: number
  nombre: string
  estado: 'ACTIVA' | 'SUSPENDIDA'
}

// Definir el tipo para el rol del usuario
type UserRole = 'ADMINISTRATIVO' | 'OPERATIVO' | 'ADMINISTRATIVO_APOYO';

// Definir el tipo para el valor del contexto
interface OrganizationContextType {
  organization: Organization | null
  session: Session | null
  userRole: UserRole | null
  isSuperAdmin: boolean
  isLoading: boolean
}

// Crear el contexto con un valor por defecto
const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined)

// Crear el proveedor del contexto
export const OrganizationProvider = ({ children }: { children: ReactNode }) => {
  const supabase = createClientComponentClient()
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const getSessionAndOrg = async () => {
      setIsLoading(true);
      const { data: { session } } = await supabase.auth.getSession()
      setSession(session)

      if (session) {
        const SUPER_ADMIN_USER_ID = '7f76aede-699d-463e-acf5-5c95a3e8b84e';
        const isUserSuperAdmin = session.user.id === SUPER_ADMIN_USER_ID;
        setIsSuperAdmin(isUserSuperAdmin);

        if (isUserSuperAdmin) {
          setOrganization(null);
          setUserRole(null);
        } else {
          // Obtener el id_organizacion y el rol del perfil del usuario
          const { data: personalData, error: personalError } = await supabase
            .from('Personal')
            .select('id_organizacion, rol')
            .eq('supabase_user_id', session.user.id)
            .single()

          if (personalError) {
            console.error('Error fetching personal data:', personalError)
          } else if (personalData) {
            setUserRole(personalData.rol as UserRole);
            // Obtener los detalles de la organización
            const { data: orgData, error: orgError } = await supabase
              .from('Organizaciones')
              .select('id, nombre, estado')
              .eq('id', personalData.id_organizacion)
              .single()

            if (orgError) {
              console.error('Error fetching organization data:', orgError)
            } else {
              setOrganization(orgData)
            }
          }
        }
      }
      setIsLoading(false)
    }

    getSessionAndOrg()

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (!newSession) {
        setOrganization(null);
        setUserRole(null);
        setIsSuperAdmin(false);
      } else {
        // Si hay un cambio de sesión (login/logout), recargamos los datos
        getSessionAndOrg();
      }
    });

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [supabase])

  return (
    <OrganizationContext.Provider value={{ organization, session, userRole, isSuperAdmin, isLoading }}>
      {children}
    </OrganizationContext.Provider>
  )
}

// Hook personalizado para usar el contexto
export const useOrganization = () => {
  const context = useContext(OrganizationContext)
  if (context === undefined) {
    throw new Error('useOrganization must be used within an OrganizationProvider')
  }
  return context
}
