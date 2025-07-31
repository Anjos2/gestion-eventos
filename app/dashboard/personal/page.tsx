'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import type { User } from '@supabase/supabase-js';

// Define la interfaz para un miembro del personal
interface Personal {
  id: number;
  nombre: string;
  email: string | null;
  rol: string;
  es_activo: boolean;
  supabase_user_id: string | null;
  id_organizacion: number | null;
}

// Componente para el formulario de añadir personal
const AddPersonalForm = ({ onAddPersonal }: { onAddPersonal: (name: string, email: string, rol: string) => void }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [rol, setRol] = useState('OPERATIVO'); // Rol por defecto

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      alert('Por favor, completa el nombre y el email.');
      return;
    }
    onAddPersonal(name, email, rol);
    setName('');
    setEmail('');
    setRol('OPERATIVO'); // Resetear al valor por defecto
  };

  return (
    <div className="bg-slate-800 p-6 rounded-xl shadow-lg mb-8 border border-slate-700">
      <h2 className="text-2xl font-bold text-white mb-4">Añadir Nuevo Personal</h2>
      <form onSubmit={handleSubmit} className="grid md:grid-cols-4 gap-4 items-end">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-slate-400 mb-1">Nombre</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg shadow-sm focus:ring-sky-500 focus:border-sky-500 transition text-white"
            placeholder="Ej: Juan Pérez"
          />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-400 mb-1">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg shadow-sm focus:ring-sky-500 focus:border-sky-500 transition text-white"
            placeholder="juan.perez@ejemplo.com"
          />
        </div>
        <div>
          <label htmlFor="rol" className="block text-sm font-medium text-slate-400 mb-1">Rol</label>
          <select
            id="rol"
            value={rol}
            onChange={(e) => setRol(e.target.value)}
            className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg shadow-sm focus:ring-sky-500 focus:border-sky-500 transition text-white"
          >
            <option value="OPERATIVO">Operativo</option>
            <option value="ADMINISTRATIVO_APOYO">Administrativo de Apoyo</option>
          </select>
        </div>
        <button
          type="submit"
          className="w-full md:w-auto justify-self-start px-6 py-2 bg-sky-600 text-white font-semibold rounded-lg shadow-md hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 transition-transform transform hover:scale-105"
        >
          Añadir Personal
        </button>
      </form>
    </div>
  );
};

// Componente para la tabla de personal
const PersonalTable = ({ personal, onToggleStatus, onGenerateInviteLink }: { personal: Personal[], onToggleStatus: (id: number, currentStatus: boolean) => void, onGenerateInviteLink: (orgId: number) => void }) => (
  <div className="bg-slate-800 rounded-xl shadow-lg overflow-hidden border border-slate-700">
    <table className="min-w-full divide-y divide-slate-700">
      <thead className="bg-slate-900">
        <tr>
          <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Nombre</th>
          <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Email</th>
          <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Rol</th>
          <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Estado</th>
          <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Usuario</th>
          <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Acciones</th>
        </tr>
      </thead>
      <tbody className="bg-slate-800 divide-y divide-slate-700">
        {personal.length > 0 ? (
          personal.map((p) => (
            <tr key={p.id} className="hover:bg-slate-700 transition-colors">
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{p.nombre}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">{p.email}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">{p.rol}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                  p.es_activo 
                    ? 'bg-green-900 text-green-200' 
                    : 'bg-red-900 text-red-200'
                }`}>
                  {p.es_activo ? 'Activo' : 'Inactivo'}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                {p.supabase_user_id ? (
                  <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-900 text-blue-200">Registrado</span>
                ) : (
                  <button 
                    onClick={() => onGenerateInviteLink(p.id_organizacion!)}
                    className="text-teal-400 hover:text-teal-300 transition-colors"
                  >
                    Generar Enlace
                  </button>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <button 
                  onClick={() => onToggleStatus(p.id, p.es_activo)}
                  className="text-sky-400 hover:text-sky-300 transition-colors"
                >
                  {p.es_activo ? 'Desactivar' : 'Activar'}
                </button>
              </td>
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={6} className="text-center py-10 text-slate-400">
              No hay personal registrado todavía.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
);

// Componente principal de la página
export default function PersonalPage() {
  const [user, setUser] = useState<User | null>(null);
  const [personal, setPersonal] = useState<Personal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserAndPersonal = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Usuario no autenticado. Redirigiendo...');
        setUser(user);

        const { data: adminData, error: adminError } = await supabase
          .from('Personal')
          .select('id_organizacion')
          .eq('supabase_user_id', user.id)
          .single();

        if (adminError || !adminData) throw new Error('No se pudo encontrar la organización del administrador.');

        const { data: personalData, error: personalError } = await supabase
          .from('Personal')
          .select('*')
          .eq('id_organizacion', adminData.id_organizacion)
          .order('id', { ascending: false });

        if (personalError) throw new Error(personalError.message);

        setPersonal(personalData || []);
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
  }, []);

  const handleAddPersonal = async (name: string, email: string, rol: string) => {
    if (!user) return;

    try {
      const { data: adminData } = await supabase
        .from('Personal')
        .select('id_organizacion')
        .eq('supabase_user_id', user.id)
        .single();

      if (!adminData) throw new Error('No se pudo obtener la organización para añadir personal.');

      const { data, error } = await supabase
        .from('Personal')
        .insert({
          nombre: name,
          email: email,
          rol: rol, // Usar el rol seleccionado
          id_organizacion: adminData.id_organizacion,
          es_activo: true,
        })
        .select()
        .single();

      if (error) throw error;
      if (!data) throw new Error('No se recibió respuesta al crear el personal.');

      setPersonal([data, ...personal]);
      alert('Personal añadido con éxito!');
    } catch (err: any) {
      setError(`Error al añadir personal: ${err.message}`);
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
      const { data, error } = await supabase
        .from('Personal')
        .update({ es_activo: !currentStatus })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setPersonal(personal.map(p => p.id === id ? data : p));
      alert(`Personal ${!currentStatus ? 'activado' : 'desactivado'} con éxito.`);

    } catch (err: any) {
      setError(`Error al cambiar el estado: ${err.message}`);
      alert(`Error al cambiar el estado: ${err.message}`);
    }
  };

  if (loading) return <div className="flex justify-center items-center h-64"><p className="text-lg text-slate-400">Cargando datos...</p></div>;
  if (error) return <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-lg" role="alert"><p>{error}</p></div>;

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-6">Gestión de Personal</h1>
      <AddPersonalForm onAddPersonal={handleAddPersonal} />
      <PersonalTable personal={personal} onToggleStatus={handleToggleStatus} onGenerateInviteLink={handleGenerateInviteLink} />
    </div>
  );
}
