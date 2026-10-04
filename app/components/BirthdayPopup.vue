<!-- app/components/BirthdayPopup.vue -->
<script setup>
/*
  Popup ulang tahun. Muncul kalau hari ini (WIB) ada anggota yang berulang tahun.
  - Data diambil dari tabel `members` (kolom name, birth_date, photo_url).
  - Muncul sekali per hari per pengunjung (disimpan di localStorage).
  - Uji coba tanpa menunggu ulang tahun: buka halaman dengan  ?ultah=MM-DD
    contoh: /?ultah=03-24  (selalu muncul, tidak menyimpan "sudah dilihat")
*/
const supabase = useSupabaseClient()
const route = useRoute()

const open = ref(false)
const people = ref([])
const broken = reactive(new Set())

const pad = (n) => String(n).padStart(2, '0')
const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0

// Tanggal hari ini menurut WIB, bukan jam perangkat pengunjung
const todayWIB = () => {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(new Date())
      .map((x) => [x.type, x.value])
  )
  return { year: +p.year, month: +p.month, day: +p.day }
}

// Mengembalikan umur kalau tanggal lahir jatuh hari ini, selain itu null.
// Yang lahir 29 Februari dirayakan 28 Februari di tahun bukan kabisat.
const ageIfToday = (birth, today) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(birth || '')
  if (!m) return null
  const by = +m[1], bm = +m[2]
  let bd = +m[3]
  if (bm === 2 && bd === 29 && !isLeap(today.year)) bd = 28
  return bm === today.month && bd === today.day ? today.year - by : null
}

const clean = (v) => String(v ?? '').replace(/[\u200B-\u200D\u2060\uFEFF]/g, '').replace(/\s+/g, ' ').trim()
const initials = (n) => clean(n).split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
const photoOk = (url) => !!url && !broken.has(url)

const close = () => {
  open.value = false
  if (!route.query.ultah) {
    try {
      const t = todayWIB()
      localStorage.setItem(`bday-seen-${t.year}-${pad(t.month)}-${pad(t.day)}`, '1')
    } catch {}
  }
}
const onKey = (e) => { if (e.key === 'Escape') close() }

// Konfeti sederhana, posisinya tetap (tidak acak) supaya konsisten
const confetti = Array.from({ length: 28 }, (_, i) => ({
  left: ((i * 37) % 100) + '%',
  delay: ((i * 0.23) % 3).toFixed(2) + 's',
  dur: (3.2 + ((i * 0.37) % 2.4)).toFixed(2) + 's',
  color: ['#f59e0b', '#3b82f6', '#10b981', '#f43f5e', '#8b5cf6', '#0ea5e9'][i % 6],
  size: 6 + (i % 4) * 2 + 'px'
}))

onMounted(async () => {
  let today = todayWIB()

  // Mode uji coba: ?ultah=MM-DD
  const forced = /^(\d{2})-(\d{2})$/.exec(String(route.query.ultah || ''))
  if (forced) today = { ...today, month: +forced[1], day: +forced[2] }

  try {
    if (!forced && localStorage.getItem(`bday-seen-${today.year}-${pad(today.month)}-${pad(today.day)}`)) return
  } catch {}

  const { data, error } = await supabase.from('members').select('name, birth_date, photo_url')
  if (error || !Array.isArray(data)) return // kalau data gagal dimuat, popup diam saja

  const found = data
    .map((m) => ({ name: clean(m.name), photo: m.photo_url || '', age: ageIfToday(m.birth_date, today) }))
    .filter((m) => m.name && m.age !== null && m.age > 0)
    .sort((a, b) => a.name.localeCompare(b.name, 'id'))

  if (!found.length) return
  people.value = found
  open.value = true
  window.addEventListener('keydown', onKey)
})

onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Transition name="bday">
    <div v-if="open" class="bday-backdrop" @click.self="close">
      <div class="bday-card" role="dialog" aria-modal="true" aria-labelledby="bday-title">
        <div class="confetti" aria-hidden="true">
          <span
            v-for="(c, i) in confetti"
            :key="i"
            :style="{ left: c.left, animationDelay: c.delay, animationDuration: c.dur, background: c.color, width: c.size, height: c.size }"
          ></span>
        </div>

        <button class="bday-close" type="button" aria-label="Tutup" @click="close">&times;</button>

        <p class="bday-emoji" aria-hidden="true">🎂</p>
        <h2 id="bday-title" class="bday-title">Selamat ulang tahun!</h2>
        <p class="bday-sub">
          {{ people.length > 1 ? 'Hari ini ada yang berulang tahun di Siscverse' : 'Hari ini hari spesial di Siscverse' }}
        </p>

        <ul class="bday-list">
          <li v-for="p in people" :key="p.name" class="bday-person">
            <img v-if="photoOk(p.photo)" :src="p.photo" :alt="p.name" class="bday-photo" referrerpolicy="no-referrer" @error="broken.add(p.photo)" />
            <span v-else class="bday-photo bday-initials">{{ initials(p.name) }}</span>
            <span class="bday-info">
              <span class="bday-name">{{ p.name }}</span>
              <span class="bday-age">{{ p.age }} tahun</span>
            </span>
          </li>
        </ul>

        <p class="bday-wish">Semoga sehat, bahagia, dan semua urusannya dilancarkan.</p>

        <div class="bday-actions">
          <NuxtLink to="/menfess" class="bday-btn bday-btn-primary" @click="close">Kirim ucapan</NuxtLink>
          <button type="button" class="bday-btn bday-btn-ghost" @click="close">Tutup</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.bday-backdrop {
  position: fixed; inset: 0; z-index: 10000; padding: 1.25rem;
  display: flex; align-items: center; justify-content: center;
  background: rgba(3, 4, 10, 0.7); backdrop-filter: blur(10px);
  font-family: 'Outfit', 'Inter', system-ui, sans-serif;
}
.bday-card {
  position: relative; overflow: hidden; width: 100%; max-width: 420px; max-height: 90vh; overflow-y: auto;
  padding: 2.25rem 1.75rem 1.75rem; text-align: center; color: #fff;
  background: linear-gradient(160deg, rgba(59, 130, 246, 0.22), rgba(139, 92, 246, 0.22)), rgba(12, 16, 28, 0.88);
  border: 1px solid rgba(255, 255, 255, 0.16); border-radius: 28px;
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.7);
}
.confetti { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
.confetti span {
  position: absolute; top: -12px; border-radius: 2px; opacity: 0;
  animation-name: fall; animation-iteration-count: infinite; animation-timing-function: linear;
}
@keyframes fall {
  0% { transform: translateY(0) rotate(0deg); opacity: 0; }
  10% { opacity: 1; }
  100% { transform: translateY(520px) rotate(540deg); opacity: 0; }
}

.bday-close {
  position: absolute; top: 0.9rem; right: 0.9rem; z-index: 2; width: 36px; height: 36px;
  display: grid; place-items: center; font-size: 1.4rem; line-height: 1; color: #fff; cursor: pointer;
  background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 50%;
}
.bday-close:hover { background: rgba(255, 255, 255, 0.2); }

.bday-emoji { position: relative; font-size: 3.2rem; line-height: 1; margin-bottom: 0.6rem; }
.bday-title { position: relative; font-size: 1.8rem; font-weight: 800; letter-spacing: -0.01em; }
.bday-sub { position: relative; margin-top: 0.4rem; color: #b6bfd6; font-size: 0.95rem; }

.bday-list { position: relative; list-style: none; margin: 1.5rem 0 1.25rem; padding: 0; display: flex; flex-direction: column; gap: 0.75rem; max-height: 38vh; overflow-y: auto; }
.bday-person {
  display: flex; align-items: center; gap: 0.9rem; padding: 0.7rem 0.9rem; text-align: left;
  background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 18px;
}
.bday-photo { width: 56px; height: 56px; flex-shrink: 0; border-radius: 16px; object-fit: cover; }
.bday-initials {
  display: grid; place-items: center; font-weight: 700; font-size: 1.3rem; color: #fff;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
}
.bday-info { display: flex; flex-direction: column; min-width: 0; }
.bday-name { font-size: 1.1rem; font-weight: 700; overflow-wrap: anywhere; }
.bday-age { color: #f2b84b; font-size: 0.9rem; font-weight: 600; }

.bday-wish { position: relative; color: #c9cfe4; font-size: 0.95rem; line-height: 1.5; margin-bottom: 1.4rem; }
.bday-actions { position: relative; display: flex; gap: 0.7rem; justify-content: center; flex-wrap: wrap; }
.bday-btn {
  padding: 0.8rem 1.4rem; border-radius: 14px; font-family: inherit; font-size: 0.95rem; font-weight: 700;
  text-decoration: none; cursor: pointer; transition: all 0.2s; border: 1px solid transparent;
}
.bday-btn-primary { background: #fff; color: #000; }
.bday-btn-primary:hover { background: #e2e8f0; transform: translateY(-1px); }
.bday-btn-ghost { background: transparent; color: #fff; border-color: rgba(255, 255, 255, 0.25); }
.bday-btn-ghost:hover { background: rgba(255, 255, 255, 0.08); }

.bday-enter-active, .bday-leave-active { transition: opacity 0.3s; }
.bday-enter-active .bday-card, .bday-leave-active .bday-card { transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1); }
.bday-enter-from, .bday-leave-to { opacity: 0; }
.bday-enter-from .bday-card { transform: scale(0.92) translateY(18px); }

@media (prefers-reduced-motion: reduce) {
  .confetti { display: none; }
  .bday-enter-active, .bday-leave-active, .bday-enter-active .bday-card { transition: none; }
}
</style>