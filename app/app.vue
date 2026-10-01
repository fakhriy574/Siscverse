<script setup>
import { ref, onMounted } from 'vue'

const isLoading = ref(true)

onMounted(() => {
  setTimeout(() => { isLoading.value = false }, 1800)
})
</script>

<template>
  <div class="bg-[#040509] min-h-screen text-[#d9def0] font-sans overflow-x-hidden selection:bg-[#6c5ce7] selection:text-white">
    
    <!-- SPACE LOADER DENGAN SI KONG -->
    <Transition
      leave-active-class="transition-all duration-1000 ease-[cubic-bezier(0.4,0,0.2,1)]"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-110"
    >
      <div v-if="isLoading" class="fixed inset-0 z-[999] bg-[#040509] flex flex-col items-center justify-center overflow-hidden">
        
        <!-- Efek Bintang/Nebula di Latar -->
        <div class="absolute inset-0 z-0 opacity-40 bg-[radial-gradient(ellipse_at_center,_rgba(108,92,231,0.2)_0%,_transparent_70%)] blur-[40px] animate-pulse"></div>

        <!-- Wadah Loading -->
        <div class="relative z-10 flex flex-col items-center">
          
          <!-- Si Kong & Orbitnya -->
          <div class="relative flex items-center justify-center mb-12 w-32 h-32">
            <!-- Cincin Orbit Luar (Ungu) -->
            <div class="absolute inset-[-30%] border-[3px] border-transparent border-t-[#6c5ce7] border-b-[#6c5ce7] rounded-full animate-[spin_3s_linear_infinite] opacity-60"></div>
            <!-- Cincin Orbit Dalam (Emas) -->
            <div class="absolute inset-[-10%] border-[3px] border-transparent border-l-[#f2c14e] border-r-[#f2c14e] rounded-full animate-[spin_2s_linear_infinite_reverse] opacity-80"></div>
            
            <!-- Kong Melayang Tanpa Gravitasi -->
            <div class="relative z-20 animate-float drop-shadow-[0_0_20px_rgba(242,193,78,0.4)]">
              <!-- Render Kong di dalam loading -->
              <KongCompanion />
            </div>
          </div>

          <!-- Teks Loading -->
          <h1 class="text-2xl font-black tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-r from-[#d9def0] via-[#f2c14e] to-[#6c5ce7] animate-pulse">
            MEMASUKI SEMESTA
          </h1>
          <p class="mt-3 text-sm text-[#8891b8] font-medium tracking-wide">
            Kong sedang menyiapkan arsip...
          </p>
          
        </div>
      </div>
    </Transition>

    <!-- KONTEN UTAMA -->
    <div v-show="!isLoading" class="relative z-10 min-h-screen">
      <!-- Tekstur bintang debu -->
      <div class="absolute inset-0 z-0 pointer-events-none opacity-20" style="background-image: radial-gradient(#ffffff 1px, transparent 1px); background-size: 40px 40px;"></div>
      
      <div class="relative z-10">
        <NuxtPage />
        <!-- Render Kong lagi untuk halaman utama setelah loading selesai -->
        <KongCompanion v-if="!isLoading" />
      </div>
    </div>

  </div>
</template>

<style scoped>
/* Animasi Zero Gravity untuk si Kong */
@keyframes float {
  0%, 100% { transform: translateY(0px) rotate(0deg) scale(1); }
  50% { transform: translateY(-15px) rotate(4deg) scale(1.05); }
}
.animate-float {
  animation: float 3.5s ease-in-out infinite;
}
</style>