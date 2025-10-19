'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useOrganization } from '@/app/context/OrganizationContext';
import Pagination from '@/app/components/ui/Pagination';
import toast from 'react-hot-toast';

// --- CONSTANTES ---
const ITEMS_PER_PAGE = 10;

// --- INTERFACES ---
interface Personal {
  id: number;
  nombre: string;
  email: string | null;
  rol: string;
  es_activo: boolean;
  supabase_user_id: string | null;
  id_organizacion: number | null;
}

// --- COMPONENTES DE UI ---
const AddPersonalForm = ({ onAddPersonal }: { onAddPersonal: (name: string, email: string, rol: string) => void }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [rol, setRol] = useState('OPERATIVO');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      toast.error('Por favor, completa el nombre y el email.');
      return;
    }
    onAddPersonal(name, email, rol);
    setName('');
    setEmail('');
    setRol('OPERATIVO');
  };

  return (
    <div className="bg-slate-800 p-4 md:p-6 rounded-xl shadow-lg mb-8 border border-slate-700">
      <h2 className="text-2xl font-bold text-white mb-4">Añadir nuevo personal</h2>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
        <div className="lg:col-span-1">
          <label htmlFor="name" className="block text-sm font-medium text-slate-400 mb-1">Nombre</label>
          <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white" placeholder="Ej: Juan Pérez" />
        </div>
        <div className="lg:col-span-1">
          <label htmlFor="email" className="block text-sm font-medium text-slate-400 mb-1">Email</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white" placeholder="juan.perez@ejemplo.com" />
        </div>
        <div>
          <label htmlFor="rol" className="block text-sm font-medium text-slate-400 mb-1">Rol</label>
          <select id="rol" value={rol} onChange={(e) => setRol(e.target.value)} className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white">
            <option value="OPERATIVO">Operativo</option>
            <option value="ADMINISTRATIVO_APOYO">Administrativo de Apoyo</option>
          </select>
        </div>
        <button type="submit" className="w-full lg:w-auto justify-self-stretch lg:justify-self-start px-6 py-2 bg-sky-600 text-white font-semibold rounded-lg hover:bg-sky-700">Añadir personal</button>
      </form>
    </div>
  );
};

