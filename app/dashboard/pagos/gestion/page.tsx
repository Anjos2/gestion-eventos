'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useOrganization } from '@/app/context/OrganizationContext';
import { FiAlertTriangle, FiClock, FiXCircle } from 'react-icons/fi';

// --- TIPOS DE DATOS ---
interface LoteGestion {
  id: number;
  monto_total: number;
  estado: string;
  personal_nombre: string;
  id_personal: number;
}

// --- COMPONENTE PRINCIPAL: Pagina de Gestión de Lotes ---
export default function GestionLotesPage() {
  const { organization } = useOrganization();
  const [lotesEnGestion, setLotesEnGestion] = useState<LoteGestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pendientes');
  const supabase = createClientComponentClient();

  const fetchData = async () => {
    if (!organization) return;

    try {
      setLoading(true);
      const { data: lotesData, error: lotesError } = await supabase
        .from('Lotes_Pago')
        .select(`id, monto_total, estado, Personal!Lotes_Pago_id_personal_fkey(id, nombre)`)
        .eq('id_organizacion', organization.id)
        .in('estado', ['PENDIENTE_APROBACION', 'RECLAMADO']);
      if (lotesError) throw new Error(lotesError.message);

      const formattedLotes = lotesData.map(lote => {
        const personalData = lote.Personal;
        let personal_nombre = 'N/A';
        let id_personal = 0;

        if (personalData) {
          if (Array.isArray(personalData) && personalData.length > 0) {
            personal_nombre = personalData[0].nombre;
            id_personal = personalData[0].id;
          } else if (!Array.isArray(personalData)) {
            personal_nombre = (personalData as any).nombre;
            id_personal = (personalData as any).id;
          }
        }

        return {
          id: lote.id,
          monto_total: lote.monto_total,
          estado: lote.estado,
          personal_nombre,
          id_personal,
        };
      });
      setLotesEnGestion(formattedLotes);

    } catch (err: any) {
      console.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [organization, supabase]);

  const handleAnularLote = async (loteId: number) => {
    if (!window.confirm(`¿Está seguro de anular el Lote #${loteId}? Los servicios volverán a estar pendientes de pago.`)) return;
    setLoading(true);
    try {
      const { data: detalles, error: dError } = await supabase.from('Detalles_Lote_Pago').select('id_evento_servicio_asignado').eq('id_lote_pago', loteId);
      if (dError) throw dError;

      const serviceIds = detalles.map(d => d.id_evento_servicio_asignado);
      await supabase.from('Evento_Servicios_Asignados').update({ estado_pago: 'PENDIENTE' }).in('id', serviceIds);
      await supabase.from('Lotes_Pago').update({ estado: 'ANULADO' }).eq('id', loteId);

      alert('Lote anulado correctamente.');
      fetchData();
    } catch (err: any) {
      alert(`Error al anular el lote: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const renderLoteList = (loteList: LoteGestion[]) => {
    if (loading) return <p className="text-slate-400 text-center py-4">Cargando lotes...</p>;
    if (loteList.length === 0) {
      return <p className="text-slate-400 text-center py-10">No hay lotes en esta categoría.</p>;
    }
    return (
      <ul className="space-y-3">
        {loteList.map(lote => (
          <li key={lote.id} className="bg-slate-800/50 p-4 rounded-lg flex justify-between items-center border border-slate-700">
            <div>
              <p className="font-bold text-white">Lote #{lote.id} - {lote.personal_nombre}</p>
              <p className="text-sm text-slate-400">Monto: S/{lote.monto_total.toFixed(2)}</p>
            </div>
            {lote.estado === 'RECLAMADO' && (
              <button 
                onClick={() => handleAnularLote(lote.id)}
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-md text-sm flex items-center gap-2 transition-colors"
              >
                <FiXCircle /> Anular lote
              </button>
            )}
          </li>
        ))}
      </ul>
    );
  }

  const pendientes = lotesEnGestion.filter(l => l.estado === 'PENDIENTE_APROBACION');
  const reclamados = lotesEnGestion.filter(l => l.estado === 'RECLAMADO');

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <h1 className="text-3xl font-bold text-white mb-6">Gestión de lotes creados</h1>
      <div className="flex border-b border-slate-700 mb-6">
        <button onClick={() => setActiveTab('pendientes')} className={`py-3 px-6 font-semibold flex items-center gap-2 transition-colors ${activeTab === 'pendientes' ? 'text-sky-400 border-b-2 border-sky-400' : 'text-slate-400 hover:text-white'}`}>
          <FiClock /> Pendientes de aprobación ({pendientes.length})
        </button>
        <button onClick={() => setActiveTab('reclamados')} className={`py-3 px-6 font-semibold flex items-center gap-2 transition-colors ${activeTab === 'reclamados' ? 'text-red-400 border-b-2 border-red-400' : 'text-slate-400 hover:text-white'}`}>
          <FiAlertTriangle /> Reclamados ({reclamados.length})
        </button>
      </div>
      <div>
        {activeTab === 'pendientes' && renderLoteList(pendientes)}
        {activeTab === 'reclamados' && renderLoteList(reclamados)}
      </div>
    </div>
  );
}
