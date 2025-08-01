'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import { FiCheckCircle, FiArchive } from 'react-icons/fi';

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

export default function HistorialPagosPage() {
  const [lotes, setLotes] = useState<LotePago[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistorialPagos = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuario no autenticado.');

      const { data: personalData, error: personalError } = await supabase
        .from('Personal')
        .select('id')
        .eq('supabase_user_id', user.id)
        .single();

      if (personalError || !personalData) throw new Error('No se pudo encontrar tu registro de personal.');

      const { data: lotesData, error: lotesError } = await supabase
        .from('Lotes_Pago')
        .select(`
          id,
          monto_total,
          fecha_pago,
          estado,
          Detalles_Lote_Pago!inner(
            monto_pagado,
            estado_asistencia_registrado,
            descuento_aplicado_pct,
            Evento_Servicios_Asignados!inner(
              Servicios!inner(nombre),
              Participaciones_Personal!inner(
                Eventos_Contrato!inner(
                  Contratos!inner(id)
                )
              )
            )
          )
        `)
        .eq('id_personal', personalData.id)
        .eq('estado', 'PAGADO')
        .order('fecha_pago', { ascending: false });

      if (lotesError) throw new Error(lotesError.message);

      const formattedLotes = lotesData.map(lote => ({
        id: lote.id,
        monto_total: lote.monto_total,
        fecha_pago: new Date(lote.fecha_pago).toLocaleDateString(),
        estado: lote.estado,
        detalles: lote.Detalles_Lote_Pago.map((detalle: any) => ({
          monto_pagado: detalle.monto_pagado,
          estado_asistencia_registrado: detalle.estado_asistencia_registrado,
          descuento_aplicado_pct: detalle.descuento_aplicado_pct,
          servicio_nombre: detalle.Evento_Servicios_Asignados.Servicios.nombre,
          contrato_id: detalle.Evento_Servicios_Asignados.Participaciones_Personal.Eventos_Contrato.Contratos.id,
        }))
      }));

      setLotes(formattedLotes);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistorialPagos();
  }, []);

  if (loading) return <div className="text-center p-8"><p className="text-slate-400">Cargando historial...</p></div>;
  if (error) return <div className="bg-red-900 text-red-200 p-4 rounded-lg">Error: {error}</div>;

  return (
    <div className="space-y-6">
      {lotes.length > 0 ? (
        lotes.map(lote => (
          <div key={lote.id} className="bg-slate-800/50 rounded-xl shadow-md p-6 border-l-4 border-green-500">
            <div className="flex flex-col md:flex-row justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-bold text-white">Lote de pago #{lote.id}</h2>
                <p className="text-sm text-slate-400">Pagado el: {lote.fecha_pago}</p>
              </div>
              <div className="text-right mt-4 md:mt-0">
                <p className="text-slate-400">Monto recibido</p>
                <p className="text-2xl font-bold text-green-400">S/{lote.monto_total.toFixed(2)}</p>
              </div>
            </div>

            <div className="mb-2">
              <h3 className="font-semibold text-slate-300 mb-2 text-sm">Detalles del pago:</h3>
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
             <div className="mt-4 p-3 bg-green-900/50 border border-green-700 rounded-lg flex items-center gap-3">
                <FiCheckCircle className="text-green-400 text-xl" />
                <p className="text-green-300 font-semibold text-sm">Este lote fue aceptado y pagado.</p>
             </div>
          </div>
        ))
      ) : (
        <div className="text-center py-16 bg-slate-800 rounded-xl border border-slate-700">
          <FiArchive className="mx-auto text-6xl text-slate-500 mb-4" />
          <h2 className="text-2xl font-bold text-white">No hay historial</h2>
          <p className="text-slate-400 mt-2">Aún no has recibido ningún pago.</p>
        </div>
      )}
    </div>
  );
}
