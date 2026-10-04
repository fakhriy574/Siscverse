<script setup>
import { ref, computed, onMounted } from 'vue'

const route = useRoute()
const isLoading = ref(true)

// Halaman admin/login tidak memakai navbar, langit, dan popup publik
const showChrome = computed(() => !/^\/(admin|auth|login)(\/|$)/.test(route.path))

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

        <div class="absolute inset-0 z-0 opacity-40 bg-[radial-gradient(ellipse_at_center,_rgba(108,92,231,0.2)_0%,_transparent_70%)] blur-[40px] animate-pulse"></div>

        <div class="relative z-10 flex flex-col items-center">
          <div class="relative flex items-center justify-center mb-12 w-32 h-32">
            <div class="absolute inset-[-30%] border-[3px] border-transparent border-t-[#6c5ce7] border-b-[#6c5ce7] rounded-full animate-[spin_3s_linear_infinite] opacity-60"></div>
            <div class="absolute inset-[-10%] border-[3px] border-transparent border-l-[#f2c14e] border-r-[#f2c14e] rounded-full animate-[spin_2s_linear_infinite_reverse] opacity-80"></div>

            <div class="relative z-20 animate-float drop-shadow-[0_0_20px_rgba(242,193,78,0.4)]">
              <KongCompanion />
            </div>
          </div>

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
      <div class="absolute inset-0 z-0 pointer-events-none opacity-20" style="background-image: radial-gradient(#ffffff 1px, transparent 1px); background-size: 40px 40px;"></div>

      <!-- Komponen bersama: dipasang sekali, tidak dibongkar saat pindah halaman -->
      <SpaceSky v-if="showChrome" />
      <AppNavbar v-if="showChrome" />
      <BirthdayPopup v-if="showChrome" />

      <div class="relative z-10">
        <NuxtPage />
        <KongCompanion v-if="!isLoading" />
      </div>
    </div>

    <!-- Musik latar: di luar v-show/v-if supaya aktif sejak halaman dibuka -->
    <MusicPlayer />

  </div>
</template>

<style scoped>
@keyframes float {
  0%, 100% { transform: translateY(0px) rotate(0deg) scale(1); }
  50% { transform: translateY(-15px) rotate(4deg) scale(1.05); }
}
.animate-float {
  animation: float 3.5s ease-in-out infinite;
}
</style>

<!-- Tidak scoped: halaman publik punya background solid sendiri yang akan menutupi SpaceSky -->
<style>
.page,
.glass-aurora-page {
  background: transparent !important;
}
</style>