'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useOrganization } from '@/app/context/OrganizationContext';
import { FiEdit, FiCheckCircle, FiClock, FiAlertTriangle, FiXCircle, FiEye, FiUsers } from 'react-icons/fi';
import Link from 'next/link';
import toast from 'react-hot-toast';

// --- TIPOS DE DATOS ---
interface LoteGestion {
  id: number;
  monto_total: number;
  estado: string;
  fecha_pago_programada: string | null;
  created_at: string;
  num_personas: number;
}

// --- COMPONENTE PRINCIPAL: Página de Gestión de Lotes ---
export default function GestionLotesPage() {
  const { organization } = useOrganization();
  const [lotes, setLotes] = useState<LoteGestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('preparacion');
  const supabase = createClientComponentClient();

  const fetchData = async () => {
    if (!organization) return;

    try {
      setLoading(true);

      // Obtener todos los lotes relevantes
      const { data: lotesData, error: lotesError } = await supabase
        .from('Lotes_Pago')
        .select(`
          id,
          monto_total,
          estado,
          fecha_pago_programada,
          created_at
        `)
        .eq('id_organizacion', organization.id)
        .in('estado', ['EN_PREPARACION', 'FINALIZADO', 'PENDIENTE_APROBACION', 'RECLAMADO', 'PAGADO'])
        .order('created_at', { ascending: false });

      if (lotesError) throw lotesError;

      // Obtener cantidad de personas por lote
      const lotesConPersonas = await Promise.all(
        lotesData.map(async (lote) => {
          const { count } = await supabase
            .from('Lotes_Pago_Personal')
            .select('*', { count: 'exact', head: true })
            .eq('id_lote_pago', lote.id);

          return {
            ...lote,
            num_personas: count || 0
          };
        })
      );

      setLotes(lotesConPersonas);

    } catch (err: any) {
      toast.error(`Error al cargar lotes: ${err.message}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [organization, supabase]);

  const handleAnularLote = async (loteId: number) => {
    const confirmacion = window.confirm(
      `¿Está seguro de anular el Lote #${loteId}? Los servicios volverán a estar pendientes de pago.`
    );
    if (!confirmacion) return;

    const toastId = toast.loading('Anulando lote...');

    try {
      // Obtener servicios del lote
      const { data: detalles, error: dError } = await supabase
        .from('Detalles_Lote_Pago')
        .select('id_evento_servicio_asignado')
        .eq('id_lote_pago', loteId);

      if (dError) throw dError;

      const serviceIds = detalles.map(d => d.id_evento_servicio_asignado);

      // Devolver servicios a PENDIENTE
      if (serviceIds.length > 0) {
        const { error: updateError } = await supabase
          .from('Evento_Servicios_Asignados')
          .update({ estado_pago: 'PENDIENTE' })
          .in('id', serviceIds);

        if (updateError) throw updateError;
      }

      // Anular lote
      const { error: loteError } = await supabase
        .from('Lotes_Pago')
        .update({ estado: 'ANULADO' })
        .eq('id', loteId);

      if (loteError) throw loteError;

      toast.success('Lote anulado correctamente.', { id: toastId });
      fetchData();

    } catch (err: any) {
      toast.error(`Error al anular el lote: ${err.message}`, { id: toastId });
    }
  };

  const getEstadoBadge = (estado: string) => {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      EN_PREPARACION: { bg: 'bg-yellow-900', text: 'text-yellow-200', label: 'En Preparación' },
      FINALIZADO: { bg: 'bg-green-900', text: 'text-green-200', label: 'Finalizado' },
      PENDIENTE_APROBACION: { bg: 'bg-blue-900', text: 'text-blue-200', label: 'Pendiente Aprobación' },
      RECLAMADO: { bg: 'bg-red-900', text: 'text-red-200', label: 'Reclamado' },
      PAGADO: { bg: 'bg-green-900', text: 'text-green-200', label: 'Pagado' },
      ANULADO: { bg: 'bg-slate-700', text: 'text-slate-300', label: 'Anulado' }
    };

    const badge = badges[estado] || { bg: 'bg-slate-700', text: 'text-slate-300', label: estado };

    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  const renderLoteCard = (lote: LoteGestion) => (
    <div
      key={lote.id}
      className="bg-slate-800 rounded-xl p-5 border border-slate-700 hover:border-sky-500 transition-all"
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-xl font-bold text-white mb-1">Lote #{lote.id}</h3>
          <p className="text-sm text-slate-400">
            Creado: {new Date(lote.created_at).toLocaleDateString()}
          </p>
          {lote.fecha_pago_programada && (
            <p className="text-sm text-slate-400">
              Fecha de pago: {new Date(lote.fecha_pago_programada).toLocaleDateString()}
            </p>
          )}
        </div>
        {getEstadoBadge(lote.estado)}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-slate-700/50 rounded-lg p-3">
          <p className="text-xs text-slate-400 mb-1">Monto Total</p>
          <p className="text-lg font-bold text-yellow-400">S/ {lote.monto_total.toFixed(2)}</p>
        </div>
        <div className="bg-slate-700/50 rounded-lg p-3">
          <p className="text-xs text-slate-400 mb-1 flex items-center gap-1">
            <FiUsers className="text-sm" /> Personas
          </p>
          <p className="text-lg font-bold text-white">{lote.num_personas}</p>
        </div>
      </div>

      <div className="flex gap-2">
        <Link
          href={`/dashboard/pagos/lote/${lote.id}`}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-lg transition-colors"
        >
          {lote.estado === 'EN_PREPARACION' ? (
            <>
              <FiEdit /> Editar lote
            </>
          ) : (
            <>
              <FiEye /> Ver detalles
            </>
          )}
        </Link>

        {(lote.estado === 'RECLAMADO' || lote.estado === 'EN_PREPARACION') && (
          <button
            onClick={() => handleAnularLote(lote.id)}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
          >
            <FiXCircle /> Anular
          </button>
        )}
      </div>
    </div>
  );

  const renderLoteList = (loteList: LoteGestion[]) => {
    if (loading) {
      return (
        <div className="flex justify-center items-center py-16">
          <p className="text-lg text-slate-400">Cargando lotes...</p>
        </div>
      );
    }

    if (loteList.length === 0) {
      return (
        <div className="text-center py-16 bg-slate-800/50 rounded-xl border border-slate-700">
          <p className="text-slate-400">No hay lotes en esta categoría.</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loteList.map(renderLoteCard)}
      </div>
    );
  };

  // Filtrar lotes por estado
  const enPreparacion = lotes.filter(l => l.estado === 'EN_PREPARACION');
  const finalizados = lotes.filter(l => l.estado === 'FINALIZADO');
  const pendientes = lotes.filter(l => l.estado === 'PENDIENTE_APROBACION');
  const reclamados = lotes.filter(l => l.estado === 'RECLAMADO');
  const otros = lotes.filter(l => !['EN_PREPARACION', 'FINALIZADO', 'PENDIENTE_APROBACION', 'RECLAMADO'].includes(l.estado));

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-6">Gestión de Lotes de Pago</h1>

      {/* Tabs */}
      <div className="flex flex-wrap border-b border-slate-700 mb-6 gap-2">
        <button
          onClick={() => setActiveTab('preparacion')}
          className={`py-3 px-6 font-semibold flex items-center gap-2 transition-colors ${
            activeTab === 'preparacion'
              ? 'text-yellow-400 border-b-2 border-yellow-400'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <FiEdit /> En Preparación ({enPreparacion.length})
        </button>

        <button
          onClick={() => setActiveTab('finalizados')}
          className={`py-3 px-6 font-semibold flex items-center gap-2 transition-colors ${
            activeTab === 'finalizados'
              ? 'text-green-400 border-b-2 border-green-400'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <FiCheckCircle /> Finalizados ({finalizados.length})
        </button>

        {(pendientes.length > 0 || reclamados.length > 0) && (
          <>
            <button
              onClick={() => setActiveTab('pendientes')}
              className={`py-3 px-6 font-semibold flex items-center gap-2 transition-colors ${
                activeTab === 'pendientes'
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FiClock /> Pendientes ({pendientes.length})
            </button>

            <button
              onClick={() => setActiveTab('reclamados')}
              className={`py-3 px-6 font-semibold flex items-center gap-2 transition-colors ${
                activeTab === 'reclamados'
                  ? 'text-red-400 border-b-2 border-red-400'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FiAlertTriangle /> Reclamados ({reclamados.length})
            </button>
          </>
        )}
      </div>

      {/* Content */}
      <div>
        {activeTab === 'preparacion' && renderLoteList(enPreparacion)}
        {activeTab === 'finalizados' && renderLoteList(finalizados)}
        {activeTab === 'pendientes' && renderLoteList(pendientes)}
        {activeTab === 'reclamados' && renderLoteList(reclamados)}
      </div>
    </div>
  );
}
