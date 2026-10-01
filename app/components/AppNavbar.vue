<!-- components/AppNavbar.vue -->
<script setup>
import { ref, reactive, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'

const route = useRoute()
const open = ref(false)
const scrolled = ref(false)

const links = [
  { to: '/', label: 'Beranda' },
  { to: '/structure', label: 'Anggota' },
  { to: '/schedule', label: 'Jadwal' },
  { to: '/menfess', label: 'Menfess' },
  { to: '/kas', label: 'Kas' }
]
const isActive = (to) => (to === '/' ? route.path === '/' : route.path.startsWith(to))
const activeIndex = computed(() => links.findIndex((l) => isActive(l.to)))

/* indikator geser: mengikuti hover/fokus, kembali ke halaman aktif saat kursor pergi */
const linkEls = []
const ind = reactive({ x: 0, w: 0, show: false, anim: false })
const setEl = (i) => (c) => { linkEls[i] = c?.$el || c }
function place(i) {
  const el = linkEls[i]
  if (!el) { ind.show = false; return }
  ind.x = el.offsetLeft
  ind.w = el.offsetWidth
  ind.show = true
}
const reset = () => place(activeIndex.value)

/* scroll: menyusut setelah sedikit gulir. Navbar selalu tampil (tidak disembunyikan). */
function onScroll() { scrolled.value = window.scrollY > 8 }
const closeMenu = () => { open.value = false }
const onKey = (e) => { if (e.key === 'Escape') closeMenu() }
const onResize = () => { if (window.innerWidth >= 768) closeMenu(); reset() }

watch(() => route.path, () => { closeMenu(); nextTick(reset) })
watch(open, (v) => { document.documentElement.style.overflow = v ? 'hidden' : '' })

onMounted(() => {
  onScroll()
  reset()
  requestAnimationFrame(() => { ind.anim = true })
  document.fonts && document.fonts.ready.then(reset)
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('keydown', onKey)
  window.addEventListener('resize', onResize)
})
onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('resize', onResize)
  document.documentElement.style.overflow = ''
})
</script>

<template>
  <header class="nav" :class="{ 'is-scrolled': scrolled, 'is-open': open }">
    <div class="pill">
      <NuxtLink to="/" class="brand" aria-label="Siscverse, ke beranda" @click="closeMenu">
        <svg class="logo" viewBox="0 0 32 32" aria-hidden="true">
          <path d="M2 16a14 5 0 0 1 28 0" fill="none" stroke="#eceef5" stroke-width="1.6" transform="rotate(-22 16 16)" />
          <circle cx="16" cy="16" r="7" fill="#f2b84b" />
          <path d="M2 16a14 5 0 0 0 28 0" fill="none" stroke="#eceef5" stroke-width="1.6" transform="rotate(-22 16 16)" />
        </svg>
        <span class="brand-name">Siscverse</span>
      </NuxtLink>

      <nav class="links" aria-label="Navigasi utama" @mouseleave="reset" @focusout="reset">
        <span class="ind" aria-hidden="true"
          :class="{ show: ind.show, anim: ind.anim }" :style="{ '--x': ind.x + 'px', '--w': ind.w + 'px' }"></span>
        <NuxtLink v-for="(l, i) in links" :key="l.to" :ref="setEl(i)" :to="l.to" class="link" :class="{ active: isActive(l.to) }"
          :aria-current="isActive(l.to) ? 'page' : undefined" @mouseenter="place(i)" @focus="place(i)">{{ l.label }}</NuxtLink>
      </nav>

      <NuxtLink to="/menfess" class="cta">Kirim menfess</NuxtLink>

      <button class="toggle" type="button" :aria-expanded="open" aria-controls="mobile-menu"
        :aria-label="open ? 'Tutup menu' : 'Buka menu'" @click="open = !open">
        <span class="bar"></span><span class="bar"></span>
      </button>
    </div>

    <div class="scrim" :class="{ open }" aria-hidden="true" @click="closeMenu"></div>

    <div id="mobile-menu" class="drawer" :class="{ open }">
      <nav class="drawer-links" aria-label="Navigasi utama (ponsel)">
        <NuxtLink v-for="(l, i) in links" :key="l.to" :to="l.to" class="drawer-link" :class="{ active: isActive(l.to) }"
          :style="{ '--i': i }" :aria-current="isActive(l.to) ? 'page' : undefined" @click="closeMenu">
          <span class="label">{{ l.label }}</span>
          <svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
        </NuxtLink>
      </nav>
      <div class="drawer-foot" :style="{ '--i': links.length }">
        <p>Semesta kecil untuk satu kelas.</p>
        <NuxtLink to="/menfess" class="cta cta-lg" @click="closeMenu">Kirim menfess</NuxtLink>
      </div>
    </div>
  </header>
