import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Wenn dein Repo "mein-garten" heißt, schreibe hier '/mein-garten/'
  // Wenn du unsicher bist, nutze './' (Punkt Slash), das funktioniert meistens
  base: './', 
})
