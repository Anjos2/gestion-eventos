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

interface TipoContrato {
  id: number
  nombre: string
}

interface BalanceData {
  id_canal_pago: number
  id_tipo_contrato: number
  tipo_contrato_nombre: string
  canal_pago_nombre: string
  mes: string
  cantidad_contratos: number
  total_ingresos: number
  cantidad_participaciones: number
  total_egresos: number
  neto: number
}

export default function BalanceMensualPage() {
  const supabase = createClientComponentClient()
  const { organization } = useOrganization()

  const [canales, setCanales] = useState<CanalPago[]>([])
  const [tiposContrato, setTiposContrato] = useState<TipoContrato[]>([])
  const [balanceData, setBalanceData] = useState<BalanceData[]>([])
  const [loading, setLoading] = useState(false)

  // Filtros
  const currentDate = new Date()
  const [mes, setMes] = useState(currentDate.getMonth() + 1)
  const [anio, setAnio] = useState(currentDate.getFullYear())
  const [idCanalPago, setIdCanalPago] = useState<number | null>(null)
  const [idTipoContrato, setIdTipoContrato] = useState<number | null>(null)

  useEffect(() => {
    if (organization?.id) {
      fetchCanalesYTipos()
    }
  }, [organization?.id])

  const fetchCanalesYTipos = async () => {
    try {
      const [canalesRes, tiposRes] = await Promise.all([
        supabase.from('Canales_Pago').select('id, nombre').eq('id_organizacion', organization?.id).eq('es_activo', true).order('es_principal', { ascending: false }),
        supabase.from('Tipos_Contrato').select('id, nombre').eq('id_organizacion', organization?.id).eq('es_activo', true)
      ])

      if (canalesRes.error) throw canalesRes.error
      if (tiposRes.error) throw tiposRes.error

      setCanales(canalesRes.data || [])
      setTiposContrato(tiposRes.data || [])
    } catch (error: any) {
      console.error('Error:', error)
      toast.error('Error al cargar datos')
    }
  }

  const fetchBalance = async () => {
    if (!organization?.id || !idCanalPago || !idTipoContrato) {
      toast.error('Por favor selecciona Canal de Pago y Tipo de Contrato')
      return
    }

    try {
      setLoading(true)
      const mesInicio = new Date(anio, mes - 1, 1).toISOString()
      const mesFin = new Date(anio, mes, 0, 23, 59, 59).toISOString()

      const { data, error } = await supabase
        .from('vista_balance_mensual_canal_tipo')
        .select('*')
        .eq('id_organizacion', organization?.id)
        .eq('id_canal_pago', idCanalPago)
        .eq('id_tipo_contrato', idTipoContrato)
        .gte('mes', mesInicio)
        .lte('mes', mesFin)

      if (error) throw error

      // Enriquecer con nombres
      const enrichedData = (data || []).map(item => ({
        ...item,
        canal_pago_nombre: canales.find(c => c.id === item.id_canal_pago)?.nombre || 'N/A',
      }))

      setBalanceData(enrichedData)
    } catch (error: any) {
      console.error('Error:', error)
      toast.error('Error al generar reporte')
    } finally {
      setLoading(false)
    }
  }

  const exportarPDF = () => {
    if (balanceData.length === 0) {
      toast.error('No hay datos para exportar')
      return
    }

    const doc = new jsPDF()
    const canalNombre = canales.find(c => c.id === idCanalPago)?.nombre || ''
    const tipoContratoNombre = tiposContrato.find(t => t.id === idTipoContrato)?.nombre || ''

    // Título
    doc.setFontSize(16)
    doc.text(`Balance Mensual - ${organization?.nombre || ''}`, 14, 15)

    doc.setFontSize(10)
    doc.text(`Mes: ${mes}/${anio}`, 14, 25)
    doc.text(`Canal de Pago: ${canalNombre}`, 14, 30)
    doc.text(`Tipo de Contrato: ${tipoContratoNombre}`, 14, 35)

    // Datos resumidos
    const totalIngresos = balanceData.reduce((sum, item) => sum + item.total_ingresos, 0)
    const totalEgresos = balanceData.reduce((sum, item) => sum + item.total_egresos, 0)
    const neto = totalIngresos - totalEgresos

    doc.setFontSize(12)
    doc.text('RESUMEN FINANCIERO', 14, 45)

    autoTable(doc, {
      startY: 50,
      head: [['Concepto', 'Cantidad', 'Monto (S/.)']],
      body: [
        ['Contratos (Ingresos)', balanceData.reduce((sum, item) => sum + item.cantidad_contratos, 0).toString(), totalIngresos.toFixed(2)],
        ['Participaciones (Egresos)', balanceData.reduce((sum, item) => sum + item.cantidad_participaciones, 0).toString(), totalEgresos.toFixed(2)],
        ['NETO', '-', neto.toFixed(2)],
      ],
      theme: 'striped',
    })

    doc.save(`balance-mensual-${mes}-${anio}.pdf`)
    toast.success('PDF generado exitosamente')
  }

  const mesNombre = new Date(anio, mes - 1).toLocaleString('es-ES', { month: 'long', year: 'numeric' })

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-6">Balance Mensual</h1>

      {/* Filtros */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg shadow p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <FiFilter className="text-slate-400" />
          <h2 className="text-lg font-semibold text-white">Filtros</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
            <label className="block text-sm font-medium text-slate-300 mb-1">Canal de Pago *</label>
            <select
              value={idCanalPago || ''}
              onChange={(e) => setIdCanalPago(e.target.value ? parseInt(e.target.value) : null)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
            >
              <option value="">Seleccione</option>
              {canales.map(canal => (
                <option key={canal.id} value={canal.id}>{canal.nombre}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Tipo de Contrato *</label>
            <select
              value={idTipoContrato || ''}
              onChange={(e) => setIdTipoContrato(e.target.value ? parseInt(e.target.value) : null)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
            >
              <option value="">Seleccione</option>
              {tiposContrato.map(tipo => (
                <option key={tipo.id} value={tipo.id}>{tipo.nombre}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-3 mt-4">
          <button
            onClick={fetchBalance}
            disabled={loading || !idCanalPago || !idTipoContrato}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed"
          >
            {loading ? 'Generando...' : 'Generar Reporte'}
          </button>

          {balanceData.length > 0 && (
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
      {balanceData.length > 0 && (
        <div className="bg-slate-800 border border-slate-700 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-white mb-4 capitalize">
            Balance de {mesNombre} - {canales.find(c => c.id === idCanalPago)?.nombre} - {tiposContrato.find(t => t.id === idTipoContrato)?.nombre}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-green-900/30 border border-green-700 rounded-lg p-4">
              <p className="text-sm text-green-300 font-medium">INGRESOS</p>
              <p className="text-2xl font-bold text-green-200">
                S/. {balanceData.reduce((sum, item) => sum + item.total_ingresos, 0).toFixed(2)}
              </p>
              <p className="text-xs text-green-400 mt-1">
                {balanceData.reduce((sum, item) => sum + item.cantidad_contratos, 0)} contratos
              </p>
            </div>

            <div className="bg-red-900/30 border border-red-700 rounded-lg p-4">
              <p className="text-sm text-red-300 font-medium">EGRESOS</p>
              <p className="text-2xl font-bold text-red-200">
                S/. {balanceData.reduce((sum, item) => sum + item.total_egresos, 0).toFixed(2)}
              </p>
              <p className="text-xs text-red-400 mt-1">
                {balanceData.reduce((sum, item) => sum + item.cantidad_participaciones, 0)} participaciones
              </p>
            </div>

            <div className={`border rounded-lg p-4 ${
              (balanceData.reduce((sum, item) => sum + item.neto, 0)) >= 0
                ? 'bg-blue-900/30 border-blue-700'
                : 'bg-yellow-900/30 border-yellow-700'
            }`}>
              <p className={`text-sm font-medium ${
                (balanceData.reduce((sum, item) => sum + item.neto, 0)) >= 0
                  ? 'text-blue-300'
                  : 'text-yellow-300'
              }`}>NETO</p>
              <p className={`text-2xl font-bold ${
                (balanceData.reduce((sum, item) => sum + item.neto, 0)) >= 0
                  ? 'text-blue-200'
                  : 'text-yellow-200'
              }`}>
                S/. {balanceData.reduce((sum, item) => sum + item.neto, 0).toFixed(2)}
              </p>
              <p className={`text-xs mt-1 ${
                (balanceData.reduce((sum, item) => sum + item.neto, 0)) >= 0
                  ? 'text-blue-400'
                  : 'text-yellow-400'
              }`}>
                {(balanceData.reduce((sum, item) => sum + item.neto, 0)) >= 0 ? 'Utilidad' : 'Pérdida'}
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-500 mt-4">
            * Este reporte incluye solo las participaciones marcadas como "Incluir en cálculos"
          </p>
        </div>
      )}

      {balanceData.length === 0 && !loading && (
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-8 text-center">
          <p className="text-slate-400">Selecciona los filtros y genera el reporte</p>
        </div>
      )}
    </div>
  )
}
