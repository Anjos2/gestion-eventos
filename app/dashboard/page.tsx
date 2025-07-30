const StatCard = ({ title, value, icon }: { title: string, value: string, icon: React.ReactNode }) => (
  <div className="bg-slate-800 p-6 rounded-xl shadow-lg flex items-center space-x-6 border border-slate-700 hover:border-sky-500 transition-all duration-300 transform hover:-translate-y-1">
    <div className="bg-slate-900 p-4 rounded-full">
      {icon}
    </div>
    <div>
      <p className="text-base font-semibold text-slate-400">{title}</p>
      <p className="text-3xl font-bold text-white">{value}</p>
    </div>
  </div>
);

// Placeholder icons with better styling
const UsersIcon = () => <span className="text-2xl text-sky-400">👥</span>;
const ContractIcon = () => <span className="text-2xl text-green-400">📝</span>;
const ServiceIcon = () => <span className="text-2xl text-amber-400">🛠️</span>;
const MoneyIcon = () => <span className="text-2xl text-red-400">💰</span>;

export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-4xl font-bold text-white mb-8">Resumen General</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Personal Activo" value="12" icon={<UsersIcon />} />
        <StatCard title="Contratos Activos" value="5" icon={<ContractIcon />} />
        <StatCard title="Servicios Registrados" value="20" icon={<ServiceIcon />} />
        <StatCard title="Pagos Pendientes" value="$1,250" icon={<MoneyIcon />} />
      </div>
    </div>
  );
}
