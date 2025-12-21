import { Toaster } from 'react-hot-toast';

export default function Layout({ children }) {
  return (
    <>
      {children}
      <Toaster 
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#2D2D2D',
            color: '#fff',
            border: '1px solid #3A3A3A',
          },
          success: {
            iconTheme: {
              primary: '#D4AF37',
              secondary: '#fff',
            },
          },
        }}
      />
    </>
  );
}