<!-- pages/admin/gallery.vue -->
<script setup>
const supabase = useSupabaseClient()

const BUCKET = 'gallery-photos'
const MAX_FILES = 20 // maksimal foto sekali unggah
const MAX_INPUT_MB = 15 // batas file asli sebelum dikecilkan
const MAX_SIDE = 1600 // sisi terpanjang foto setelah dikecilkan (px)

// ---------- READ ----------
const { data: photos, refresh, error: loadError } = await useAsyncData('gallery_list', async () => {
  const { data, error } = await supabase
    .from('gallery')
    .select('*')
    .order('taken_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}, { server: false })

const search = ref('')
const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  const list = photos.value || []
  if (!q) return list
  return list.filter((p) => [p.caption, p.album].some((v) => (v || '').toLowerCase().includes(q)))
})
const albums = computed(() =>
  [...new Set((photos.value || []).map((p) => (p.album || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'id'))
)

// ---------- TOAST ----------
const toast = ref('')
let toastTimer
const notify = (msg) => {
  toast.value = msg
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toast.value = ''), 3200)
}

// ---------- FOTO ----------
// Kecilkan foto supaya hemat penyimpanan dan cepat dibuka
const shrinkImage = (file) =>
  new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height))
      const width = Math.round(img.width * scale)
      const height = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d').drawImage(img, 0, 0, width, height)
      URL.revokeObjectURL(url)
      canvas.toBlob(
        (blob) => (blob ? resolve({ blob, width, height }) : reject(new Error('Gagal memproses gambar'))),
        'image/jpeg',
        0.85
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Format gambar tidak didukung (HEIC belum bisa, ubah ke JPG/PNG)'))
    }
    img.src = url
  })

// Ambil path file dari public URL, lalu hapus dari bucket
const deletePhotoFile = async (url) => {
  if (!url) return
  const marker = `/${BUCKET}/`
  const idx = url.indexOf(marker)
  if (idx === -1) return
  const path = decodeURIComponent(url.slice(idx + marker.length).split('?')[0])
  await supabase.storage.from(BUCKET).remove([path])
}

// ---------- UNGGAH ----------
const showUpload = ref(false)
const files = ref([]) // { file, preview, status }
const uAlbum = ref('')
const uDate = ref('')
const uCaption = ref('')
const uploading = ref(false)
const progress = ref(0)
const uError = ref('')
const fileInput = ref(null)

const revokeAll = () => {
  files.value.forEach((f) => URL.revokeObjectURL(f.preview))
}

const openUpload = () => {
  revokeAll()
  files.value = []
  uAlbum.value = ''
  uDate.value = ''
  uCaption.value = ''
  uError.value = ''
  progress.value = 0
  if (fileInput.value) fileInput.value.value = ''
  showUpload.value = true
}

const closeUpload = () => {
  if (uploading.value) return
  revokeAll()
  files.value = []
  showUpload.value = false
}

const onPickFiles = (e) => {
  uError.value = ''
  const picked = Array.from(e.target.files || [])
  const problems = []
  for (const file of picked) {
    if (files.value.length >= MAX_FILES) {
      problems.push(`Maksimal ${MAX_FILES} foto sekali unggah.`)
      break
    }
    if (!file.type.startsWith('image/')) {
      problems.push(`${file.name}: bukan gambar`)
      continue
    }
    if (file.size > MAX_INPUT_MB * 1024 * 1024) {
      problems.push(`${file.name}: lebih dari ${MAX_INPUT_MB} MB`)
      continue
    }
    files.value.push({ file, preview: URL.createObjectURL(file), status: 'wait' })
  }
  if (problems.length) uError.value = [...new Set(problems)].join('; ')
  e.target.value = ''
}

const removeFile = (i) => {
  URL.revokeObjectURL(files.value[i].preview)
  files.value.splice(i, 1)
}