</template>

<style scoped>
.nav { --nav-h: 64px; --gutter: clamp(1.25rem, 4vw, 2rem); position: relative; z-index: 100; height: var(--nav-h); pointer-events: none;
  font-family: 'Inter', system-ui, sans-serif; }

/* pill: menyatu dengan halaman di atas, jadi kaca yang lebih sempit setelah digulir */
.pill { pointer-events: auto; position: fixed; top: 0; left: 0; right: 0; z-index: 2; display: flex; align-items: center; justify-content: space-between;
  width: calc(100% - var(--gutter) * 2); max-width: 72rem; height: 48px; margin: 8px auto 0; padding: 0 .5rem 0 1rem;
  border: 1px solid transparent; border-radius: 999px;
  transition: max-width .5s cubic-bezier(.3, .8, .3, 1), background-color .3s, border-color .3s, box-shadow .3s; }
.is-scrolled .pill, .is-open .pill { max-width: 50rem; background: rgba(10, 13, 22, .62); border-color: rgba(255, 255, 255, .1);
  backdrop-filter: blur(16px) saturate(1.4); -webkit-backdrop-filter: blur(16px) saturate(1.4); box-shadow: 0 14px 34px -16px rgba(0, 0, 0, .8); }
.is-open .pill { background: rgba(10, 13, 22, .96); }

