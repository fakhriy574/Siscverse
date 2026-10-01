<!-- components/KongMascot.vue (ganti isi file Kong yang lama dengan ini) -->
<script setup>
import { ref, reactive, computed, nextTick, watch, onMounted, onBeforeUnmount } from 'vue'

const route = useRoute()
const supabase = useSupabaseClient()

/* =====================================================================
   PENGATURAN
   Semua data jadwal, kas, anggota, dan menfess dibaca LANGSUNG dari Supabase.
   Kalau nama kolom di tabelmu beda, cukup tambahkan nama kolomnya ke daftar ini.
   ===================================================================== */
const KONG_FACES = 'right' // ganti ke 'left' kalau gambar kong.png aslinya menghadap kiri
const NAME_KEYS = ['name', 'full_name', 'fullname', 'nama', 'nama_lengkap', 'display_name', 'nickname']
const ROLE_KEYS = ['role', 'position', 'jabatan', 'peran', 'structure_role', 'title']
const DESC_KEYS = ['description', 'note', 'notes', 'title', 'keterangan', 'category', 'label', 'name']
const ROOM_KEYS = ['room', 'location', 'ruang', 'ruangan']
const WHO_KEYS = ['lecturer', 'teacher', 'dosen', 'guru', 'instructor']

// Aturan main sama dengan yang tampil di halaman beranda
const RULES = [
  ['Saling menghargai', 'Boleh beda pendapat, tidak boleh merendahkan.'],
  ['Anonim bukan tanpa etika', 'Menfess tidak dipakai untuk menyerang atau membuka aib orang.'],
  ['Jaga privasi anggota', 'Data di arsip hanya untuk keperluan kelas.'],
  ['Bayar kas tepat waktu', 'Catatan iuran terbuka supaya adil untuk semua.'],
  ['Laporkan yang janggal', 'Ada info keliru di arsip? Sampaikan ke pengurus.']
]

/* =====================================================================
   DATA LIVE DARI SUPABASE
   null = gagal dimuat. Tiap tabel gagal sendiri-sendiri.
   ===================================================================== */
const db = reactive({ members: null, memberCount: null, schedules: null, kas: null, menfess: null, menfessCount: null, loadedAt: 0 })
let loadingP = null

const safe = async (p) => { try { return await p } catch (e) { return { error: e } } }
const pick = (o, keys) => {
  for (const k of keys) { const v = o?.[k]; if (v !== null && v !== undefined && String(v).trim() !== '') return String(v).trim() }
  return ''
}

function load() {
  if (loadingP) return loadingP
  loadingP = (async () => {
    const [m, s, k, f] = await Promise.all([
      safe(supabase.from('members').select('*', { count: 'exact' })),
      safe(supabase.from('schedules').select('*').order('start_time', { ascending: true })),
      safe(supabase.from('kas_transactions').select('*').order('transaction_date', { ascending: false }).order('created_at', { ascending: false })),
      safe(supabase.from('menfess').select('message, created_at', { count: 'exact' }).order('created_at', { ascending: false }).limit(3))
    ])
    for (const [n, r] of [['members', m], ['schedules', s], ['kas', k], ['menfess', f]]) if (r.error) console.error(`[kong] ${n} gagal:`, r.error)
    // Dari anggota hanya nama dan peran yang disimpan di memori; kolom lain (kontak, dll) dibuang.
    db.members = m.error ? null : (m.data || []).map((r) => ({ name: pick(r, NAME_KEYS), role: pick(r, ROLE_KEYS) })).filter((x) => x.name)
    db.memberCount = m.error ? null : (m.count ?? (m.data || []).length)
    db.schedules = s.error ? null : (s.data || [])
    db.kas = k.error ? null : (k.data || []).map((r) => ({
      type: r.transaction_type, amount: Number(r.amount) || 0, date: String(r.transaction_date || r.created_at || '').slice(0, 10), desc: pick(r, DESC_KEYS)
    }))
    // Pengirim menfess sengaja tidak dibaca: pesannya anonim.
    db.menfess = f.error ? null : (f.data || [])
    db.menfessCount = f.error ? null : (f.count ?? (f.data || []).length)
    db.loadedAt = Date.now()
  })().finally(() => { loadingP = null })
  return loadingP
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const ensureData = () => (!db.loadedAt || Date.now() - db.loadedAt > 45000 ? Promise.race([load(), sleep(4000)]) : Promise.resolve())

/* =====================================================================
   HELPER
   ===================================================================== */
const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
const DAYS_LC = DAYS.map((d) => d.toLowerCase())
const DAY_EN = { SUNDAY: 0, MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4, FRIDAY: 5, SATURDAY: 6 }
const WK = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
const dayIdx = (v) => {
  const u = String(v || '').toUpperCase()
  if (u in DAY_EN) return DAY_EN[u]
  const i = DAYS.findIndex((d) => d.toUpperCase() === u)
  return i >= 0 ? i : null
}
const rp = (n) => (n < 0 ? '-' : '') + 'Rp ' + Math.abs(n).toLocaleString('id-ID')
const hhmm = (t) => String(t || '').slice(0, 5)
const toMin = (t) => { const [h, m] = hhmm(t).split(':').map(Number); return h * 60 + m }
const isTime = (v) => /^\d{1,2}:\d{2}/.test(String(v || ''))
const fmtDate = (v) => {
  const s = String(v).slice(0, 10), d = new Date(s + 'T00:00:00')
  return isNaN(d) ? s : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}
const trunc = (t, n = 110) => { const s = String(t || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n).trimEnd() + '...' : s }
const ago = (iso) => {
  const s = Math.max(0, (Date.now() - new Date(iso)) / 1000)
  if (s < 60) return 'baru saja'
  if (s < 3600) return `${Math.floor(s / 60)} menit lalu`
  if (s < 86400) return `${Math.floor(s / 3600)} jam lalu`
  if (s < 604800) return `${Math.floor(s / 86400)} hari lalu`
  return fmtDate(iso)
}
const countdown = (m) => { const h = Math.floor(m / 60), mm = m % 60; return h ? `${h} jam${mm ? ` ${mm} menit` : ''}` : `${mm} menit` }

// Waktu sekarang di WIB
function wib() {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
      .formatToParts(new Date()).map((x) => [x.type, x.value])
  )
  const hour = Number(p.hour) % 24
  return { day: WK[p.weekday], minutes: hour * 60 + Number(p.minute), hour, date: `${p.year}-${p.month}-${p.day}`, ym: `${p.year}-${p.month}`, hm: `${String(hour).padStart(2, '0')}:${p.minute}` }
}

