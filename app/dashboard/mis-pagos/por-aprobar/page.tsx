'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useOrganization } from '@/app/context/OrganizationContext';
import { FiAlertTriangle, FiCheck } from 'react-icons/fi';

// Tipos de datos
interface LotePago {
  id: number;
  monto_total: number;
  fecha_pago: string;
  estado: string;
  detalles: DetalleLotePago[];
}

interface DetalleLotePago {
  monto_pagado: number;
  estado_asistencia_registrado: string;
  descuento_aplicado_pct: number | null;
  servicio_nombre: string;
  contrato_id: number;
}

export default function PorAprobarPage() {
  const { session } = useOrganization();
  const [lotes, setLotes] = useState<LotePago[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClientComponentClient();

  const fetchMisPagos = async () => {
    if (!session) return;

    try {
      setLoading(true);
      const { data: personalData, error: personalError } = await supabase
        .from('Personal')
        .select('id')
        .eq('supabase_user_id', session.user.id)
        .single();

      if (personalError || !personalData) throw new Error('No se pudo encontrar tu registro de personal.');

      // Use flattened view instead of nested joins
      const { data: detallesData, error: detallesError } = await supabase
        .from('vista_lotes_pago_personal_detalle')
        .select('*')
        .eq('id_personal', personalData.id)
        .in('estado', ['PAGADO', 'RECLAMADO'])
        .order('fecha_pago', { ascending: false });

      if (detallesError) throw new Error(detallesError.message);

      // Group details by lote
      const lotesMap: { [key: number]: LotePago } = {};

      detallesData?.forEach((detalle: any) => {
        if (!lotesMap[detalle.id_lote]) {
          lotesMap[detalle.id_lote] = {
            id: detalle.id_lote,
            monto_total: detalle.monto_total,
            fecha_pago: new Date(detalle.fecha_pago).toLocaleDateString(),
            estado: detalle.estado,
            detalles: []
          };
        }

        lotesMap[detalle.id_lote].detalles.push({
          monto_pagado: detalle.monto_pagado,
          estado_asistencia_registrado: detalle.estado_asistencia_registrado,
          descuento_aplicado_pct: detalle.descuento_aplicado_pct,
          servicio_nombre: detalle.servicio_nombre,
          contrato_id: detalle.contrato_id,
        });
      });

      setLotes(Object.values(lotesMap));

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMisPagos();
  }, [session, supabase]);

  if (loading) return <div className="text-center p-8"><p className="text-slate-400">Cargando tus pagos...</p></div>;
  if (error) return <div className="bg-red-900 text-red-200 p-4 rounded-lg">Error: {error}</div>;

  return (
    <div className="space-y-6">
      {lotes.length > 0 ? (
        lotes.map(lote => (
          <div key={lote.id} className={`bg-slate-800 rounded-xl shadow-lg p-6 border-l-4 ${lote.estado === 'RECLAMADO' ? 'border-red-500' : 'border-green-500'}`}>
            <div className="flex flex-col md:flex-row justify-between items-start mb-4">
              <div>
                <h2 className="text-2xl font-bold text-white">Lote de pago #{lote.id}</h2>
                <p className="text-sm text-slate-400">Generado el: {lote.fecha_pago}</p>
                <span className={`inline-block mt-2 px-3 py-1 text-xs font-semibold rounded-full ${
                  lote.estado === 'PAGADO' ? 'bg-green-900 text-green-200' : 'bg-red-900 text-red-200'
                }`}>
                  {lote.estado}
                </span>
              </div>
              <div className="text-right mt-4 md:mt-0">
                <p className="text-slate-400">Monto total</p>
                <p className="text-3xl font-bold text-yellow-400">S/{lote.monto_total.toFixed(2)}</p>
              </div>
            </div>

            <div className="mb-4">
              <h3 className="font-semibold text-white mb-2">Detalles del pago:</h3>
              <ul className="space-y-2 text-sm">
                {lote.detalles.map((d, index) => (
                  <li key={index} className="flex justify-between items-center bg-slate-700/50 p-2 rounded-md">
                    <span className="text-slate-300">{d.servicio_nombre} (Contrato #{d.contrato_id})</span>
                    <div className="text-right">
                      <p className="font-mono text-white">S/{d.monto_pagado.toFixed(2)}</p>
                      <p className="text-xs text-slate-400">
                        {d.estado_asistencia_registrado}
                        {d.descuento_aplicado_pct && d.descuento_aplicado_pct > 0 ? ` (-${d.descuento_aplicado_pct}%)` : ''}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {lote.estado === 'RECLAMADO' && (
               <div className="mt-4 p-4 bg-red-900/50 border border-red-700 rounded-lg flex items-center gap-3">
                  <FiAlertTriangle className="text-red-400 text-2xl" />
                  <p className="text-red-300 font-semibold">Este lote ha sido marcado como reclamado. El administrador se pondrá en contacto contigo.</p>
               </div>
            )}
          </div>
        ))
      ) : (
        <div className="text-center py-16 bg-slate-800 rounded-xl border border-slate-700">
          <FiCheck className="mx-auto text-6xl text-green-500 mb-4" />
          <h2 className="text-2xl font-bold text-white">Sin lotes de pago</h2>
          <p className="text-slate-400 mt-2">No tienes lotes de pago registrados aún.</p>
        </div>
      )}
    </div>
  );
}
