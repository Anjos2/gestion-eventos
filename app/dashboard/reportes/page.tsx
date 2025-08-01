'use client';

import Link from 'next/link';
import { FiChevronRight } from 'react-icons/fi';

const reportes = [
  {
    title: 'Reporte de pagos históricos por personal',
    description: 'Consulta todos los lotes de pago emitidos a un miembro del personal en un rango de fechas específico.',
    href: '/dashboard/reportes/pagos-personal',
  },
  {
    title: 'Reporte de participación por personal',
    description: 'Revisa el historial de participación de un empleado, incluyendo los servicios realizados y su asistencia.',
    href: '/dashboard/reportes/participacion-personal',
  },
  {
    title: 'Reporte de rentabilidad por tipo de contrato',
    description: 'Analiza la rentabilidad de diferentes tipos de contrato, comparando ingresos y costos.',
    href: '/dashboard/reportes/rentabilidad-contrato',
  },
  // ... más reportes aquí
];

export default function ReportesPage() {
  return (
    <div className="p-4 md:p-6 lg:p-8">
      <h1 className="text-3xl font-bold text-white mb-8">Módulo de reportes</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reportes.map((reporte) => (
          <Link href={reporte.href} key={reporte.href}>
            <div className="bg-slate-800 rounded-xl shadow-lg p-6 border border-slate-700 hover:border-sky-500 hover:bg-slate-700/50 transition-all duration-200 cursor-pointer h-full flex flex-col justify-between">
              <div>
                <h2 className="text-xl font-bold text-white mb-2">{reporte.title}</h2>
                <p className="text-slate-400 text-sm mb-4">{reporte.description}</p>
              </div>
              <div className="text-right text-sky-400 font-semibold flex items-center justify-end">
                Ver reporte
                <FiChevronRight className="ml-1" />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