function lev(a, b) {
  if (Math.abs(a.length - b.length) > 1) return 2
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i])
  for (let j = 1; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return dp[a.length][b.length]
}
const SLANG = { jdwl: 'jadwal', jadwl: 'jadwal', brp: 'berapa', bsk: 'besok', udh: 'sudah', gmn: 'bagaimana', gimana: 'bagaimana', gmna: 'bagaimana', mksh: 'makasih', trims: 'makasih', kls: 'kelas', sldo: 'saldo', sp: 'siapa', siapakah: 'siapa', kpn: 'kapan', skrg: 'sekarang', hrini: 'hari ini', mpel: 'mapel', matakuliah: 'matkul' }
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
  .split(' ').map((w) => SLANG[w] || w).join(' ')
const has = (t, ...ws) => ws.some((w) => new RegExp(`\\b${w}\\b`).test(t))
const STOP = new Set(['yang', 'dan', 'di', 'ke', 'dari', 'itu', 'ini', 'apa', 'siapa', 'kapan', 'jam', 'berapa', 'ada', 'kah', 'dong', 'sih', 'deh', 'nih', 'ya', 'tuh', 'kok', 'mau', 'tolong', 'kong', 'bisa', 'saya', 'aku', 'kamu', 'untuk', 'dengan', 'atau', 'pada', 'hari', 'kelas', 'jadwal', 'mapel', 'matkul', 'pelajaran', 'kuliah', 'besok', 'sekarang', 'lusa', 'kemarin', 'minggu', 'pekan', 'lagi', 'sudah', 'belum', 'saja', 'aja', 'cuma', 'terakhir', 'terbaru', 'kas', 'saldo', 'menfess', 'anggota', 'orang', 'nama', 'tentang', 'soal', 'info', 'cek', 'lihat', 'kasih', 'tahu', 'tau', 'dimana', 'mana', 'berikutnya', 'selanjutnya', 'tidak', 'nggak', 'gak', 'teman', 'semua', 'sama', 'juga', 'kalau', 'kalo', 'terus', 'lalu', 'masuk', 'ruang'])
const contentTokens = (t) => t.split(' ').filter((w) => w.length >= 3 && !STOP.has(w) && !DAYS_LC.includes(w))

/* =====================================================================
   DATA TURUNAN
   ===================================================================== */
const sched = computed(() =>
  (db.schedules || []).map((s) => {
    const d = dayIdx(s.day_of_week), mapel = String(s.subject || '').trim()
    if (d === null || !isTime(s.start_time) || !mapel) return null
    const end = isTime(s.end_time) ? hhmm(s.end_time) : ''
    const n = norm(mapel)
    return { d, hari: DAYS[d], jam: hhmm(s.start_time), min: toMin(s.start_time), end, endMin: end ? toMin(end) : null, mapel, norm: n, words: n.split(' ').filter(Boolean), room: pick(s, ROOM_KEYS), who: pick(s, WHO_KEYS) }
  }).filter(Boolean).sort((a, b) => a.d - b.d || a.min - b.min)
)
const fmtC = (c) => `${c.mapel}, ${c.jam}${c.end ? '–' + c.end : ''} WIB${c.room ? ', ' + c.room : ''}${c.who ? ' (' + c.who + ')' : ''}`
const whenLabel = (c, diff) => (diff === 0 ? 'hari ini' : diff === 1 ? 'besok' : diff === 7 ? `${c.hari} depan` : `hari ${c.hari}`)
const diffOf = (c, now) => { let diff = (c.d - now.day + 7) % 7; if (diff === 0 && c.min <= now.minutes) diff = 7; return diff }
function nextClass(now, list = sched.value) {
  if (!list.length) return null
  return list.map((c) => { const diff = diffOf(c, now); return { c, diff, order: diff * 1440 + c.min } }).sort((a, b) => a.order - b.order)[0]
}
const currentClass = (now) => sched.value.find((c) => c.d === now.day && c.endMin !== null && c.min <= now.minutes && now.minutes < c.endMin)
function nextText(now) {
  const n = nextClass(now)
  if (!n) return ''
  return `${n.c.mapel}, ${whenLabel(n.c, n.diff)} pukul ${n.c.jam} WIB${n.diff === 0 ? ` (dalam ${countdown(n.c.min - now.minutes)})` : ''}`
}
function daySchedule(d, label, now) {
  const cs = sched.value.filter((c) => c.d === d)
  if (!cs.length) return `Tidak ada kelas ${label} (${DAYS[d]}).`
  const today = label === 'hari ini'
  const lines = cs.map((c) => {
    let tag = ''
    if (today) {
      if (c.endMin !== null && now.minutes >= c.min && now.minutes < c.endMin) tag = ' (sedang berlangsung)'
      else if (c.endMin !== null ? now.minutes >= c.endMin : now.minutes > c.min) tag = ' (sudah lewat)'
    }
    return `• ${fmtC(c)}${tag}`
  })
  return `Kelas ${label} (${DAYS[d]}):\n${lines.join('\n')}`
}
function parseDay(t, now) {
  const off = (n, label) => ({ d: (now.day + n + 7) % 7, label })
  if (/\blusa\b/.test(t)) return off(2, 'lusa')
  if (/\bbesok\b/.test(t)) return off(1, 'besok')
  if (/\bkemarin\b/.test(t)) return off(-1, 'kemarin')
  if (/\bhari ini\b|\bsekarang\b/.test(t) && !/jam berapa|hari apa/.test(t)) return off(0, 'hari ini')
  for (let i = 0; i < 7; i++) {
    const w = DAYS_LC[i]
    if (i === 0 ? /\bminggu\b(?! (ini|depan|lalu))/.test(t) : new RegExp(`\\b${w}\\b`).test(t)) return { d: i, label: `hari ${DAYS[i]}` }
  }
  return null
}
function findSubject(t) {
  const toks = contentTokens(t)
  if (!toks.length || !sched.value.length) return null
  let best = null, bestScore = 0
  for (const c of sched.value) {
    const initials = c.words.map((w) => w[0]).join('')
    let score = t.includes(c.norm) ? 5 : 0
    for (const tk of toks) {
      if (c.words.includes(tk)) score += 3
      else if (tk.length >= 4 && c.words.some((w) => w.length >= 4 && (w.startsWith(tk) || tk.startsWith(w)))) score += 2
      else if (tk.length >= 5 && c.words.some((w) => lev(w, tk) <= 1)) score += 2
      else if (tk.length >= 2 && tk === initials) score += 3
    }
    if (score > bestScore) { best = c; bestScore = score }
  }
  return bestScore >= 2 ? sched.value.filter((c) => c.norm === best.norm) : null
}

