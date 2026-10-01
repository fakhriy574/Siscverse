export default defineNuxtConfig({
  compatibilityDate: '2024-04-03',
  devtools: { enabled: true },

  // Load CSS Tailwind
  css: ['~/assets/css/main.css'],

  // Load Modul Supabase dan Tailwind
  modules: [
    '@nuxtjs/supabase',
    '@nuxtjs/tailwindcss'
  ],

  // Konfigurasi Supabase
  supabase: {
    redirect: false // Matikan redirect otomatis agar web ini bisa diakses publik tanpa login
  },

  // Kunci API untuk Kong AI (nilai aslinya diisi lewat .env)
  runtimeConfig: {
    anthropicApiKey: ''
  }
})