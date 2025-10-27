'use client'

import { useState, useEffect } from 'react'
import { useOrganization } from '@/app/context/OrganizationContext'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { FiDownload, FiFilter, FiAlertCircle } from 'react-icons/fi'
import toast from 'react-hot-toast'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface CanalPago {
  id: number
  nombre: string
}

interface PagoPendiente {
  id_organizacion: number
  id_canal_pago: number
  canal_pago_nombre: string
  canal_es_principal: boolean
  id_personal_participante: number
  participante_nombre: string
  dni: string | null
  id_tipo_contrato: number
  tipo_contrato_nombre: string
  mes: string
  fecha_evento: string
  fecha_hora_evento: string
  cantidad_eventos: number
  total_monto: number
  fecha_primer_evento: string
  fecha_ultimo_evento: string
  tipos_contrato_detalle: string
}

export default function PagosPendientesPage() {
  const supabase = createClientComponentClient()
  const { organization } = useOrganization()

  const [canales, setCanales] = useState<CanalPago[]>([])
  const [dataPagos, setDataPagos] = useState<PagoPendiente[]>([])
  const [loading, setLoading] = useState(false)

  const currentDate = new Date()
  const [mes, setMes] = useState(currentDate.getMonth() + 1)
  const [anio, setAnio] = useState(currentDate.getFullYear())
  const [idCanalPago, setIdCanalPago] = useState<number | null>(null)

  useEffect(() => {
    if (organization?.id) {
      fetchCanales()
    }
  }, [organization?.id])

  const fetchCanales = async () => {
    try {
      const { data, error } = await supabase
        .from('Canales_Pago')
        .select('id, nombre')
        .eq('id_organizacion', organization?.id)
        .eq('es_activo', true)
        .order('es_principal', { ascending: false })

      if (error) throw error
      setCanales(data || [])
    } catch (error: any) {
      console.error('Error:', error)
      toast.error('Error al cargar canales')
    }
  }

  const fetchPagosPendientes = async () => {
    if (!organization?.id) {
      toast.error('No se pudo obtener la organización')
      return
    }

    try {
      setLoading(true)
      const mesInicio = new Date(anio, mes - 1, 1).toISOString()
      const mesFin = new Date(anio, mes, 0, 23, 59, 59).toISOString()

      let query = supabase
        .from('vista_pagos_pendientes_participante')
        .select('*')
        .eq('id_organizacion', organization?.id)
        .gte('mes', mesInicio)
        .lte('mes', mesFin)
        .order('participante_nombre', { ascending: true })
        .order('fecha_evento', { ascending: false })

      if (idCanalPago) {
        query = query.eq('id_canal_pago', idCanalPago)
      }

      const { data, error } = await query

      if (error) throw error
      setDataPagos(data || [])
    } catch (error: any) {
      console.error('Error:', error)
      toast.error('Error al generar reporte')
    } finally {
      setLoading(false)
    }
  }

  const exportarPDF = () => {
    if (dataPagos.length === 0) {
      toast.error('No hay datos para exportar')
      return
    }

    const doc = new jsPDF()
    const mesNombre = new Date(anio, mes - 1).toLocaleString('es-ES', { month: 'long' }).toUpperCase()
    const canalNombre = idCanalPago ? canales.find(c => c.id === idCanalPago)?.nombre : 'Todos los canales'

    // Título
    doc.setFontSize(14)
    doc.text(`PAGOS PENDIENTES ${mesNombre} ${anio}`, 105, 15, { align: 'center' })
    doc.setFontSize(10)
    doc.text(organization?.nombre || '', 105, 22, { align: 'center' })
    doc.text(`Canal: ${canalNombre}`, 105, 27, { align: 'center' })

    // Agrupar por participante
    const participantes: { [key: number]: any } = {}
    dataPagos.forEach(item => {
      if (!participantes[item.id_personal_participante]) {
        participantes[item.id_personal_participante] = {
          nombre: item.participante_nombre,
          dni: item.dni || '',
          eventos: [],
          totalGeneral: 0
        }
      }
      participantes[item.id_personal_participante].eventos.push({
        fecha: item.fecha_evento,
        tipo: item.tipo_contrato_nombre,
        cantidad: item.cantidad_eventos,
        monto: item.total_monto
      })
      participantes[item.id_personal_participante].totalGeneral += item.total_monto
    })

    // Tabla
    const tableData = Object.values(participantes).map((p: any, index) => {
      const eventosStr = p.eventos.map((ev: any) =>
        `${new Date(ev.fecha).toLocaleDateString('es-ES')} - ${ev.tipo} (S/. ${ev.monto.toFixed(2)})`
      ).join('\n')

      return [
        (index + 1).toString(),
        p.nombre,
        p.dni,
        p.eventos.length.toString(),
        eventosStr,
        `S/. ${p.totalGeneral.toFixed(2)}`
      ]
    })

    autoTable(doc, {
      startY: 35,
      head: [['N°', 'INTEGRANTE', 'DNI', 'EVENTOS', 'DETALLE', 'TOTAL']],
      body: tableData,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [66, 139, 202], textColor: 255 },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 35 },
        2: { cellWidth: 25 },
        3: { cellWidth: 20 },
        4: { cellWidth: 60 },
        5: { cellWidth: 25 }
      }
    })

    // Total
    const totalGeneral = Object.values(participantes).reduce((sum: number, p: any) => sum + p.totalGeneral, 0)
    const finalY = (doc as any).lastAutoTable.finalY + 5
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text(`TOTAL GENERAL: S/. ${totalGeneral.toFixed(2)}`, 14, finalY)

    doc.save(`pagos-pendientes-${mes}-${anio}.pdf`)
    toast.success('PDF generado exitosamente')
  }

  const mesNombre = new Date(anio, mes - 1).toLocaleString('es-ES', { month: 'long', year: 'numeric' })

  // Agrupar datos por participante para mostrar en tabla
  const participantesAgrupados: { [key: number]: any } = {}
  dataPagos.forEach(item => {
    if (!participantesAgrupados[item.id_personal_participante]) {
      participantesAgrupados[item.id_personal_participante] = {
        nombre: item.participante_nombre,
        dni: item.dni,
        canal: item.canal_pago_nombre,
        eventos: [],
        totalGeneral: 0
      }
    }
    participantesAgrupados[item.id_personal_participante].eventos.push({
      fecha: item.fecha_evento,
      tipo: item.tipo_contrato_nombre,
      cantidad: item.cantidad_eventos,
      monto: item.total_monto
    })
    participantesAgrupados[item.id_personal_participante].totalGeneral += item.total_monto
  })

  const totalPendiente = Object.values(participantesAgrupados).reduce((sum: number, p: any) => sum + p.totalGeneral, 0)

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-2">Pagos Pendientes</h1>
        <p className="text-slate-400 text-sm">
          Reporte de pagos pendientes a personal por eventos completados
        </p>
      </div>

      {/* Filtros */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg shadow p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <FiFilter className="text-slate-400" />
          <h2 className="text-lg font-semibold text-white">Filtros</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Mes</label>
            <select
              value={mes}
              onChange={(e) => setMes(parseInt(e.target.value))}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>{new Date(2000, m - 1).toLocaleString('es-ES', { month: 'long' })}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Año</label>
            <select
              value={anio}
              onChange={(e) => setAnio(parseInt(e.target.value))}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
            >
              {Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - i).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Canal de Pago (opcional)</label>
            <select
              value={idCanalPago || ''}
              onChange={(e) => setIdCanalPago(e.target.value ? parseInt(e.target.value) : null)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
            >
              <option value="">Todos los canales</option>
              {canales.map(canal => (
                <option key={canal.id} value={canal.id}>{canal.nombre}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-3 mt-4">
          <button
            onClick={fetchPagosPendientes}
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed"
          >
            {loading ? 'Generando...' : 'Generar Reporte'}
          </button>

          {dataPagos.length > 0 && (
            <button
              onClick={exportarPDF}
              className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
            >
              <FiDownload />
              Exportar PDF
            </button>
          )}
        </div>
      </div>

      {/* Alerta de Total Pendiente */}
      {Object.keys(participantesAgrupados).length > 0 && (
        <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-4 mb-6 flex items-start gap-3">
          <FiAlertCircle className="text-yellow-400 mt-0.5 flex-shrink-0" size={20} />
          <div className="flex-1">
            <h3 className="font-semibold text-yellow-200 mb-1">Total de Pagos Pendientes</h3>
            <p className="text-2xl font-bold text-yellow-100">
              S/. {totalPendiente.toFixed(2)}
            </p>
            <p className="text-sm text-yellow-300 mt-1">
              {Object.keys(participantesAgrupados).length} participante(s) con pagos pendientes
            </p>
          </div>
        </div>
      )}

      {/* Resultados */}
      {Object.keys(participantesAgrupados).length > 0 && (
        <div className="bg-slate-800 border border-slate-700 rounded-lg shadow overflow-hidden">
          <div className="p-4 bg-slate-900 border-b border-slate-700">
            <h3 className="text-lg font-semibold text-white capitalize">
              Reporte de {mesNombre}
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-700">
              <thead className="bg-slate-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase">N°</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase">Integrante</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase">DNI</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase">Canal</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase">Eventos Pendientes</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-slate-400 uppercase">Total Pendiente</th>
                </tr>
              </thead>
              <tbody className="bg-slate-800 divide-y divide-slate-700">
                {Object.values(participantesAgrupados).map((p: any, index) => (
                  <tr key={index} className="hover:bg-slate-700">
                    <td className="px-4 py-3 text-sm text-white">{index + 1}</td>
                    <td className="px-4 py-3 text-sm font-medium text-white">{p.nombre}</td>
                    <td className="px-4 py-3 text-sm text-slate-300">{p.dni || 'N/A'}</td>
                    <td className="px-4 py-3 text-sm text-slate-300">{p.canal}</td>
                    <td className="px-4 py-3 text-sm text-slate-300">
                      {p.eventos.map((ev: any, i: number) => (
                        <div key={i} className="mb-1">
                          <span className="inline-block bg-slate-700 px-2 py-1 rounded text-xs mr-2">
                            {new Date(ev.fecha).toLocaleDateString('es-ES')}
                          </span>
                          <span className="font-medium">{ev.tipo}</span> →
                          <span className="text-yellow-400 font-semibold ml-1">S/. {ev.monto.toFixed(2)}</span>
                        </div>
                      ))}
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-right text-white">
                      S/. {p.totalGeneral.toFixed(2)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-slate-900 font-bold">
                  <td colSpan={5} className="px-4 py-3 text-sm text-right text-white">TOTAL GENERAL:</td>
                  <td className="px-4 py-3 text-sm text-right text-white">
                    S/. {totalPendiente.toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {dataPagos.length === 0 && !loading && (
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-8 text-center">
          <p className="text-slate-400">Selecciona los filtros y genera el reporte</p>
        </div>
      )}
    </div>
  )
}
