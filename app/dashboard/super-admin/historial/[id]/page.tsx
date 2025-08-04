'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface HistorialFacturacion {
  id: number;
  fecha_facturacion: string;
  registros_facturados: number;
}

interface Organizacion {
  nombre: string;
}

export default function HistorialPage() {
  const [historial, setHistorial] = useState<HistorialFacturacion[]>([]);
  const [organizacion, setOrganizacion] = useState<Organizacion | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const params = useParams();
  const id = params.id;
  const supabase = createClientComponentClient();

  useEffect(() => {
    if (!id) return;

    const fetchHistorial = async () => {
      setLoading(true);

      // Obtener nombre de la organización
      const { data: orgData, error: orgError } = await supabase
        .from('Organizaciones')
        .select('nombre')
        .eq('id', id)
        .single();

      if (orgError) {
        console.error('Error fetching organizacion:', orgError);
        setError('No se pudo cargar la información de la organización.');
        setLoading(false);
        return;
      }
      setOrganizacion(orgData);

      // Obtener historial de facturación
      const { data, error } = await supabase
        .from('Historial_Facturacion')
        .select('id, fecha_facturacion, registros_facturados')
        .eq('id_organizacion', id)
        .order('fecha_facturacion', { ascending: false });

      if (error) {
        console.error('Error fetching historial:', error);
        setError('No se pudo cargar el historial de facturación.');
      } else {
        setHistorial(data);
      }
      setLoading(false);
    };

    fetchHistorial();
  }, [id, supabase]);

  if (loading) return <p className="text-slate-400">Cargando historial...</p>;
  if (error) return <p className="text-red-400">{error}</p>;

  return (
    <div className="container mx-auto px-4">
      <Link href="/dashboard/super-admin" className="text-sky-400 hover:text-sky-300 mb-4 inline-block">← Volver al panel</Link>
      <h1 className="text-3xl font-bold text-white mb-6">Historial de Facturación para <span className="text-sky-400">{organizacion?.nombre}</span></h1>
      <div className="bg-slate-800 shadow-md rounded-lg overflow-hidden border border-slate-700">
        <table className="min-w-full leading-normal">
          <thead>
            <tr>
              <th className="px-5 py-3 border-b-2 border-slate-700 bg-slate-900 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Fecha de Cierre</th>
              <th className="px-5 py-3 border-b-2 border-slate-700 bg-slate-900 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Registros Facturados</th>
            </tr>
          </thead>
          <tbody>
            {historial.length > 0 ? (
              historial.map((registro) => (
                <tr key={registro.id} className="hover:bg-slate-700/50">
                  <td className="px-5 py-4 border-b border-slate-700 text-sm">
                    <p className="text-white font-semibold">{new Date(registro.fecha_facturacion).toLocaleString('es-ES')}</p>
                  </td>
                  <td className="px-5 py-4 border-b border-slate-700 text-sm">
                    <p className="text-slate-300">{registro.registros_facturados}</p>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={2} className="text-center py-10 text-slate-400">
                  No hay registros de facturación para esta organización.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
