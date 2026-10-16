import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/moba-retri-arena-3d/',
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 850,
    rollupOptions: {
      output: {
        manualChunks: {
          'three-core': ['three'],
          'r3f-ecosystem': ['@react-three/fiber', '@react-three/drei'],
          'react-vendor': ['react', 'react-dom', 'lucide-react'],
        },
      },
    },
  },
});
