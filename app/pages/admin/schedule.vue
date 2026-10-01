<!-- pages/admin/schedule.vue -->
<script setup>
const supabase = useSupabaseClient()

// Sesuaikan nama kolom di sini kalau tabel `schedules` kamu memakai nama lain
const COLS = {
  day: 'day_of_week',
  time: 'start_time',
  subject: 'subject',
  room: 'room',
}

// Nilai `value` disimpan di database, `label` hanya tampilan
const DAYS = [
  { value: 'MONDAY', label: 'Senin', dot: 'bg-amber-400' },
  { value: 'TUESDAY', label: 'Selasa', dot: 'bg-pink-400' },
  { value: 'WEDNESDAY', label: 'Rabu', dot: 'bg-emerald-400' },
  { value: 'THURSDAY', label: 'Kamis', dot: 'bg-sky-400' },
  { value: 'FRIDAY', label: 'Jumat', dot: 'bg-violet-400' },
]

// ---------- READ ----------
const { data: schedules, refresh, error: loadError } = await useAsyncData('schedules_list', async () => {
  const { data, error } = await supabase
    .from('schedules')
    .select('*')
    .order(COLS.time, { ascending: true })
  if (error) throw error
  return data || []
})

const search = ref('')
const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  const list = schedules.value || []
  if (!q) return list
  return list.filter((s) =>
    [s[COLS.subject], s[COLS.room]].some((v) => (v || '').toLowerCase().includes(q))
  )
})

// Kelompokkan per hari. Hari di luar Senin-Jumat ditaruh di "Lainnya" supaya tidak hilang.
const groups = computed(() => {
  const known = DAYS.map((d) => ({
    ...d,
    items: filtered.value.filter((s) => s[COLS.day] === d.value),
  }))
  const other = filtered.value.filter((s) => !DAYS.some((d) => d.value === s[COLS.day]))
  if (other.length) known.push({ value: 'OTHER', label: 'Lainnya', dot: 'bg-slate-400', items: other })
  return known
})

// ---------- STATE ----------
const emptyForm = () => ({ day: 'MONDAY', time: '', subject: '', room: '' })

const showForm = ref(false)
const editingId = ref(null)
const form = ref(emptyForm())
const saving = ref(false)
const formError = ref('')

const deleteTarget = ref(null)
const deleting = ref(false)

const toast = ref('')
let toastTimer
const notify = (msg) => {
  toast.value = msg
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toast.value = ''), 2800)
}

// ---------- CREATE / UPDATE ----------
const openCreate = () => {
  editingId.value = null
  form.value = emptyForm()
  formError.value = ''
  showForm.value = true
}

const openEdit = (s) => {
  editingId.value = s.id
  form.value = {
    day: s[COLS.day] || 'MONDAY',
    time: (s[COLS.time] || '').slice(0, 5),
    subject: s[COLS.subject] || '',
    room: s[COLS.room] || '',
  }
  formError.value = ''
  showForm.value = true
}

const closeForm = () => {
  if (saving.value) return
  showForm.value = false
}

const save = async () => {
  formError.value = ''
  const subject = form.value.subject.trim()
  if (!subject) {
    formError.value = 'Mata pelajaran wajib diisi.'
    return
  }
  if (!form.value.time) {
    formError.value = 'Jam mulai wajib diisi.'
    return
  }

  saving.value = true
  try {
    const payload = {
      [COLS.day]: form.value.day,
      [COLS.time]: form.value.time,
      [COLS.subject]: subject,
      [COLS.room]: form.value.room.trim() || null,
    }

    const query = editingId.value
      ? supabase.from('schedules').update(payload).eq('id', editingId.value)
      : supabase.from('schedules').insert(payload)
    const { error } = await query
    if (error) throw error

    const wasEdit = !!editingId.value
    showForm.value = false
    await refresh()
    notify(wasEdit ? 'Jadwal diperbarui.' : 'Jadwal baru ditambahkan.')
  } catch (err) {
    formError.value = `Gagal menyimpan: ${err.message}`
  } finally {
    saving.value = false
  }
}

