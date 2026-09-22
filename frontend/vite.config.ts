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
            res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
            res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
            return fs.createReadStream(filePath).pipe(res);
          }
        }
        next();
      });
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
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  preview: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
})