.brand { display: inline-flex; align-items: center; gap: .55rem; text-decoration: none; color: #eceef5; }
.logo { width: 26px; height: 26px; transition: transform .5s cubic-bezier(.3, .8, .3, 1); }
.brand:hover .logo { transform: rotate(-24deg); }
.brand-name { font-family: 'Fraunces', Georgia, serif; font-size: 1.2rem; font-weight: 600; letter-spacing: -.01em; }

.links { position: relative; display: none; }
.ind { position: absolute; top: 0; bottom: 0; left: 0; width: var(--w); border-radius: 999px; background: rgba(255, 255, 255, .09);
  transform: translateX(var(--x)); opacity: 0; pointer-events: none; }
.ind.show { opacity: 1; }
.ind.anim { transition: transform .38s cubic-bezier(.3, .8, .3, 1), width .38s cubic-bezier(.3, .8, .3, 1), opacity .2s; }
.link { position: relative; z-index: 1; padding: .5rem .95rem; border-radius: 999px; color: #9ba2ba; text-decoration: none; font-size: .92rem; font-weight: 500; transition: color .2s; }
.link:hover, .link.active { color: #eceef5; }
.link.active::after { content: ''; position: absolute; left: 50%; bottom: 3px; width: 4px; height: 4px; margin-left: -2px; border-radius: 50%; background: var(--accent, #f2b84b); }

.cta { display: none; align-items: center; padding: .5rem 1rem; border-radius: 999px; background: var(--accent, #f2b84b); color: #1a1204;
  font-size: .88rem; font-weight: 600; text-decoration: none; transition: background-color .2s, transform .2s; }
.cta:hover { background: #ffc95f; transform: translateY(-1px); }
.cta-lg { display: flex; justify-content: center; width: 100%; padding: .85rem 1.4rem; font-size: .95rem; }

.link:focus-visible, .brand:focus-visible, .toggle:focus-visible, .drawer-link:focus-visible, .cta:focus-visible { outline: 2px solid var(--accent, #f2b84b); outline-offset: 3px; }

/* tombol hamburger */
.toggle { position: relative; width: 40px; height: 40px; border: 1px solid rgba(255, 255, 255, .12); border-radius: 50%; background: rgba(255, 255, 255, .06);
  color: #eceef5; cursor: pointer; transition: background-color .2s, border-color .25s; }
.toggle:hover { background: rgba(255, 255, 255, .11); }
.is-open .toggle { border-color: rgba(242, 184, 75, .55); }
.bar { position: absolute; left: 11px; right: 11px; height: 2px; border-radius: 2px; background: currentColor; transition: top .25s ease, transform .25s ease; }
.bar:nth-child(1) { top: 14px; } .bar:nth-child(2) { top: 21px; }
.is-open .bar:nth-child(1) { top: 18px; transform: rotate(45deg); }
.is-open .bar:nth-child(2) { top: 18px; transform: rotate(-45deg); }

/* menu ponsel: kartu kaca melayang di bawah pill, bukan layar penuh */
.scrim { position: fixed; inset: 0; z-index: -1; background: rgba(3, 4, 8, .6); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
  opacity: 0; visibility: hidden; pointer-events: none; transition: opacity .3s ease, visibility 0s linear .3s; }
.scrim.open { opacity: 1; visibility: visible; pointer-events: auto; transition-delay: 0s; }

.drawer { pointer-events: auto; position: fixed; z-index: 1; top: var(--nav-h); left: var(--gutter); right: var(--gutter);
  display: flex; flex-direction: column; max-height: calc(100vh - var(--nav-h) - 1.5rem); max-height: calc(100svh - var(--nav-h) - 1.5rem); overflow-y: auto;
  padding: .4rem 1.25rem 1.25rem; border: 1px solid rgba(255, 255, 255, .12); border-radius: 24px; background: rgba(10, 13, 22, .96);
  backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px); box-shadow: 0 30px 60px -20px rgba(0, 0, 0, .85); transform-origin: top center;
  opacity: 0; visibility: hidden; transform: translateY(-10px) scale(.98);
  transition: opacity .28s ease, transform .35s cubic-bezier(.3, .8, .3, 1), visibility 0s linear .35s; }
.drawer.open { opacity: 1; visibility: visible; transform: none; transition-delay: 0s; }

.drawer-link, .drawer-foot { opacity: 0; transform: translateY(8px); transition: opacity .35s ease, transform .35s cubic-bezier(.3, .8, .3, 1); }
.drawer.open .drawer-link, .drawer.open .drawer-foot { opacity: 1; transform: none; transition-delay: calc(var(--i) * 45ms + 90ms); }
.drawer-link { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 1rem .25rem; border-top: 1px solid rgba(255, 255, 255, .08);
  color: #c9cee0; text-decoration: none; font-family: 'Fraunces', Georgia, serif; font-size: 1.45rem; font-weight: 600; letter-spacing: -.01em; }
.drawer-link:first-child { border-top: 0; }
.drawer-link.active { color: var(--accent, #f2b84b); }
.drawer-link.active .label::before { content: ''; display: inline-block; width: 6px; height: 6px; margin: 0 .6rem .2rem 0; border-radius: 50%;
  background: var(--accent, #f2b84b); box-shadow: 0 0 10px rgba(242, 184, 75, .7); vertical-align: middle; }
.chev { flex: none; width: 18px; height: 18px; opacity: .4; }
.drawer-foot { display: grid; gap: .9rem; margin-top: .25rem; padding-top: 1.1rem; border-top: 1px solid rgba(255, 255, 255, .08); }
.drawer-foot p { color: #9ba2ba; font-size: .9rem; text-align: center; }

@media (min-width: 768px) {
  .pill { display: grid; grid-template-columns: 1fr auto 1fr; }
  .brand { justify-self: start; }
  .links { display: flex; }
  .cta { justify-self: end; }
  .toggle, .drawer, .scrim { display: none; }
}
@media (min-width: 960px) { .pill .cta { display: inline-flex; } }
@media (prefers-reduced-motion: reduce) {
  .pill, .logo, .ind.anim, .link, .cta, .toggle, .bar, .scrim, .drawer, .drawer-link, .drawer-foot { transition: none; }
  .drawer-link, .drawer-foot { opacity: 1; transform: none; }
}
</style>