// ---------- DELETE ----------
const askDelete = (s) => {
  deleteTarget.value = s
}

const remove = async () => {
  const target = deleteTarget.value
  if (!target) return
  deleting.value = true
  const { error } = await supabase.from('schedules').delete().eq('id', target.id)
  deleting.value = false
  deleteTarget.value = null

  if (error) {
    notify(`Gagal menghapus: ${error.message}`)
    return
  }

  await refresh()
  notify(`Jadwal ${target[COLS.subject] || ''} dihapus.`)
}

// ---------- IMPORT DARI GOOGLE SHEETS (LINK / CSV) ----------
const showImport = ref(false)
const importRows = ref([])
const importFileName = ref('')
const importError = ref('')
const importing = ref(false)
const importInput = ref(null)
const sheetUrl = ref('')
const loadingSheet = ref(false)

// Penguraian CSV yang aman untuk teks dalam tanda kutip dan baris baru di dalam sel
const parseCSV = (text) => {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  const src = text.replace(/^\uFEFF/, '')
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++ } else inQuotes = false
      } else field += c
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      row.push(field); field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(field); field = ''
      rows.push(row); row = []
    } else {
      field += c
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row) }
  return rows.filter((r) => r.some((v) => v.trim() !== ''))
}

const cleanText = (v) => String(v ?? '').replace(/[\u200B-\u200D\u2060\uFEFF]/g, '').replace(/\s+/g, ' ').trim()

const DAY_ALIASES = {
  MONDAY: ['senin', 'monday', 'mon', 'sen'],
  TUESDAY: ['selasa', 'tuesday', 'tue', 'tues', 'sel'],
  WEDNESDAY: ['rabu', 'wednesday', 'wed', 'rab'],
  THURSDAY: ['kamis', 'thursday', 'thu', 'thur', 'thurs', 'kam'],
  FRIDAY: ['jumat', 'jumaat', 'friday', 'fri', 'jum'],
}
const parseDay = (v) => {
  const s = cleanText(v).toLowerCase().replace(/[^a-z]/g, '')
  return Object.keys(DAY_ALIASES).find((d) => DAY_ALIASES[d].includes(s)) || null
}