function kasSummary(now) {
  const rows = db.kas || []
  const sign = (r) => (r.type === 'INCOME' ? r.amount : -r.amount)
  const sum = (arr, ty) => arr.filter((r) => r.type === ty).reduce((s, r) => s + r.amount, 0)
  const month = rows.filter((r) => r.date.startsWith(now.ym))
  const lastDate = rows[0]?.date
  const lastDay = lastDate ? rows.filter((r) => r.date === lastDate) : []
  return {
    rows, balance: rows.reduce((s, r) => s + sign(r), 0), income: sum(rows, 'INCOME'), expense: sum(rows, 'EXPENSE'),
    monthIn: sum(month, 'INCOME'), monthOut: sum(month, 'EXPENSE'), lastDate, lastNet: lastDay.reduce((s, r) => s + sign(r), 0), sign
  }
}
const kasLine = (r) => `• ${fmtDate(r.date)}: ${r.type === 'INCOME' ? '+' : '-'}${rp(r.amount)}${r.desc ? ` (${trunc(r.desc, 40)})` : ''}`

function findMembers(t) {
  const list = db.members || []
  const toks = contentTokens(t)
  if (!toks.length || !list.length) return []
  const hits = []
  for (const m of list) {
    const nw = norm(m.name).split(' '), rn = norm(m.role)
    let sc = 0, strong = false
    for (const tk of toks) {
      if (nw.includes(tk)) { sc += 3; strong = true }
      else if (tk.length >= 4 && nw.some((w) => w.startsWith(tk) || (tk.length >= 5 && lev(w, tk) <= 1))) sc += 2
      if (rn && tk.length >= 4 && rn.includes(tk)) { sc += 3; strong = true }
    }
    if (sc >= 2) hits.push({ m, sc, strong })
  }
  return hits.sort((a, b) => b.sc - a.sc).slice(0, 6)
}
const fmtM = (m) => `• ${m.name}${m.role ? ' (' + m.role + ')' : ''}`

/* =====================================================================
   OTAK KONG
   ===================================================================== */
const DEFAULT_CHIPS = ['Jadwal hari ini', 'Kelas berikutnya', 'Saldo kas', 'Cara kirim menfess', 'Aturan main']
let ctx = { intent: '' }

