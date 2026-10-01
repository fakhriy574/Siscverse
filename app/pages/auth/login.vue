<script setup>
import { ref } from 'vue'

const supabase = useSupabaseClient()
const user = useSupabaseUser()

// Cek apakah user sudah login, jika ya langsung lempar ke admin
watchEffect(() => {
  if (user.value) {
    return navigateTo('/admin')
  }
})

const email = ref('')
const password = ref('')
const loading = ref(false)
const errorMessage = ref('')

const handleLogin = async () => {
  loading.value = true
  errorMessage.value = ''
  
  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.value,
      password: password.value,
    })
    
    if (error) throw error
    
    return navigateTo('/admin')
  } catch (error) {
    errorMessage.value = 'Akses ditolak. Email atau password tidak cocok.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6 font-sans relative overflow-hidden">
    
    <!-- Latar Belakang Elegan -->
    <div class="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-violet-100/50 to-transparent pointer-events-none"></div>

    <!-- Kotak Form Login -->
    <div class="w-full max-w-md bg-white rounded-[2rem] p-8 md:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 relative z-10">
      
      <!-- Header & Logo -->
      <div class="text-center mb-8">
        <div class="w-16 h-16 bg-gradient-to-tr from-violet-600 to-pink-500 rounded-2xl mx-auto flex items-center justify-center text-white font-black text-3xl shadow-lg shadow-violet-200 mb-5">
          S
        </div>
        <h1 class="text-2xl font-black text-slate-900 tracking-tight">Siscverse Admin</h1>
        <p class="text-slate-500 text-sm mt-2 font-medium">Masuk untuk mengelola data kelas.</p>
      </div>

      <!-- Pesan Error -->
      <div v-if="errorMessage" class="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600">
        <svg class="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
        </svg>
        <p class="text-sm font-bold">{{ errorMessage }}</p>
      </div>

      <!-- Form -->
      <form @submit.prevent="handleLogin" class="space-y-5">
        
        <!-- Input Email -->
        <div>
          <label class="block text-sm font-bold text-slate-700 mb-2">Email Address</label>
          <div class="relative group">
            <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"></path></svg>
            </div>
            <input 
              v-model="email" 
              type="email" 
              required
              placeholder="admin@siscverse.com"
              class="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 transition-all"
            />
          </div>
        </div>

        <!-- Input Password -->
        <div>
          <label class="block text-sm font-bold text-slate-700 mb-2">Password</label>
          <div class="relative group">
            <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
            </div>
            <input 
              v-model="password" 
              type="password" 
              required
              placeholder="••••••••"
              class="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 transition-all"
            />
          </div>
        </div>

        <!-- Tombol Login -->
        <button 
          type="submit" 
          :disabled="loading"
          class="w-full mt-2 bg-slate-900 text-white font-bold py-4 rounded-2xl text-sm hover:bg-slate-800 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
        >
          <span v-if="loading" class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
          <template v-else>
            Masuk ke Sistem
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
          </template>
        </button>

      </form>
    </div>
  </div>
</template>