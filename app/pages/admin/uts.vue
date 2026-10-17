<!-- pages/admin/uts.vue -->
<script setup>
const supabase = useSupabaseClient()

const MODES = [
  { value: 'LURING', label: 'Luring (tatap muka)' },
  { value: 'DARING', label: 'Daring (online)' },
]

// ---------- READ ----------
const { data: exams, refresh, error: loadError } = await useAsyncData('exams_list', async () => {
  const { data, error } = await supabase
    .from('exams')
    .select('*')
    .order('exam_date', { ascending: true })
    .order('start_time', { ascending: true, nullsFirst: false })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}, { server: false })

const grouped = computed(() => {
  const map = new Map()
  ;(exams.value || []).forEach((e) => {
    if (!map.has(e.exam_date)) map.set(e.exam_date, [])
    map.get(e.exam_date).push(e)
  })
  return [...map.entries()].map(([date, items]) => ({ date, items }))
})

const missingTime = computed(() => (exams.value || []).filter((e) => !e.start_time).length)

// ---------- STATE ----------
const emptyForm = () => ({ exam_date: '', subject: '', mode: 'LURING', start_time: '', end_time: '', room: '', notes: '' })

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

const openEdit = (e) => {
  editingId.value = e.id
  form.value = {
    exam_date: e.exam_date || '',
    subject: e.subject || '',
    mode: e.mode || 'LURING',
    start_time: (e.start_time || '').slice(0, 5),
    end_time: (e.end_time || '').slice(0, 5),
    room: e.room || '',
    notes: e.notes || '',
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
  const f = form.value
  const subject = f.subject.trim()
  if (!f.exam_date) { formError.value = 'Tanggal ujian wajib diisi.'; return }
  if (!subject) { formError.value = 'Mata kuliah wajib diisi.'; return }
  if (f.start_time && f.end_time && f.end_time <= f.start_time) {
    formError.value = 'Jam selesai harus setelah jam mulai.'
    return
  }

  saving.value = true
  const payload = {
    exam_date: f.exam_date,
    subject,
    mode: f.mode,
    start_time: f.start_time || null,
    end_time: f.end_time || null,
    room: f.room.trim() || null,
    notes: f.notes.trim() || null,
  }
  const query = editingId.value
    ? supabase.from('exams').update(payload).eq('id', editingId.value)
    : supabase.from('exams').insert(payload)
  const { error } = await query
  saving.value = false

  if (error) {
    formError.value = error.code === '23505'
      ? 'Mata kuliah itu sudah ada di tanggal yang sama.'
      : `Gagal menyimpan: ${error.message}`
    return
  }

  const wasEdit = !!editingId.value
  showForm.value = false
  await refresh()
  notify(wasEdit ? 'Jadwal ujian diperbarui.' : 'Jadwal ujian ditambahkan.')
}

// ---------- DELETE ----------
const remove = async () => {
  const target = deleteTarget.value
  if (!target) return
  deleting.value = true
  const { error } = await supabase.from('exams').delete().eq('id', target.id)
  deleting.value = false
  deleteTarget.value = null

  if (error) {
    notify(`Gagal menghapus: ${error.message}`)
    return
  }
  await refresh()
  notify('Jadwal ujian dihapus.')
}

// ---------- HELPERS ----------
const formatDate = (value) =>
  new Date(value + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const hhmm = (t) => String(t || '').slice(0, 5)
const timeText = (e) => {
  if (e.start_time && e.end_time) return `${hhmm(e.start_time)} – ${hhmm(e.end_time)}`
  if (e.start_time) return hhmm(e.start_time)
  return 'Jam belum diisi'
}

onBeforeUnmount(() => clearTimeout(toastTimer))
</script>

<template>
  <div class="flex h-screen bg-[#F8FAFC] text-slate-800 font-sans overflow-hidden selection:bg-violet-200">
    <!-- Sidebar -->
    <AdminSidebar />

    <!-- Main -->
    <main class="flex-1 overflow-y-auto relative">
      <div class="max-w-4xl mx-auto p-6 md:p-10">
        <header class="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h1 class="text-3xl font-black text-slate-900 tracking-tight">Jadwal UTS 📝</h1>
            <p class="text-slate-500 text-sm mt-1">Kelola jadwal ujian tengah semester: tanggal, mata kuliah, jam, dan ruangan.</p>
          </div>
          <button
            type="button"
            class="bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm px-6 py-3 rounded-2xl shadow-lg shadow-violet-200 transition-colors"
            @click="openCreate"
          >
            + Tambah ujian
          </button>
        </header>

        <div v-if="loadError" class="bg-red-50 border border-red-100 text-red-700 rounded-2xl p-5 text-sm font-medium">
          Gagal memuat data: {{ loadError.message }}
        </div>

        <div
          v-else-if="!(exams || []).length"
          class="min-h-[160px] flex flex-col items-center justify-center bg-white rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center"
        >
          <span class="text-3xl mb-2">🫥</span>
          <p class="text-slate-500 text-sm font-medium">Belum ada jadwal ujian. Klik "Tambah ujian" untuk mulai.</p>
        </div>

        <template v-else>
          <p v-if="missingTime" class="mb-5 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3">
            {{ missingTime }} ujian belum punya jam. Klik Edit lalu isi jam mulai dan ruangannya kalau sudah diumumkan.
          </p>

          <div class="space-y-6">
            <section v-for="g in grouped" :key="g.date">
              <h2 class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 px-1">{{ formatDate(g.date) }}</h2>
              <div class="space-y-3">
                <article
                  v-for="e in g.items"
                  :key="e.id"
                  class="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4"
                >
                  <div class="min-w-0 flex-1">
                    <p class="font-black text-slate-900">{{ e.subject }}</p>
                    <p class="text-xs font-medium text-slate-400 mt-0.5">
                      <span :class="e.start_time ? '' : 'italic'">{{ timeText(e) }}</span>
                      <template v-if="e.room"> · {{ e.room }}</template>
                    </p>
                    <p v-if="e.notes" class="text-xs text-slate-500 mt-1">{{ e.notes }}</p>
                  </div>

                  <span
                    class="self-start sm:self-auto text-[11px] font-bold px-2.5 py-1 rounded-lg shrink-0"
                    :class="e.mode === 'DARING' ? 'bg-sky-50 text-sky-700' : 'bg-emerald-50 text-emerald-700'"
                  >
                    {{ e.mode === 'DARING' ? 'Daring' : 'Luring' }}
                  </span>

                  <div class="flex gap-2 shrink-0">
                    <button
                      type="button"
                      class="text-xs font-bold px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-violet-100 text-slate-600 hover:text-violet-700 transition-colors"
                      @click="openEdit(e)"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      class="text-xs font-bold px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-red-100 text-slate-600 hover:text-red-600 transition-colors"
                      @click="deleteTarget = e"
                    >
                      Hapus
                    </button>
                  </div>
                </article>
              </div>
            </section>
          </div>
        </template>
      </div>
    </main>

    <!-- Form modal -->
    <div
      v-if="showForm"
      class="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
      @click.self="closeForm"
    >
      <div class="bg-white rounded-[2rem] w-full max-w-lg max-h-[92vh] overflow-y-auto shadow-2xl">
        <div class="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
          <h2 class="text-xl font-black text-slate-900">{{ editingId ? 'Edit ujian' : 'Tambah ujian' }}</h2>
          <button type="button" class="text-slate-400 hover:text-slate-600 text-xl leading-none" aria-label="Tutup" @click="closeForm">✕</button>
        </div>

        <div class="px-8 py-6 space-y-5">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label for="u-date" class="block text-xs font-bold text-slate-500 mb-2">Tanggal</label>
              <input
                id="u-date"
                v-model="form.exam_date"
                type="date"
                class="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
              />
            </div>
            <div>
              <label for="u-mode" class="block text-xs font-bold text-slate-500 mb-2">Cara ujian</label>
              <select
                id="u-mode"
                v-model="form.mode"
                class="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
              >
                <option v-for="m in MODES" :key="m.value" :value="m.value">{{ m.label }}</option>
              </select>
            </div>
          </div>

          <div>
            <label for="u-subject" class="block text-xs font-bold text-slate-500 mb-2">Mata kuliah</label>
            <input
              id="u-subject"
              v-model="form.subject"
              type="text"
              maxlength="100"
              placeholder="Contoh: Algoritma"
              class="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
            />
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label for="u-start" class="block text-xs font-bold text-slate-500 mb-2">Jam mulai (opsional)</label>
              <input
                id="u-start"
                v-model="form.start_time"
                type="time"
                class="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
              />
            </div>
            <div>
              <label for="u-end" class="block text-xs font-bold text-slate-500 mb-2">Jam selesai (opsional)</label>
              <input
                id="u-end"
                v-model="form.end_time"
                type="time"
                class="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
              />
            </div>
          </div>

          <div>
            <label for="u-room" class="block text-xs font-bold text-slate-500 mb-2">Ruangan atau tautan (opsional)</label>
            <input
              id="u-room"
              v-model="form.room"
              type="text"
              maxlength="60"
              placeholder="Contoh: Lab 2 atau Google Meet"
              class="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
            />
          </div>

          <div>
            <label for="u-notes" class="block text-xs font-bold text-slate-500 mb-2">Catatan (opsional)</label>
            <textarea
              id="u-notes"
              v-model="form.notes"
              rows="2"
              maxlength="300"
              placeholder="Contoh: Bawa kalkulator"
              class="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none"
            ></textarea>
          </div>

          <p v-if="formError" class="text-sm font-medium text-red-600 bg-red-50 border border-red-100 rounded-2xl px-4 py-3">{{ formError }}</p>
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
            {{ saving ? 'Menyimpan...' : editingId ? 'Simpan perubahan' : 'Tambah ujian' }}
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
        <h2 class="text-lg font-black text-slate-900 mb-2">Hapus ujian {{ deleteTarget.subject }}?</h2>
        <p class="text-sm text-slate-500 mb-6">Jadwal ini akan dihapus permanen dan tidak bisa dikembalikan.</p>
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