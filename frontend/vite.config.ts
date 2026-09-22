import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import fs from 'fs'
import path from 'path'

function onnxWasmPlugin(): Plugin {
  return {
    name: 'serve-onnx-wasm',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.startsWith('/onnx-dist/')) {
          const fileName = req.url.replace('/onnx-dist/', '').split('?')[0];
          const filePath = path.resolve('node_modules/onnxruntime-web/dist', fileName);
          if (fs.existsSync(filePath)) {
            if (fileName.endsWith('.wasm')) {
              res.setHeader('Content-Type', 'application/wasm');
            } else if (fileName.endsWith('.mjs') || fileName.endsWith('.js')) {
              res.setHeader('Content-Type', 'application/javascript');
            }
            return fs.createReadStream(filePath).pipe(res);
          }
        }
        next();
      });
    },
    closeBundle() {
      const srcDir = path.resolve(process.cwd(), 'node_modules/onnxruntime-web/dist');
      const destDir = path.resolve(process.cwd(), 'dist/onnx-dist');
      if (fs.existsSync(srcDir)) {
        if (!fs.existsSync(destDir)) {
          fs.mkdirSync(destDir, { recursive: true });
        }
        const files = fs.readdirSync(srcDir);
        for (const file of files) {
          if (file.endsWith('.wasm') || file.endsWith('.mjs') || (file.endsWith('.js') && !file.endsWith('.map'))) {
            const destFile = path.join(destDir, file);
            if (!fs.existsSync(destFile)) {
              fs.copyFileSync(path.join(srcDir, file), destFile);
            }
          }
        }
        console.log('[onnxWasmPlugin] Copied onnxruntime-web dist files to dist/onnx-dist');
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), onnxWasmPlugin()],
  optimizeDeps: {
    exclude: ['onnxruntime-web'],
  },
  server: {
    hmr: {
      overlay: false,
    },
  },
  preview: {},
})