function answer(raw) {
  const t = norm(raw), now = wib(), words = t ? t.split(' ').length : 0
  const R = (text, o = {}) => ({ text, ...o })
  const fail = (what, link, label) => R(`Kong belum bisa membaca data ${what} dari server sekarang. Coba lagi sebentar ya.`, { link, label })
  if (!t) return R('Ketik pertanyaanmu dulu ya. 🙂')

  /* sapaan dan umum */
  if (has(t, 'makasih', 'thanks', 'thx', 'thank', 'mantap') || /terima ?kasih/.test(t)) return R('Sama-sama! Kalau ada lagi, tanya aja ya. 🐒', { suggest: DEFAULT_CHIPS })
  if (words <= 4 && has(t, 'halo', 'hai', 'hi', 'hello', 'hallo', 'pagi', 'siang', 'sore', 'malam', 'assalamualaikum', 'p')) {
    const part = now.hour < 11 ? 'pagi' : now.hour < 15 ? 'siang' : now.hour < 18 ? 'sore' : 'malam'
    return R(`Selamat ${part}! Mau tanya jadwal, kas, menfess, anggota, atau aturan main? 🌸`, { suggest: DEFAULT_CHIPS })
  }
  if (/(siapa|apa) (kamu|kong)|kamu (siapa|apa)|nama kamu|kong itu/.test(t))
    return R('Aku Kong, penjaga Siscverse. Aku bukan AI serba tahu: aku membaca data kelas langsung dari arsip (jadwal, kas, anggota, menfess) dan menjawab dari situ. Di luar itu, aku jujur bilang nggak tahu.')
  if (has(t, 'bantu', 'help', 'menu', 'fitur') || /bisa (apa|ngapain)/.test(t))
    return R('Aku bisa jawab soal:\n• Jadwal: hari ini, besok, hari tertentu, per mata kuliah, kelas berikutnya, hari kosong\n• Kas: saldo, pemasukan, pengeluaran, transaksi terakhir\n• Anggota: jumlah, cari nama, siapa ketua/bendahara\n• Menfess: cara kirim dan pesan terbaru\n• Aturan main', { suggest: DEFAULT_CHIPS })
  if (/jam berapa (sekarang|ini)|sekarang jam|hari apa|tanggal berapa|tanggal (hari ini|sekarang)/.test(t)) {
    const d = new Date()
    return R(`Sekarang ${d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' })}, pukul ${now.hm} WIB.`)
  }
  if (has(t, 'tugas', 'pr', 'deadline', 'ujian', 'uts', 'uas', 'ulangan', 'kuis', 'quiz'))
    return R('Soal tugas dan ujian, Kong belum punya datanya, jadi nggak mau asal jawab. Cek grup kelas atau tanya pengurus ya.')
  if (has(t, 'joke', 'lucu', 'lawak', 'bercanda') || /tebak.?tebakan/.test(t))
    return R(['Kenapa komputer nggak pernah kedinginan? Karena banyak Windows-nya. 😄', 'Kenapa programmer suka gelap? Karena light attracts bugs. 🐛', 'Apa bedanya kamu dan deadline? Deadline pasti datang. 😅'][Math.floor(Math.random() * 3)])
  if (has(t, 'semangat', 'motivasi', 'putus asa', 'nyerah')) return R('Pelan-pelan juga nggak apa-apa, yang penting jalan terus. Kamu sudah sampai sejauh ini, lho. 💪')

  /* anggota: siapa X / siapa ketua */
  const memberHits = findMembers(t)
  const asksWho = /\b(siapa|nama|kenal|profil)\b/.test(t)
  const asksCount = /berapa (orang|anggota|siswa|murid|teman|mahasiswa)|jumlah (orang|anggota|siswa|murid|mahasiswa)|ada berapa (orang|anggota)|total anggota/.test(t)
  if (asksCount || (has(t, 'anggota', 'struktur', 'pengurus') && !memberHits.length)) {
    if (db.memberCount === null) return fail('anggota', '/structure', 'Buka Anggota')
    return R(`Ada ${db.memberCount} orang di kelas ini. Nama, foto, dan perannya lengkap di halaman Anggota.`, { link: '/structure', label: 'Buka Anggota', intent: 'anggota', suggest: ['Siapa ketua kelas?', 'Jadwal hari ini', 'Saldo kas'] })
  }
  if (asksWho && memberHits.length) {
    const hs = memberHits.map((h) => h.m)
    return R(hs.length === 1 ? `${fmtM(hs[0]).slice(2)}. Profil lengkapnya ada di halaman Anggota.` : `Yang cocok:\n${hs.map(fmtM).join('\n')}`, { link: '/structure', label: 'Buka Anggota', intent: 'anggota' })
  }
  if (asksWho && !has(t, 'kamu', 'kong') && db.members !== null && !db.members.some((m) => m.role) && /ketua|sekretaris|bendahara|wakil|wali/.test(t))
    return R('Data peran belum terbaca dari arsip anggota. Lihat langsung di halaman Anggota ya.', { link: '/structure', label: 'Buka Anggota' })

  /* kas */
  if (has(t, 'kas', 'saldo', 'iuran', 'bendahara', 'uang', 'dana', 'pemasukan', 'pengeluaran', 'transaksi', 'mutasi')) {
    if (has(t, 'bayar', 'lunas', 'nunggak', 'cicil', 'transfer', 'setor'))
      return R('Catatan iuran ada di halaman Kas. Cara dan waktu bayarnya, tanya langsung ke bendahara kelas ya.', { link: '/kas', label: 'Buka Kas', intent: 'kas' })
    if (db.kas === null) return fail('kas', '/kas', 'Buka Kas')
    const k = kasSummary(now)
    const o = { link: '/kas', label: 'Buka Kas', intent: 'kas', suggest: ['Transaksi terakhir', 'Total pengeluaran', 'Total pemasukan', 'Jadwal hari ini'] }
    if (!k.rows.length) return R('Belum ada catatan kas.', o)
    if (/riwayat|transaksi|mutasi|terakhir|history|catatan/.test(t)) return R(`${Math.min(5, k.rows.length)} transaksi terakhir:\n${k.rows.slice(0, 5).map(kasLine).join('\n')}\n\nSaldo sekarang ${rp(k.balance)}.`, o)
    if (/pemasukan|masuk|income|iuran masuk/.test(t)) return R(`Total pemasukan ${rp(k.income)}. Bulan ini ${rp(k.monthIn)}.`, o)
    if (/pengeluaran|keluar|expense|belanja|habis|dipakai/.test(t)) return R(`Total pengeluaran ${rp(k.expense)}. Bulan ini ${rp(k.monthOut)}.`, o)
    const note = k.lastDate === now.date ? (k.lastNet > 0 ? ` Naik ${rp(k.lastNet)} hari ini.` : k.lastNet < 0 ? ` Turun ${rp(-k.lastNet)} hari ini.` : ' Tidak berubah hari ini.') : ` Terakhir diperbarui ${fmtDate(k.lastDate)}.`
    return R(`Saldo kas sekarang ${rp(k.balance)}.${note}`, o)
  }

  /* menfess */
  if (has(t, 'menfess', 'anonim', 'anonymous', 'confess', 'curhat') || /kirim pesan|pesan anonim/.test(t)) {
    const o = { link: '/menfess', label: 'Buka Menfess', intent: 'menfess', suggest: ['Menfess terbaru', 'Aturan main', 'Jadwal hari ini'] }
    if (/terbaru|terakhir|isi|pesan apa|ada apa|lihat|baca|baru/.test(t) && !/kirim|cara|gimana|bagaimana/.test(t)) {
      if (db.menfess === null) return fail('menfess', '/menfess', 'Buka Menfess')
      if (!db.menfess.length) return R('Belum ada menfess yang masuk.', o)
      return R(`Menfess terbaru (dari ${db.menfessCount} pesan):\n${db.menfess.map((f) => `• "${trunc(f.message)}" (${ago(f.created_at)})`).join('\n')}`, o)
    }
    return R('Menfess itu pesan tanpa nama. Buka halaman Menfess, tulis pesanmu, lalu kirim. Ingat aturannya: jangan dipakai untuk menyerang atau membuka aib orang.', o)
  }

  /* aturan */
  if (has(t, 'aturan', 'peraturan', 'larangan', 'etika', 'kesepakatan', 'rules'))
    return R('Aturan mainnya:\n' + RULES.map(([a, b], i) => `${i + 1}. ${a}: ${b}`).join('\n'), { intent: 'aturan' })

  /* jadwal */
  const dayE = parseDay(t, now)
  const subj = findSubject(t)
  const askSchedule = has(t, 'jadwal', 'kelas', 'pelajaran', 'matkul', 'mapel', 'kuliah', 'belajar', 'masuk') || /ada apa|apa saja|jam berapa/.test(t)
  const follow = ctx.intent === 'jadwal' && words <= 5 && (dayE || subj || has(t, 'berikutnya', 'selanjutnya', 'pekan', 'minggu'))
  if (askSchedule || subj || follow || (dayE && words <= 3)) {
    if (db.schedules === null) return fail('jadwal', '/schedule', 'Buka Jadwal')
    if (!sched.value.length) return R('Belum ada jadwal yang tercatat di arsip.', { link: '/schedule', label: 'Buka Jadwal', intent: 'jadwal' })
    const o = { link: '/schedule', label: 'Buka Jadwal', intent: 'jadwal', suggest: ['Besok', 'Kelas berikutnya', 'Jadwal pekan ini', 'Hari apa yang kosong?'] }
    if (/minggu (ini|depan)|pekan|seminggu|semua jadwal|jadwal lengkap/.test(t))
      return R('Jadwal pekan ini:\n' + [1, 2, 3, 4, 5, 6, 0].filter((d) => sched.value.some((c) => c.d === d)).map((d) => `${DAYS[d]}: ${sched.value.filter((c) => c.d === d).map((c) => `${c.mapel} ${c.jam}`).join(', ')}`).join('\n'), o)
    if (has(t, 'libur', 'kosong', 'free') || /tidak ada kelas/.test(t)) {
      const free = [1, 2, 3, 4, 5].filter((d) => !sched.value.some((c) => c.d === d)).map((d) => DAYS[d])
      return R(free.length ? `Hari tanpa kelas (Senin–Jumat): ${free.join(', ')}.` : 'Setiap hari Senin–Jumat ada kelas di jadwal.', o)
    }
    if (/berapa (kelas|sesi|mapel|matkul)|jumlah (kelas|sesi|mapel|matkul)/.test(t))
      return R(`Ada ${sched.value.length} sesi kelas per pekan, dari ${new Set(sched.value.map((c) => c.norm)).size} mata kuliah.`, o)
    if (has(t, 'sedang', 'lagi') || /saat ini/.test(t) || (has(t, 'sekarang') && askSchedule)) {
      const cur = currentClass(now)
      return R(cur ? `Yang sedang berlangsung: ${fmtC(cur)}.` : `Tidak ada kelas yang sedang berlangsung. Berikutnya: ${nextText(now)}.`, o)
    }
    if (has(t, 'berikutnya', 'selanjutnya', 'next') || /habis ini/.test(t)) return R(`Kelas berikutnya: ${nextText(now)}.`, o)
    if (subj) {
      const n = nextClass(now, subj)
      const sessions = subj.map((c) => `${c.hari} ${c.jam}${c.end ? '–' + c.end : ''}`).join(' dan ')
      return R(`${subj[0].mapel}: ${sessions} WIB${subj[0].room ? ', ' + subj[0].room : ''}${subj[0].who ? ' (' + subj[0].who + ')' : ''}. Pertemuan berikutnya ${whenLabel(n.c, n.diff)}${n.diff === 0 ? ` (dalam ${countdown(n.c.min - now.minutes)})` : ''}.`, o)
    }
    if (dayE) {
      let txt = daySchedule(dayE.d, dayE.label, now)
      if (dayE.label === 'hari ini' && !sched.value.some((c) => c.d === now.day)) txt += ` Berikutnya: ${nextText(now)}.`
      return R(txt, o)
    }
    return R(`Kelas berikutnya: ${nextText(now)}. Mau lihat hari tertentu? Sebut aja harinya.`, o)
  }

  /* anggota (nama saja) */
  const strongMember = memberHits.filter((h) => h.strong)
  if (strongMember.length) {
    const hs = strongMember.map((h) => h.m)
    return R(hs.length === 1 ? `${fmtM(hs[0]).slice(2)}. Profil lengkapnya ada di halaman Anggota.` : `Yang cocok:\n${hs.map(fmtM).join('\n')}`, { link: '/structure', label: 'Buka Anggota', intent: 'anggota' })
  }

  /* curhat dan keluhan */
  if (has(t, 'capek', 'lelah', 'stres', 'stress', 'sedih', 'galau', 'bosan', 'males', 'malas', 'pusing'))
    return R('Wajar kok kalau lagi capek. Tarik napas dulu, minum air. Kalau mau cerita tanpa nama, halaman Menfess terbuka untuk itu. 🌱', { link: '/menfess', label: 'Buka Menfess' })
  if (has(t, 'rusak', 'keluhan', 'lapor', 'laporan', 'ac', 'kotor'))
    return R('Kalau ada info keliru di arsip, sampaikan ke pengurus. Kalau keluhan soal fasilitas dan kamu ragu menyebut nama, bisa lewat Menfess (tetap sopan ya).', { link: '/menfess', label: 'Buka Menfess' })

  return R('Hmm, itu di luar yang Kong tahu, dan aku nggak mau asal jawab. Coba tanya soal jadwal, kas, menfess, anggota, atau aturan main.', { suggest: DEFAULT_CHIPS })
}

