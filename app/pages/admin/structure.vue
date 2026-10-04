<!-- pages/admin/structure.vue -->
<script setup>
const supabase = useSupabaseClient()

// Sesuaikan nama kolom di sini kalau tabel `members` kamu memakai nama lain
const COLS = {
  name: 'name',
  birth: 'birth_date',
  instagram: 'instagram',
  quote: 'quote',
  photo: 'photo_url',
  role: 'role',
}

// Pilihan jabatan. Kata kunci di sini yang dipakai halaman publik untuk menaruh orang di rasi bintang.
const ROLE_OPTIONS = [
  'Ketua', 'Wakil Ketua', 'Sekretaris', 'Bendahara', 'Bendahara II',
  'PJ Konsep Sistem Informasi', 'PJ Bahasa Inggris', 'PJ Algoritma', 'PJ Pancasila',
  'PJ Pemrograman', 'PJ Matematika Dasar', 'PJ Agama Islam', 'PJ Bahasa Indonesia',
]
const BUCKET = 'member-photos'
const MAX_FILE_MB = 5

// ---------- READ ----------
const { data: members, refresh, error: loadError } = await useAsyncData('members_list', async () => {
  const { data, error } = await supabase
    .from('members')
    .select('*')
    .order(COLS.name, { ascending: true })
  if (error) throw error
  return data || []
}, { server: false })

const search = ref('')
const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  const list = members.value || []
  if (!q) return list
  return list.filter((m) =>
    [m[COLS.name], m[COLS.instagram], m[COLS.quote]].some((v) => (v || '').toLowerCase().includes(q))
  )
})

// ---------- STATE ----------
const emptyForm = () => ({ name: '', role: '', birth: '', instagram: '', quote: '' })

const roleOptions = computed(() =>
  form.value.role && !ROLE_OPTIONS.includes(form.value.role) ? [form.value.role, ...ROLE_OPTIONS] : ROLE_OPTIONS
)

const showForm = ref(false)
const editingId = ref(null)
const form = ref(emptyForm())
const saving = ref(false)
const formError = ref('')

// foto
const currentPhotoUrl = ref('') // foto yang tersimpan saat ini (saat edit)
const newPhotoFile = ref(null) // file baru yang dipilih
const previewUrl = ref('') // preview file baru
const removePhoto = ref(false) // centang untuk menghapus foto lama
const fileInput = ref(null)

const shownPhoto = computed(() => {
  if (previewUrl.value) return previewUrl.value
  if (removePhoto.value) return ''
  return currentPhotoUrl.value
})

const deleteTarget = ref(null)
const deleting = ref(false)

const toast = ref('')
let toastTimer
const notify = (msg) => {
  toast.value = msg
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toast.value = ''), 2800)
}

// ---------- FOTO ----------
const resetPhotoState = () => {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = ''
  newPhotoFile.value = null
  removePhoto.value = false
  if (fileInput.value) fileInput.value.value = ''
}

const onPickFile = (e) => {
  const file = e.target.files?.[0]
  if (!file) return
  formError.value = ''

  if (!file.type.startsWith('image/')) {
    formError.value = 'File harus berupa gambar (JPG, PNG, atau WebP).'
    e.target.value = ''
    return
  }
  if (file.size > MAX_FILE_MB * 1024 * 1024) {
    formError.value = `Ukuran foto maksimal ${MAX_FILE_MB} MB.`
    e.target.value = ''
    return
  }

  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  newPhotoFile.value = file
  previewUrl.value = URL.createObjectURL(file)
  removePhoto.value = false
}

const clearPhoto = () => {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = ''
  newPhotoFile.value = null
  if (fileInput.value) fileInput.value.value = ''
  if (currentPhotoUrl.value) removePhoto.value = true
}

// Perkecil foto (maks 800px) supaya upload cepat dan hemat storage
const shrinkImage = (file, maxSize = 800) =>
  new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      canvas.toBlob((blob) => resolve(blob || file), 'image/jpeg', 0.85)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(file)
    }
    img.src = url
  })

