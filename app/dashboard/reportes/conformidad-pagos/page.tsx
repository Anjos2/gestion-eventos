'use client'

import { useState, useEffect } from 'react'
import { useOrganization } from '@/app/context/OrganizationContext'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { FiDownload, FiFilter } from 'react-icons/fi'
import toast from 'react-hot-toast'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface CanalPago {
  id: number
  nombre: string
}

interface ParticipantePago {
  id_personal_participante: number
  participante_nombre: string
  dni: string | null
  tipo_contrato_nombre: string
  cantidad_eventos: number
  total_monto: number
  fecha_pago_programada: string | null
}

export default function ConformidadPagosPage() {
  const supabase = createClientComponentClient()
  const { organization } = useOrganization()

  const [canales, setCanales] = useState<CanalPago[]>([])
  const [dataPagos, setDataPagos] = useState<ParticipantePago[]>([])
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

  const fetchConformidad = async () => {
    if (!organization?.id) {
      toast.error('No se pudo obtener la organización')
      return
    }

    try {
      setLoading(true)
      const mesInicio = new Date(anio, mes - 1, 1).toISOString()
      const mesFin = new Date(anio, mes, 0, 23, 59, 59).toISOString()

      let query = supabase
        .from('vista_conformidad_pagos_participante')
        .select('*')
        .eq('id_organizacion', organization?.id)
        .gte('mes', mesInicio)
        .lte('mes', mesFin)
        .order('participante_nombre', { ascending: true })
        .order('tipo_contrato_nombre', { ascending: true })

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
    doc.text(`CONFORMIDAD DE PAGOS ${mesNombre} ${anio}`, 105, 15, { align: 'center' })
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
          tiposContrato: [],
          totalGeneral: 0
        }
      }
      participantes[item.id_personal_participante].tiposContrato.push({
        tipo: item.tipo_contrato_nombre,
        cantidad: item.cantidad_eventos,
        monto: item.total_monto
      })
      participantes[item.id_personal_participante].totalGeneral += item.total_monto
    })

    // Tabla
    const tableData = Object.values(participantes).map((p: any, index) => {
      const tiposContratoStr = p.tiposContrato.map((tc: any) => `${tc.cantidad} ${tc.tipo} (S/. ${tc.monto.toFixed(2)})`).join('\n')
      return [
        (index + 1).toString(),
        p.nombre,
        p.dni,
        tiposContratoStr,
        `S/. ${p.totalGeneral.toFixed(2)}`,
        '', // Conforme
        ''  // Firma
      ]
    })

    autoTable(doc, {
      startY: 35,
      head: [['N°', 'INTEGRANTE', 'DNI', 'SERVICIOS', 'PAGO TOTAL', 'CONFORME', 'FIRMA']],
      body: tableData,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [66, 139, 202], textColor: 255 },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 40 },
        2: { cellWidth: 25 },
        3: { cellWidth: 40 },
        4: { cellWidth: 25 },
        5: { cellWidth: 20 },
        6: { cellWidth: 30 }
      }
    })

    // Total
    const totalGeneral = Object.values(participantes).reduce((sum: number, p: any) => sum + p.totalGeneral, 0)
    const finalY = (doc as any).lastAutoTable.finalY + 5
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text(`TOTAL GENERAL: S/. ${totalGeneral.toFixed(2)}`, 14, finalY)

    doc.save(`conformidad-pagos-${mes}-${anio}.pdf`)
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
        tiposContrato: [],
        totalGeneral: 0
      }
    }
    participantesAgrupados[item.id_personal_participante].tiposContrato.push({
      tipo: item.tipo_contrato_nombre,
      cantidad: item.cantidad_eventos,
      monto: item.total_monto
    })
    participantesAgrupados[item.id_personal_participante].totalGeneral += item.total_monto
  })

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Conformidad de Pagos</h1>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <FiFilter className="text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-800">Filtros</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mes</label>
            <select
              value={mes}
              onChange={(e) => setMes(parseInt(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>{new Date(2000, m - 1).toLocaleString('es-ES', { month: 'long' })}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Año</label>
            <select
              value={anio}
              onChange={(e) => setAnio(parseInt(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              {Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - i).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Canal de Pago (opcional)</label>
            <select
              value={idCanalPago || ''}
              onChange={(e) => setIdCanalPago(e.target.value ? parseInt(e.target.value) : null)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
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
            onClick={fetchConformidad}
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
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

      {/* Resultados */}
      {Object.keys(participantesAgrupados).length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 bg-gray-50 border-b">
            <h3 className="text-lg font-semibold text-gray-800 capitalize">
              Reporte de {mesNombre}
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">N°</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Integrante</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">DNI</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Servicios por Tipo de Contrato</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Pago Total</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {Object.values(participantesAgrupados).map((p: any, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{index + 1}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{p.nombre}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{p.dni || 'N/A'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {p.tiposContrato.map((tc: any, i: number) => (
                        <div key={i} className="mb-1">
                          <span className="font-medium">{tc.cantidad}</span> {tc.tipo} → <span className="text-green-600 font-semibold">S/. {tc.monto.toFixed(2)}</span>
                        </div>
                      ))}
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-right text-gray-900">
                      S/. {p.totalGeneral.toFixed(2)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-gray-100 font-bold">
                  <td colSpan={4} className="px-4 py-3 text-sm text-right text-gray-900">TOTAL GENERAL:</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-900">
                    S/. {Object.values(participantesAgrupados).reduce((sum: number, p: any) => sum + p.totalGeneral, 0).toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {dataPagos.length === 0 && !loading && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-gray-600">Selecciona los filtros y genera el reporte</p>
        </div>
      )}
    </div>
  )
}
