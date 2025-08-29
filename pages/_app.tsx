import type { AppProps } from 'next/app';
import { useEffect } from 'react';
import { ThemeProvider } from '../lib/themeContext';
import '../styles/globals.css';

function MyApp({ Component, pageProps }: AppProps) {
  useEffect(() => {
    // Initialize real-time sync when app starts
    const initializeSync = async () => {
      try {
        const response = await fetch('/api/init');
        if (response.ok) {
          console.log('Real-time sync initialized');
        }
      } catch (error) {
        console.error('Failed to initialize sync:', error);
      }
    };

    // เรียกหลังจาก component mount
    initializeSync();
  }, []);

  return (
    <ThemeProvider>
      <Component {...pageProps} />
    </ThemeProvider>
  );
}

export default MyApp;