const uploadPhoto = async (file) => {
  const blob = await shrinkImage(file)
  const path = `${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: 'image/jpeg', cacheControl: '3600' })
  if (error) throw error
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

// Ambil path file dari public URL, lalu hapus dari bucket
const deletePhotoFile = async (url) => {
  if (!url) return
  const marker = `/${BUCKET}/`
  const idx = url.indexOf(marker)
  if (idx === -1) return
  const path = decodeURIComponent(url.slice(idx + marker.length).split('?')[0])
  await supabase.storage.from(BUCKET).remove([path])
}

// ---------- CREATE / UPDATE ----------
const openCreate = () => {
  editingId.value = null
  form.value = emptyForm()
  currentPhotoUrl.value = ''
  resetPhotoState()
  formError.value = ''
  showForm.value = true
}

const openEdit = (m) => {
  editingId.value = m.id
  form.value = {
    name: m[COLS.name] || '',
    role: ROLE_OPTIONS.includes(m[COLS.role]) ? m[COLS.role] : (m[COLS.role] && m[COLS.role].toLowerCase() !== 'member' ? m[COLS.role] : ''),
    birth: m[COLS.birth] || '',
    instagram: m[COLS.instagram] || '',
    quote: m[COLS.quote] || '',
  }
  currentPhotoUrl.value = m[COLS.photo] || ''
  resetPhotoState()
  formError.value = ''
  showForm.value = true
}

const closeForm = () => {
  if (saving.value) return
  resetPhotoState()
  showForm.value = false
}

const save = async () => {
  formError.value = ''
  const name = form.value.name.trim()
  if (!name) {
    formError.value = 'Nama lengkap wajib diisi.'
    return
  }

  saving.value = true
  let uploadedUrl = null

  try {
    const payload = {
      [COLS.name]: name,
      [COLS.role]: form.value.role || 'member',
      [COLS.birth]: form.value.birth || null,
      [COLS.instagram]: form.value.instagram.trim().replace(/^@+/, '') || null,
      [COLS.quote]: form.value.quote.trim() || null,
    }

    // Tentukan nilai foto
    if (newPhotoFile.value) {
      uploadedUrl = await uploadPhoto(newPhotoFile.value)
      payload[COLS.photo] = uploadedUrl
    } else if (removePhoto.value) {
      payload[COLS.photo] = null
    }

    const query = editingId.value
      ? supabase.from('members').update(payload).eq('id', editingId.value)
      : supabase.from('members').insert(payload)
    const { error } = await query
    if (error) throw error

    // Data tersimpan, sekarang aman menghapus foto lama
    if ((newPhotoFile.value || removePhoto.value) && currentPhotoUrl.value) {
      await deletePhotoFile(currentPhotoUrl.value)
    }

    const wasEdit = !!editingId.value
    resetPhotoState()
    showForm.value = false
    await refresh()
    notify(wasEdit ? 'Data warga diperbarui.' : 'Warga baru ditambahkan.')
  } catch (err) {
    // Simpan gagal: bersihkan foto baru yang sudah terlanjur diupload
    if (uploadedUrl) await deletePhotoFile(uploadedUrl)
    formError.value = `Gagal menyimpan: ${err.message}`
  } finally {
    saving.value = false
  }
}

// ---------- DELETE ----------
const askDelete = (m) => {
  deleteTarget.value = m
}

const remove = async () => {
  const target = deleteTarget.value
  if (!target) return
  deleting.value = true
  const { error } = await supabase.from('members').delete().eq('id', target.id)
  deleting.value = false
  deleteTarget.value = null

  if (error) {
    notify(`Gagal menghapus: ${error.message}`)
    return
  }

  await deletePhotoFile(target[COLS.photo])
  await refresh()
  notify(`${target[COLS.name] || 'Warga'} dihapus.`)
}

// ---------- IMPORT DARI GOOGLE SHEETS (CSV) ----------
const showImport = ref(false)
const importRows = ref([])
const importFileName = ref('')
const importError = ref('')
const importing = ref(false)
const importPhotos = ref(true) // ikut simpan link foto dari Google Drive
const tidyNames = ref(true) // rapikan huruf besar-kecil nama
const fileDupes = ref(0) // jumlah baris ganda di dalam file
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

const cleanText = (v) =>
  String(v ?? '').replace(/[\u200B-\u200D\u2060\uFEFF]/g, '').replace(/[ \t]+/g, ' ').trim()
const nameKey = (s) => cleanText(s).toLowerCase().replace(/\s+/g, ' ')
const titleCase = (s) =>
  s.toLowerCase().replace(/(^|[\s'’-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase())

// dd/mm/yyyy (format Google Sheets Indonesia) atau yyyy-mm-dd, hasil yyyy-mm-dd
const parseDate = (v) => {
  const s = cleanText(v)
  if (!s) return { value: null }
  let y, m, d, mt
  if ((mt = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/))) {
    d = +mt[1]; m = +mt[2]; y = +mt[3]
  } else if ((mt = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) {
    y = +mt[1]; m = +mt[2]; d = +mt[3]
  } else {
    return { value: null, note: `Tanggal "${s}" tidak dikenali` }
  }
  const dt = new Date(Date.UTC(y, m - 1, d))
  const valid = dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
  if (!valid || y < 1940 || y > new Date().getFullYear()) {
    return { value: null, note: `Tanggal "${s}" tidak valid, dikosongkan` }
  }
  return { value: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` }
}

