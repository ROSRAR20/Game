import { defineConfig, Plugin } from 'vite';
import fs from 'fs';
import path from 'path';

/**
 * Excludes local dev reference assets (e.g. public/dev/ref.jpg) from production builds,
 * while still allowing them to be served locally during development and preview.
 */
function excludeDevAssetsPlugin(): Plugin {
  return {
    name: 'exclude-dev-assets',
    // In preview server (npm run preview), serve /dev/* directly from public/dev/* if it exists locally
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.startsWith('/dev/')) {
          const cleanUrl = req.url.split('?')[0]!;
          const filePath = path.resolve(__dirname, 'public', cleanUrl.slice(1));
          if (fs.existsSync(filePath)) {
            res.setHeader('Content-Type', 'image/jpeg');
            fs.createReadStream(filePath).pipe(res);
            return;
          }
        }
        next();
      });
    },
    // Ensure dist/ never contains dev/ so production and Android builds remain clean
    closeBundle() {
      const distDev = path.resolve(__dirname, 'dist/dev');
      if (fs.existsSync(distDev)) {
        fs.rmSync(distDev, { recursive: true, force: true });
        console.info('[Vite] Cleaned dist/dev reference folder from production bundle.');
      }
    }
  };
}

export default defineConfig({
  plugins: [excludeDevAssetsPlugin()],
  server: {
    port: 3000,
    host: true
  },
  preview: {
    port: 3000,
    host: true
  }
});
