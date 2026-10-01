<!-- pages/menfess.vue -->
<script setup>
useHead({
  title: 'Menfess | Siscverse',
  meta: [{ name: 'description', content: 'Menfess Siscverse: pesan tanpa nama untuk hal yang sulit dibilang langsung.' }],
  link: [
    { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
    { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
    { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Outfit:wght@400;500;600;700;800&display=swap' }
  ]
})

const supabase = useSupabaseClient()

const MAX_MESSAGE = 500
const MAX_SENDER = 30
const COOLDOWN_SECONDS = 20

/* ===== AMBIL DATA DARI SUPABASE ===== */
const { data: rows, pending, error, refresh } = useAsyncData(
  'menfess-public',
  async () => {
    const { data, error } = await supabase
      .from('menfess')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error
    return data ?? []
  },
  { lazy: true, default: () => [] }
)

// Error fetch tampil di console browser (F12) supaya tidak tertelan diam-diam
watch(error, (e) => { if (e) console.error('[menfess] gagal:', e) }, { immediate: true })

const messages = computed(() => (Array.isArray(rows.value) ? rows.value : []))

/* ===== KIRIM MENFESS ===== */
const sender = ref('')
const message = ref('')
const sending = ref(false)
const formError = ref('')
const notice = ref('')
const cooldown = ref(0)
let noticeTimer
let cooldownTimer

const remaining = computed(() => MAX_MESSAGE - message.value.length)

const startCooldown = () => {
  cooldown.value = COOLDOWN_SECONDS
  clearInterval(cooldownTimer)
  cooldownTimer = setInterval(() => {
    cooldown.value -= 1
    if (cooldown.value <= 0) clearInterval(cooldownTimer)
  }, 1000)
}

const submit = async () => {
  formError.value = ''
  const text = message.value.trim()
  if (!text) {
    formError.value = 'Pesannya masih kosong.'
    return
  }
  if (text.length > MAX_MESSAGE) {
    formError.value = `Pesan maksimal ${MAX_MESSAGE} karakter.`
    return
  }
  if (cooldown.value > 0) return

  sending.value = true
  const { error } = await supabase.from('menfess').insert({
    sender_name: sender.value.trim().slice(0, MAX_SENDER) || 'anonymous',
    message: text
  })
  sending.value = false

  if (error) {
    formError.value = `Gagal mengirim: ${error.message}`
    return
  }

  message.value = ''
  sender.value = ''
  startCooldown()
  notice.value = 'Terkirim! Pesanmu sudah masuk ke feed.'
  clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => (notice.value = ''), 3500)
  await refresh()
}

onBeforeUnmount(() => {
  clearTimeout(noticeTimer)
  clearInterval(cooldownTimer)
})

/* ===== TAMPILAN FEED ===== */
const PAGE = 20
const visible = ref(PAGE)
const shown = computed(() => messages.value.slice(0, visible.value))

const ACCENTS = ['#3b82f6', '#8b5cf6', '#0ea5e9', '#10b981', '#f59e0b', '#f43f5e']
const accentOf = (m) => {
  const key = String(m.sender_name || 'anonymous')
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
  return ACCENTS[h % ACCENTS.length]
}

const timeAgo = (value) => {
  if (!value) return ''
  const d = new Date(value)
  const diff = Math.floor((Date.now() - d.getTime()) / 1000)
  if (diff < 60) return 'baru saja'
  if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`
  if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`
  if (diff < 7 * 86400) return `${Math.floor(diff / 86400)} hari lalu`
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}
</script>

<template>
  <div class="glass-aurora-page">

    <!-- Latar Belakang Aurora Glow -->
    <div class="aurora-bg">
      <div class="aurora-blob blob-1"></div>
      <div class="aurora-blob blob-2"></div>
      <div class="aurora-blob blob-3"></div>
    </div>

    <div class="noise-overlay"></div>
    <SpaceSky />
    <AppNavbar />

    <main class="main-layout">

      <!-- HEADER -->
      <header class="header-section">
        <div class="badge-glass">MENFESS SISCVERSE</div>
        <h1 class="title">Pesan Tanpa Nama<br/><span class="text-gradient">untuk Satu Kelas</span></h1>
        <p class="subtitle">Ada yang sulit dibilang langsung? Tulis di sini. Nama pengirim boleh dikosongkan.</p>
      </header>

      <!-- FORM KIRIM -->
      <section class="compose">
        <input
          v-model="sender"
          type="text"
          :maxlength="MAX_SENDER"
          placeholder="Nama pengirim (boleh dikosongkan)"
          class="field"
        />
        <div class="textarea-wrap">
          <textarea
            v-model="message"
            rows="4"
            placeholder="Tulis pesanmu di sini..."
            class="field area"
          ></textarea>
          <span class="counter" :class="{ over: remaining < 0 }">{{ message.length }}/{{ MAX_MESSAGE }}</span>
        </div>

        <p v-if="formError" class="form-error">{{ formError }}</p>

        <div class="compose-foot">
          <p class="rules">Tetap saling menghargai. Menfess tidak dipakai untuk menyerang atau membuka aib orang.</p>
          <button class="btn-primary" :disabled="sending || cooldown > 0 || remaining < 0" @click="submit">
            {{ sending ? 'Mengirim...' : cooldown > 0 ? `Tunggu ${cooldown} detik` : 'Kirim Menfess' }}
          </button>
        </div>
      </section>

      <!-- FEED -->
      <section class="feed">
        <div class="title-row">
          <h2 class="group-title">Feed Menfess</h2>
          <span class="count-badge">{{ messages.length }} Pesan</span>
        </div>

        <div v-if="pending" class="loading-state">
          <div class="spinner"></div>
          <p>Memuat pesan...</p>
        </div>

        <div v-else-if="error" class="state-box">
          <div class="state-icon">!</div>
          <p>Gagal memuat menfess: {{ error.message }}</p>
        </div>

        <div v-else-if="messages.length === 0" class="state-box">
          <div class="state-icon">!</div>
          <p>Belum ada menfess. Jadi yang pertama!</p>
        </div>

        <template v-else>
          <div class="feed-list">
            <article v-for="m in shown" :key="m.id" class="card" :style="{ '--accent': accentOf(m) }">
              <div class="card-head">
                <span class="avatar">{{ (m.sender_name || 'a').trim().charAt(0).toUpperCase() }}</span>
                <div class="who">
                  <p class="who-name">{{ m.sender_name || 'anonymous' }}</p>
                  <p class="who-time">{{ timeAgo(m.created_at) }}</p>
                </div>
              </div>
              <p class="card-text">{{ m.message }}</p>
            </article>
          </div>

          <div v-if="messages.length > visible" class="more-wrap">
            <button class="more-btn" @click="visible += PAGE">Tampilkan lebih banyak</button>
          </div>
        </template>
      </section>

    </main>

    <!-- NOTIFIKASI -->
    <transition name="pop">
      <div v-if="notice" class="notice" role="status">{{ notice }}</div>
    </transition>
  </div>
</template>

<style scoped>
/* ================= GLOBAL SETTINGS ================= */
* { box-sizing: border-box; margin: 0; padding: 0; }

.glass-aurora-page {
  --bg: #05050a;
  --glass-bg: rgba(20, 25, 40, 0.4);
  --glass-border: rgba(255, 255, 255, 0.1);
  --text-primary: #ffffff;
  --text-secondary: #94a3b8;

  font-family: 'Inter', -apple-system, sans-serif;
  background-color: var(--bg);
  color: var(--text-primary);
  min-height: 100vh;
  padding-bottom: 6rem;
  position: relative;
  overflow-x: hidden;
}

/* ================= BACKGROUND AURORA & NOISE ================= */
.aurora-bg { position: fixed; inset: 0; z-index: 0; overflow: hidden; pointer-events: none; }
.aurora-blob { position: absolute; border-radius: 50%; filter: blur(80px); opacity: 0.3; animation: float 20s ease-in-out infinite alternate; }
.blob-1 { top: -10%; left: -10%; width: 500px; height: 500px; background: #3b82f6; }
.blob-2 { top: 40%; right: -10%; width: 400px; height: 400px; background: #8b5cf6; animation-delay: -5s; }
.blob-3 { bottom: -20%; left: 20%; width: 600px; height: 600px; background: #0ea5e9; animation-delay: -10s; }

.noise-overlay {
  position: fixed; inset: 0; z-index: 1; pointer-events: none; opacity: 0.03;
  background-image: url('data:image/svg+xml,%3Csvg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"%3E%3Cfilter id="noiseFilter"%3E%3CfeTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch"/%3E%3C/filter%3E%3Crect width="100%25" height="100%25" filter="url(%23noiseFilter)"/%3E%3C/svg%3E');
}

.main-layout { max-width: 760px; margin: 0 auto; padding: 5rem 1.5rem; position: relative; z-index: 10; }

/* ================= HEADER ================= */
.header-section { margin-bottom: 3.5rem; text-align: center; display: flex; flex-direction: column; align-items: center; }
.badge-glass {
  display: inline-block; padding: 0.5rem 1.5rem; margin-bottom: 1.5rem;
  font-family: 'Outfit', sans-serif; font-size: 0.8rem; font-weight: 700; letter-spacing: 0.2em;
  background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border); border-radius: 100px; backdrop-filter: blur(10px);
}
.title { font-family: 'Outfit', sans-serif; font-size: clamp(2.5rem, 6vw, 4.5rem); font-weight: 800; line-height: 1.1; margin-bottom: 1rem; letter-spacing: -0.02em; }
.text-gradient { background: linear-gradient(135deg, #fff, #94a3b8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.subtitle { font-size: 1.1rem; color: var(--text-secondary); max-width: 560px; line-height: 1.6; }

/* ================= FORM ================= */
.compose {
  background: var(--glass-bg); backdrop-filter: blur(20px);
  border: 1px solid var(--glass-border); border-radius: 24px;
  padding: 1.5rem; margin-bottom: 4.5rem; display: flex; flex-direction: column; gap: 1rem;
  box-shadow: 0 20px 50px rgba(0,0,0,0.3);
}
.field {
  width: 100%; padding: 1rem 1.25rem; color: #fff; font-family: inherit; font-size: 1rem;
  background: rgba(255,255,255,0.04); border: 1px solid var(--glass-border); border-radius: 16px;
  outline: none; transition: all 0.3s;
}
.field::placeholder { color: var(--text-secondary); }
.field:focus { border-color: #3b82f6; box-shadow: 0 0 20px rgba(59, 130, 246, 0.25); }
.area { resize: none; line-height: 1.6; padding-bottom: 2rem; }
.textarea-wrap { position: relative; }
.counter { position: absolute; right: 1rem; bottom: 0.75rem; font-size: 0.75rem; color: var(--text-secondary); pointer-events: none; }
.counter.over { color: #f43f5e; }

.form-error { font-size: 0.9rem; color: #fda4af; background: rgba(244, 63, 94, 0.1); border: 1px solid rgba(244, 63, 94, 0.25); border-radius: 14px; padding: 0.75rem 1rem; }

.compose-foot { display: flex; align-items: center; justify-content: space-between; gap: 1.25rem; flex-wrap: wrap; }
.rules { flex: 1; min-width: 200px; font-size: 0.85rem; line-height: 1.5; color: var(--text-secondary); }

.btn-primary {
  padding: 0.95rem 2rem; background: #fff; color: #000;
  font-family: 'Outfit', sans-serif; font-size: 0.95rem; font-weight: 700; letter-spacing: 0.04em;
  border: none; border-radius: 16px; cursor: pointer; transition: all 0.3s;
}
.btn-primary:hover:not(:disabled) { background: #e2e8f0; transform: translateY(-2px); box-shadow: 0 10px 25px rgba(255,255,255,0.2); }
.btn-primary:disabled { opacity: 0.55; cursor: not-allowed; }

/* ================= FEED ================= */
.title-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 2rem; border-bottom: 1px solid var(--glass-border); padding-bottom: 1rem; }
.group-title { font-family: 'Outfit', sans-serif; font-size: 1.4rem; font-weight: 700; color: #fff; letter-spacing: 0.05em; text-transform: uppercase; }
.count-badge { padding: 0.3rem 0.8rem; background: var(--glass-bg); border: 1px solid var(--glass-border); border-radius: 100px; font-size: 0.85rem; color: var(--text-secondary); }

.feed-list { display: flex; flex-direction: column; gap: 1.1rem; }
.card {
  padding: 1.4rem 1.5rem; background: var(--glass-bg); backdrop-filter: blur(10px);
  border: 1px solid var(--glass-border); border-left: 3px solid var(--accent); border-radius: 20px;
  display: flex; flex-direction: column; gap: 0.9rem; transition: all 0.3s;
}
.card:hover { background: rgba(30, 40, 60, 0.6); border-color: var(--accent); transform: translateX(6px); box-shadow: 0 10px 25px rgba(0,0,0,0.4); }

.card-head { display: flex; align-items: center; gap: 0.8rem; }
.avatar {
  width: 38px; height: 38px; border-radius: 12px; flex-shrink: 0; display: grid; place-items: center;
  font-family: 'Outfit', sans-serif; font-weight: 700; color: #fff;
  background: linear-gradient(135deg, var(--accent), #0f172a);
}
.who { min-width: 0; }
.who-name { font-family: 'Outfit', sans-serif; font-size: 1rem; font-weight: 600; color: #fff; overflow-wrap: anywhere; }
.who-time { font-size: 0.78rem; color: var(--text-secondary); }
.card-text { font-size: 1.05rem; line-height: 1.7; color: #e2e8f0; white-space: pre-line; overflow-wrap: anywhere; }

.more-wrap { display: flex; justify-content: center; margin-top: 1.5rem; }
.more-btn {
  padding: 0.8rem 2rem; background: var(--glass-bg); backdrop-filter: blur(10px);
  border: 1px solid var(--glass-border); border-radius: 100px;
  color: #fff; font-family: 'Outfit', sans-serif; font-size: 0.95rem; font-weight: 600;
  cursor: pointer; transition: all 0.2s;
}
.more-btn:hover { background: rgba(255,255,255,0.1); }

/* ================= STATES ================= */
.loading-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4rem 0; gap: 1rem; color: var(--text-secondary); }
.spinner { width: 40px; height: 40px; border: 4px solid rgba(255,255,255,0.1); border-top-color: #3b82f6; border-radius: 50%; animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.state-box { padding: 4rem 0; display: flex; flex-direction: column; align-items: center; gap: 1rem; color: var(--text-secondary); text-align: center; }
.state-icon { width: 48px; height: 48px; border-radius: 50%; border: 2px solid var(--text-secondary); display: grid; place-items: center; font-size: 1.5rem; font-weight: 700; }

/* ================= NOTIFIKASI ================= */
.notice {
  position: fixed; bottom: 1.5rem; left: 50%; transform: translateX(-50%); z-index: 9999;
  padding: 0.9rem 1.5rem; background: #fff; color: #000; border-radius: 100px;
  font-family: 'Outfit', sans-serif; font-weight: 600; font-size: 0.95rem; box-shadow: 0 15px 40px rgba(0,0,0,0.5);
}
.pop-enter-active, .pop-leave-active { transition: opacity 0.3s, transform 0.3s; }
.pop-enter-from, .pop-leave-to { opacity: 0; transform: translateX(-50%) translateY(15px); }

/* ================= KEYFRAMES ================= */
@keyframes float { 0% { transform: translate(0, 0) scale(1); } 100% { transform: translate(30px, 30px) scale(1.1); } }

/* ================= RESPONSIVE ================= */
@media (max-width: 560px) {
  .title { font-size: 2.2rem; }
  .compose { padding: 1.1rem; }
  .compose-foot { flex-direction: column; align-items: stretch; }
  .btn-primary { width: 100%; }
}
@media (prefers-reduced-motion: reduce) {
  .aurora-blob, .spinner { animation: none; }
}
</style>