const runUpload = async () => {
  uError.value = ''
  if (!files.value.length) {
    uError.value = 'Pilih minimal satu foto.'
    return
  }

  uploading.value = true
  progress.value = 0
  const single = files.value.length === 1
  const failures = []
  let okCount = 0

  for (let i = 0; i < files.value.length; i++) {
    const item = files.value[i]
    let path = null
    try {
      const { blob, width, height } = await shrinkImage(item.file)
      path = `${crypto.randomUUID()}.jpg`
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' })
      if (upErr) throw upErr

      const imageUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
      const { error } = await supabase.from('gallery').insert({
        image_url: imageUrl,
        caption: single ? uCaption.value.trim() || null : null,
        album: uAlbum.value.trim() || null,
        taken_at: uDate.value || null,
        width,
        height,
      })
      if (error) {
        await supabase.storage.from(BUCKET).remove([path])
        throw error
      }
      item.status = 'ok'
      okCount++
    } catch (err) {
      item.status = 'fail'
      failures.push(`${item.file.name}: ${err.message}`)
    }
    progress.value = i + 1
  }

  uploading.value = false
  await refresh()

  // Buang yang sudah berhasil; yang gagal tetap di daftar supaya bisa dicoba lagi
  files.value = files.value.filter((f) => {
    if (f.status === 'ok') URL.revokeObjectURL(f.preview)
    return f.status !== 'ok'
  })

  if (!failures.length) {
    showUpload.value = false
    notify(`${okCount} foto berhasil diunggah.`)
  } else {
    uError.value = `${okCount} berhasil, ${failures.length} gagal. ${failures.join(' | ')}`
  }
}

// ---------- EDIT ----------
const editTarget = ref(null)
const editForm = ref({ caption: '', album: '', taken_at: '' })
const savingEdit = ref(false)
const editError = ref('')

const openEdit = (p) => {
  editTarget.value = p
  editForm.value = { caption: p.caption || '', album: p.album || '', taken_at: p.taken_at || '' }
  editError.value = ''
}

const saveEdit = async () => {
  if (!editTarget.value) return
  savingEdit.value = true
  editError.value = ''
  const { error } = await supabase
    .from('gallery')
    .update({
      caption: editForm.value.caption.trim() || null,
      album: editForm.value.album.trim() || null,
      taken_at: editForm.value.taken_at || null,
    })
    .eq('id', editTarget.value.id)
  savingEdit.value = false

  if (error) {
    editError.value = `Gagal menyimpan: ${error.message}`
    return
  }
  editTarget.value = null
  await refresh()
  notify('Foto diperbarui.')
}

// ---------- HAPUS ----------
const deleteTarget = ref(null)
const deleting = ref(false)

const remove = async () => {
  const target = deleteTarget.value
  if (!target) return
  deleting.value = true
  const { error } = await supabase.from('gallery').delete().eq('id', target.id)
  deleting.value = false
  deleteTarget.value = null

  if (error) {
    notify(`Gagal menghapus: ${error.message}`)
    return
  }
  await deletePhotoFile(target.image_url)
  await refresh()
  notify('Foto dihapus.')
}

