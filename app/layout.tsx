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
              background: '#333',
              color: '#fff',
            },
            // Default options for specific types
            success: {
              duration: 3000,
              theme: {
                primary: 'green',
                secondary: 'black',
              },
            },
          }}
        />
        {children}
      </body>
    </html>
  );
}