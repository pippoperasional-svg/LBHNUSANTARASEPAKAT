import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, (process as any).cwd(), '');

  // Robustly find the API Key from various sources:
  // Prioritize VITE_GEMINI_API_KEY as per your Vercel setup
  const apiKey = 
    process.env.VITE_GEMINI_API_KEY || env.VITE_GEMINI_API_KEY || 
    process.env.API_KEY || env.API_KEY || 
    process.env.VITE_API_KEY || env.VITE_API_KEY;

  return {
    plugins: [react()],
    // Base '/' is better for Vercel deployments than './'
    base: '/',
    build: {
      outDir: 'dist',
      sourcemap: false,
      minify: 'esbuild',
    },
    server: {
      port: 3000,
    },
    // This defines global constants that are replaced at build time.
    // Critical for the Gemini SDK which expects process.env.API_KEY
    define: {
      'process.env.API_KEY': JSON.stringify(apiKey),
      // Polyfill process.env for other usages if necessary
      'process.env': {} 
    }
  };
});
