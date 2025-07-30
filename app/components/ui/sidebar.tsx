import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FiHome, FiUsers, FiBriefcase, FiFileText, FiTool, FiClipboard, FiCreditCard, FiBarChart2 } from 'react-icons/fi';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: <FiHome /> },
  { href: '/dashboard/personal', label: 'Personal', icon: <FiUsers /> },
  { href: '/dashboard/contratadores', label: 'Contratadores', icon: <FiBriefcase /> },
  { href: '/dashboard/tipos-contrato', label: 'Tipos de Contrato', icon: <FiFileText /> },
  { href: '/dashboard/servicios', label: 'Servicios', icon: <FiTool /> },
  { href: '/dashboard/contratos', label: 'Contratos', icon: <FiClipboard /> },
  { href: '/dashboard/pagos', label: 'Pagos', icon: <FiCreditCard /> },
  { href: '/dashboard/reportes', label: 'Reportes', icon: <FiBarChart2 /> },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 h-screen bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800">
      <div className="p-6 text-center">
        <h1 className="text-3xl font-bold text-white tracking-wider">GestiónApp</h1>
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

