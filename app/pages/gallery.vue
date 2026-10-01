<script setup>
// Data dummy dengan link gambar acak dari Unsplash untuk simulasi.
// Nantinya bisa diganti dengan URL gambar dari Supabase Storage.
const memories = [
  { 
    id: 1, 
    src: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&q=80&w=1200', 
    alt: 'THE BEGINNING', 
    colSpan: 'md:col-span-8',
    height: 'h-[400px] md:h-[600px]'
  },
  { 
    id: 2, 
    src: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&q=80&w=800', 
    alt: 'FIRST PROJECT', 
    colSpan: 'md:col-span-4',
    height: 'h-[400px] md:h-[600px]'
  },
  { 
    id: 3, 
    src: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&q=80&w=800', 
    alt: 'LATE NIGHT DEBUGGING', 
    colSpan: 'md:col-span-4',
    height: 'h-[300px] md:h-[400px]'
  },
  { 
    id: 4, 
    src: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&q=80&w=1200', 
    alt: 'CLASS MEET', 
    colSpan: 'md:col-span-8',
    height: 'h-[300px] md:h-[400px]'
  },
  { 
    id: 5, 
    src: 'https://images.unsplash.com/photo-1542831371-29b0f74f9713?auto=format&fit=crop&q=80&w=1200', 
    alt: 'THE CHAOS', 
    colSpan: 'md:col-span-12',
    height: 'h-[400px] md:h-[700px]'
  }
]
</script>

<template>
  <main class="min-h-screen pt-24 px-4 md:px-12 max-w-[1400px] mx-auto pb-24">
    
    <!-- Header Editorial -->
    <div class="mb-16 md:mb-24 flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-[#111111] pb-12">
      <div>
        <h1 class="font-display text-5xl md:text-7xl font-bold uppercase tracking-tighter mb-6">
          Visual<br/>
          <span class="text-[#8A8A8A]">Archive.</span>
        </h1>
        <p class="text-[#8A8A8A] max-w-sm border-l border-[#48BB78] pl-4 font-mono text-sm leading-relaxed">
          Potongan memori yang tertinggal di dalam server. Jangan biarkan data ini terhapus.
        </p>
      </div>
      <div class="font-mono text-xs text-[#555] uppercase tracking-widest">
        [ 2025 — 2028 ]
      </div>
    </div>

    <!-- Asymmetric Grid System -->
    <div class="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6">
      
      <div 
        v-for="img in memories" 
        :key="img.id" 
        :class="[img.colSpan, img.height]"
        class="group relative overflow-hidden bg-[#111111] cursor-pointer"
      >
        <!-- Image dengan transisi smooth ala majalah -->
        <img 
          :src="img.src" 
          :alt="img.alt" 
          class="w-full h-full object-cover grayscale opacity-60 mix-blend-luminosity group-hover:grayscale-0 group-hover:opacity-100 group-hover:mix-blend-normal group-hover:scale-105 transition-all duration-700 ease-[cubic-bezier(0.25,1,0.5,1)]"
        />
        
        <!-- Hover Metadata -->
        <div class="absolute inset-0 bg-gradient-to-t from-[#0A0A0A]/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex flex-col justify-end p-8">
          <div class="overflow-hidden">
            <span class="inline-block translate-y-full group-hover:translate-y-0 transition-transform duration-500 delay-100 ease-[cubic-bezier(0.25,1,0.5,1)] font-mono text-xs text-[#F5F5F5] tracking-widest border border-[#333] bg-[#0A0A0A]/50 backdrop-blur-sm px-4 py-2">
              {{ img.alt }}
            </span>
          </div>
        </div>
      </div>

    </div>
  </main>
</template>