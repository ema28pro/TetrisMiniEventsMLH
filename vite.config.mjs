import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  server: {
    host: true,
    port: 3000,
  },
  plugins: [
    {
      name: 'copy-static-data-and-assets',
      closeBundle() {
        const dist = path.resolve(__dirname, 'dist');
        if (fs.existsSync(dist)) {
          fs.cpSync(path.resolve(__dirname, 'data'), path.resolve(dist, 'data'), { recursive: true });
          fs.cpSync(path.resolve(__dirname, 'assets'), path.resolve(dist, 'assets'), { recursive: true });
        }
      },
    },
  ],
});