/* =====================================================================
   CHAT
   ===================================================================== */
const greeting = () => [{ sender: 'kong', text: 'Halo! Aku Kong, penjaga Siscverse. Tanya soal jadwal, kas, menfess, anggota, atau aturan main ya. Aku bisa diajak ngobrol sambil jalan juga. 🐒' }]
const chatOpen = ref(false)
const panelVisible = ref(false)
const userInput = ref('')
const typing = ref(false)
const chatBox = ref(null)
const inputEl = ref(null)
const messages = ref(greeting())
const chips = ref(DEFAULT_CHIPS)

const clamp = (v, a, b) => Math.min(Math.max(v, a), b)
const rand = (a, b) => a + Math.random() * (b - a)
const scrollToBottom = () => nextTick(() => { if (chatBox.value) chatBox.value.scrollTop = chatBox.value.scrollHeight })
watch(() => messages.value.length, scrollToBottom)
watch(typing, scrollToBottom)

async function ask(raw) {
  const text = raw.trim()
  if (!text || typing.value) return
  messages.value.push({ sender: 'user', text })
  userInput.value = ''
  typing.value = true
  const started = Date.now()
  await ensureData()
  const res = answer(text)
  if (res.intent) ctx.intent = res.intent
  const wait = clamp(350 + res.text.length * 5, 500, 1300) - (Date.now() - started)
  if (wait > 0) await sleep(wait)
  typing.value = false
  messages.value.push({ sender: 'kong', ...res })
  chips.value = res.suggest || DEFAULT_CHIPS
  nextTick(() => inputEl.value?.focus())
}
const sendMessage = () => ask(userInput.value)
function clearChat() { messages.value = greeting(); ctx = { intent: '' }; chips.value = DEFAULT_CHIPS }

