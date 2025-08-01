'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FiPlusCircle, FiArchive } from 'react-icons/fi';

export default function PagosLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const navLinks = [
    { href: '/dashboard/pagos', label: 'Pagos pendientes', icon: <FiPlusCircle /> },
    { href: '/dashboard/pagos/gestion', label: 'Gestionar lotes', icon: <FiArchive /> },
  ];

  return (
    <div>
      <div className="flex border-b border-slate-700 mb-6">
        {navLinks.map(link => {
          const isActive = pathname === link.href;
          return (
            <Link key={link.href} href={link.href}>
              <div className={`py-3 px-6 font-semibold flex items-center gap-2 transition-colors ${isActive ? 'text-sky-400 border-b-2 border-sky-400' : 'text-slate-400 hover:text-white'}`}>
                {link.icon}
                <span>{link.label}</span>
              </div>
            </Link>
          );
        })}
      </div>
      <div>
        {children}
      </div>
    </div>
  );
}
