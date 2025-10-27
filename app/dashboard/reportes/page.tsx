'use client';

import Link from 'next/link';
import { FiChevronRight, FiBarChart2, FiFileText, FiCalendar, FiAlertCircle } from 'react-icons/fi';

const reportes = [
  {
    title: 'Balance Mensual',
    description: 'Calcula ingresos, egresos y neto por mes, canal de pago y tipo de contrato. Ideal para rendición de cuentas ante la junta directiva.',
    href: '/dashboard/reportes/balance-mensual',
    icon: <FiBarChart2 className="text-3xl text-sky-400" />,
  },
  {
    title: 'Pagos Pendientes',
    description: 'Muestra todos los pagos pendientes a personal por eventos completados. Útil para cuadrar cuentas antes de realizar los pagos.',
    href: '/dashboard/reportes/pagos-pendientes',
    icon: <FiAlertCircle className="text-3xl text-yellow-400" />,
  },
  {
    title: 'Conformidad de Pagos',
    description: 'Genera el reporte consolidado mensual para que cada participante firme y confirme la recepción de su pago.',
    href: '/dashboard/reportes/conformidad-pagos',
    icon: <FiFileText className="text-3xl text-green-400" />,
  },
  {
    title: 'Control Diario',
    description: 'Visualiza el calendario mensual detallado de eventos por participante, tipo de contrato y canal de pago. Exportable a Excel.',
    href: '/dashboard/reportes/control-diario',
    icon: <FiCalendar className="text-3xl text-purple-400" />,
  },
];

export default function ReportesPage() {
  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Módulo de Reportes</h1>
        <p className="text-slate-400">Genera reportes financieros y de gestión para tu organización</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reportes.map((reporte) => (
          <Link href={reporte.href} key={reporte.href}>
            <div className="bg-slate-800 rounded-xl shadow-lg p-6 border border-slate-700 hover:border-sky-500 hover:bg-slate-700/50 transition-all duration-200 cursor-pointer h-full flex flex-col">
              <div className="mb-4">
                {reporte.icon}
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-white mb-2">{reporte.title}</h2>
                <p className="text-slate-400 text-sm mb-4">{reporte.description}</p>
              </div>
              <div className="text-right text-sky-400 font-semibold flex items-center justify-end mt-auto pt-4 border-t border-slate-700">
                Ver reporte
                <FiChevronRight className="ml-1" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-8 bg-blue-900/20 border border-blue-700/50 rounded-lg p-4">
        <h3 className="text-blue-200 font-semibold mb-2">Acerca de los reportes</h3>
        <ul className="text-blue-300 text-sm space-y-1 list-disc list-inside">
          <li>Todos los reportes están organizados por <strong>Canal de Pago</strong> y <strong>Tipo de Contrato</strong></li>
          <li>Los participantes marcados como "No incluir en cálculos" no aparecen en reportes de balance</li>
          <li>Los reportes pueden exportarse a PDF o Excel según corresponda</li>
        </ul>
      </div>
    </div>
  );
}
