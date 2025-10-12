'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import toast from 'react-hot-toast';

interface Organizacion {
  id: number;
  nombre: string;
  estado: string;
  conteo_registros_nuevos: number;
  precio_por_registro: number | null;
}

export default function SuperAdminPage() {
  const [organizaciones, setOrganizaciones] = useState<Organizacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [precioPorRegistro, setPrecioPorRegistro] = useState<string>('0');
  const [editPrecio, setEditPrecio] = useState<boolean>(false);
  const [isAlertModalOpen, setAlertModalOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [selectedOrg, setSelectedOrg] = useState<Organizacion | null>(null);
  const [isPriceModalOpen, setPriceModalOpen] = useState(false);
  const [customPrice, setCustomPrice] = useState<string>('');
  const supabase = createClientComponentClient();

  const fetchConfig = async () => {
    const { data, error } = await supabase
      .from('Configuracion_Plataforma')
      .select('valor')
      .eq('clave', 'precio_por_registro')
      .single();

    if (data) {
      setPrecioPorRegistro(data.valor);
    }
  };

  const fetchOrganizaciones = async () => {
    setLoading(true);
    setError(null);
    console.log('[SuperAdmin] 🔄 Iniciando carga de organizaciones...');

    // Query 1: Obtener todas las organizaciones
    console.log('[SuperAdmin] 📊 Consultando tabla Organizaciones...');
    const { data: orgsData, error: orgsError } = await supabase
      .from('Organizaciones')
      .select('id, nombre, estado, precio_por_registro');

    if (orgsError) {
      console.error('[SuperAdmin] ❌ ERROR en query Organizaciones:', {
        code: orgsError.code,
        message: orgsError.message,
        details: orgsError.details,
        hint: orgsError.hint
      });
      setError('No se pudieron cargar las organizaciones.');
      setLoading(false);
      return;
    }

    console.log('[SuperAdmin] ✅ Organizaciones obtenidas:', orgsData?.length || 0, 'registros');

    // Query 2: Obtener todos los contadores
    console.log('[SuperAdmin] 📊 Consultando tabla Contadores_Uso...');
    const { data: contadoresData, error: contadoresError } = await supabase
      .from('Contadores_Uso')
      .select('id_organizacion, conteo_registros_nuevos');

    if (contadoresError) {
      console.error('[SuperAdmin] ❌ ERROR en query Contadores_Uso:', {
        code: contadoresError.code,
        message: contadoresError.message,
        details: contadoresError.details,
        hint: contadoresError.hint
      });
      setError('No se pudieron cargar los contadores de uso.');
      setLoading(false);
      return;
    }

    console.log('[SuperAdmin] ✅ Contadores obtenidos:', contadoresData?.length || 0, 'registros');

    // Crear un mapa de contadores por id_organizacion para búsqueda rápida
    const contadoresMap = new Map(
      contadoresData.map(c => [c.id_organizacion, c.conteo_registros_nuevos])
    );

    // Combinar los datos
    const organizacionesConContador = orgsData.map(org => ({
      ...org,
      conteo_registros_nuevos: contadoresMap.get(org.id) ?? 0,
    }));

    console.log('[SuperAdmin] ✅ Datos combinados exitosamente:', organizacionesConContador.length, 'organizaciones');
    setOrganizaciones(organizacionesConContador as Organizacion[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchOrganizaciones();
    fetchConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGuardarPrecio = async () => {
    const toastId = toast.loading('Actualizando precio...');
    const { error } = await supabase
      .from('Configuracion_Plataforma')
      .update({ valor: precioPorRegistro })
      .eq('clave', 'precio_por_registro');

    if (error) {
      toast.error('Error al actualizar el precio.', { id: toastId });
    } else {
      toast.success('Precio actualizado con éxito.', { id: toastId });
      setEditPrecio(false);
    }
  };

  const toggleEstadoOrganizacion = async (id: number, estadoActual: string) => {
    const nuevoEstado = estadoActual === 'ACTIVA' ? 'SUSPENDIDA' : 'ACTIVA';
    toast((t) => (
      <span>
        ¿Seguro que quieres cambiar el estado a <b>{nuevoEstado}</b>?
        <div className="flex gap-2 mt-2">
          <button 
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-1 px-3 rounded-lg text-sm"
            onClick={() => {
              toast.dismiss(t.id);
              performToggleEstado(id, nuevoEstado);
            }}
          >
            Confirmar
          </button>
          <button 
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-1 px-3 rounded-lg text-sm"
            onClick={() => toast.dismiss(t.id)}
          >
            Cancelar
          </button>
        </div>
      </span>
    ));
  };

  const performToggleEstado = async (id: number, nuevoEstado: string) => {
    const toastId = toast.loading('Actualizando estado...');
    const { error } = await supabase
      .from('Organizaciones')
      .update({ estado: nuevoEstado })
      .eq('id', id);

    if (error) {
      toast.error('Error al cambiar el estado de la organización.', { id: toastId });
    } else {
      toast.success('Estado actualizado con éxito.', { id: toastId });
      fetchOrganizaciones();
    }
  }

  const handleCerrarCiclo = async (organizacion: Organizacion) => {
    const montoAFacturar = organizacion.conteo_registros_nuevos * (organizacion.precio_por_registro ?? parseFloat(precioPorRegistro));
    toast((t) => (
      <span>
        ¿Seguro que quieres cerrar el ciclo de facturación? Se facturarán <b>{organizacion.conteo_registros_nuevos}</b> registros por un monto de <b>S/ {montoAFacturar.toFixed(2)}</b>.
        <div className="flex gap-2 mt-2">
          <button 
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-1 px-3 rounded-lg text-sm"
            onClick={() => {
              toast.dismiss(t.id);
              performCerrarCiclo(organizacion.id, organizacion.conteo_registros_nuevos, montoAFacturar);
            }}
          >
            Confirmar
          </button>
          <button 
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-1 px-3 rounded-lg text-sm"
            onClick={() => toast.dismiss(t.id)}
          >
            Cancelar
          </button>
        </div>
      </span>
    ));
  };

  const performCerrarCiclo = async (organizacionId: number, conteoActual: number, montoFacturado: number) => {
    const toastId = toast.loading('Cerrando ciclo de facturación...');
    // 1. Insertar en Historial_Facturacion
    const { error: historialError } = await supabase
      .from('Historial_Facturacion')
      .insert({
        id_organizacion: organizacionId,
        registros_facturados: conteoActual,
        monto_facturado: montoFacturado
      });

    if (historialError) {
      toast.error('Error al guardar en el historial de facturación: ' + historialError.message, { id: toastId });
      return;
    }

    // 2. Resetear el contador
    const { error: contadorError } = await supabase
      .from('Contadores_Uso')
      .update({
        conteo_registros_nuevos: 0,
        ultimo_reseteo: new Date().toISOString(),
      })
      .eq('id_organizacion', organizacionId);

    if (contadorError) {
      toast.error('Error al resetear el contador de uso: ' + contadorError.message, { id: toastId });
    } else {
      toast.success('Ciclo de facturación cerrado con éxito.', { id: toastId });
      fetchOrganizaciones(); // Recargar datos
    }
  }

  const openAlertModal = (org: Organizacion) => {
    setSelectedOrg(org);
    setAlertModalOpen(true);
  };

  const closeAlertModal = () => {
    setSelectedOrg(null);
    setAlertMessage('');
    setAlertModalOpen(false);
  };

  const handleSendAlert = async () => {
    if (!alertMessage.trim() || !selectedOrg) {
      toast.error('El mensaje de la alerta no puede estar vacío.');
      return;
    }

    const toastId = toast.loading('Enviando alerta...');
    const { error } = await supabase
      .from('Organizaciones')
      .update({
        alerta_activa: true,
        mensaje_alerta: alertMessage,
      })
      .eq('id', selectedOrg.id);

    if (error) {
      toast.error('Error al enviar la alerta: ' + error.message, { id: toastId });
    } else {
      toast.success('Alerta enviada con éxito.', { id: toastId });
      closeAlertModal();
      fetchOrganizaciones(); // Recargar para ver el estado actualizado si es necesario
    }
  };

  const openPriceModal = (org: Organizacion) => {
    setSelectedOrg(org);
    setCustomPrice(org.precio_por_registro?.toString() || '');
    setPriceModalOpen(true);
  };

  const closePriceModal = () => {
    setSelectedOrg(null);
    setCustomPrice('');
    setPriceModalOpen(false);
  };

  const handleSetCustomPrice = async () => {
    if (!selectedOrg) return;

    const priceToSet = customPrice.trim() === '' ? null : parseFloat(customPrice);

    const toastId = toast.loading('Guardando precio personalizado...');
    const { error } = await supabase
      .from('Organizaciones')
      .update({ precio_por_registro: priceToSet })
      .eq('id', selectedOrg.id);

    if (error) {
      toast.error('Error al guardar el precio: ' + error.message, { id: toastId });
    } else {
      toast.success('Precio personalizado guardado con éxito.', { id: toastId });
      closePriceModal();
      fetchOrganizaciones();
    }
  };

  if (loading) return <p className="text-slate-400">Cargando panel de super-admin...</p>;
  if (error) return <p className="text-red-400">{error}</p>;

  return (
    <div className="container mx-auto px-4">
      <h1 className="text-3xl font-bold text-white mb-6">Panel de Superadministrador</h1>
      
      <div className="bg-slate-800 shadow-md rounded-lg p-6 border border-slate-700 mb-6">
        <h2 className="text-xl font-semibold text-white mb-4">Configuración de Facturación</h2>
        <div className="flex items-center">
          <label className="text-slate-300 mr-4">Precio por Registro (S/):</label>
          {editPrecio ? (
            <input 
              type="number"
              value={precioPorRegistro}
              onChange={(e) => setPrecioPorRegistro(e.target.value)}
              className="bg-slate-900 border border-slate-600 rounded-md px-3 py-2 text-white w-24"
            />
          ) : (
            <p className="text-white font-bold text-lg">S/ {precioPorRegistro}</p>
          )}
          {editPrecio ? (
            <button onClick={handleGuardarPrecio} className="ml-4 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-md text-white font-semibold">Guardar</button>
          ) : (
            <button onClick={() => setEditPrecio(true)} className="ml-4 px-4 py-2 bg-sky-600 hover:bg-sky-700 rounded-md text-white font-semibold">Editar</button>
          )}
        </div>
      </div>

      <div className="bg-slate-800 shadow-md rounded-lg overflow-hidden border border-slate-700">
        <table className="min-w-full leading-normal">
          <thead>
            <tr>
              <th className="px-5 py-3 border-b-2 border-slate-700 bg-slate-900 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Organización</th>
              <th className="px-5 py-3 border-b-2 border-slate-700 bg-slate-900 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Estado</th>
              <th className="px-5 py-3 border-b-2 border-slate-700 bg-slate-900 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Consumo Actual</th>
              <th className="px-5 py-3 border-b-2 border-slate-700 bg-slate-900 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Monto a Facturar</th>
              <th className="px-5 py-3 border-b-2 border-slate-700 bg-slate-900 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {organizaciones.map((org) => (
              <tr key={org.id} className="hover:bg-slate-700/50">
                <td className="px-5 py-4 border-b border-slate-700 text-sm">
                  <p className="text-white font-semibold">{org.nombre}</p>
                </td>
                <td className="px-5 py-4 border-b border-slate-700 text-sm">
                  <span className={`relative inline-block px-3 py-1 font-semibold leading-tight rounded-full ${org.estado === 'ACTIVA' ? 'text-green-200 bg-green-900/50' : 'text-red-200 bg-red-900/50'}`}>
                    {org.estado}
                  </span>
                </td>
                <td className="px-5 py-4 border-b border-slate-700 text-sm">
                  <p className="text-slate-300">{org.conteo_registros_nuevos} registros</p>
                </td>
                <td className="px-5 py-4 border-b border-slate-700 text-sm">
                  <p className="text-white font-bold">S/ {(org.conteo_registros_nuevos * (org.precio_por_registro ?? parseFloat(precioPorRegistro))).toFixed(2)}</p>
                  <p className="text-xs text-slate-400">Precio/Reg: S/ {org.precio_por_registro ?? precioPorRegistro}</p>
                </td>
                <td className="px-5 py-4 border-b border-slate-700 text-sm">
                  <button
                    onClick={() => toggleEstadoOrganizacion(org.id, org.estado)}
                    className={`px-4 py-2 rounded-md text-white font-semibold transition-transform transform hover:scale-105 ${org.estado === 'ACTIVA' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
                  >
                    {org.estado === 'ACTIVA' ? 'Suspender' : 'Reactivar'}
                  </button>
                  <button
                    onClick={() => handleCerrarCiclo(org)}
                    className="ml-2 px-4 py-2 rounded-md text-white font-semibold transition-transform transform hover:scale-105 bg-blue-600 hover:bg-blue-700"
                  >
                    Cerrar ciclo
                  </button>
                  <Link href={`/dashboard/super-admin/historial/${org.id}`}>
                    <button className="ml-2 px-4 py-2 rounded-md text-white font-semibold transition-transform transform hover:scale-105 bg-gray-600 hover:bg-gray-700">
                      Ver historial
                    </button>
                  </Link>
                  <button
                    onClick={() => openAlertModal(org)}
                    className="ml-2 px-4 py-2 rounded-md text-white font-semibold transition-transform transform hover:scale-105 bg-amber-600 hover:bg-amber-700"
                  >
                    Enviar Alerta
                  </button>
                  <button
                    onClick={() => openPriceModal(org)}
                    className="ml-2 px-4 py-2 rounded-md text-white font-semibold transition-transform transform hover:scale-105 bg-teal-600 hover:bg-teal-700"
                  >
                    Editar Precio
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isAlertModalOpen && selectedOrg && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center">
          <div className="bg-slate-800 p-6 rounded-lg shadow-lg w-1/3">
            <h2 className="text-xl font-bold text-white mb-4">Enviar Alerta a {selectedOrg.nombre}</h2>
            <textarea
              value={alertMessage}
              onChange={(e) => setAlertMessage(e.target.value)}
              className="w-full bg-slate-900 border border-slate-600 rounded-md px-3 py-2 text-white mb-4"
              rows={4}
              placeholder="Ej: Tu ciclo de pago está por vencer. Regulariza tu situación para evitar la suspensión."
            />
            <div className="flex justify-end gap-4">
              <button onClick={closeAlertModal} className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-md text-white font-semibold">Cancelar</button>
              <button onClick={handleSendAlert} className="px-4 py-2 bg-amber-600 hover:bg-amber-700 rounded-md text-white font-semibold">Enviar Alerta</button>
            </div>
          </div>
        </div>
      )}

      {isPriceModalOpen && selectedOrg && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center">
          <div className="bg-slate-800 p-6 rounded-lg shadow-lg w-1/3">
            <h2 className="text-xl font-bold text-white mb-4">Editar Precio para {selectedOrg.nombre}</h2>
            <input
              type="number"
              value={customPrice}
              onChange={(e) => setCustomPrice(e.target.value)}
              className="w-full bg-slate-900 border border-slate-600 rounded-md px-3 py-2 text-white mb-4"
              placeholder="Dejar en blanco para usar el precio global"
            />
            <div className="flex justify-end gap-4">
              <button onClick={closePriceModal} className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-md text-white font-semibold">Cancelar</button>
              <button onClick={handleSetCustomPrice} className="px-4 py-2 bg-teal-600 hover:bg-teal-700 rounded-md text-white font-semibold">Guardar Precio</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
