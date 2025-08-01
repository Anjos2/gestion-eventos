'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import { FiSearch, FiDownload } from 'react-icons/fi';
import * as XLSX from 'xlsx';

// Tipos de datos
interface Personal {
  id: number;
  nombre: string;
}

interface LotePago {
  id: number;
  fecha_pago: string;
  monto_total: number;
  Detalles_Lote_Pago: {
    monto_pagado: number;
    estado_asistencia_registrado: string | null;
    descuento_aplicado_pct: number | null;
    Evento_Servicios_Asignados: {
      Servicios: {
        nombre: string;
      };
    };
  }[];
}

export default function PagosPersonalReportePage() {
  const [personalList, setPersonalList] = useState<Personal[]>([]);
  const [selectedPersonal, setSelectedPersonal] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [reportData, setReportData] = useState<LotePago[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPersonal = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: adminData } = await supabase
        .from('Personal')
        .select('id_organizacion')
        .eq('supabase_user_id', user.id)
        .single();

      if (adminData) {
        const { data, error } = await supabase
          .from('Personal')
          .select('id, nombre')
          .eq('id_organizacion', adminData.id_organizacion)
          .order('nombre', { ascending: true });

        if (error) {
          console.error('Error fetching personal:', error);
        } else {
          setPersonalList(data || []);
        }
      }
    };
    fetchPersonal();
  }, []);

  const handleGenerateReport = async () => {
    if (!selectedPersonal || !startDate || !endDate) {
      setError('Por favor, seleccione personal y un rango de fechas.');
      return;
    }
    setLoading(true);
    setError(null);
    setReportData([]);

    const { data, error } = await supabase
      .from('Lotes_Pago')
      .select(`
        id,
        fecha_pago,
        monto_total,
        Detalles_Lote_Pago!inner(
          monto_pagado,
          estado_asistencia_registrado,
          descuento_aplicado_pct,
          Evento_Servicios_Asignados!inner(
            Servicios!inner(nombre)
          )
        )
      `)
      .eq('id_personal', selectedPersonal)
      .eq('estado', 'PAGADO') // <-- AÑADIDO: Filtra solo lotes pagados
      .gte('fecha_pago', startDate)
      .lte('fecha_pago', endDate)
      .order('fecha_pago', { ascending: false });

    if (error) {
      setError(error.message);
    } else {
      const getSingle = (data: any) => (Array.isArray(data) ? data[0] : data);

      const formattedData = (data || []).map(lote => ({
        ...lote,
        Detalles_Lote_Pago: lote.Detalles_Lote_Pago.map(detalle => {
          const evento = getSingle(detalle.Evento_Servicios_Asignados);
          const servicio = evento ? getSingle(evento.Servicios) : null;
          return {
            ...detalle,
            Evento_Servicios_Asignados: {
              Servicios: {
                nombre: servicio?.nombre || 'N/A',
              },
            },
          };
        }),
      }));
      setReportData(formattedData);
    }
    setLoading(false);
  };

  const handleExport = () => {
    if (reportData.length === 0) {
      alert("No hay datos para exportar.");
      return;
    }

    const dataToExport = reportData.flatMap(lote => 
      lote.Detalles_Lote_Pago.map(detalle => ({
        'Lote ID': lote.id,
        'Fecha de Pago': new Date(lote.fecha_pago + 'T00:00:00').toLocaleDateString(),
        'Monto Total del Lote': lote.monto_total,
        'Servicio Pagado': detalle.Evento_Servicios_Asignados.Servicios.nombre,
        'Monto Pagado por Servicio': detalle.monto_pagado,
        'Asistencia': detalle.estado_asistencia_registrado,
        'Descuento (%)': detalle.descuento_aplicado_pct,
      }))
    );

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Pagos");

    // Buffer
    XLSX.writeFile(workbook, "ReportePagosPersonal.xlsx");

  };

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <h1 className="text-3xl font-bold text-white mb-6">Reporte de pagos por personal</h1>

      <div className="bg-slate-800 rounded-xl shadow-lg p-6 border border-slate-700 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="md:col-span-2">
            <label htmlFor="personal" className="block text-sm font-medium text-slate-400 mb-1">Personal</label>
            <select
              id="personal"
              value={selectedPersonal}
              onChange={(e) => setSelectedPersonal(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg text-white p-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="">Seleccione un miembro del personal</option>
              {personalList.map(p => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="start-date" className="block text-sm font-medium text-slate-400 mb-1">Fecha de inicio</label>
            <input
              type="date"
              id="start-date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg text-white p-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
          <div>
            <label htmlFor="end-date" className="block text-sm font-medium text-slate-400 mb-1">Fecha de fin</label>
            <input
              type="date"
              id="end-date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg text-white p-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
          <div className="md:col-start-4">
            <button
              onClick={handleGenerateReport}
              disabled={loading}
              className="w-full flex items-center justify-center bg-sky-600 hover:bg-sky-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-colors duration-200 disabled:bg-slate-600"
            >
              {loading ? 'Generando...' : <><FiSearch className="mr-2" /> Generar reporte</>}</button>
          </div>
        </div>
        {error && <p className="text-red-400 mt-4">{error}</p>}
      </div>

      {/* Results Header */}
      {reportData.length > 0 && (
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-white">Resultados</h2>
            <button 
                onClick={handleExport}
                className="flex items-center bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-colors duration-200">
                <FiDownload className="mr-2"/> Exportar a Excel
            </button>
        </div>
      )}

      {/* Results */}
      <div className="space-y-6">
        {reportData.map(lote => (
          <div key={lote.id} className="bg-slate-800 rounded-xl shadow-lg p-6 border border-slate-700">
            <div className="flex justify-between items-center mb-4">
              <div>
                <p className="text-slate-400 text-sm">Lote de pago #{lote.id}</p>
                <p className="text-white font-semibold">{new Date(lote.fecha_pago + 'T00:00:00').toLocaleDateString()}</p>
              </div>
              <div className="text-right">
                <p className="text-slate-400 text-sm">Monto total pagado</p>
                <p className="text-2xl font-bold text-green-400">S/{lote.monto_total.toFixed(2)}</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-900">
                  <tr>
                    <th className="px-4 py-2 font-semibold text-slate-400 uppercase tracking-wider">Servicio pagado</th>
                    <th className="px-4 py-2 font-semibold text-slate-400 uppercase tracking-wider text-right">Monto pagado</th>
                    <th className="px-4 py-2 font-semibold text-slate-400 uppercase tracking-wider text-center">Observaciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {lote.Detalles_Lote_Pago.map((detalle, index) => (
                    <tr key={index}>
                      <td className="px-4 py-2">{detalle.Evento_Servicios_Asignados.Servicios.nombre}</td>
                      <td className="px-4 py-2 text-right font-mono">S/{detalle.monto_pagado.toFixed(2)}</td>
                      <td className="px-4 py-2 text-center">
                        {detalle.estado_asistencia_registrado === 'AUSENTE' && <span className="text-red-400">Ausente</span>}
                        {detalle.estado_asistencia_registrado === 'TARDANZA' && <span className="text-yellow-400">Tardanza ({detalle.descuento_aplicado_pct || 0}%)</span>}
                        {detalle.estado_asistencia_registrado === 'PUNTUAL' && <span className="text-green-400">Puntual</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
        {loading && <p className="text-center text-slate-400">Cargando...</p>}
        {!loading && reportData.length === 0 && !error && (
          <div className="text-center py-16 bg-slate-800 rounded-xl border border-slate-700">
            <p className="text-slate-400">No hay datos para los filtros seleccionados.</p>
          </div>
        )}
      </div>
    </div>
  );
}