// Terima 08:00, 8.00, 08:00:00, "08.00 - 09.40" (diambil jam mulainya), atau 8:00 PM
const parseTime = (v) => {
  const s = cleanText(v).toLowerCase()
  if (!s) return null
  const m = s.match(/(\d{1,2})\s*[:.]\s*(\d{2})(?:\s*[:.]\s*\d{2})?\s*(am|pm)?/)
  if (!m) return null
  let h = +m[1]
  const min = +m[2]
  if (m[3] === 'pm' && h < 12) h += 12
  if (m[3] === 'am' && h === 12) h = 0
  if (h > 23 || min > 59) return null
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

const dayLabel = (value) => DAYS.find((d) => d.value === value)?.label || value
const rowKey = (day, time, subject) => `${day}|${time}|${cleanText(subject).toLowerCase()}`

const buildImportRows = (table) => {
  const [headers, ...body] = table
  const find = (words) =>
    headers.findIndex((h) => words.some((w) => cleanText(h).toLowerCase().includes(w)))
  const idx = {
    day: find(['hari', 'day']),
    time: find(['jam', 'waktu', 'mulai', 'start', 'time']),
    subject: find(['mata', 'matkul', 'pelajaran', 'kuliah', 'mapel', 'subject']),
    room: find(['ruang', 'room', 'lokasi']),
  }
  const missing = []
  if (idx.day === -1) missing.push('Hari')
  if (idx.time === -1) missing.push('Jam')
  if (idx.subject === -1) missing.push('Mata Pelajaran')
  if (missing.length) {
    throw new Error(`Kolom ${missing.join(', ')} tidak ditemukan. Baris pertama harus berisi header: Hari, Jam, Mata Pelajaran, Ruangan.`)
  }
  const cell = (cells, i) => (i === -1 ? '' : cells[i] ?? '')

  const existing = new Set(
    (schedules.value || []).map((x) => rowKey(x[COLS.day], String(x[COLS.time] || '').slice(0, 5), x[COLS.subject]))
  )
  const seen = new Set()

  return body.map((cells) => {
    const dayRaw = cleanText(cell(cells, idx.day))
    const timeRaw = cleanText(cell(cells, idx.time))
    const subject = cleanText(cell(cells, idx.subject))
    const room = cleanText(cell(cells, idx.room)) || null
    const day = parseDay(dayRaw)
    const time = parseTime(timeRaw)

    const notes = []
    if (!day) notes.push(`Hari "${dayRaw}" tidak dikenali`)
    if (!time) notes.push(`Jam "${timeRaw}" tidak dikenali`)
    if (!subject) notes.push('Mata pelajaran kosong')
    const valid = !!(day && time && subject)

    let exists = false
    if (valid) {
      const k = rowKey(day, time, subject)
      if (existing.has(k)) { exists = true; notes.push('Sudah ada di database') }
      else if (seen.has(k)) { exists = true; notes.push('Ganda di dalam file') }
      seen.add(k)
    }
    return { day, dayRaw, time, timeRaw, subject, room, notes, valid, exists, include: valid && !exists }
  })
}

const toImport = computed(() => importRows.value.filter((r) => r.include && r.valid && !r.exists))
const invalidCount = computed(() => importRows.value.filter((r) => !r.valid).length)
const existsCount = computed(() => importRows.value.filter((r) => r.valid && r.exists).length)

const openImport = () => {
  importRows.value = []
  importFileName.value = ''
  importError.value = ''
  sheetUrl.value = ''
  if (importInput.value) importInput.value.value = ''
  showImport.value = true
}

const closeImport = () => {
  if (importing.value || loadingSheet.value) return
  showImport.value = false
}

// Proses teks CSV, dipakai oleh unggah file maupun link Google Sheets
const processCSV = (text, sourceName) => {
  importError.value = ''
  importRows.value = []
  importFileName.value = sourceName
  try {
    const table = parseCSV(text)
    if (table.length < 2) throw new Error('Sheet kosong atau tidak ada baris data.')
    importRows.value = buildImportRows(table)
  } catch (err) {
    importError.value = err.message
  }
}

const onPickImport = async (e) => {
  const file = e.target.files?.[0]
  if (!file) return
  processCSV(await file.text(), file.name)
}

// Ambil ID spreadsheet dan gid (tab) dari link Google Sheets
const parseSheetUrl = (url) => {
  const id = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)?.[1]
  const gid = url.match(/[#&?]gid=(\d+)/)?.[1] || '0'
  return id ? { id, gid } : null
}

// Ambil CSV langsung dari browser lewat endpoint gviz (sheet harus publik: "Siapa saja yang memiliki link")
const fetchFromSheet = async () => {
  importError.value = ''
  const parsed = parseSheetUrl(sheetUrl.value.trim())
  if (!parsed) {
    importError.value = 'Link tidak valid. Tempel link Google Sheets, contoh: https://docs.google.com/spreadsheets/d/.../edit'
    return
  }

  loadingSheet.value = true
  try {
    const url = `https://docs.google.com/spreadsheets/d/${parsed.id}/gviz/tq?tqx=out:csv&gid=${parsed.gid}`
    const res = await fetch(url)
    const text = await res.text()

    // Sheet privat mengembalikan halaman login (HTML), bukan CSV
    if (!res.ok || text.trimStart().startsWith('<')) throw new Error('private')

    processCSV(text, `Google Sheets (tab gid ${parsed.gid})`)
  } catch {
    importRows.value = []
    importError.value = 'Sheet tidak bisa diakses. Pastikan dibagikan sebagai "Siapa saja yang memiliki link" (Pelihat), atau unggah file CSV di bawah.'
  } finally {
    loadingSheet.value = false
  }
}

const runImport = async () => {
  const list = toImport.value
  if (!list.length) return
  importing.value = true
  importError.value = ''
  try {
    const payload = list.map((r) => ({
      [COLS.day]: r.day,
      [COLS.time]: r.time,
      [COLS.subject]: r.subject,
      [COLS.room]: r.room,
    }))
    const { error } = await supabase.from('schedules').insert(payload)
    if (error) throw error
    await refresh()
    showImport.value = false
    notify(`${list.length} jadwal berhasil diimpor.`)
  } catch (err) {
    importError.value = `Gagal mengimpor: ${err.message}`
  } finally {
    importing.value = false
  }
}

// ---------- HELPERS ----------
const hhmm = (t) => (t ? String(t).slice(0, 5) : '--:--')

onBeforeUnmount(() => clearTimeout(toastTimer))
</script>

<template>
  <div class="flex h-screen bg-[#F8FAFC] text-slate-800 font-sans overflow-hidden selection:bg-violet-200">
    <!-- Sidebar -->
    <aside class="w-64 bg-white border-r border-slate-100 flex-col justify-between hidden md:flex shrink-0 shadow-sm z-10">
      <div>
        <div class="h-20 flex items-center px-8">
          <div class="w-8 h-8 bg-gradient-to-tr from-violet-600 to-pink-500 rounded-xl flex items-center justify-center text-white font-black text-sm shadow-md mr-3">S</div>
          <span class="font-black text-slate-800 tracking-tight text-xl">Siscverse</span>
        </div>

        <nav class="p-4 space-y-1">
          <NuxtLink class="flex items-center px-4 py-3 text-sm font-medium rounded-2xl text-slate-500 hover:bg-slate-50 transition-all" to="/admin">🏠 Dashboard</NuxtLink>
          <NuxtLink class="flex items-center px-4 py-3 text-sm font-medium rounded-2xl text-slate-500 hover:bg-slate-50 transition-all" to="/admin/structure">✨ Directory</NuxtLink>
          <NuxtLink class="flex items-center px-4 py-3 text-sm font-bold rounded-2xl bg-violet-50 text-violet-700 transition-all" to="/admin/schedule">📅 Schedule</NuxtLink>
          <NuxtLink class="flex items-center px-4 py-3 text-sm font-medium rounded-2xl text-slate-500 hover:bg-slate-50 transition-all" to="/admin/menfess">💌 Menfess</NuxtLink>
          <NuxtLink class="flex items-center px-4 py-3 text-sm font-medium rounded-2xl text-slate-500 hover:bg-slate-50 transition-all" to="/admin/kas">💸 Treasury</NuxtLink>
        </nav>
      </div>

      <div class="p-6">
        <div class="bg-emerald-50 rounded-2xl p-4 flex items-center gap-3 border border-emerald-100">
          <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <div>
            <p class="text-xs font-bold text-emerald-800">System Online</p>
            <p class="text-[10px] font-medium text-emerald-600">Database Connected</p>
          </div>
        </div>
      </div>
    </aside>

    <!-- Main -->
    <main class="flex-1 overflow-y-auto relative">
      <div class="max-w-6xl mx-auto p-6 md:p-10">
        <header class="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h1 class="text-3xl font-black text-slate-900 tracking-tight">Schedule 📅</h1>
            <p class="text-slate-500 text-sm mt-1">Kelola jadwal kelas: tambah, ubah, dan hapus.</p>
          </div>
          <div class="flex flex-wrap gap-3">
            <button
              type="button"
              class="bg-white hover:bg-violet-50 border border-violet-200 text-violet-700 font-bold text-sm px-6 py-3 rounded-2xl transition-colors"
              @click="openImport"
            >
              Impor dari Google Sheets
            </button>
            <button
              type="button"
              class="bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm px-6 py-3 rounded-2xl shadow-lg shadow-violet-200 transition-colors"
              @click="openCreate"
            >
              + Tambah jadwal
            </button>
          </div>
        </header>

        <div class="mb-6">
          <input
            v-model="search"
            type="search"
            placeholder="Cari mata pelajaran atau ruangan..."
            class="w-full md:w-96 bg-white border border-slate-200 rounded-2xl px-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
          />
          <span class="text-xs font-bold text-slate-400 ml-3">{{ filtered.length }} jadwal</span>
        </div>

        <div v-if="loadError" class="bg-red-50 border border-red-100 text-red-700 rounded-2xl p-5 text-sm font-medium">
          Gagal memuat data: {{ loadError.message }}
        </div>

        <div
          v-else-if="(schedules || []).length === 0"
          class="min-h-[160px] flex flex-col items-center justify-center bg-white rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center"
        >
          <span class="text-3xl mb-2">🫥</span>
          <p class="text-slate-500 text-sm font-medium">Belum ada jadwal. Klik "Tambah jadwal" atau impor dari Google Sheets.</p>
        </div>

        <div v-else class="space-y-10">
          <section v-for="g in groups" :key="g.value">
            <div class="flex items-center gap-3 mb-4">
              <span class="w-3 h-3 rounded-full" :class="g.dot"></span>
              <h2 class="text-lg font-black text-slate-900">{{ g.label }}</h2>
              <span class="text-xs font-bold text-slate-400">{{ g.items.length }} jadwal</span>
            </div>

            <div v-if="g.items.length" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              <article
                v-for="s in g.items"
                :key="s.id"
                class="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col gap-3"
              >
                <div class="text-3xl font-black text-slate-900 tracking-tight">{{ hhmm(s[COLS.time]) }}</div>
                <div class="min-w-0">
                  <h3 class="font-black text-slate-900 truncate">{{ s[COLS.subject] || 'Tanpa nama' }}</h3>
                  <p class="text-xs font-medium text-slate-400 truncate">📍 {{ s[COLS.room] || 'Ruangan belum ditentukan' }}</p>
                </div>

                <div class="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    class="text-xs font-bold px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-violet-100 text-slate-600 hover:text-violet-700 transition-colors"
                    @click="openEdit(s)"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    class="text-xs font-bold px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-red-100 text-slate-600 hover:text-red-600 transition-colors"
                    @click="askDelete(s)"
                  >
                    Hapus
                  </button>
                </div>
              </article>
            </div>

            <div
              v-else
              class="bg-white rounded-2xl border-2 border-dashed border-slate-200 px-5 py-6 text-center text-sm font-medium text-slate-300"
            >
              {{ search ? 'Tidak ada yang cocok.' : 'Tidak ada jadwal, hari bebas.' }}
            </div>
          </section>
        </div>
      </div>
    </main>

    <!-- Form modal (create / edit) -->
    <div
      v-if="showForm"
      class="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
      @click.self="closeForm"
    >
      <div class="bg-white rounded-[2rem] w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        <div class="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
          <h2 class="text-xl font-black text-slate-900">
            {{ editingId ? 'Edit jadwal' : 'Tambah jadwal' }}
          </h2>
          <button type="button" class="text-slate-400 hover:text-slate-600 text-xl leading-none" aria-label="Tutup" @click="closeForm">✕</button>
        </div>

        <div class="px-8 py-6 space-y-5">
          <div>
            <label for="s-day" class="block text-xs font-bold text-slate-500 mb-2">Hari</label>
            <select
              id="s-day"
              v-model="form.day"
              class="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
            >
              <option v-for="d in DAYS" :key="d.value" :value="d.value">{{ d.label }}</option>
            </select>
          </div>

          <div>
            <label for="s-time" class="block text-xs font-bold text-slate-500 mb-2">Jam mulai</label>
            <input
              id="s-time"
              v-model="form.time"
              type="time"
              class="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
            />
          </div>

          <div>
            <label for="s-subject" class="block text-xs font-bold text-slate-500 mb-2">Mata pelajaran</label>
            <input
              id="s-subject"
              v-model="form.subject"
              type="text"
              placeholder="Contoh: Pemrograman Web"
              class="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
            />
          </div>

          <div>
            <label for="s-room" class="block text-xs font-bold text-slate-500 mb-2">Ruangan (opsional)</label>
            <input
              id="s-room"
              v-model="form.room"
              type="text"
              placeholder="Contoh: Lab Komputer"
              class="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
            />
          </div>

          <p v-if="formError" class="text-sm font-medium text-red-600 bg-red-50 border border-red-100 rounded-2xl px-4 py-3">
            {{ formError }}
          </p>
        </div>

        <div class="px-8 py-5 border-t border-slate-100 flex justify-end gap-3">
          <button
            type="button"
            class="text-sm font-bold px-5 py-2.5 rounded-xl text-slate-500 hover:bg-slate-100 transition-colors"
            :disabled="saving"
            @click="closeForm"
          >
            Batal
          </button>
          <button
            type="button"
            class="text-sm font-bold px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-60 transition-colors"
            :disabled="saving"
            @click="save"
          >
            {{ saving ? 'Menyimpan...' : editingId ? 'Simpan perubahan' : 'Tambah jadwal' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Import modal (link Google Sheets / CSV) -->
    <div
      v-if="showImport"
      class="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
      @click.self="closeImport"
    >
      <div class="bg-white rounded-[2rem] w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl">
        <div class="px-8 py-6 border-b border-slate-100 flex items-center justify-between shrink-0">
          <h2 class="text-xl font-black text-slate-900">Impor jadwal dari Google Sheets</h2>
          <button type="button" class="text-slate-400 hover:text-slate-600 text-xl leading-none" aria-label="Tutup" @click="closeImport">✕</button>
        </div>

        <div class="px-8 py-6 space-y-5 overflow-y-auto">
          <div class="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm text-slate-600 leading-relaxed space-y-2">
            <p class="font-bold text-slate-700">Format Google Sheets</p>
            <p>Baris pertama adalah header, satu jadwal per baris, dengan kolom <strong>Hari</strong>, <strong>Jam</strong>, <strong>Mata Pelajaran</strong>, dan <strong>Ruangan</strong> (ruangan boleh kosong). Urutan kolom bebas.</p>
            <p>Hari boleh <em>Senin</em> atau <em>Monday</em>. Jam boleh <em>08:00</em>, <em>08.00</em>, atau <em>08.00 - 09.40</em> (yang diambil jam mulainya).</p>
            <p>Pastikan sheet dibagikan sebagai <strong>Siapa saja yang memiliki link → Pelihat</strong>. Untuk memilih tab tertentu, buka tab itu lalu salin link dari address bar.</p>
          </div>

          <div>
            <label for="sheet-url" class="block text-xs font-bold text-slate-500 mb-2">Link Google Sheets</label>
            <div class="flex flex-col sm:flex-row gap-3">
              <input
                id="sheet-url"
                v-model="sheetUrl"
                type="url"
                placeholder="https://docs.google.com/spreadsheets/d/..."
                class="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                @keyup.enter="fetchFromSheet"
              />
              <button
                type="button"
                class="text-sm font-bold px-5 py-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-60 transition-colors shrink-0"
                :disabled="loadingSheet || !sheetUrl.trim()"
                @click="fetchFromSheet"
              >
                {{ loadingSheet ? 'Mengambil...' : 'Ambil data' }}
              </button>
            </div>
          </div>

          <div class="flex items-center gap-3 text-xs font-bold text-slate-300">
            <span class="flex-1 border-t border-slate-200"></span>atau unggah CSV<span class="flex-1 border-t border-slate-200"></span>
          </div>

          <div class="flex flex-wrap items-center gap-3">
            <input ref="importInput" type="file" accept=".csv,text/csv" class="hidden" @change="onPickImport" />
            <button
              type="button"
              class="text-sm font-bold px-5 py-2.5 rounded-xl bg-violet-50 hover:bg-violet-100 text-violet-700 transition-colors"
              @click="importInput?.click()"
            >
              Pilih file CSV
            </button>
            <span v-if="importFileName" class="text-xs font-medium text-slate-400 truncate">{{ importFileName }}</span>
          </div>

          <p v-if="importError" class="text-sm font-medium text-red-600 bg-red-50 border border-red-100 rounded-2xl px-4 py-3">
            {{ importError }}
          </p>

          <template v-if="importRows.length">
            <div class="flex flex-wrap gap-2 text-xs font-bold">
              <span class="px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700">{{ toImport.length }} akan diimpor</span>
              <span v-if="existsCount" class="px-3 py-1.5 rounded-full bg-slate-100 text-slate-500">{{ existsCount }} sudah ada, dilewati</span>
              <span v-if="invalidCount" class="px-3 py-1.5 rounded-full bg-amber-50 text-amber-700">{{ invalidCount }} baris perlu dicek</span>
            </div>

            <div class="border border-slate-200 rounded-2xl overflow-auto max-h-[40vh]">
              <table class="w-full text-xs text-left">
                <thead class="bg-slate-50 text-slate-500 sticky top-0">
                  <tr>
                    <th class="px-3 py-2 w-10"></th>
                    <th class="px-3 py-2 font-bold">Hari</th>
                    <th class="px-3 py-2 font-bold">Jam</th>
                    <th class="px-3 py-2 font-bold">Mata pelajaran</th>
                    <th class="px-3 py-2 font-bold">Ruangan</th>
                    <th class="px-3 py-2 font-bold">Catatan</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(r, i) in importRows"
                    :key="i"
                    class="border-t border-slate-100 align-top"
                    :class="{ 'opacity-50': !r.valid || r.exists || !r.include }"
                  >
                    <td class="px-3 py-2">
                      <input v-model="r.include" type="checkbox" :disabled="!r.valid || r.exists" class="accent-violet-600" :aria-label="`Impor ${r.subject}`" />
                    </td>
                    <td class="px-3 py-2 whitespace-nowrap">{{ r.day ? dayLabel(r.day) : r.dayRaw || '-' }}</td>
                    <td class="px-3 py-2 whitespace-nowrap font-bold text-slate-800">{{ r.time || r.timeRaw || '-' }}</td>
                    <td class="px-3 py-2 font-bold text-slate-800">{{ r.subject || '-' }}</td>
                    <td class="px-3 py-2">{{ r.room || '-' }}</td>
                    <td class="px-3 py-2 text-amber-700">{{ r.notes.join('; ') }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>
        </div>

        <div class="px-8 py-5 border-t border-slate-100 flex justify-end gap-3 shrink-0">
          <button
            type="button"
            class="text-sm font-bold px-5 py-2.5 rounded-xl text-slate-500 hover:bg-slate-100 transition-colors"
            :disabled="importing"
            @click="closeImport"
          >
            Batal
          </button>
          <button
            type="button"
            class="text-sm font-bold px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-60 transition-colors"
            :disabled="importing || !toImport.length"
            @click="runImport"
          >
            {{ importing ? 'Mengimpor...' : `Impor ${toImport.length} jadwal` }}
          </button>
        </div>
      </div>
    </div>

    <!-- Delete confirm -->
    <div
      v-if="deleteTarget"
      class="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
      @click.self="deleteTarget = null"
    >
      <div class="bg-white rounded-[2rem] w-full max-w-sm p-8 shadow-2xl text-center">
        <div class="text-4xl mb-3">🗑️</div>
        <h2 class="text-lg font-black text-slate-900 mb-2">Hapus jadwal {{ deleteTarget[COLS.subject] || 'ini' }}?</h2>
        <p class="text-sm text-slate-500 mb-6">Jadwal akan dihapus permanen dan tidak bisa dikembalikan.</p>
        <div class="flex gap-3 justify-center">
          <button
            type="button"
            class="text-sm font-bold px-5 py-2.5 rounded-xl text-slate-500 hover:bg-slate-100 transition-colors"
            :disabled="deleting"
            @click="deleteTarget = null"
          >
            Batal
          </button>
          <button
            type="button"
            class="text-sm font-bold px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white disabled:opacity-60 transition-colors"
            :disabled="deleting"
            @click="remove"
          >
            {{ deleting ? 'Menghapus...' : 'Ya, hapus' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Toast -->
    <div
      v-if="toast"
      class="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-slate-900 text-white text-sm font-bold px-5 py-3 rounded-2xl shadow-xl"
      role="status"
    >
      {{ toast }}
    </div>
  </div>
</template>