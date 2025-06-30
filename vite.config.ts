import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react'; // Make sure to import react

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      plugins: [react()], // Add the react plugin
      base: '/realestate-investment-analysis/', // Add this line
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});