// ---------- HELPERS ----------
const formatDate = (value) => {
  if (!value) return ''
  return new Date(value + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}

onBeforeUnmount(() => {
  revokeAll()
  clearTimeout(toastTimer)
})
</script>

<template>
  <div class="flex h-screen bg-[#F8FAFC] text-slate-800 font-sans overflow-hidden selection:bg-violet-200">
    <!-- Sidebar -->
    <AdminSidebar />

    <!-- Main -->
    <main class="flex-1 overflow-y-auto relative">
      <div class="max-w-6xl mx-auto p-6 md:p-10">
        <header class="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h1 class="text-3xl font-black text-slate-900 tracking-tight">Gallery 🖼️</h1>
            <p class="text-slate-500 text-sm mt-1">Kelola foto kegiatan kelas: unggah, ubah keterangan, dan hapus.</p>
          </div>
          <button
            type="button"
            class="bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm px-6 py-3 rounded-2xl shadow-lg shadow-violet-200 transition-colors"
            @click="openUpload"
          >
            + Unggah foto
          </button>
        </header>

        <div class="mb-6">
          <input
            v-model="search"
            type="search"
            placeholder="Cari keterangan atau album..."
            class="w-full md:w-96 bg-white border border-slate-200 rounded-2xl px-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
          />
          <span class="text-xs font-bold text-slate-400 ml-3">{{ filtered.length }} foto</span>
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
            {{ search ? 'Tidak ada foto yang cocok dengan pencarian.' : 'Belum ada foto. Klik "Unggah foto" untuk mulai.' }}
          </p>
        </div>

        <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          <article
            v-for="p in filtered"
            :key="p.id"
            class="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col"
          >
            <img
              :src="p.image_url"
              :alt="p.caption || 'Foto galeri'"
              loading="lazy"
              class="w-full aspect-square object-cover bg-slate-100"
            />
            <div class="p-4 flex flex-col gap-2 flex-1">
              <p class="text-sm text-slate-700 leading-relaxed flex-1">
                <template v-if="p.caption">{{ p.caption }}</template>
                <span v-else class="text-slate-300">Belum ada keterangan.</span>
              </p>
              <div class="flex flex-wrap items-center gap-2 text-[11px] font-bold">
                <span v-if="p.album" class="px-2 py-0.5 rounded-lg bg-violet-50 text-violet-700">{{ p.album }}</span>
                <span v-if="p.taken_at" class="text-slate-400">📅 {{ formatDate(p.taken_at) }}</span>
              </div>
              <div class="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  class="text-xs font-bold px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-violet-100 text-slate-600 hover:text-violet-700 transition-colors"
                  @click="openEdit(p)"
                >
                  Edit
                </button>
                <button
                  type="button"
                  class="text-xs font-bold px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-red-100 text-slate-600 hover:text-red-600 transition-colors"
                  @click="deleteTarget = p"
                >
                  Hapus
                </button>
              </div>
            </div>
          </article>
        </div>
      </div>
    </main>

    <!-- Upload modal -->
    <div
      v-if="showUpload"
      class="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
      @click.self="closeUpload"
    >
      <div class="bg-white rounded-[2rem] w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl">
        <div class="px-8 py-6 border-b border-slate-100 flex items-center justify-between shrink-0">
          <h2 class="text-xl font-black text-slate-900">Unggah foto</h2>
          <button type="button" class="text-slate-400 hover:text-slate-600 text-xl leading-none" aria-label="Tutup" @click="closeUpload">✕</button>
        </div>

        <div class="px-8 py-6 space-y-5 overflow-y-auto">
          <div class="flex flex-wrap items-center gap-3">
            <input ref="fileInput" type="file" accept="image/*" multiple class="hidden" @change="onPickFiles" />
            <button
              type="button"
              class="text-sm font-bold px-5 py-2.5 rounded-xl bg-violet-50 hover:bg-violet-100 text-violet-700 transition-colors disabled:opacity-60"
              :disabled="uploading"
              @click="fileInput?.click()"
            >
              {{ files.length ? 'Tambah foto lagi' : 'Pilih foto' }}
            </button>
            <span class="text-xs text-slate-400">Bisa pilih banyak sekaligus (maks {{ MAX_FILES }}). Foto otomatis dikecilkan.</span>
          </div>

          <div v-if="files.length" class="grid grid-cols-4 sm:grid-cols-5 gap-3">
            <div v-for="(f, i) in files" :key="f.preview" class="relative aspect-square rounded-xl overflow-hidden bg-slate-100">
              <img :src="f.preview" alt="" class="w-full h-full object-cover" />
              <span
                v-if="f.status === 'fail'"
                class="absolute inset-0 bg-red-500/50 text-white text-lg font-black flex items-center justify-center"
              >!</span>
              <button
                v-if="!uploading"
                type="button"
                class="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 hover:bg-black/80 text-white text-xs leading-none"
                :aria-label="`Buang ${f.file.name}`"
                @click="removeFile(i)"
              >
                ✕
              </button>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label for="g-album" class="block text-xs font-bold text-slate-500 mb-2">Album (opsional)</label>
              <input
                id="g-album"
                v-model="uAlbum"
                list="album-list"
                type="text"
                maxlength="40"
                placeholder="Contoh: Study Tour"
                class="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
              />
              <datalist id="album-list">
                <option v-for="a in albums" :key="a" :value="a" />
              </datalist>
            </div>
            <div>
              <label for="g-date" class="block text-xs font-bold text-slate-500 mb-2">Tanggal kegiatan (opsional)</label>
              <input
                id="g-date"
                v-model="uDate"
                type="date"
                class="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
              />
            </div>
          </div>

          <div v-if="files.length === 1">
            <label for="g-caption" class="block text-xs font-bold text-slate-500 mb-2">Keterangan (opsional)</label>
            <textarea
              id="g-caption"
              v-model="uCaption"
              rows="2"
              maxlength="300"
              class="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none"
            ></textarea>
          </div>
          <p v-else-if="files.length > 1" class="text-xs text-slate-400">
            Album dan tanggal berlaku untuk semua foto. Keterangan per foto bisa diisi lewat tombol Edit setelah diunggah.
          </p>

          <p v-if="uploading" class="text-sm font-bold text-violet-700">Mengunggah {{ progress }} dari {{ files.length }}...</p>
          <p v-if="uError" class="text-sm font-medium text-red-600 bg-red-50 border border-red-100 rounded-2xl px-4 py-3 break-words">
            {{ uError }}
          </p>
        </div>

        <div class="px-8 py-5 border-t border-slate-100 flex justify-end gap-3 shrink-0">
          <button
            type="button"
            class="text-sm font-bold px-5 py-2.5 rounded-xl text-slate-500 hover:bg-slate-100 transition-colors"
            :disabled="uploading"
            @click="closeUpload"
          >
            Batal
          </button>
          <button
            type="button"
            class="text-sm font-bold px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-60 transition-colors"
            :disabled="uploading || !files.length"
            @click="runUpload"
          >
            {{ uploading ? 'Mengunggah...' : `Unggah ${files.length || ''} foto` }}
          </button>
        </div>
      </div>
    </div>

    <!-- Edit modal -->
    <div
      v-if="editTarget"
      class="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
      @click.self="editTarget = null"
    >
      <div class="bg-white rounded-[2rem] w-full max-w-md max-h-[92vh] overflow-y-auto shadow-2xl">
        <div class="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
          <h2 class="text-xl font-black text-slate-900">Edit foto</h2>
          <button type="button" class="text-slate-400 hover:text-slate-600 text-xl leading-none" aria-label="Tutup" @click="editTarget = null">✕</button>
        </div>
        <div class="px-8 py-6 space-y-5">
          <img :src="editTarget.image_url" alt="" class="w-full max-h-56 object-cover rounded-2xl bg-slate-100" />
          <div>
            <label for="e-caption" class="block text-xs font-bold text-slate-500 mb-2">Keterangan</label>
            <textarea
              id="e-caption"
              v-model="editForm.caption"
              rows="3"
              maxlength="300"
              class="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none"
            ></textarea>
          </div>
          <div>
            <label for="e-album" class="block text-xs font-bold text-slate-500 mb-2">Album</label>
            <input
              id="e-album"
              v-model="editForm.album"
              list="album-list"
              type="text"
              maxlength="40"
              class="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
            />
          </div>
          <div>
            <label for="e-date" class="block text-xs font-bold text-slate-500 mb-2">Tanggal kegiatan</label>
            <input
              id="e-date"
              v-model="editForm.taken_at"
              type="date"
              class="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
            />
          </div>
          <p v-if="editError" class="text-sm font-medium text-red-600 bg-red-50 border border-red-100 rounded-2xl px-4 py-3">{{ editError }}</p>
        </div>
        <div class="px-8 py-5 border-t border-slate-100 flex justify-end gap-3">
          <button
            type="button"
            class="text-sm font-bold px-5 py-2.5 rounded-xl text-slate-500 hover:bg-slate-100 transition-colors"
            :disabled="savingEdit"
            @click="editTarget = null"
          >
            Batal
          </button>
          <button
            type="button"
            class="text-sm font-bold px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-60 transition-colors"
            :disabled="savingEdit"
            @click="saveEdit"
          >
            {{ savingEdit ? 'Menyimpan...' : 'Simpan perubahan' }}
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
        <img :src="deleteTarget.image_url" alt="" class="w-24 h-24 object-cover rounded-2xl mx-auto mb-3 bg-slate-100" />
        <h2 class="text-lg font-black text-slate-900 mb-2">Hapus foto ini?</h2>
        <p class="text-sm text-slate-500 mb-6">Foto akan dihapus permanen dan tidak bisa dikembalikan.</p>
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