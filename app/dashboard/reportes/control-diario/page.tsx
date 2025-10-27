'use client'

import { useState, useEffect } from 'react'
import { useOrganization } from '@/app/context/OrganizationContext'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { FiDownload, FiFilter } from 'react-icons/fi'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'

interface CanalPago {
  id: number
  nombre: string
}

interface TipoContrato {
  id: number
  nombre: string
}

interface EventoDiario {
  fecha_evento: string
  participante_nombre: string
  monto_pactado: number
  hora_evento: string
  dia_semana: string
}

export default function ControlDiarioPage() {
  const supabase = createClientComponentClient()
  const { organization } = useOrganization()

  const [canales, setCanales] = useState<CanalPago[]>([])
  const [tiposContrato, setTiposContrato] = useState<TipoContrato[]>([])
  const [dataEventos, setDataEventos] = useState<EventoDiario[]>([])
  const [loading, setLoading] = useState(false)

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

  const fetchControlDiario = async () => {
    if (!organization?.id || !idCanalPago || !idTipoContrato) {
      toast.error('Por favor selecciona Canal de Pago y Tipo de Contrato')
      return
    }

    try {
      setLoading(true)
      const mesInicio = new Date(anio, mes - 1, 1).toISOString()
      const mesFin = new Date(anio, mes, 0, 23, 59, 59).toISOString()

      const { data, error } = await supabase
        .from('vista_control_diario_participante')
        .select('*')
        .eq('id_organizacion', organization?.id)
        .eq('id_canal_pago', idCanalPago)
        .eq('id_tipo_contrato', idTipoContrato)
        .gte('mes', mesInicio)
        .lte('mes', mesFin)
        .order('participante_nombre', { ascending: true })
        .order('fecha_evento', { ascending: true })

      if (error) throw error
      setDataEventos(data || [])
    } catch (error: any) {
      console.error('Error:', error)
      toast.error('Error al generar reporte')
    } finally {
      setLoading(false)
    }
  }

  const exportarExcel = () => {
    if (dataEventos.length === 0) {
      toast.error('No hay datos para exportar')
      return
    }

    const mesNombre = new Date(anio, mes - 1).toLocaleString('es-ES', { month: 'long' }).toUpperCase()
    const canalNombre = canales.find(c => c.id === idCanalPago)?.nombre || ''
    const tipoContratoNombre = tiposContrato.find(t => t.id === idTipoContrato)?.nombre || ''

    // Agrupar por participante y fecha
    const participantes: { [key: string]: any } = {}
    const fechasUnicas = new Set<string>()

    dataEventos.forEach(evento => {
      fechasUnicas.add(evento.fecha_evento)
      if (!participantes[evento.participante_nombre]) {
        participantes[evento.participante_nombre] = {}
      }
      if (!participantes[evento.participante_nombre][evento.fecha_evento]) {
        participantes[evento.participante_nombre][evento.fecha_evento] = 0
      }
      participantes[evento.participante_nombre][evento.fecha_evento] += evento.monto_pactado
    })

    const fechasOrdenadas = Array.from(fechasUnicas).sort()

    // Crear encabezados
    const headers = ['N°', 'INTEGRANTE', ...fechasOrdenadas.map(f => new Date(f).getDate().toString()), 'CANTIDAD', 'TOTAL']

    // Crear filas
    const rows = Object.entries(participantes).map(([nombre, fechas], index) => {
      const row: any = {
        'N°': index + 1,
        'INTEGRANTE': nombre
      }

      let cantidadEventos = 0
      let totalMonto = 0

      fechasOrdenadas.forEach(fecha => {
        const monto = fechas[fecha] || 0
        row[new Date(fecha).getDate().toString()] = monto > 0 ? monto : ''
        if (monto > 0) cantidadEventos++
        totalMonto += monto
      })

      row['CANTIDAD'] = cantidadEventos
      row['TOTAL'] = totalMonto.toFixed(2)

      return row
    })

    // Crear worksheet
    const ws = XLSX.utils.json_to_sheet(rows, { header: headers })

    // Agregar título
    XLSX.utils.sheet_add_aoa(ws, [
      [`CONTROL DE PAGOS - ${organization?.nombre || ''}`],
      [`${mesNombre} ${anio}`],
      [`Tipo de Contrato: ${tipoContratoNombre}`],
      [`Canal: ${canalNombre}`],
      [] // Fila vacía
    ], { origin: 'A1' })

    // Crear workbook
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Control Diario')

    // Guardar archivo
    XLSX.writeFile(wb, `control-diario-${mes}-${anio}.xlsx`)
    toast.success('Excel generado exitosamente')
  }

  const mesNombre = new Date(anio, mes - 1).toLocaleString('es-ES', { month: 'long', year: 'numeric' })

  // Agrupar datos por participante para vista previa
  const participantes: { [key: string]: any } = {}
  dataEventos.forEach(evento => {
    if (!participantes[evento.participante_nombre]) {
      participantes[evento.participante_nombre] = {
        eventos: [],
        cantidadEventos: 0,
        totalMonto: 0
      }
    }
    participantes[evento.participante_nombre].eventos.push(evento)
    participantes[evento.participante_nombre].cantidadEventos++
    participantes[evento.participante_nombre].totalMonto += evento.monto_pactado
  })

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-6">Control Diario</h1>

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
            onClick={fetchControlDiario}
            disabled={loading || !idCanalPago || !idTipoContrato}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed"
          >
            {loading ? 'Generando...' : 'Generar Reporte'}
          </button>

          {dataEventos.length > 0 && (
            <button
              onClick={exportarExcel}
              className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
            >
              <FiDownload />
              Exportar Excel
            </button>
          )}
        </div>
      </div>

      {/* Resultados - Vista Previa */}
      {Object.keys(participantes).length > 0 && (
        <div className="bg-slate-800 border border-slate-700 rounded-lg shadow overflow-hidden">
          <div className="p-4 bg-slate-900 border-b border-slate-700">
            <h3 className="text-lg font-semibold text-white capitalize">
              Control de {mesNombre}
            </h3>
            <p className="text-sm text-slate-400 mt-1">
              {canales.find(c => c.id === idCanalPago)?.nombre} - {tiposContrato.find(t => t.id === idTipoContrato)?.nombre}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-700">
              <thead className="bg-slate-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase sticky left-0 bg-slate-900">Participante</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-slate-400 uppercase">Cantidad</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-slate-400 uppercase">Total</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase">Eventos</th>
                </tr>
              </thead>
              <tbody className="bg-slate-800 divide-y divide-slate-700">
                {Object.entries(participantes).map(([nombre, data]: [string, any], index) => (
                  <tr key={index} className="hover:bg-slate-700">
                    <td className="px-4 py-3 text-sm font-medium text-white sticky left-0 bg-slate-800">{nombre}</td>
                    <td className="px-4 py-3 text-sm text-center text-slate-300">{data.cantidadEventos}</td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-white">S/. {data.totalMonto.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-slate-300">
                      <div className="flex flex-wrap gap-2">
                        {data.eventos.map((evento: EventoDiario, i: number) => (
                          <span key={i} className="inline-block bg-blue-900 text-blue-200 px-2 py-1 rounded text-xs">
                            {new Date(evento.fecha_evento).getDate()}/{mes} - S/. {evento.monto_pactado}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
                <tr className="bg-slate-900 font-bold">
                  <td className="px-4 py-3 text-sm text-white">TOTALES</td>
                  <td className="px-4 py-3 text-sm text-center text-white">
                    {Object.values(participantes).reduce((sum: number, p: any) => sum + p.cantidadEventos, 0)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-white">
                    S/. {Object.values(participantes).reduce((sum: number, p: any) => sum + p.totalMonto, 0).toFixed(2)}
                  </td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="p-4 bg-blue-900/30 border-t border-blue-700">
            <p className="text-sm text-blue-300">
              💡 <strong>Tip:</strong> Exporta a Excel para ver el calendario completo día por día
            </p>
          </div>
        </div>
      )}

      {dataEventos.length === 0 && !loading && (
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-8 text-center">
          <p className="text-slate-400">Selecciona los filtros y genera el reporte</p>
        </div>
      )}
    </div>
  )
}
