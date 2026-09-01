import { defineConfig } from 'vite';

export default defineConfig({
  // base './' membuat aset memakai path relatif sehingga hasil build
  // bisa di-deploy di mana saja — root domain maupun subpath
  // (mis. username.github.io/jalur-app/)
  base: './',
  server: {
    port: 5173,
    open: true
  },
  build: {
    outDir: 'dist',
    sourcemap: false
  }
});
