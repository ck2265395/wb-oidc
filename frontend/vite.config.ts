import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// 开发时所有 OIDC/NestJS 路径都代理到后端 3000，浏览器视角全部同源
const backend = 'http://localhost:3000';

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: backend, changeOrigin: true },
      '/interaction': { target: backend, changeOrigin: true },
      '/auth': { target: backend, changeOrigin: true },
      '/token': { target: backend, changeOrigin: true },
      '/userinfo': { target: backend, changeOrigin: true },
      '/jwks': { target: backend, changeOrigin: true },
      '/session': { target: backend, changeOrigin: true },
      '/.well-known': { target: backend, changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
  },
});
