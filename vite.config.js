import { defineConfig } from 'vite'

export default defineConfig({
  root: '.',
  build: {
    rollupOptions: {
      input: {
        main:     'index.html',
        websites: 'websites.html',
        crm:      'crm.html',
        content:  'content.html',
        login:    'login.html',
      }
    }
  }
})
