'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/app/lib/supabase';
import type { User } from '@supabase/supabase-js';
import Pagination from '@/app/components/ui/Pagination';

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
      alert('Por favor, completa el nombre y el email.');
      return;
    }
    onAddPersonal(name, email, rol);
    setName('');
    setEmail('');
    setRol('OPERATIVO');
  };

  return (
    <div className="bg-slate-800 p-6 rounded-xl shadow-lg mb-8 border border-slate-700">
      <h2 className="text-2xl font-bold text-white mb-4">Añadir Nuevo Personal</h2>
      <form onSubmit={handleSubmit} className="grid md:grid-cols-4 gap-4 items-end">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-slate-400 mb-1">Nombre</label>
          <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white" placeholder="Ej: Juan Pérez" />
        </div>
        <div>
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
        <button type="submit" className="w-full md:w-auto justify-self-start px-6 py-2 bg-sky-600 text-white font-semibold rounded-lg hover:bg-sky-700">Añadir Personal</button>
      </form>
    </div>
  );
};

const PersonalTable = ({ personal, onToggleStatus, onGenerateInviteLink }: { personal: Personal[], onToggleStatus: (id: number, currentStatus: boolean) => void, onGenerateInviteLink: (orgId: number) => void }) => (
  <div className="bg-slate-800 rounded-xl shadow-lg overflow-hidden border border-slate-700">
    <table className="min-w-full divide-y divide-slate-700">
      <thead className="bg-slate-900">
        <tr>
          <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Nombre</th>
          <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Email</th>
          <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Rol</th>
          <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Estado</th>
          <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Usuario</th>
          <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Acciones</th>
        </tr>
      </thead>
      <tbody className="bg-slate-800 divide-y divide-slate-700">
        {personal.length > 0 ? (
          personal.map((p) => (
            <tr key={p.id} className="hover:bg-slate-700">
              <td className="px-6 py-4 text-sm font-medium text-white">{p.nombre}</td>
              <td className="px-6 py-4 text-sm text-slate-300">{p.email}</td>
              <td className="px-6 py-4 text-sm text-slate-300">{p.rol}</td>
              <td className="px-6 py-4 text-sm">
                <span className={`px-3 py-1 text-xs font-semibold rounded-full ${p.es_activo ? 'bg-green-900 text-green-200' : 'bg-red-900 text-red-200'}`}>
                  {p.es_activo ? 'Activo' : 'Inactivo'}
                </span>
              </td>
              <td className="px-6 py-4 text-sm">
                {p.supabase_user_id ? (
                  <span className="px-3 py-1 text-xs font-semibold rounded-full bg-blue-900 text-blue-200">Registrado</span>
                ) : (
                  <button onClick={() => onGenerateInviteLink(p.id_organizacion!)} className="text-teal-400 hover:text-teal-300">Generar Enlace</button>
                )}
              </td>
              <td className="px-6 py-4 text-sm font-medium">
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
);

// --- COMPONENTE DE LÓGICA Y CARGA DE DATOS ---
function PersonalPageContent() {
  const searchParams = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [personal, setPersonal] = useState<Personal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  
  const currentPage = parseInt(searchParams.get('page') || '1', 10);

  useEffect(() => {
    const fetchUserAndPersonal = async () => {
      try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Usuario no autenticado. Redirigiendo...');
        setUser(user);

        const { data: adminData, error: adminError } = await supabase
          .from('Personal')
          .select('id_organizacion')
          .eq('supabase_user_id', user.id)
          .single();

        if (adminError || !adminData) throw new Error('No se pudo encontrar la organización del administrador.');

        const from = (currentPage - 1) * ITEMS_PER_PAGE;
        const to = from + ITEMS_PER_PAGE - 1;

        const { data: personalData, error: personalError, count } = await supabase
          .from('Personal')
          .select('*', { count: 'exact' })
          .eq('id_organizacion', adminData.id_organizacion)
          .order('id', { ascending: false })
          .range(from, to);

        if (personalError) throw new Error(personalError.message);

        setPersonal(personalData || []);
        setTotalCount(count || 0);

      } catch (err: any) {
        setError(err.message);
        if (err.message.includes('autenticado')) {
          window.location.href = '/auth/login';
        }
      } finally {
        setLoading(false);
      }
    };

    fetchUserAndPersonal();
  }, [currentPage]);

  const handleAddPersonal = async (name: string, email: string, rol: string) => {
    if (!user) return;
    try {
      const { data: adminData } = await supabase.from('Personal').select('id_organizacion').eq('supabase_user_id', user.id).single();
      if (!adminData) throw new Error('No se pudo obtener la organización.');

      const { data, error } = await supabase.from('Personal').insert({
        nombre: name, email: email, rol: rol, id_organizacion: adminData.id_organizacion, es_activo: true,
      }).select().single();

      if (error) throw error;
      if (!data) throw new Error('No se recibió respuesta al crear el personal.');

      // Refrescar la primera página para ver el nuevo registro
      if (currentPage === 1) {
        setPersonal([data, ...personal.slice(0, ITEMS_PER_PAGE - 1)]);
        setTotalCount(prev => prev + 1);
      }
      alert('Personal añadido con éxito!');
    } catch (err: any) {
      alert(`Error al añadir personal: ${err.message}`);
    }
  };

  const handleGenerateInviteLink = (orgId: number) => {
    if (!orgId) {
      alert('Error: No se pudo determinar la organización.');
      return;
    }
    const inviteLink = `${window.location.origin}/auth/register-personal?org_id=${orgId}`;
    window.prompt("Copia este enlace y envíalo al nuevo miembro del personal:", inviteLink);
  };

  const handleToggleStatus = async (id: number, currentStatus: boolean) => {
    try {
      const { data, error } = await supabase.from('Personal').update({ es_activo: !currentStatus }).eq('id', id).select().single();
      if (error) throw error;
      setPersonal(personal.map(p => p.id === id ? data : p));
      alert(`Personal ${!currentStatus ? 'activado' : 'desactivado'} con éxito.`);
    } catch (err: any) {
      alert(`Error al cambiar el estado: ${err.message}`);
    }
  };

  if (loading) return <div className="flex justify-center items-center h-64"><p className="text-lg text-slate-400">Cargando datos...</p></div>;
  if (error) return <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-lg"><p>{error}</p></div>;

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-6">Gestión de Personal</h1>
      <AddPersonalForm onAddPersonal={handleAddPersonal} />
      <PersonalTable personal={personal} onToggleStatus={handleToggleStatus} onGenerateInviteLink={handleGenerateInviteLink} />
      <Pagination
        currentPage={currentPage}
        totalCount={totalCount}
        itemsPerPage={ITEMS_PER_PAGE}
        path="/dashboard/personal"
      />
    </div>
  );
}

// --- COMPONENTE PRINCIPAL DE LA PÁGINA (con Suspense) ---
export default function PersonalPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-64"><p className="text-lg text-slate-400">Cargando página...</p></div>}>
      <PersonalPageContent />
    </Suspense>
  );
}