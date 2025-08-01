'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import { FiHome, FiUsers, FiBriefcase, FiFileText, FiTool, FiClipboard, FiCreditCard, FiBarChart2, FiDollarSign, FiShield, FiCalendar } from 'react-icons/fi';

// Define los items de navegación para cada rol
const navItemsAdmin = [
  { href: '/dashboard', label: 'Resumen', icon: <FiHome /> },
  { href: '/dashboard/personal', label: 'Personal', icon: <FiUsers /> },
  { href: '/dashboard/contratadores', label: 'Contratadores', icon: <FiBriefcase /> },
  { href: '/dashboard/tipos-contrato', label: 'Tipos de contrato', icon: <FiFileText /> },
  { href: '/dashboard/servicios', label: 'Servicios', icon: <FiTool /> },
  { href: '/dashboard/contratos', label: 'Contratos', icon: <FiClipboard /> },
  { href: '/dashboard/pagos', label: 'Pagos', icon: <FiCreditCard /> },
  { href: '/dashboard/reportes', label: 'Reportes', icon: <FiBarChart2 /> },
];

const navItemsOperativo = [
  { href: '/dashboard', label: 'Resumen', icon: <FiHome /> },
  { href: '/dashboard/mis-participaciones', label: 'Mis asistencias', icon: <FiCalendar /> },
  { href: '/dashboard/mis-pagos', label: 'Mis pagos', icon: <FiDollarSign /> },
];

const navItemsAdminApoyo = [
  { href: '/dashboard', label: 'Resumen', icon: <FiHome /> },
  { href: '/dashboard/contratos', label: 'Contratos', icon: <FiClipboard /> },
  { href: '/dashboard/pagos', label: 'Pagos', icon: <FiCreditCard /> },
  { href: '/dashboard/reportes', label: 'Reportes', icon: <FiBarChart2 /> },
];

// Definir el tipo para el rol del usuario
type UserRole = 'ADMINISTRATIVO' | 'OPERATIVO' | 'ADMINISTRATIVO_APOYO' | null;

// ID del Super Administrador
const SUPER_ADMIN_USER_ID = '7f76aede-699d-463e-acf5-5c95a3e8b84e';

export default function Sidebar() {
  const pathname = usePathname();
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [orgName, setOrgName] = useState<string>('GestiónApp');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Comprobar si es Super Administrador por ID
          if (user.id === SUPER_ADMIN_USER_ID) {
            setIsSuperAdmin(true);
            setUserRole(null); // No tiene un rol de la tabla Personal
            setOrgName('Plataforma');
            return;
          }

          const { data: personal, error } = await supabase
            .from('Personal')
            .select('rol, Organizaciones!id_organizacion(nombre)')
            .eq('supabase_user_id', user.id)
            .single();

          // Si no se encuentra un registro de personal, es un estado inconsistente.
          if (!personal) {
            // PGRST116 es el código de Supabase para "cero filas devueltas" en una consulta .single()
            if (error && error.code !== 'PGRST116') {
              throw new Error(`Error de base de datos: ${error.message}`); // Lanza un error si es un problema diferente
            }
            
            console.warn('Usuario autenticado sin registro en Personal. Forzando cierre de sesión.');
            await supabase.auth.signOut();
            window.location.href = '/auth/login'; // Redirigir explícitamente
            return;
          }

          if (personal) {
            setUserRole(personal.rol as UserRole);
            const orgData = personal.Organizaciones;
            if (orgData) {
              // Comprobación robusta para manejar objeto o array
              if (Array.isArray(orgData) && orgData.length > 0) {
                setOrgName(orgData[0].nombre);
              } else if (!Array.isArray(orgData)) {
                setOrgName((orgData as any).nombre);
              }
            }
          }        }
      } catch (error) {
        console.error("Error fetching user role:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserRole();
  }, []);

  const getNavItems = () => {
    if (isSuperAdmin) {
      return [
        { href: '/dashboard/super-admin', label: 'Gestión Global', icon: <FiShield /> },
      ];
    }
    switch (userRole) {
      case 'ADMINISTRATIVO':
        return navItemsAdmin;
      case 'ADMINISTRATIVO_APOYO':
        return navItemsAdminApoyo;
      case 'OPERATIVO':
        return navItemsOperativo;
      default:
        return [];
    }
  };


  const navItems = getNavItems();

  if (loading) {
    return (
      <aside className="w-64 h-screen bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800">
        <div className="p-6 text-center">
          <div className="h-8 bg-slate-800 rounded-lg animate-pulse w-3/4 mx-auto"></div>
        </div>
        <div className="flex-1 px-4 py-4">
          {/* Skeleton loading state */}
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-slate-800 rounded-lg animate-pulse"></div>
            ))}
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-64 h-screen bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800">
      <div className="p-6 text-center">
        <h1 className="text-3xl font-bold text-white tracking-wider truncate">{orgName}</h1>
      </div>
      <nav className="flex-1 px-4 py-4">
        <ul className="space-y-2">
          {navItems.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex items-center space-x-3 p-3 rounded-lg transition-all duration-200 font-semibold ${
                  pathname.startsWith(item.href) && (item.href !== '/dashboard' || pathname === '/dashboard')
                    ? 'bg-sky-500 text-white shadow-lg'
                    : 'hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span className="text-xl">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="p-4 border-t border-slate-800">
        {/* User profile section can be added here */}
      </div>
    </aside>
  );
}

