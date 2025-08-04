import './globals.css';
import { Toaster } from 'react-hot-toast';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <Toaster 
          position="top-right"
          toastOptions={{
            // Define default options
            className: '',
            duration: 5000,
            style: {
              background: '#1f2937', // bg-slate-800
              color: '#f1f5f9', // text-slate-100
              border: '1px solid #334155' // border-slate-700
            },
            // Default options for specific types
            success: {
              duration: 3000,
              iconTheme: {
                primary: '#22c55e', // green-500
                secondary: '#f1f5f9',
              },
            },
            error: {
              iconTheme: {
                primary: '#ef4444', // red-500
                secondary: '#f1f5f9',
              },
            }
          }}
        />
        {children}
      </body>
    </html>
  );
}