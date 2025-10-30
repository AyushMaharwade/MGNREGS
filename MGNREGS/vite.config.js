import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default {
  // ...existing...
  server: {
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
};