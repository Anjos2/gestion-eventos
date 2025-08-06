'use client';

import Image from 'next/image';
import Link from 'next/link';
import { FiAlertTriangle, FiPhone } from 'react-icons/fi';

export default function SuspendedPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-900 text-white p-4">
      <div className="w-full max-w-md mx-auto bg-slate-800 rounded-2xl shadow-2xl p-8 border border-slate-700 text-center">
        <FiAlertTriangle className="mx-auto text-5xl text-red-500 mb-4" />
        <h1 className="text-3xl font-bold mb-2">Cuenta Suspendida</h1>
        <p className="text-slate-400 mb-6">
          El acceso a tu organización ha sido suspendido por un pago pendiente.
        </p>

        <div className="bg-slate-900/50 p-6 rounded-lg mb-6">
          <h2 className="text-xl font-semibold text-sky-400 mb-4">Instrucciones de Pago</h2>
          <p className="mb-4">Para reactivar tu servicio, por favor, realiza el pago a través de Yape y contacta a soporte.</p>
          
          <div className="bg-white p-2 rounded-lg shadow-md inline-block mb-4">
            <Image 
              src="/yape-qr.png" 
              alt="Código QR de Yape" 
              width={180} 
              height={180} 
              className="rounded-md" 
              style={{ width: 'auto', height: 'auto' }}
            />
          </div>

          <div className="text-lg">
            <p>Titular: <span className="font-semibold">Joseph Huayhualla Barboza</span></p>
            <p className="flex items-center justify-center gap-2">
              <FiPhone />
              <span className="font-semibold">999 636 452</span>
            </p>
          </div>
        </div>

        <a 
          href="https://wa.me/51999636452?text=Hola%2C%20vengo%20de%20la%20app%20de%20gesti%C3%B3n%20de%20eventos%20y%20mi%20cuenta%20ha%20sido%20suspendida."
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300 mb-4"
        >
          <FiPhone />
          Contactar por WhatsApp
        </a>

        <Link href="/auth/login" className="block text-sky-500 hover:underline mt-4">
          Volver al inicio de sesión
        </Link>
      </div>
    </div>
  );
}
