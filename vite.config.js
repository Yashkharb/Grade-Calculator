import { defineConfig } from 'vite';
import { resolve } from 'path';

const root = import.meta.dirname ?? process.cwd();

export default defineConfig({
  appType: 'mpa',
  build: {
    rollupOptions: {
      input: {
        main: resolve(root, 'index.html'),
        about: resolve(root, 'about/index.html'),
        faq: resolve(root, 'faq/index.html'),
        contact: resolve(root, 'contact/index.html'),
        privacy: resolve(root, 'privacy/index.html'),
        terms: resolve(root, 'terms/index.html'),
        notfound: resolve(root, '404.html'),
      },
    },
  },
});