// Ambil username saja. Link non-Instagram dikosongkan.
const parseInstagram = (v) => {
  let s = cleanText(v)
  if (!s) return { value: null }
  const ig = s.match(/instagram\.com\/([A-Za-z0-9._]+)/i)
  if (ig) return { value: ig[1] }
  if (/^https?:\/\//i.test(s) || s.includes('/')) {
    return { value: null, note: 'Bukan link Instagram, dikosongkan' }
  }
  s = s.replace(/^@+/, '').replace(/\s+/g, '')
  return { value: s || null }
}

// Link Google Drive -> URL gambar. Hanya tampil kalau file dibagikan "siapa saja yang memiliki link".
const drivePhoto = (v) => {
  const s = cleanText(v)
  if (!s) return null
  const m = s.match(/[?&]id=([\w-]+)/) || s.match(/\/d\/([\w-]+)/)
  return m ? `https://drive.google.com/thumbnail?id=${m[1]}&sz=w800` : null
}

const buildImportRows = (table) => {
  const [headers, ...body] = table
  const find = (test) => headers.findIndex((h) => test(cleanText(h).toLowerCase()))
  const idx = {
    name: find((h) => h.includes('nama') && !h.includes('instagram')),
    birth: find((h) => h.includes('lahir')),
    ig: find((h) => h.includes('instagram')),
    quote: find((h) => /q[uo]+t/.test(h)),
    photo: find((h) => h.includes('foto')),
  }
  if (idx.name === -1) {
    throw new Error('Kolom "Nama lengkap" tidak ditemukan. Pastikan baris pertama CSV adalah header dari Google Sheets.')
  }
  const cell = (cells, i) => (i === -1 ? '' : cells[i] ?? '')

  // Kalau nama yang sama masuk dua kali, pakai kiriman yang terakhir
  const byName = new Map()
  let dupes = 0
  body.forEach((cells) => {
    const raw = cleanText(cell(cells, idx.name))
    if (!raw) return
    const key = nameKey(raw)
    if (byName.has(key)) dupes++
    byName.set(key, cells)
  })
  fileDupes.value = dupes

  const existing = new Set((members.value || []).map((m) => nameKey(m[COLS.name])))

  return [...byName.entries()].map(([key, cells]) => {
    const notes = []
    const birth = parseDate(cell(cells, idx.birth))
    const ig = parseInstagram(cell(cells, idx.ig))
    if (birth.note) notes.push(birth.note)
    if (ig.note) notes.push(ig.note)
    const exists = existing.has(key)
    return {
      rawName: cleanText(cell(cells, idx.name)),
      birth: birth.value,
      instagram: ig.value,
      quote: cleanText(cell(cells, idx.quote)) || null,
      photo: drivePhoto(cell(cells, idx.photo)),
      notes,
      exists,
      include: !exists,
    }
  })
}

