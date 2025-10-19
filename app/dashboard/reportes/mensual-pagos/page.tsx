'use client';

import React, { useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useOrganization } from '@/app/context/OrganizationContext';
import { FiDownload, FiPrinter, FiFileText } from 'react-icons/fi';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// --- INTERFACES ---
interface ReporteMensualPersonal {
  numero_orden: number;
  id_personal: number;
  nombre: string;
  dni: string | null;
  total_contratos: number;
  contratos_por_tipo: Record<string, { cantidad: number; monto: number }>;
  pago_total: number;
  estado_pago: string;
  fecha_pago: Date | null;
}

export default function ReporteMensualPagosPage() {
  const { organization } = useOrganization();
  const [mesSeleccionado, setMesSeleccionado] = useState('');
  const [reporteData, setReporteData] = useState<ReporteMensualPersonal[]>([]);
  const [tiposContrato, setTiposContrato] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClientComponentClient();

  // Estilos de impresión
  React.useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      @media print {
        @page {
          margin: 2cm;
          size: landscape;
        }

        body {
          font-family: 'Arial', sans-serif;
          color: #000;
          background: white;
        }

        body * {
          visibility: hidden;
        }

        #print-area, #print-area * {
          visibility: visible;
        }

        #print-area {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          background: white;
        }

        .no-print {
          display: none !important;
        }

        .print-header {
          margin-bottom: 25px;
          padding-bottom: 15px;
          border-bottom: 3px solid #000;
          text-align: center;
        }

        .print-header h1 {
          font-size: 24px;
          font-weight: bold;
          margin: 0 0 10px 0;
        }

        .print-header p {
          margin: 3px 0;
          font-size: 12px;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          page-break-inside: auto;
          font-size: 9px;
        }

        tr {
          page-break-inside: avoid;
          page-break-after: auto;
        }

        thead {
          display: table-header-group;
        }

        thead tr {
          background-color: #e5e7eb !important;
        }

        th {
          background-color: #e5e7eb !important;
          color: #000 !important;
          font-weight: bold !important;
          padding: 8px 6px !important;
          border: 1px solid #000 !important;
          text-align: center !important;
          font-size: 8px !important;
        }

        td {
          padding: 6px !important;
          border: 1px solid #000 !important;
          color: #000 !important;
        }

        tbody tr:nth-child(even) {
          background-color: #f9fafb !important;
        }

        tfoot {
          background-color: #dbeafe !important;
          font-weight: bold;
        }

        tfoot td {
          font-size: 10px !important;
          padding: 10px 6px !important;
          border: 2px solid #000 !important;
        }
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const handleGenerarReporte = async () => {
    if (!mesSeleccionado) {
      setError('Por favor, selecciona un mes.');
      return;
    }

    if (!organization) {
      setError('No se encontró la organización.');
      return;
    }

    setLoading(true);
    setError(null);
    setReporteData([]);
    setTiposContrato([]);

    const toastId = toast.loading('Generando reporte...');

    try {
      // Calcular rango de fechas del mes
      const [year, month] = mesSeleccionado.split('-');
      const startDate = `${year}-${month}-01`;
      const nextMonth = parseInt(month) === 12 ? 1 : parseInt(month) + 1;
      const nextYear = parseInt(month) === 12 ? parseInt(year) + 1 : parseInt(year);
      const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

      console.log('Fetching data from', startDate, 'to', endDate);

      // Helper para obtener el primer elemento de un array o el elemento mismo
      const getSingle = (data: any) => (Array.isArray(data) ? data[0] : data);

      // ========================================
      // PASO 1: Queries sin joins (evitar aliases de Supabase)
      // ========================================

      // QUERY 1: Contratos del mes (CORRECTO: la fecha está en Contratos, no en Eventos_Contrato)
      const { data: contratos, error: contratosError } = await supabase
        .from('Contratos')
        .select('id, fecha_hora_evento, id_tipo_contrato')
        .gte('fecha_hora_evento', startDate)
        .lt('fecha_hora_evento', endDate);

      if (contratosError) throw contratosError;

      if (!contratos || contratos.length === 0) {
        toast.error('No se encontraron contratos para el mes seleccionado.', { id: toastId });
        setLoading(false);
        return;
      }

      console.log('1. Contratos del mes:', contratos.length);

      const contratoIds = contratos.map(c => c.id);
      const tipoContratoIds = Array.from(new Set(contratos.map(c => c.id_tipo_contrato)));

      // QUERY 2: Tipos de Contrato (solo campos directos)
      const { data: tiposContrato, error: tiposError } = await supabase
        .from('Tipos_Contrato')
        .select('id, nombre')
        .in('id', tipoContratoIds);

      if (tiposError) throw tiposError;

      console.log('2. Tipos Contrato:', tiposContrato?.length || 0);

      // QUERY 3: Eventos-Contrato (tabla intermedia)
      const { data: eventosContrato, error: eventosError } = await supabase
        .from('Eventos_Contrato')
        .select('id, id_contrato')
        .in('id_contrato', contratoIds);

      if (eventosError) throw eventosError;

      console.log('3. Eventos-Contrato:', eventosContrato?.length || 0);

      const eventoContratoIds = eventosContrato?.map(ec => ec.id) || [];

      // QUERY 4: Participaciones de personal (por id_evento_contrato)
      const { data: participaciones, error: participacionesError } = await supabase
        .from('Participaciones_Personal')
        .select('id, id_personal_participante, id_evento_contrato')
        .in('id_evento_contrato', eventoContratoIds);

      if (participacionesError) throw participacionesError;

      if (!participaciones || participaciones.length === 0) {
        toast.error('No se encontraron participaciones para el mes seleccionado.', { id: toastId });
        setLoading(false);
        return;
      }

      console.log('4. Participaciones:', participaciones.length);

      const participacionIds = participaciones.map(p => p.id);
      const personalIds = Array.from(new Set(participaciones.map(p => p.id_personal_participante)));

      // QUERY 5: Servicios asignados (por id_participacion, NO por id_evento_contrato)
      const { data: servicios, error: serviciosError } = await supabase
        .from('Evento_Servicios_Asignados')
        .select('id, id_participacion, monto_pactado, estado_pago')
        .eq('id_organizacion', organization.id)
        .in('id_participacion', participacionIds);

      if (serviciosError) throw serviciosError;

      if (!servicios || servicios.length === 0) {
        toast.error('No se encontraron servicios para el mes seleccionado.', { id: toastId });
        setLoading(false);
        return;
      }

      console.log('5. Servicios:', servicios.length);

      const servicioIds = servicios.map(s => s.id);

      // QUERY 6: Detalles de Lote de Pago (solo campos directos)
      const { data: detallesLote, error: detallesError } = await supabase
        .from('Detalles_Lote_Pago')
        .select('id_evento_servicio_asignado, id_lote_pago')
        .in('id_evento_servicio_asignado', servicioIds);

      if (detallesError) throw detallesError;

      console.log('6. Detalles Lote:', detallesLote?.length || 0);

      const loteIds = Array.from(new Set(detallesLote?.map(d => d.id_lote_pago) || []));

      // QUERY 7: Lotes de Pago (solo campos directos)
      const { data: lotesPago, error: lotesError } = await supabase
        .from('Lotes_Pago')
        .select('id, estado, fecha_pago_programada')
        .in('id', loteIds);

      if (lotesError) throw lotesError;

      console.log('7. Lotes Pago:', lotesPago?.length || 0);

      // QUERY 8: Personal (solo campos directos)
      const { data: personalData, error: personalError } = await supabase
        .from('Personal')
        .select('id, nombre, dni')
        .in('id', personalIds);

      if (personalError) throw personalError;

      console.log('8. Personal:', personalData?.length || 0);

      // ========================================
      // PASO 2: Crear Maps para combinación eficiente
      // ========================================

      const tipoContratoMap = new Map(tiposContrato?.map(tc => [tc.id, tc]) || []);
      const contratoMap = new Map(contratos?.map(c => [c.id, c]) || []);
      const eventoContratoMap = new Map(eventosContrato?.map(ec => [ec.id, ec]) || []);
      const participacionMap = new Map(participaciones.map(p => [p.id, p]));
      const detalleLoteMap = new Map(detallesLote?.map(dl => [dl.id_evento_servicio_asignado, dl]) || []);
      const lotePagoMap = new Map(lotesPago?.map(lp => [lp.id, lp]) || []);
      const personalMap = new Map(personalData?.map(p => [p.id, p]) || []);

      // ========================================
      // PASO 3: Combinar datos en estructura completa
      // ========================================

      const serviciosFiltrados = servicios.map((servicio: any) => {
        // La cadena correcta: Servicio → Participación → Evento_Contrato → Contrato → Tipo_Contrato
        const participacion = participacionMap.get(servicio.id_participacion);
        if (!participacion) return null;

        const eventoContrato = eventoContratoMap.get(participacion.id_evento_contrato);
        const contrato = contratoMap.get(eventoContrato?.id_contrato);
        const tipoContrato = tipoContratoMap.get(contrato?.id_tipo_contrato);

        const detalleLote = detalleLoteMap.get(servicio.id);
        const lotePago = detalleLote ? lotePagoMap.get(detalleLote.id_lote_pago) : null;

        return {
          id: servicio.id,
          monto: servicio.monto_pactado,
          estado_pago: servicio.estado_pago,
          id_personal_participante: participacion.id_personal_participante,
          tipo_contrato_nombre: tipoContrato?.nombre || 'Sin tipo',
          lote_pago: lotePago ? {
            estado: lotePago.estado,
            fecha_pago_programada: lotePago.fecha_pago_programada
          } : null
        };
      }).filter(s => s !== null) || [];

      console.log('Servicios filtrados combinados:', serviciosFiltrados.length);

      // Obtener tipos de contrato únicos para columnas
      const tiposSet = new Set<string>();
      serviciosFiltrados.forEach((servicio: any) => {
        if (servicio.tipo_contrato_nombre) {
          tiposSet.add(servicio.tipo_contrato_nombre);
        }
      });

      const tiposContratoArray = Array.from(tiposSet).sort();
      setTiposContrato(tiposContratoArray);

      // ========================================
      // PASO 4: Agrupar por personal
      // ========================================

      const personalAgrupado: Record<number, {
        servicios: any[];
        personal: any;
      }> = {};

      serviciosFiltrados.forEach((servicio: any) => {
        const idPersonal = servicio.id_personal_participante;
        if (idPersonal) {
          if (!personalAgrupado[idPersonal]) {
            personalAgrupado[idPersonal] = {
              servicios: [],
              personal: personalMap.get(idPersonal)
            };
          }
          personalAgrupado[idPersonal].servicios.push(servicio);
        }
      });

      // ========================================
      // PASO 5: Procesar cada persona para el reporte
      // ========================================

      const reportePersonas: ReporteMensualPersonal[] = [];
      let numeroOrden = 1;

      for (const [idPersonalStr, data] of Object.entries(personalAgrupado)) {
        const idPersonal = parseInt(idPersonalStr);
        const contratos_por_tipo: Record<string, { cantidad: number; monto: number }> = {};

        // Inicializar tipos
        tiposContratoArray.forEach(tipo => {
          contratos_por_tipo[tipo] = { cantidad: 0, monto: 0 };
        });

        let pagoTotal = 0;
        let serviciosPagados = 0;

        data.servicios.forEach((servicio: any) => {
          const nombreTipo = servicio.tipo_contrato_nombre;

          if (contratos_por_tipo[nombreTipo]) {
            contratos_por_tipo[nombreTipo].cantidad += 1;
            contratos_por_tipo[nombreTipo].monto += servicio.monto || 0;
          }

          pagoTotal += servicio.monto || 0;

          // Verificar si está realmente pagado (no solo en lote finalizado)
          if (servicio.estado_pago === 'PAGADO') {
            serviciosPagados++;
          }
        });

        // Calcular estado de pago
        let estadoPago = 'Pendiente';
        let fechaPago: Date | null = null;

        if (serviciosPagados > 0) {
          const fechasPago = data.servicios
            .map((s: any) => {
              // Solo obtener fecha de servicios realmente pagados
              if (s.estado_pago === 'PAGADO' && s.lote_pago?.fecha_pago_programada) {
                return new Date(s.lote_pago.fecha_pago_programada);
              }
              return null;
            })
            .filter((f): f is Date => f !== null);

          if (fechasPago.length > 0) {
            fechaPago = new Date(Math.max(...fechasPago.map(f => f.getTime())));

            if (serviciosPagados === data.servicios.length) {
              estadoPago = `Pagado (${fechaPago.toLocaleDateString('es-PE')})`;
            } else {
              estadoPago = `Parcial (${serviciosPagados}/${data.servicios.length})`;
            }
          }
        }

        reportePersonas.push({
          numero_orden: numeroOrden++,
          id_personal: idPersonal,
          nombre: data.personal?.nombre || 'Desconocido',
          dni: data.personal?.dni || null,
          total_contratos: data.servicios.length,
          contratos_por_tipo,
          pago_total: pagoTotal,
          estado_pago: estadoPago,
          fecha_pago: fechaPago
        });
      }

      // Ordenar por número de orden
      reportePersonas.sort((a, b) => a.numero_orden - b.numero_orden);

      setReporteData(reportePersonas);
      toast.success(`Reporte generado con ${reportePersonas.length} personas.`, { id: toastId });

    } catch (err: any) {
      console.error('Error generando reporte:', err);
      toast.error(`Error: ${err.message}`, { id: toastId });
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const calcularTotales = () => {
    const totales = {
      total_contratos: 0,
      pago_total: 0,
      por_tipo: {} as Record<string, { cantidad: number; monto: number }>
    };

    tiposContrato.forEach(tipo => {
      totales.por_tipo[tipo] = { cantidad: 0, monto: 0 };
    });

    reporteData.forEach(persona => {
      totales.total_contratos += persona.total_contratos;
      totales.pago_total += persona.pago_total;

      tiposContrato.forEach(tipo => {
        const data = persona.contratos_por_tipo[tipo];
        if (data) {
          totales.por_tipo[tipo].cantidad += data.cantidad;
          totales.por_tipo[tipo].monto += data.monto;
        }
      });
    });

    return totales;
  };

  const handleDescargarExcel = () => {
    const excelData: any[] = [];
    const totales = calcularTotales();

    // Header
    excelData.push([organization?.nombre || 'Organización']);
    excelData.push([`Reporte Mensual de Pagos - ${getNombreMes(mesSeleccionado)}`]);
    excelData.push([`Fecha de Emisión: ${new Date().toLocaleDateString('es-PE')}`]);
    excelData.push([]);

    // Headers
    const headers = ['N°', 'Integrante', 'DNI', 'Total Contratos'];
    tiposContrato.forEach(tipo => {
      headers.push(`${tipo} (Cant)`);
      headers.push(`${tipo} (S/)`);
    });
    headers.push('Pago Total');
    headers.push('Estado de Pago');
    excelData.push(headers);

    // Datos
    reporteData.forEach(persona => {
      const row: any[] = [
        persona.numero_orden,
        persona.nombre,
        persona.dni || '-',
        persona.total_contratos
      ];

      tiposContrato.forEach(tipo => {
        const data = persona.contratos_por_tipo[tipo] || { cantidad: 0, monto: 0 };
        row.push(data.cantidad);
        row.push(data.monto.toFixed(2));
      });

      row.push(persona.pago_total.toFixed(2));
      row.push(persona.estado_pago);
      excelData.push(row);
    });

    // Totales
    const rowTotales: any[] = [
      '',
      'TOTAL',
      '',
      totales.total_contratos
    ];

    tiposContrato.forEach(tipo => {
      const data = totales.por_tipo[tipo] || { cantidad: 0, monto: 0 };
      rowTotales.push(data.cantidad);
      rowTotales.push(data.monto.toFixed(2));
    });

    rowTotales.push(totales.pago_total.toFixed(2));
    rowTotales.push('');
    excelData.push(rowTotales);

    // Crear worksheet
    const ws = XLSX.utils.aoa_to_sheet(excelData);

    // Anchos de columna
    const colWidths: any[] = [
      { wch: 5 },  // N°
      { wch: 25 }, // Integrante
      { wch: 12 }, // DNI
      { wch: 15 }  // Total Contratos
    ];

    tiposContrato.forEach(() => {
      colWidths.push({ wch: 10 }); // Cantidad
      colWidths.push({ wch: 12 }); // Monto
    });
    colWidths.push({ wch: 12 }); // Pago Total
    colWidths.push({ wch: 20 }); // Estado

    ws['!cols'] = colWidths;

    // Merge cells para header
    if (!ws['!merges']) ws['!merges'] = [];
    ws['!merges'].push(
      { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: headers.length - 1 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: headers.length - 1 } }
    );

    // Crear workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Reporte Mensual');

    // Descargar
    const fecha = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Reporte_Mensual_${mesSeleccionado}_${fecha}.xlsx`);
    toast.success('Excel descargado exitosamente');
  };

  const handleDescargarPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const totales = calcularTotales();

    // Header
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(organization?.nombre || 'Organización', 14, 15);

    doc.setFontSize(14);
    doc.text(`Reporte Mensual de Pagos - ${getNombreMes(mesSeleccionado)}`, 14, 25);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Fecha de Emisión: ${new Date().toLocaleDateString('es-PE')}`, 14, 32);
    doc.text(`Total de Personas: ${reporteData.length} | Monto Total: S/ ${totales.pago_total.toFixed(2)}`, 14, 38);

    // Preparar headers
    const headers: string[] = ['N°', 'Integrante', 'DNI', 'Total'];
    tiposContrato.forEach(tipo => {
      headers.push(`${tipo}\n(Cant)`);
      headers.push(`${tipo}\n(S/)`);
    });
    headers.push('Pago\nTotal');
    headers.push('Estado de Pago');

    // Preparar datos
    const body: any[][] = reporteData.map(persona => {
      const row: any[] = [
        persona.numero_orden,
        persona.nombre,
        persona.dni || '-',
        persona.total_contratos
      ];

      tiposContrato.forEach(tipo => {
        const data = persona.contratos_por_tipo[tipo] || { cantidad: 0, monto: 0 };
        row.push(data.cantidad);
        row.push(data.monto.toFixed(2));
      });

      row.push(persona.pago_total.toFixed(2));
      row.push(persona.estado_pago);
      return row;
    });

    // Fila de totales
    const footRow: any[] = ['', 'TOTAL', '', totales.total_contratos];
    tiposContrato.forEach(tipo => {
      const data = totales.por_tipo[tipo] || { cantidad: 0, monto: 0 };
      footRow.push(data.cantidad);
      footRow.push(data.monto.toFixed(2));
    });
    footRow.push(totales.pago_total.toFixed(2));
    footRow.push('');

    // Generar tabla
    autoTable(doc, {
      startY: 45,
      head: [headers],
      body: body,
      foot: [footRow],
      theme: 'grid',
      styles: {
        fontSize: 7,
        cellPadding: 2,
        overflow: 'linebreak',
      },
      headStyles: {
        fillColor: [226, 232, 240], // slate-200
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        halign: 'center',
      },
      footStyles: {
        fillColor: [219, 234, 254], // blue-100
        textColor: [0, 0, 0],
        fontStyle: 'bold',
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 }, // N°
        1: { halign: 'left', cellWidth: 35 },   // Integrante
        2: { halign: 'center', cellWidth: 20 }, // DNI
        3: { halign: 'center', cellWidth: 15 }, // Total
        // Los demás se ajustan automáticamente
      },
      didParseCell: function(data) {
        // Alinear columnas de monto a la derecha
        if (data.section === 'body' || data.section === 'foot') {
          const colIndex = data.column.index;
          // Montos están en posiciones impares después de la columna 3
          if (colIndex > 3 && colIndex < headers.length - 1 && (colIndex - 4) % 2 === 1) {
            data.cell.styles.halign = 'right';
          }
          // Pago Total
          if (colIndex === headers.length - 2) {
            data.cell.styles.halign = 'right';
          }
        }
      }
    });

    // Guardar
    const fecha = new Date().toISOString().slice(0, 10);
    doc.save(`Reporte_Mensual_${mesSeleccionado}_${fecha}.pdf`);
    toast.success('PDF descargado exitosamente');
  };

  const handleImprimir = () => {
    window.print();
  };

  const getNombreMes = (mesAno: string) => {
    if (!mesAno) return '';
    const [year, month] = mesAno.split('-');
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                   'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return `${meses[parseInt(month) - 1]} ${year}`;
  };

  return (
    <div className="p-4 md:p-6 lg:p-8">
      {/* Filtros */}
      <div className="bg-slate-800 rounded-xl p-6 mb-6 border border-slate-700 no-print">
        <h1 className="text-3xl font-bold text-white mb-6">Reporte Mensual de Pagos</h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="md:col-span-1">
            <label htmlFor="mes" className="block text-sm font-medium text-slate-400 mb-2">
              Seleccionar Mes
            </label>
            <input
              id="mes"
              type="month"
              value={mesSeleccionado}
              onChange={(e) => setMesSeleccionado(e.target.value)}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
            />
          </div>

          <div>
            <button
              onClick={handleGenerarReporte}
              disabled={loading || !mesSeleccionado}
              className="w-full px-6 py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-lg disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Generando...' : 'Generar Reporte'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg">
            <p>{error}</p>
          </div>
        )}
      </div>

      {/* Botones de acción */}
      {reporteData.length > 0 && (
        <div className="flex flex-wrap gap-4 mb-6 no-print">
          <button
            onClick={handleDescargarExcel}
            className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors"
          >
            <FiDownload /> Descargar Excel
          </button>
          <button
            onClick={handleDescargarPDF}
            className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors"
          >
            <FiFileText /> Exportar PDF
          </button>
          <button
            onClick={handleImprimir}
            className="flex items-center gap-2 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition-colors"
          >
            <FiPrinter /> Imprimir
          </button>
        </div>
      )}

      {/* Área de impresión */}
      {reporteData.length > 0 && (
        <div id="print-area">
          <div className="print-header hidden print:block">
            <h1>{organization?.nombre || 'Organización'}</h1>
            <h1>Reporte Mensual de Pagos - {getNombreMes(mesSeleccionado)}</h1>
            <p><strong>Fecha de Emisión:</strong> {new Date().toLocaleDateString('es-PE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            <p><strong>Total de Personas:</strong> {reporteData.length} | <strong>Monto Total:</strong> S/ {calcularTotales().pago_total.toFixed(2)}</p>
          </div>

          {/* Tabla */}
          <div className="bg-slate-800 print:bg-white rounded-xl shadow-lg border border-slate-700 print:border-black overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-900 print:bg-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-center text-xs font-bold text-slate-400 print:text-black uppercase">N°</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 print:text-black uppercase">Integrante</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-slate-400 print:text-black uppercase">DNI</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-slate-400 print:text-black uppercase">Total Contratos</th>
                    {tiposContrato.map(tipo => (
                      <React.Fragment key={tipo}>
                        <th className="px-4 py-3 text-center text-xs font-bold text-slate-400 print:text-black uppercase border-l border-slate-700 print:border-black">
                          {tipo} (Cant)
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-bold text-slate-400 print:text-black uppercase">
                          {tipo} (S/)
                        </th>
                      </React.Fragment>
                    ))}
                    <th className="px-4 py-3 text-right text-xs font-bold text-slate-400 print:text-black uppercase border-l border-slate-700 print:border-black">
                      Pago Total
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-slate-400 print:text-black uppercase">
                      Estado de Pago
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700 print:divide-black">
                  {reporteData.map(persona => (
                    <tr key={persona.id_personal} className="hover:bg-slate-700/50 print:hover:bg-transparent">
                      <td className="px-4 py-3 text-center text-slate-300 print:text-black">{persona.numero_orden}</td>
                      <td className="px-4 py-3 font-medium text-white print:text-black">{persona.nombre}</td>
                      <td className="px-4 py-3 text-center text-slate-300 print:text-black">{persona.dni || '-'}</td>
                      <td className="px-4 py-3 text-center text-slate-300 print:text-black">{persona.total_contratos}</td>
                      {tiposContrato.map(tipo => {
                        const data = persona.contratos_por_tipo[tipo] || { cantidad: 0, monto: 0 };
                        return (
                          <React.Fragment key={tipo}>
                            <td className="px-4 py-3 text-center text-slate-300 print:text-black border-l border-slate-700 print:border-black">
                              {data.cantidad}
                            </td>
                            <td className="px-4 py-3 text-right text-slate-300 print:text-black">
                              S/ {data.monto.toFixed(2)}
                            </td>
                          </React.Fragment>
                        );
                      })}
                      <td className="px-4 py-3 text-right font-bold text-yellow-400 print:text-black border-l border-slate-700 print:border-black">
                        S/ {persona.pago_total.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-slate-300 print:text-black">
                        {persona.estado_pago}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-900 print:bg-gray-200">
                  <tr className="border-t-2 border-sky-500 print:border-black">
                    <td className="px-4 py-4 font-bold text-white print:text-black" colSpan={2}>
                      TOTAL
                    </td>
                    <td className="px-4 py-4"></td>
                    <td className="px-4 py-4 text-center font-bold text-white print:text-black text-lg">
                      {calcularTotales().total_contratos}
                    </td>
                    {tiposContrato.map(tipo => {
                      const data = calcularTotales().por_tipo[tipo] || { cantidad: 0, monto: 0 };
                      return (
                        <React.Fragment key={tipo}>
                          <td className="px-4 py-4 text-center font-bold text-white print:text-black border-l border-slate-700 print:border-black">
                            {data.cantidad}
                          </td>
                          <td className="px-4 py-4 text-right font-bold text-white print:text-black">
                            S/ {data.monto.toFixed(2)}
                          </td>
                        </React.Fragment>
                      );
                    })}
                    <td className="px-4 py-4 text-right font-bold text-yellow-400 print:text-black text-lg border-l border-slate-700 print:border-black">
                      S/ {calcularTotales().pago_total.toFixed(2)}
                    </td>
                    <td className="px-4 py-4"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Mensaje cuando no hay datos */}
      {!loading && reporteData.length === 0 && mesSeleccionado && !error && (
        <div className="text-center py-16 bg-slate-800/50 rounded-xl border border-slate-700">
          <p className="text-slate-400">Selecciona un mes y haz clic en "Generar Reporte"</p>
        </div>
      )}
    </div>
  );
}