/* =====================================================================
   GERAK KONG
   ===================================================================== */
const M = 16
const vw = ref(1024), vh = ref(768)
const size = computed(() => (vw.value >= 768 ? 128 : 96))
const maxX = () => Math.max(M, vw.value - size.value - M)
const el = ref(null)
const x = ref(0), lift = ref(0), dur = ref(0), facing = ref(1)
const ready = ref(false), walking = ref(false), dragging = ref(false), dropping = ref(false)
const tip = ref('')
let reduced = false, wanderTimer, tipTimer, hideTimer, refreshTimer, drag = null, walkId = 0

function walkTo(target) {
  const t = clamp(target, M, maxX())
  const dist = Math.abs(t - x.value)
  if (dist < 4) return Promise.resolve(true)
  const id = ++walkId
  facing.value = t > x.value ? 1 : -1
  dur.value = Math.round(dist / 0.09) // sekitar 90px per detik
  walking.value = true
  x.value = t
  return new Promise((res) => setTimeout(() => { if (id === walkId) walking.value = false; res(id === walkId) }, dur.value))
}
// berhenti seketika di posisi sekarang (dipakai saat diklik atau diseret sambil jalan)
function freeze() {
  walkId++
  if (el.value) x.value = clamp(el.value.getBoundingClientRect().left, 0, vw.value - size.value)
  dur.value = 0
  walking.value = false
}
function scheduleWander(delay = rand(4500, 9000)) {
  clearTimeout(wanderTimer)
  if (reduced) return
  wanderTimer = setTimeout(async () => {
    if (document.hidden || chatOpen.value || dragging.value || tip.value) return scheduleWander()
    let t = rand(M, maxX())
    if (Math.abs(t - x.value) < 100) t = x.value < vw.value / 2 ? x.value + rand(160, 320) : x.value - rand(160, 320)
    if (await walkTo(t)) scheduleWander()
  }, delay)
}

/* chat bisa dibuka kapan saja, termasuk saat Kong sedang berjalan: dia langsung berhenti dan menjawab */
watch(chatOpen, async (v) => {
  if (!v) { panelVisible.value = false; scheduleWander(3000); return }
  tip.value = ''
  clearTimeout(wanderTimer); clearTimeout(hideTimer)
  freeze()
  panelVisible.value = true
  ensureData()
  await nextTick()
  inputEl.value?.focus()
  scrollToBottom()
})
const toggleChat = () => { chatOpen.value = !chatOpen.value }

/* seret Kong ke mana saja; dilepas, dia jatuh ke bawah dengan memantul */
function onDown(e) {
  if (e.button > 0) return
  const r = e.currentTarget.getBoundingClientRect()
  freeze()
  clearTimeout(wanderTimer)
  drag = { sx: e.clientX, sy: e.clientY, ox: r.left, ol: lift.value, moved: false }
  e.currentTarget.setPointerCapture(e.pointerId)
}
function onMove(e) {
  if (!drag) return
  const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy
  if (!drag.moved && Math.hypot(dx, dy) < 6) return
  drag.moved = true; dragging.value = true; tip.value = ''
  x.value = clamp(drag.ox + dx, 0, vw.value - size.value)
  lift.value = clamp(drag.ol - dy, 0, vh.value - size.value - 32)
}
function onUp() {
  if (!drag) return
  const moved = drag.moved
  drag = null
  if (!moved) { toggleChat(); return }
  dragging.value = false; dropping.value = true; lift.value = 0
  setTimeout(() => { dropping.value = false }, 650)
  showTip('Wuih, seru! Turunin aku pelan-pelan ya.', 3500)
  if (!chatOpen.value) scheduleWander(3500)
}

/* =====================================================================
   CELETUKAN KONG (pakai data asli)
   ===================================================================== */