const PersonalTable = ({ personal, onToggleStatus }: { personal: Personal[], onToggleStatus: (id: number, currentStatus: boolean) => void }) => (
  <div className="bg-slate-800 rounded-xl shadow-lg border border-slate-700">
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-700">
        <thead className="bg-slate-900">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase whitespace-nowrap">Nombre</th>
            <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase whitespace-nowrap">Email</th>
            <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase whitespace-nowrap">Rol</th>
            <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase whitespace-nowrap">Estado</th>
            <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase whitespace-nowrap">Usuario</th>
            <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase whitespace-nowrap">Activar/Desactivar</th>
          </tr>
        </thead>
        <tbody className="bg-slate-800 divide-y divide-slate-700">
          {personal.length > 0 ? (
            personal.map((p) => (
              <tr key={p.id} className="hover:bg-slate-700">
                <td className="px-6 py-4 text-sm font-medium text-white whitespace-nowrap">{p.nombre}</td>
                <td className="px-6 py-4 text-sm text-slate-300 whitespace-nowrap">{p.email}</td>
                <td className="px-6 py-4 text-sm text-slate-300 whitespace-nowrap">{p.rol}</td>
                <td className="px-6 py-4 text-sm whitespace-nowrap">
                  <span className={`px-3 py-1 text-xs font-semibold rounded-full ${p.es_activo ? 'bg-green-900 text-green-200' : 'bg-red-900 text-red-200'}`}>
                    {p.es_activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm whitespace-nowrap">
                  {p.supabase_user_id ? (
                    <span className="px-3 py-1 text-xs font-semibold rounded-full bg-blue-900 text-blue-200">Registrado</span>
                  ) : (
                    <span className="px-3 py-1 text-xs font-semibold rounded-full bg-gray-700 text-gray-300">Sin cuenta</span>
                  )}
                </td>
                <td className="px-6 py-4 text-sm font-medium whitespace-nowrap">
                  <button onClick={() => onToggleStatus(p.id, p.es_activo)} className="text-sky-400 hover:text-sky-300">
                    {p.es_activo ? 'Desactivar' : 'Activar'}
                  </button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={6} className="text-center py-10 text-slate-400">No hay personal registrado todavía.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </div>
);

// --- COMPONENTE DE LÓGICA Y CARGA DE DATOS ---
function PersonalPageContent() {
  const searchParams = useSearchParams();
  const { organization, session } = useOrganization();
  const [personal, setPersonal] = useState<Personal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const supabase = createClientComponentClient();
  
  const currentPage = parseInt(searchParams.get('page') || '1', 10);

  const fetchPersonal = async () => {
    if (!organization) return;

    try {
      setLoading(true);
      const offset = (currentPage - 1) * ITEMS_PER_PAGE;

      // Usar funciones RPC en lugar de SELECT directo para evitar problemas de RLS
      const [
        { data: personalData, error: personalError },
        { data: count, error: countError }
      ] = await Promise.all([
        supabase.rpc('get_organization_personnel', {
          p_limit: ITEMS_PER_PAGE,
          p_offset: offset
        }),
        supabase.rpc('count_organization_personnel')
      ]);

      if (personalError) throw new Error(personalError.message);
      if (countError) throw new Error(countError.message);

      setPersonal(personalData || []);
      setTotalCount(count || 0);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPersonal();
  }, [currentPage, organization, supabase]);

  const handleAddPersonal = async (name: string, email: string, rol: string) => {
    if (!organization || !session) return;
    const toastId = toast.loading('Añadiendo personal...');
    try {
      // Llamar al API route que crea el usuario automáticamente
      const response = await fetch('/api/create-personal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          nombre: name,
          email: email,
          rol: rol,
          id_organizacion: organization.id
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al crear el personal');
      }

      // Mostrar mensaje de éxito con las credenciales
      toast.success(
        (t) => (
          <div className="text-white">
            <p className="font-bold mb-2">✅ Personal creado con éxito</p>
            <div className="bg-slate-700 p-3 rounded-lg text-sm space-y-1">
              <p><span className="font-semibold">Usuario:</span> {result.credentials.email}</p>
              <p><span className="font-semibold">Contraseña:</span> {result.credentials.password}</p>
              <p className="text-xs text-slate-300 mt-2">⚠️ El usuario puede cambiar su contraseña desde su perfil</p>
            </div>
          </div>
        ),
        { id: toastId, duration: 10000 }
      );

      // Refrescar la lista completa para mostrar el nuevo registro
      await fetchPersonal();
    } catch (err: any) {
      toast.error(`Error al añadir personal: ${err.message}`, { id: toastId });
    }
  };


  const handleToggleStatus = async (id: number, currentStatus: boolean) => {
    const actionText = currentStatus ? 'desactivar' : 'activar';
    toast((t) => (
      <span>
        ¿Seguro que quieres {actionText} a este miembro del personal?
        <div className="flex gap-2 mt-2">
          <button 
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-1 px-3 rounded-lg text-sm"
            onClick={() => {
              toast.dismiss(t.id);
              performToggle(id, currentStatus);
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

  const performToggle = async (id: number, currentStatus: boolean) => {
    const toastId = toast.loading('Actualizando estado...');
    try {
      const { data, error } = await supabase.from('Personal').update({ es_activo: !currentStatus }).eq('id', id).select().single();
      if (error) throw error;
      setPersonal(personal.map(p => p.id === id ? data : p));
      toast.success(`Personal ${!currentStatus ? 'activado' : 'desactivado'} con éxito.`, { id: toastId });
    } catch (err: any) {
      toast.error(`Error al cambiar el estado: ${err.message}`, { id: toastId });
    }
  }

  if (loading) return <div className="flex justify-center items-center h-64"><p className="text-lg text-slate-400">Cargando datos...</p></div>;
  if (error) return <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-lg"><p>{error}</p></div>;

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-6">Gestión de personal</h1>
      <AddPersonalForm onAddPersonal={handleAddPersonal} />
      <PersonalTable personal={personal} onToggleStatus={handleToggleStatus} />
      <Pagination
        currentPage={currentPage}
        totalCount={totalCount}
        itemsPerPage={ITEMS_PER_PAGE}
        path="/dashboard/personal"
      />
    </div>
  );
}

// --- COMPONENTE PRINCIPAL EXPORTADO POR DEFECTO ---
export default function PersonalPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-64"><p className="text-lg text-slate-400">Cargando página...</p></div>}>
      <PersonalPageContent />
    </Suspense>
  );
}
