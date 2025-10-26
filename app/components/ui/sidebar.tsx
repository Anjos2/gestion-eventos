'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useOrganization } from '@/app/context/OrganizationContext';
import { FiHome, FiUsers, FiBriefcase, FiFileText, FiTool, FiClipboard, FiCreditCard, FiBarChart2, FiDollarSign, FiShield, FiCalendar, FiX, FiSliders } from 'react-icons/fi';

// Define los items de navegación para cada rol
const navItemsAdmin = [
  { href: '/dashboard', label: 'Resumen', icon: <FiHome /> },
  { href: '/dashboard/personal', label: 'Personal', icon: <FiUsers /> },
  { href: '/dashboard/contratadores', label: 'Contratadores', icon: <FiBriefcase /> },
  { href: '/dashboard/tipos-contrato', label: 'Tipos de contrato', icon: <FiFileText /> },
  { href: '/dashboard/servicios', label: 'Servicios', icon: <FiTool /> },
  { href: '/dashboard/canales-pago', label: 'Canales de Pago', icon: <FiSliders /> },
  { href: '/dashboard/contratos', label: 'Contratos', icon: <FiClipboard /> },
  { href: '/dashboard/pagos', label: 'Pagos', icon: <FiCreditCard /> },
  { href: '/dashboard/reportes', label: 'Reportes', icon: <FiBarChart2 /> },
  { href: '/dashboard/facturacion', label: 'Facturación', icon: <FiDollarSign /> },
];

const navItemsOperativo = [
  { href: '/dashboard', label: 'Resumen', icon: <FiHome /> },
  { href: '/dashboard/mis-participaciones', label: 'Mis asistencias', icon: <FiCalendar /> },
  { href: '/dashboard/mis-pagos', label: 'Mis pagos', icon: <FiDollarSign /> },
];

const navItemsAdminApoyo = [
  { href: '/dashboard', label: 'Resumen', icon: <FiHome /> },
  { href: '/dashboard/canales-pago', label: 'Canales de Pago', icon: <FiSliders /> },
  { href: '/dashboard/contratos', label: 'Contratos', icon: <FiClipboard /> },
  { href: '/dashboard/pagos', label: 'Pagos', icon: <FiCreditCard /> },
  { href: '/dashboard/reportes', label: 'Reportes', icon: <FiBarChart2 /> },
  { href: '/dashboard/facturacion', label: 'Facturación', icon: <FiDollarSign /> },
];

interface SidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
}

export default function Sidebar({ isOpen, toggleSidebar }: SidebarProps) {
  const pathname = usePathname();
  const { organization, userRole, isSuperAdmin, isLoading } = useOrganization();

  const orgName = isSuperAdmin ? 'Plataforma' : organization?.nombre || 'GestiónApp';

  const getNavItems = () => {
    if (isSuperAdmin) {
      return [
        { href: '/dashboard', label: 'Resumen', icon: <FiHome /> },
        { href: '/dashboard/super-admin', label: 'Gestión global', icon: <FiShield /> },
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

  if (isLoading) {
    return (
      <aside className="w-64 h-screen bg-slate-900 text-slate-300 flex-col border-r border-slate-800 hidden md:flex">
        <div className="p-6 text-center">
          <div className="h-8 bg-slate-800 rounded-lg animate-pulse w-3/4 mx-auto"></div>
        </div>
        <div className="flex-1 px-4 py-4">
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
    <>
      {/* Overlay for mobile */}
      {isOpen && <div className="fixed inset-0 bg-black/60 z-30 md:hidden" onClick={toggleSidebar}></div>}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 w-64 h-full bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800 z-40 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } md:relative md:translate-x-0 md:flex`}
      >
        <div className="p-6 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-white tracking-wider truncate">{orgName}</h1>
          <button onClick={toggleSidebar} className="md:hidden text-2xl text-slate-400 hover:text-white">
            <FiX />
          </button>
        </div>
        <nav className="flex-1 px-4 py-4">
          <ul className="space-y-2">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={toggleSidebar} // Close sidebar on link click in mobile
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
    </>
  );
}