function tipsFor(path) {
  const now = wib(), n = nextText(now)
  const kas = db.kas ? kasSummary(now) : null
  const map = {
    '/kas': [kas ? `Saldo kas sekarang ${rp(kas.balance)}. Sudah bayar iuran belum?` : 'Sudah bayar iuran belum?', 'Catatan kas terbuka buat semua, biar adil.'],
    '/menfess': ['Tulis aja, nggak perlu nama. Tapi tetap sopan ya!', 'Anonim bukan tanpa etika, lho.'],
    '/schedule': [n ? `Kelas berikutnya: ${n}.` : 'Cek jadwal biar nggak telat!', 'Cek jadwal biar nggak telat!'],
    '/structure': [db.memberCount ? `Ada ${db.memberCount} orang di sini. Sudah kenal semua?` : 'Sudah kenal semua?', 'Klik aku kalau mau tanya siapa-siapa.'],
    '/': [n ? `Kelas berikutnya: ${n}.` : 'Klik aku kalau mau nanya jadwal atau kas!', 'Klik aku kalau mau nanya jadwal atau kas!', 'Psst, ada yang mau disampaikan? Coba Menfess.']
  }
  const key = Object.keys(map).find((k) => k !== '/' && path.startsWith(k)) || '/'
  return map[key]
}
function showTip(text, ms = 5500) {
  if (chatOpen.value || dragging.value) return
  if (walking.value) { setTimeout(() => showTip(text, ms), 1500); return }
  tip.value = text
  clearTimeout(hideTimer)
  hideTimer = setTimeout(() => { tip.value = '' }, ms)
}
function tipLoop() {
  clearTimeout(tipTimer)
  tipTimer = setTimeout(() => {
    const list = tipsFor(route.path)
    showTip(list[Math.floor(Math.random() * list.length)])
    tipLoop()
  }, rand(30000, 50000))
}
watch(() => route.path, (p) => setTimeout(() => showTip(tipsFor(p)[0]), 1200))

/* posisi panel dan celetukan, dijaga tetap di dalam layar */
const panelW = computed(() => Math.min(320, vw.value - 16))
const bodyH = computed(() => clamp(vh.value - size.value - 290, 110, 260))
const alignRight = computed(() => x.value + size.value / 2 > vw.value / 2)
const panelLeft = computed(() => {
  const want = alignRight.value ? x.value + size.value - panelW.value : x.value
  return clamp(want, 8, vw.value - panelW.value - 8) - x.value
})
const tipLeft = computed(() => clamp(x.value + size.value / 2 - 95, 8, vw.value - 198) - x.value)
const flip = computed(() => (facing.value === (KONG_FACES === 'right' ? 1 : -1) ? 1 : -1))
const dataState = computed(() => (db.loadedAt ? 'Data live dari arsip kelas' : 'Memuat data...'))

function onResize() {
  vw.value = window.innerWidth; vh.value = window.innerHeight
  dur.value = 0
  x.value = clamp(x.value, M, maxX())
}
onMounted(() => {
  reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  onResize()
  x.value = maxX()
  window.addEventListener('resize', onResize)
  requestAnimationFrame(() => { ready.value = true })
  load()
  refreshTimer = setInterval(() => { if (!document.hidden) load() }, 120000)
  setTimeout(() => showTip('Halo! Aku Kong. Klik aku kalau butuh teman ngobrol.', 6000), 1500)
  scheduleWander(6000)
  tipLoop()
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  clearTimeout(wanderTimer); clearTimeout(tipTimer); clearTimeout(hideTimer); clearInterval(refreshTimer)
})
</script>

