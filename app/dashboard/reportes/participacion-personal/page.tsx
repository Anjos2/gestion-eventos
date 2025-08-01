'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import { FiSearch, FiCalendar, FiUser, FiFileText, FiList, FiCheckCircle, FiXCircle, FiClock, FiDownload } from 'react-icons/fi';
import * as XLSX from 'xlsx';

// Tipos de datos
interface Personal {
  id: number;
  nombre: string;
}

interface ReportData {
  id_contrato: number;
  fecha_hora_evento: string;
  tipo_contrato_nombre: string;
  estado_asistencia: string;
  servicios: {
    nombre: string;
    monto_pactado: number;
  }[];
}

interface AsistenciaSummary {
  PUNTUAL: number;
  TARDANZA: number;
  AUSENTE: number;
}

export default function ParticipacionPersonalReportePage() {
  const [personalList, setPersonalList] = useState<Personal[]>([]);
  const [selectedPersonal, setSelectedPersonal] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [reportData, setReportData] = useState<ReportData[]>([]);
  const [summary, setSummary] = useState<AsistenciaSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [filteredPersonal, setFilteredPersonal] = useState<Personal[]>([]);
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);

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
          .eq('rol', 'OPERATIVO')
          .order('nombre', { ascending: true });

        if (error) {
          console.error('Error fetching personal:', error);
        } else {
          setPersonalList(data || []);
          setFilteredPersonal(data || []);
        }
      }
    };
    fetchPersonal();
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value;
    setSearchTerm(term);
    if (term) {
      setFilteredPersonal(
        personalList.filter(p =>
          p.nombre.toLowerCase().includes(term.toLowerCase())
        )
      );
      setIsDropdownVisible(true);
    } else {
      setFilteredPersonal(personalList);
      setIsDropdownVisible(false);
    }
  };

  const handleSelectPersonal = (personal: Personal) => {
    setSelectedPersonal(personal.id.toString());
    setSearchTerm(personal.nombre);
    setIsDropdownVisible(false);
  };

  const handleGenerateReport = async () => {
    if (!selectedPersonal || !startDate || !endDate) {
      setError('Por favor, seleccione personal y un rango de fechas.');
      return;
    }
    setLoading(true);
    setError(null);
    setReportData([]);
    setSummary(null);

    const { data, error } = await supabase
      .from('reporte_participacion_flat')
      .select(`*`)
      .eq('id_personal_participante', selectedPersonal)
      .gte('fecha_hora_evento', startDate)
      .lte('fecha_hora_evento', endDate)
      .order('fecha_hora_evento', { ascending: false });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // Agrupar por contrato
    const groupedByContrato: { [key: number]: ReportData } = {};

    data.forEach((row: any) => {
      if (!groupedByContrato[row.id_contrato]) {
        groupedByContrato[row.id_contrato] = {
          id_contrato: row.id_contrato,
          fecha_hora_evento: row.fecha_hora_evento,
          tipo_contrato_nombre: row.tipo_contrato_nombre,
          estado_asistencia: row.estado_asistencia,
          servicios: [],
        };
      }

      groupedByContrato[row.id_contrato].servicios.push({
        nombre: row.servicio_nombre,
        monto_pactado: row.monto_pactado,
      });
    });

    const reportResult = Object.values(groupedByContrato);
    setReportData(reportResult);

    // Calcular el resumen de asistencia
    const newSummary: AsistenciaSummary = { PUNTUAL: 0, TARDANZA: 0, AUSENTE: 0 };
    reportResult.forEach(contrato => {
      if (contrato.estado_asistencia in newSummary) {
        newSummary[contrato.estado_asistencia as keyof AsistenciaSummary]++;
      }
    });
    setSummary(newSummary);

    setLoading(false);
  };

  const handleExport = () => {
    if (reportData.length === 0) {
      alert("No hay datos para exportar.");
      return;
    }

    const personalSeleccionado = personalList.find(p => p.id.toString() === selectedPersonal);

    // 1. Preparar datos
    const title = `Reporte de Participación para: ${personalSeleccionado?.nombre || 'N/A'}`;
    const dateRange = `Período: ${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}`;

    const summaryData = [
      { Criterio: 'Asistencias Puntuales', Total: summary?.PUNTUAL || 0 },
      { Criterio: 'Tardanzas Registradas', Total: summary?.TARDANZA || 0 },
      { Criterio: 'Ausencias Registradas', Total: summary?.AUSENTE || 0 },
    ];

    const details = reportData.flatMap(contrato => 
      contrato.servicios.map(servicio => ({
        'Contrato ID': contrato.id_contrato,
        'Tipo de Contrato': contrato.tipo_contrato_nombre,
        'Fecha del Evento': new Date(contrato.fecha_hora_evento).toLocaleString(),
        'Asistencia': contrato.estado_asistencia,
        'Servicio Realizado': servicio.nombre,
        'Monto Pactado': { v: servicio.monto_pactado, t: 'n', z: '"S/"#,##0.00' },
      }))
    );

    // 2. Crear la hoja y añadir datos por secciones
    let finalData: any[] = [];
    finalData.push([title]);
    finalData.push([dateRange]);
    finalData.push([]); // Spacer
    finalData.push(['Resumen de Asistencia']);
    finalData = finalData.concat(summaryData.map(s => [s.Criterio, s.Total]));
    finalData.push([]); // Spacer
    finalData.push(['Detalle de Participaciones']);
    const detailsHeader = ['Contrato ID', 'Tipo de Contrato', 'Fecha del Evento', 'Asistencia', 'Servicio Realizado', 'Monto Pactado'];
    finalData.push(detailsHeader);
    details.forEach(item => finalData.push(Object.values(item)));

    const ws = XLSX.utils.aoa_to_sheet(finalData);

    // 3. Calcular anchos de columna
    const colWidths = finalData.reduce((acc, row) => {
      row.forEach((cell: any, colIndex: number) => {
        const cellValue = cell?.v ?? cell?.toString() ?? '';
        const len = cellValue.length;
        if (!acc[colIndex] || len > acc[colIndex]) {
          acc[colIndex] = len;
        }
      });
      return acc;
    }, [] as number[]);

    ws['!cols'] = colWidths.map(w => ({ wch: w + 2 })); // Añadir padding

    // 4. Crear y descargar el libro
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Participacion");
    XLSX.writeFile(wb, `ReporteParticipacion_${personalSeleccionado?.nombre.replace(/ /g, '_')}.xlsx`);
  };

  const AsistenciaIcon = ({ asistencia }: { asistencia: string }) => {
    switch (asistencia) {
      case 'PUNTUAL': return <FiCheckCircle className="text-green-400" />;
      case 'TARDANZA': return <FiClock className="text-yellow-400" />;
      case 'AUSENTE': return <FiXCircle className="text-red-400" />;
      default: return null;
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <h1 className="text-3xl font-bold text-white mb-6">Reporte de participación por personal</h1>

      <div className="bg-slate-800 rounded-xl shadow-lg p-6 border border-slate-700 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="md:col-span-2 relative">
            <label htmlFor="personal-search" className="block text-sm font-medium text-slate-400 mb-1 flex items-center"><FiUser className="mr-2"/>Personal</label>
            <input
              type="text"
              id="personal-search"
              value={searchTerm}
              onChange={handleSearchChange}
              onFocus={() => setIsDropdownVisible(true)}
              onBlur={() => setTimeout(() => setIsDropdownVisible(false), 100)}
              placeholder="Buscar por nombre..."
              className="w-full bg-slate-700 border border-slate-600 rounded-lg text-white p-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            {isDropdownVisible && (
              <ul className="absolute z-10 w-full bg-slate-900 border border-slate-600 rounded-lg mt-1 max-h-60 overflow-y-auto shadow-lg">
                {filteredPersonal.length > 0 ? (
                  filteredPersonal.map(p => (
                    <li 
                      key={p.id} 
                      onClick={() => handleSelectPersonal(p)}
                      className="p-2 text-white hover:bg-sky-600 cursor-pointer"
                    >
                      {p.nombre}
                    </li>
                  ))
                ) : (
                  <li className="p-2 text-slate-400">No se encontraron coincidencias</li>
                )}
              </ul>
            )}
          </div>
          <div>
            <label htmlFor="start-date" className="block text-sm font-medium text-slate-400 mb-1 flex items-center"><FiCalendar className="mr-2"/>Fecha de inicio</label>
            <input
              type="date"
              id="start-date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg text-white p-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
          <div>
            <label htmlFor="end-date" className="block text-sm font-medium text-slate-400 mb-1 flex items-center"><FiCalendar className="mr-2"/>Fecha de fin</label>
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

      {/* Summary & Export Section */}
      {reportData.length > 0 && (
        <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-white">Resumen de asistencia</h2>
                <button 
                    onClick={handleExport}
                    className="flex items-center bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-colors duration-200">
                    <FiDownload className="mr-2"/> Exportar a Excel
                </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-white">
                <div className="bg-green-500/20 border border-green-500 rounded-lg p-4 flex items-center">
                    <FiCheckCircle className="text-3xl text-green-400 mr-4"/>
                    <div>
                        <p className="text-sm text-slate-300">Puntual</p>
                        <p className="text-2xl font-bold">{summary?.PUNTUAL}</p>
                    </div>
                </div>
                <div className="bg-yellow-500/20 border border-yellow-500 rounded-lg p-4 flex items-center">
                    <FiClock className="text-3xl text-yellow-400 mr-4"/>
                    <div>
                        <p className="text-sm text-slate-300">Tardanzas</p>
                        <p className="text-2xl font-bold">{summary?.TARDANZA}</p>
                    </div>
                </div>
                <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 flex items-center">
                    <FiXCircle className="text-3xl text-red-400 mr-4"/>
                    <div>
                        <p className="text-sm text-slate-300">Ausencias</p>
                        <p className="text-2xl font-bold">{summary?.AUSENTE}</p>
                    </div>
                </div>
            </div>
        </div>
      )} 

      {/* Results */}
      <div className="space-y-6">
        {reportData.map(contrato => (
          <div key={contrato.id_contrato} className="bg-slate-800 rounded-xl shadow-lg p-6 border border-slate-700">
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="flex items-center text-white">
                <FiFileText className="mr-2 text-slate-400"/>
                <div>
                  <p className="text-sm text-slate-400">Contrato #{contrato.id_contrato}</p>
                  <p className="font-semibold">{contrato.tipo_contrato_nombre}</p>
                </div>
              </div>
              <div className="flex items-center text-white">
                <FiCalendar className="mr-2 text-slate-400"/>
                <div>
                  <p className="text-sm text-slate-400">Fecha del evento</p>
                  <p className="font-semibold">{new Date(contrato.fecha_hora_evento).toLocaleString()}</p>
                </div>
              </div>
              <div className="flex items-center text-white">
                <AsistenciaIcon asistencia={contrato.estado_asistencia} />
                <div className="ml-2">
                  <p className="text-sm text-slate-400">Asistencia</p>
                  <p className="font-semibold">{contrato.estado_asistencia}</p>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="text-lg font-semibold text-white mb-2 flex items-center"><FiList className="mr-2 text-slate-400"/>Servicios realizados</h4>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-900">
                    <tr>
                      <th className="px-4 py-2 font-semibold text-slate-400 uppercase tracking-wider">Servicio</th>
                      <th className="px-4 py-2 font-semibold text-slate-400 uppercase tracking-wider text-right">Monto pactado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {contrato.servicios.map((servicio, index) => (
                      <tr key={index}>
                        <td className="px-4 py-2">{servicio.nombre}</td>
                        <td className="px-4 py-2 text-right font-mono">S/{servicio.monto_pactado.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ))}
        {loading && <p className="text-center text-slate-400">Cargando...</p>}
        {!loading && reportData.length === 0 && !error && (
          <div className="text-center py-16 bg-slate-800 rounded-xl border border-slate-700">
            <p className="text-slate-400">No hay datos de participación para los filtros seleccionados.</p>
          </div>
        )}
      </div>
    </div>
  );
}
