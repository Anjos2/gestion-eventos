'use client'

import { useState, useEffect } from 'react'
import { useOrganization } from '@/app/context/OrganizationContext'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { FiPlus, FiEdit2, FiTrash2, FiStar, FiAlertCircle } from 'react-icons/fi'
import toast from 'react-hot-toast'

interface CanalPago {
  id: number
  id_organizacion: number
  nombre: string
  descripcion: string | null
  es_principal: boolean
  es_activo: boolean
  created_at: string
}

export default function CanalesPagoPage() {
  const supabase = createClientComponentClient()
  const { organization, userRole } = useOrganization()

  const [canales, setCanales] = useState<CanalPago[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingCanal, setEditingCanal] = useState<CanalPago | null>(null)
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    es_principal: false
  })

  const isAdmin = userRole === 'ADMINISTRATIVO' || userRole === 'ADMINISTRATIVO_APOYO'

  useEffect(() => {
    if (organization?.id) {
      fetchCanales()
    }
  }, [organization?.id])

  const fetchCanales = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('Canales_Pago')
        .select('*')
        .eq('id_organizacion', organization?.id)
        .eq('es_activo', true)
        .order('es_principal', { ascending: false })
        .order('nombre', { ascending: true })

      if (error) throw error
      setCanales(data || [])
    } catch (error: any) {
      console.error('Error fetching canales:', error)
      toast.error('Error al cargar canales de pago')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenModal = (canal?: CanalPago) => {
    if (canal) {
      setEditingCanal(canal)
      setFormData({
        nombre: canal.nombre,
        descripcion: canal.descripcion || '',
        es_principal: canal.es_principal
      })
    } else {
      setEditingCanal(null)
      setFormData({
        nombre: '',
        descripcion: '',
        es_principal: false
      })
    }
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingCanal(null)
    setFormData({
      nombre: '',
      descripcion: '',
      es_principal: false
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.nombre.trim()) {
      toast.error('El nombre del canal es obligatorio')
      return
    }

    try {
      if (editingCanal) {
        // Actualizar
        const { error } = await supabase
          .from('Canales_Pago')
          .update({
            nombre: formData.nombre.trim(),
            descripcion: formData.descripcion.trim() || null,
            es_principal: formData.es_principal
          })
          .eq('id', editingCanal.id)

        if (error) throw error
        toast.success('Canal actualizado exitosamente')
      } else {
        // Crear
        const { error } = await supabase
          .from('Canales_Pago')
          .insert({
            id_organizacion: organization?.id,
            nombre: formData.nombre.trim(),
            descripcion: formData.descripcion.trim() || null,
            es_principal: formData.es_principal,
            es_activo: true
          })

        if (error) throw error
        toast.success('Canal creado exitosamente')
      }

      handleCloseModal()
      fetchCanales()
    } catch (error: any) {
      console.error('Error saving canal:', error)
      toast.error(error.message || 'Error al guardar canal')
    }
  }

  const handleDelete = async (canal: CanalPago) => {
    if (canal.es_principal) {
      toast.error('No se puede eliminar el canal principal')
      return
    }

    if (!confirm(`¿Estás seguro de eliminar el canal "${canal.nombre}"?`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('Canales_Pago')
        .update({ es_activo: false })
        .eq('id', canal.id)

      if (error) throw error
      toast.success('Canal eliminado exitosamente')
      fetchCanales()
    } catch (error: any) {
      console.error('Error deleting canal:', error)
      toast.error('Error al eliminar canal. Puede tener registros asociados.')
    }
  }

  if (!isAdmin) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
          <FiAlertCircle className="text-yellow-600 mt-0.5" size={20} />
          <div>
            <h3 className="font-semibold text-yellow-800">Acceso Restringido</h3>
            <p className="text-yellow-700 text-sm">
              Solo los usuarios administrativos pueden gestionar canales de pago.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Canales de Pago</h1>
          <p className="text-gray-600 text-sm mt-1">
            Gestiona los canales para organizar ingresos y egresos
          </p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
        >
          <FiPlus size={18} />
          Nuevo Canal
        </button>
      </div>

      {/* Lista de Canales */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="text-gray-600 mt-2">Cargando canales...</p>
        </div>
      ) : canales.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-gray-600">No hay canales de pago registrados</p>
          <button
            onClick={() => handleOpenModal()}
            className="mt-4 text-blue-600 hover:underline"
          >
            Crear primer canal
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {canales.map((canal) => (
            <div
              key={canal.id}
              className={`bg-white border rounded-lg p-5 hover:shadow-md transition ${
                canal.es_principal ? 'border-blue-400 bg-blue-50' : 'border-gray-200'
              }`}
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-800 text-lg">
                      {canal.nombre}
                    </h3>
                    {canal.es_principal && (
                      <FiStar className="text-blue-600" size={18} title="Canal Principal" />
                    )}
                  </div>
                  {canal.descripcion && (
                    <p className="text-gray-600 text-sm mt-1">{canal.descripcion}</p>
                  )}
                </div>
              </div>

              <div className="flex gap-2 mt-4 pt-4 border-t border-gray-200">
                <button
                  onClick={() => handleOpenModal(canal)}
                  className="flex-1 bg-gray-100 text-gray-700 px-3 py-2 rounded hover:bg-gray-200 transition flex items-center justify-center gap-2 text-sm"
                >
                  <FiEdit2 size={14} />
                  Editar
                </button>
                {!canal.es_principal && (
                  <button
                    onClick={() => handleDelete(canal)}
                    className="flex-1 bg-red-50 text-red-600 px-3 py-2 rounded hover:bg-red-100 transition flex items-center justify-center gap-2 text-sm"
                  >
                    <FiTrash2 size={14} />
                    Eliminar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              {editingCanal ? 'Editar Canal' : 'Nuevo Canal'}
            </h2>

            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre del Canal <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ej: Canal Principal, Donaciones, Patrocinios"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descripción
                  </label>
                  <textarea
                    value={formData.descripcion}
                    onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Descripción opcional del canal"
                    rows={3}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="es_principal"
                    checked={formData.es_principal}
                    onChange={(e) => setFormData({ ...formData, es_principal: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <label htmlFor="es_principal" className="text-sm text-gray-700 flex items-center gap-1">
                    <FiStar size={14} />
                    Marcar como canal principal
                  </label>
                </div>

                <p className="text-xs text-gray-500">
                  * Solo puede haber un canal principal. Si marcas este canal como principal,
                  el anterior dejará de serlo automáticamente.
                </p>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
                >
                  {editingCanal ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