const displayName = (r) => (tidyNames.value ? titleCase(r.rawName) : r.rawName)
const toImport = computed(() => importRows.value.filter((r) => r.include && !r.exists))
const existingCount = computed(() => importRows.value.filter((r) => r.exists).length)

const openImport = () => {
  importRows.value = []
  importFileName.value = ''
  importError.value = ''
  fileDupes.value = 0
  sheetUrl.value = ''
  if (importInput.value) importInput.value.value = ''
  showImport.value = true
}

const closeImport = () => {
  if (importing.value) return
  showImport.value = false
}

// Ubah link Google Sheets menjadi alamat unduhan CSV. Gid (tab) dipakai kalau ada di link.
const sheetCsvUrls = (input) => {
  const text = String(input || '').trim()
  const gid = (text.match(/[#&?]gid=(\d+)/) || [])[1]

  // Sheet yang sudah "Publikasikan ke web"
  const pub = text.match(/\/spreadsheets\/d\/e\/([\w-]+)/)
  if (pub) return [`https://docs.google.com/spreadsheets/d/e/${pub[1]}/pub?output=csv${gid ? `&gid=${gid}` : ''}`]

  const m = text.match(/\/spreadsheets\/d\/([\w-]+)/) || (/^[\w-]{25,}$/.test(text) ? [null, text] : null)
  if (!m) return []
  const id = m[1]
  const g = gid ? `&gid=${gid}` : ''
  return [
    `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&headers=1${g}`,
    `https://docs.google.com/spreadsheets/d/${id}/export?format=csv${g}`,
  ]
}

const fetchSheetCsv = async (input) => {
  const urls = sheetCsvUrls(input)
  if (!urls.length) {
    throw new Error('Link tidak dikenali. Tempel link yang berbentuk docs.google.com/spreadsheets/d/...')
  }
  let sawLoginPage = false
  for (const url of urls) {
    try {
      const res = await fetch(url)
      if (!res.ok) continue
      const text = await res.text()
      if (/^\s*<(!doctype|html)/i.test(text)) { sawLoginPage = true; continue }
      return text
    } catch {
      // diblokir browser atau jaringan, coba alamat berikutnya
    }
  }
  throw new Error(
    sawLoginPage
      ? 'Sheet ini masih pribadi. Di Google Sheets pilih Bagikan, lalu ubah Akses umum menjadi "Siapa saja yang memiliki link" (Viewer), kemudian coba lagi.'
      : 'Sheet tidak bisa dibaca dari browser. Pastikan aksesnya "Siapa saja yang memiliki link", atau unduh sebagai CSV lalu unggah filenya di bawah.'
  )
}

// Pemrosesan bersama untuk file CSV maupun hasil dari link
const processCsv = (text, label) => {
  importError.value = ''
  importRows.value = []
  importFileName.value = label
  try {
    const table = parseCSV(text)
    if (table.length < 2) throw new Error('Sheet kosong atau tidak ada baris data.')
    importRows.value = buildImportRows(table)
  } catch (err) {
    importError.value = err.message
  }
}

const loadFromLink = async () => {
  importError.value = ''
  if (!sheetUrl.value.trim()) {
    importError.value = 'Tempel link Google Sheets dulu.'
    return
  }
  loadingSheet.value = true
  try {
    processCsv(await fetchSheetCsv(sheetUrl.value), 'Google Sheets')
  } catch (err) {
    importRows.value = []
    importFileName.value = ''
    importError.value = err.message
  } finally {
    loadingSheet.value = false
  }
}

const onPickImport = async (e) => {
  const file = e.target.files?.[0]
  if (!file) return
  processCsv(await file.text(), file.name)
}

const runImport = async () => {
  const list = toImport.value
  if (!list.length) return
  importing.value = true
  importError.value = ''
  try {
    const payload = list.map((r) => ({
      [COLS.name]: displayName(r),
      [COLS.birth]: r.birth,
      [COLS.instagram]: r.instagram,
      [COLS.quote]: r.quote,
      [COLS.photo]: importPhotos.value ? r.photo : null,
    }))
    const { error } = await supabase.from('members').insert(payload)
    if (error) throw error
    await refresh()
    showImport.value = false
    notify(`${list.length} warga berhasil diimpor.`)
  } catch (err) {
    importError.value = `Gagal mengimpor: ${err.message}`
  } finally {
    importing.value = false
  }
}

// ---------- HELPERS ----------
const formatDate = (value) => {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

const initial = (name) => (name || '?').trim().charAt(0).toUpperCase()

onBeforeUnmount(() => {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  clearTimeout(toastTimer)
})
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
          <NuxtLink class="flex items-center px-4 py-3 text-sm font-bold rounded-2xl bg-violet-50 text-violet-700 transition-all" to="/admin/structure">✨ Directory</NuxtLink>
          <NuxtLink class="flex items-center px-4 py-3 text-sm font-medium rounded-2xl text-slate-500 hover:bg-slate-50 transition-all" to="/admin/schedule">📅 Schedule</NuxtLink>
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
            <h1 class="text-3xl font-black text-slate-900 tracking-tight">Directory ✨</h1>
            <p class="text-slate-500 text-sm mt-1">Kelola data warga kelas: tambah, ubah, dan hapus.</p>
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
              + Tambah warga
            </button>
          </div>
        </header>

        <div class="mb-6">
          <input
            v-model="search"
            type="search"
            placeholder="Cari nama, Instagram, atau quotes..."
            class="w-full md:w-96 bg-white border border-slate-200 rounded-2xl px-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
          />
          <span class="text-xs font-bold text-slate-400 ml-3">{{ filtered.length }} warga</span>
        </div>

        <div v-if="loadError" class="bg-red-50 border border-red-100 text-red-700 rounded-2xl p-5 text-sm font-medium">
          Gagal memuat data: {{ loadError.message }}
        </div>

        <div
          v-else-if="filtered.length === 0"
          class="min-h-[160px] flex flex-col items-center justify-center bg-white rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center"
        >
          <span class="text-3xl mb-2">🫥</span>
          <p class="text-slate-500 text-sm font-medium">
            {{ search ? 'Tidak ada warga yang cocok dengan pencarian.' : 'Belum ada warga. Klik "Tambah warga" atau impor dari Google Sheets.' }}
          </p>
        </div>

        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <article
            v-for="m in filtered"
            :key="m.id"
            class="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col gap-4"
          >
            <div class="flex items-center gap-3">
              <img
                v-if="m[COLS.photo]"
                :src="m[COLS.photo]"
                :alt="`Foto ${m[COLS.name] || 'warga'}`"
                loading="lazy"
                class="w-14 h-14 rounded-2xl object-cover shrink-0 bg-slate-100"
              />
              <div
                v-else
                class="w-14 h-14 rounded-2xl bg-gradient-to-tr from-violet-500 to-pink-400 text-white text-lg font-black flex items-center justify-center shrink-0"
              >
                {{ initial(m[COLS.name]) }}
              </div>
              <div class="min-w-0">
                <h3 class="font-black text-slate-900 truncate">{{ m[COLS.name] || 'Tanpa nama' }}</h3>
                <p class="text-xs font-medium text-slate-400 truncate">
                  {{ m[COLS.instagram] ? '@' + m[COLS.instagram] : 'Instagram belum diisi' }}
                </p>
                <p
                  v-if="m[COLS.role] && m[COLS.role].toLowerCase() !== 'member'"
                  class="inline-block mt-1 text-[11px] font-bold px-2 py-0.5 rounded-lg bg-violet-50 text-violet-700"
                >
                  {{ m[COLS.role] }}
                </p>
              </div>
            </div>

            <p class="text-sm text-slate-600 leading-relaxed flex-1">
              <template v-if="m[COLS.quote]">"{{ m[COLS.quote] }}"</template>
              <span v-else class="text-slate-300">Belum ada quotes.</span>
            </p>

            <div class="flex items-center justify-between pt-3 border-t border-slate-100">
              <span class="text-xs font-bold text-slate-400">🎂 {{ formatDate(m[COLS.birth]) }}</span>
              <div class="flex gap-2">
                <button
                  type="button"
                  class="text-xs font-bold px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-violet-100 text-slate-600 hover:text-violet-700 transition-colors"
                  @click="openEdit(m)"
                >
                  Edit
                </button>
                <button
                  type="button"
                  class="text-xs font-bold px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-red-100 text-slate-600 hover:text-red-600 transition-colors"
                  @click="askDelete(m)"
                >
                  Hapus
                </button>
              </div>
            </div>
          </article>
        </div>
      </div>
    </main>

    <!-- Form modal (create / edit) -->
    <div
      v-if="showForm"
      class="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
      @click.self="closeForm"
      @keydown.esc="closeForm"
    >
      <div class="bg-white rounded-[2rem] w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        <div class="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
          <h2 class="text-xl font-black text-slate-900">
            {{ editingId ? 'Edit warga' : 'Tambah warga' }}
          </h2>
          <button type="button" class="text-slate-400 hover:text-slate-600 text-xl leading-none" aria-label="Tutup" @click="closeForm">✕</button>
        </div>

        <div class="px-8 py-6 space-y-5">
          <!-- Foto -->
          <div>
            <span class="block text-xs font-bold text-slate-500 mb-2">Foto</span>
            <div class="flex items-center gap-4">
              <img
                v-if="shownPhoto"
                :src="shownPhoto"
                alt="Pratinjau foto"
                class="w-20 h-20 rounded-2xl object-cover bg-slate-100 shrink-0"
              />
              <div
                v-else
                class="w-20 h-20 rounded-2xl bg-slate-100 border-2 border-dashed border-slate-200 flex items-center justify-center text-2xl text-slate-300 shrink-0"
              >
                📷
              </div>

              <div class="flex flex-col gap-2 items-start">
                <input
                  ref="fileInput"
                  type="file"
                  accept="image/*"
                  class="hidden"
                  @change="onPickFile"
                />
                <button
                  type="button"
                  class="text-xs font-bold px-4 py-2 rounded-xl bg-violet-50 hover:bg-violet-100 text-violet-700 transition-colors"
                  @click="fileInput?.click()"
                >
                  {{ shownPhoto ? 'Ganti foto' : 'Pilih foto' }}
                </button>
                <button
                  v-if="shownPhoto"
                  type="button"
                  class="text-xs font-bold text-slate-400 hover:text-red-600 transition-colors"
                  @click="clearPhoto"
                >
                  Hapus foto
                </button>
                <p class="text-[11px] text-slate-400">JPG, PNG, atau WebP. Maks {{ MAX_FILE_MB }} MB.</p>
              </div>
            </div>
          </div>

          <div>
            <label for="f-name" class="block text-xs font-bold text-slate-500 mb-2">Nama lengkap</label>
            <input
              id="f-name"
              v-model="form.name"
              type="text"
              class="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
            />
          </div>

          <div>
            <label for="f-role" class="block text-xs font-bold text-slate-500 mb-2">Jabatan</label>
            <select
              id="f-role"
              v-model="form.role"
              class="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
            >
              <option value="">Anggota (tanpa jabatan)</option>
              <option v-for="r in roleOptions" :key="r" :value="r">{{ r }}</option>
            </select>
          </div>

          <div>
            <label for="f-birth" class="block text-xs font-bold text-slate-500 mb-2">Tanggal lahir</label>
            <input
              id="f-birth"
              v-model="form.birth"
              type="date"
              class="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
            />
          </div>

          <div>
            <label for="f-ig" class="block text-xs font-bold text-slate-500 mb-2">Nama Instagram</label>
            <div class="flex items-center bg-slate-50 border border-slate-200 rounded-2xl px-4 focus-within:ring-2 focus-within:ring-violet-300">
              <span class="text-slate-400 text-sm mr-2">@</span>
              <input
                id="f-ig"
                v-model="form.instagram"
                type="text"
                class="w-full bg-transparent py-3 text-sm focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label for="f-quote" class="block text-xs font-bold text-slate-500 mb-2">Quotes / kata-kata mutiara</label>
            <textarea
              id="f-quote"
              v-model="form.quote"
              rows="4"
              class="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none"
            ></textarea>
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
            {{ saving ? 'Menyimpan...' : editingId ? 'Simpan perubahan' : 'Tambah warga' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Import modal (Google Sheets -> CSV) -->
    <div
      v-if="showImport"
      class="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
      @click.self="closeImport"
    >
      <div class="bg-white rounded-[2rem] w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl">
        <div class="px-8 py-6 border-b border-slate-100 flex items-center justify-between shrink-0">
          <h2 class="text-xl font-black text-slate-900">Impor dari Google Sheets</h2>
          <button type="button" class="text-slate-400 hover:text-slate-600 text-xl leading-none" aria-label="Tutup" @click="closeImport">✕</button>
        </div>

        <div class="px-8 py-6 space-y-5 overflow-y-auto">
          <!-- Opsi 1: tempel link -->
          <div class="space-y-2">
            <label for="i-link" class="block text-xs font-bold text-slate-500">Tempel link Google Sheets</label>
            <div class="flex flex-col sm:flex-row gap-2">
              <input
                id="i-link"
                v-model="sheetUrl"
                type="url"
                placeholder="https://docs.google.com/spreadsheets/d/..."
                class="flex-1 min-w-0 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                @keyup.enter="loadFromLink"
              />
              <button
                type="button"
                class="text-sm font-bold px-5 py-3 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-60 transition-colors shrink-0"
                :disabled="loadingSheet"
                @click="loadFromLink"
              >
                {{ loadingSheet ? 'Mengambil...' : 'Ambil dari link' }}
              </button>
            </div>
            <p class="text-xs text-slate-400 leading-relaxed">
              Di Google Sheets pilih <strong>Bagikan</strong>, ubah Akses umum menjadi <strong>Siapa saja yang memiliki link</strong> (Viewer). Sheet jawaban formulir berisi kolom email, jadi kembalikan ke "Dibatasi" setelah selesai impor. Kolom Timestamp dan Email tidak ikut diimpor.
            </p>
          </div>

          <div class="flex items-center gap-3 text-xs text-slate-300">
            <span class="h-px flex-1 bg-slate-200"></span>atau<span class="h-px flex-1 bg-slate-200"></span>
          </div>

          <!-- Opsi 2: unggah file CSV -->
          <div class="flex flex-wrap items-center gap-3">
            <input ref="importInput" type="file" accept=".csv,text/csv" class="hidden" @change="onPickImport" />
            <button
              type="button"
              class="text-sm font-bold px-5 py-2.5 rounded-xl bg-violet-50 hover:bg-violet-100 text-violet-700 transition-colors"
              @click="importInput?.click()"
            >
              Unggah file CSV
            </button>
            <span v-if="importFileName" class="text-xs font-medium text-slate-400 truncate">Sumber: {{ importFileName }}</span>
          </div>
          <p class="text-xs text-slate-400 -mt-2">Unduh lewat File, Unduh, Nilai dipisahkan koma (.csv), kalau kamu tidak mau membagikan sheet-nya.</p>

          <div class="flex flex-wrap gap-x-6 gap-y-2">
            <label class="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
              <input v-model="tidyNames" type="checkbox" class="accent-violet-600" />
              Rapikan huruf besar-kecil nama
            </label>
            <label class="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
              <input v-model="importPhotos" type="checkbox" class="accent-violet-600" />
              Ikut simpan link foto dari Google Drive
            </label>
          </div>

          <p v-if="importPhotos" class="text-xs text-slate-400 leading-relaxed">
            Foto hanya tampil kalau folder fotonya di Google Drive dibagikan sebagai "Siapa saja yang memiliki link" (Viewer). Kalau belum, atur sekarang; link yang sudah tersimpan akan langsung berfungsi.
          </p>

          <p v-if="importError" class="text-sm font-medium text-red-600 bg-red-50 border border-red-100 rounded-2xl px-4 py-3">
            {{ importError }}
          </p>

          <template v-if="importRows.length">
            <div class="flex flex-wrap gap-2 text-xs font-bold">
              <span class="px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700">{{ toImport.length }} akan diimpor</span>
              <span v-if="existingCount" class="px-3 py-1.5 rounded-full bg-slate-100 text-slate-500">{{ existingCount }} sudah ada, dilewati</span>
              <span v-if="fileDupes" class="px-3 py-1.5 rounded-full bg-amber-50 text-amber-700">{{ fileDupes }} kiriman ganda, dipakai yang terakhir</span>
            </div>

            <div class="border border-slate-200 rounded-2xl overflow-auto max-h-[40vh]">
              <table class="w-full text-xs text-left">
                <thead class="bg-slate-50 text-slate-500 sticky top-0">
                  <tr>
                    <th class="px-3 py-2 w-10"></th>
                    <th class="px-3 py-2 font-bold">Nama</th>
                    <th class="px-3 py-2 font-bold">Lahir</th>
                    <th class="px-3 py-2 font-bold">Instagram</th>
                    <th class="px-3 py-2 font-bold">Quotes</th>
                    <th class="px-3 py-2 font-bold">Foto</th>
                    <th class="px-3 py-2 font-bold">Catatan</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(r, i) in importRows"
                    :key="i"
                    class="border-t border-slate-100 align-top"
                    :class="{ 'opacity-50': r.exists || !r.include }"
                  >
                    <td class="px-3 py-2">
                      <input v-model="r.include" type="checkbox" :disabled="r.exists" class="accent-violet-600" :aria-label="`Impor ${r.rawName}`" />
                    </td>
                    <td class="px-3 py-2 font-bold text-slate-800 whitespace-nowrap">{{ displayName(r) }}</td>
                    <td class="px-3 py-2 whitespace-nowrap">{{ r.birth || '-' }}</td>
                    <td class="px-3 py-2 whitespace-nowrap">{{ r.instagram ? '@' + r.instagram : '-' }}</td>
                    <td class="px-3 py-2 max-w-[14rem] truncate" :title="r.quote || ''">{{ r.quote || '-' }}</td>
                    <td class="px-3 py-2">{{ r.photo ? 'Ada' : '-' }}</td>
                    <td class="px-3 py-2 text-amber-700">
                      <template v-if="r.exists">Sudah ada di database</template>
                      <template v-else>{{ r.notes.join('; ') }}</template>
                    </td>
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
            {{ importing ? 'Mengimpor...' : `Impor ${toImport.length} warga` }}
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
        <h2 class="text-lg font-black text-slate-900 mb-2">Hapus {{ deleteTarget[COLS.name] || 'warga ini' }}?</h2>
        <p class="text-sm text-slate-500 mb-6">Data dan fotonya akan dihapus permanen dan tidak bisa dikembalikan.</p>
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