<template>
  <div
    ref="el"
    class="fixed left-0 bottom-4 z-50 pointer-events-none"
    :style="{
      width: size + 'px', height: size + 'px', opacity: ready ? 1 : 0,
      transform: `translate3d(${x}px, ${-lift}px, 0)`,
      transition: dragging ? 'none' : dropping ? 'transform .6s cubic-bezier(.3,1.35,.5,1)' : `transform ${dur}ms cubic-bezier(.45,.05,.55,.95), opacity .4s`
    }"
  >
    <!-- CELETUKAN -->
    <Transition enter-active-class="transition duration-200 ease-out" enter-from-class="opacity-0 translate-y-2" leave-active-class="transition duration-150" leave-to-class="opacity-0">
      <div v-if="tip && !panelVisible" class="absolute bottom-full mb-1 w-[190px] bg-white border-[3px] border-[#2D2D2D] rounded-2xl p-2.5 text-xs font-bold text-[#2D2D2D] shadow-[4px_4px_0px_#2D2D2D]"
        :class="alignRight ? 'rounded-br-none' : 'rounded-bl-none'" :style="{ left: tipLeft + 'px' }" role="status">
        {{ tip }}
      </div>
    </Transition>

    <!-- PANEL CHAT -->
    <Transition
      enter-active-class="transition duration-300 ease-out" enter-from-class="opacity-0 translate-y-6 scale-75" enter-to-class="opacity-100 translate-y-0 scale-100"
      leave-active-class="transition duration-200 ease-in" leave-from-class="opacity-100 scale-100" leave-to-class="opacity-0 translate-y-6 scale-75"
    >
      <div v-if="panelVisible" role="dialog" aria-label="Chat bareng Kong" @keydown.esc="chatOpen = false"
        class="pointer-events-auto absolute bottom-full mb-2 bg-white border-4 border-[#2D2D2D] rounded-[2rem] overflow-hidden shadow-[8px_8px_0px_#2D2D2D] flex flex-col"
        :class="alignRight ? 'rounded-br-none origin-bottom-right' : 'rounded-bl-none origin-bottom-left'"
        :style="{ width: panelW + 'px', left: panelLeft + 'px' }">

        <div class="bg-[#FFD166] px-4 py-3 flex items-center justify-between gap-2 border-b-4 border-[#2D2D2D]">
          <div class="min-w-0">
            <h3 class="font-black text-[#2D2D2D] text-lg uppercase leading-tight">Chat bareng Kong</h3>
            <p class="text-[10px] font-bold text-[#2D2D2D]/70 flex items-center gap-1">
              <span class="inline-block w-2 h-2 rounded-full border border-[#2D2D2D]" :class="db.loadedAt ? 'bg-[#95D5B2]' : 'bg-white animate-pulse'"></span>{{ dataState }}
            </p>
          </div>
          <div class="flex gap-1.5 shrink-0">
            <button type="button" aria-label="Bersihkan chat" title="Bersihkan chat" @click="clearChat"
              class="w-8 h-8 bg-white border-2 border-[#2D2D2D] rounded-full font-black text-[#2D2D2D] hover:bg-[#A0C4FF] transition-colors">↺</button>
            <button type="button" aria-label="Tutup chat" @click="chatOpen = false"
              class="w-8 h-8 bg-white border-2 border-[#2D2D2D] rounded-full font-black text-[#2D2D2D] hover:bg-[#FF85A1] hover:text-white transition-colors">X</button>
          </div>
        </div>

        <div ref="chatBox" role="log" aria-live="polite" class="p-4 overflow-y-auto flex flex-col gap-3 bg-[#FFFBF0]" :style="{ height: bodyH + 'px' }">
          <div v-for="(msg, i) in messages" :key="i"
            class="max-w-[88%] p-3 text-sm font-bold border-2 border-[#2D2D2D] whitespace-pre-line"
            :class="msg.sender === 'user' ? 'bg-[#A0C4FF] text-[#2D2D2D] self-end rounded-2xl rounded-tr-none' : 'bg-white text-[#2D2D2D] self-start rounded-2xl rounded-tl-none shadow-[2px_2px_0px_#2D2D2D]'">
            {{ msg.text }}
            <NuxtLink v-if="msg.link" :to="msg.link" @click="chatOpen = false"
              class="mt-2 block w-fit bg-[#95D5B2] border-2 border-[#2D2D2D] rounded-lg px-2.5 py-1 text-xs font-black shadow-[2px_2px_0px_#2D2D2D] hover:translate-y-0.5 hover:shadow-none transition-all">
              {{ msg.label }}
            </NuxtLink>
          </div>
          <div v-if="typing" class="self-start flex gap-1 bg-white border-2 border-[#2D2D2D] rounded-2xl rounded-tl-none px-3 py-3" aria-label="Kong sedang mengetik">
            <span v-for="d in 3" :key="d" class="w-2 h-2 rounded-full bg-[#2D2D2D] animate-bounce" :style="{ animationDelay: (d - 1) * 120 + 'ms' }"></span>
          </div>
        </div>

        <div class="px-3 pt-2 pb-1 bg-white border-t-4 border-[#2D2D2D] flex gap-1.5 overflow-x-auto">
          <button v-for="q in chips" :key="q" type="button" :disabled="typing" @click="ask(q)"
            class="shrink-0 bg-[#FFFBF0] border-2 border-[#2D2D2D] rounded-full px-2.5 py-1 text-xs font-bold text-[#2D2D2D] hover:bg-[#FFD166] disabled:opacity-50 transition-colors">{{ q }}</button>
        </div>

        <div class="p-3 pt-2 bg-white">
          <form @submit.prevent="sendMessage" class="flex gap-2">
            <input ref="inputEl" v-model="userInput" type="text" placeholder="Ketik sesuatu..." aria-label="Pesan untuk Kong" autocomplete="off"
              class="flex-1 min-w-0 bg-[#FFFBF0] border-2 border-[#2D2D2D] rounded-xl px-3 py-2 text-sm font-bold text-[#2D2D2D] outline-none focus:border-[#FF85A1]" />
            <button type="submit" :disabled="typing"
              class="bg-[#95D5B2] border-2 border-[#2D2D2D] rounded-xl px-4 py-2 font-black text-[#2D2D2D] shadow-[2px_2px_0px_#2D2D2D] hover:translate-y-1 hover:shadow-none disabled:opacity-60 transition-all">KIRIM</button>
          </form>
        </div>
      </div>
    </Transition>

    <!-- KONG: berjalan sendiri, bisa diseret, klik kapan saja untuk chat -->
    <button type="button" class="kong pointer-events-auto w-full h-full block cursor-grab active:cursor-grabbing select-none"
      :aria-label="chatOpen ? 'Tutup chat Kong' : 'Buka chat Kong'" :aria-expanded="chatOpen"
      @pointerdown="onDown" @pointermove="onMove" @pointerup="onUp" @pointercancel="onUp" @click="(e) => e.detail === 0 && toggleChat()">
      <span class="block w-full h-full" :style="{ transform: `scaleX(${flip})`, transition: 'transform .25s' }">
        <img src="/kong.png" alt="" draggable="false"
          class="w-full h-full object-contain filter drop-shadow-[4px_4px_0px_#2D2D2D]"
          :class="dragging ? 'kong-drag' : walking ? 'kong-walk' : 'kong-idle'" />
      </span>
    </button>
  </div>
</template>

<style scoped>
.kong { touch-action: none; background: none; border: 0; padding: 0; }
.kong:focus-visible { outline: 3px solid #FFD166; outline-offset: 4px; border-radius: 1rem; }
.kong-idle { animation: wiggle 3s ease-in-out infinite; }
.kong-walk { animation: hop .42s ease-in-out infinite; }
.kong-drag { transform: rotate(-6deg) scale(1.1); transition: transform .15s; }
@keyframes wiggle { 0%, 100% { transform: rotate(-3deg) translateY(0); } 50% { transform: rotate(3deg) translateY(-8px); } }
@keyframes hop { 0%, 100% { transform: translateY(0) rotate(-5deg); } 50% { transform: translateY(-16px) rotate(5deg); } }
@media (prefers-reduced-motion: reduce) { .kong-idle, .kong-walk { animation: none; } }
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: #FFFBF0; }
::-webkit-scrollbar-thumb { background: #FFD166; border: 1px solid #2D2D2D; border-radius: 10px; }
</style>