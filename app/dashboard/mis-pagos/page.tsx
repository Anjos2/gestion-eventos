'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function MisPagosRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/mis-pagos/por-aprobar');
  }, [router]);

  return (
    <div className="text-center p-8">
      <p className="text-slate-400">Redirigiendo...</p>
    </div>
  );
}