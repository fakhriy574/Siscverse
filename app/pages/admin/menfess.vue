<!-- pages/admin/menfess.vue -->
<script setup>
const supabase = useSupabaseClient()

// Sesuaikan nama kolom di sini kalau tabel `menfess` kamu memakai nama lain
const COLS = {
  sender: 'sender_name',
  message: 'message',
  createdAt: 'created_at',
  views: 'views',
  likes: 'likes',
}
const MAX_MESSAGE = 500

// ---------- READ ----------
const { data: messages, refresh, error: loadError } = await useAsyncData('menfess_list', async () => {
  const { data, error } = await supabase
    .from('menfess')
    .select('*')
    .order(COLS.createdAt, { ascending: false })
  if (error) throw error
  return data || []
})

const search = ref('')
const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  const list = messages.value || []
  if (!q) return list
  return list.filter((m) =>
    [m[COLS.sender], m[COLS.message]].some((v) => (v || '').toLowerCase().includes(q))
  )
})

const totalViews = computed(() => (messages.value || []).reduce((s, m) => s + Number(m[COLS.views] || 0), 0))
const totalLikes = computed(() => (messages.value || []).reduce((s, m) => s + Number(m[COLS.likes] || 0), 0))

// ---------- STATE ----------
const emptyForm = () => ({ sender: 'Admin', message: '' })

const showForm = ref(false)
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

// ---------- CREATE ----------
const openCreate = () => {
  form.value = emptyForm()
  formError.value = ''
  showForm.value = true
}

const closeForm = () => {
  if (saving.value) return
  showForm.value = false
}

const save = async () => {
  formError.value = ''
  const message = form.value.message.trim()
  if (!message) {
    formError.value = 'Pesannya jangan kosong dong.'
    return
  }
  if (message.length > MAX_MESSAGE) {
    formError.value = `Pesan maksimal ${MAX_MESSAGE} karakter.`
    return
  }

  saving.value = true
  const { error } = await supabase.from('menfess').insert({
    [COLS.sender]: form.value.sender.trim() || 'anonymous',
    [COLS.message]: message,
  })
  saving.value = false

  if (error) {
    formError.value = `Gagal mengirim: ${error.message}`
    return
  }

  showForm.value = false
  await refresh()
  notify('Pesan berhasil disiarkan.')
}

// ---------- DELETE ----------
const askDelete = (m) => {
  deleteTarget.value = m
}

const remove = async () => {
  const target = deleteTarget.value
  if (!target) return
  deleting.value = true
  const { error } = await supabase.from('menfess').delete().eq('id', target.id)
  deleting.value = false
  deleteTarget.value = null

  if (error) {
    notify(`Gagal menghapus: ${error.message}`)
    return
  }

  await refresh()
  notify('Menfess dihapus.')
}

// ---------- HELPERS ----------
const formatDate = (value) => {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const preview = (text, n = 90) => {
  const t = (text || '').trim()
  return t.length > n ? t.slice(0, n) + '…' : t
}

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
          <NuxtLink class="flex items-center px-4 py-3 text-sm font-medium rounded-2xl text-slate-500 hover:bg-slate-50 transition-all" to="/admin/schedule">📅 Schedule</NuxtLink>
          <NuxtLink class="flex items-center px-4 py-3 text-sm font-bold rounded-2xl bg-violet-50 text-violet-700 transition-all" to="/admin/menfess">💌 Menfess</NuxtLink>
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
            <h1 class="text-3xl font-black text-slate-900 tracking-tight">Menfess 💌</h1>
            <p class="text-slate-500 text-sm mt-1">Moderasi pesan anonim dan siarkan pengumuman dari admin.</p>
          </div>
          <button
            type="button"
            class="bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm px-6 py-3 rounded-2xl shadow-lg shadow-violet-200 transition-colors"
            @click="openCreate"
          >
            + Siarkan pesan
          </button>
        </header>

        <div v-if="loadError" class="bg-red-50 border border-red-100 text-red-700 rounded-2xl p-5 text-sm font-medium">
          Gagal memuat data: {{ loadError.message }}
        </div>

        <template v-else>
          <!-- Ringkasan -->
          <section class="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
            <div class="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm">
              <p class="text-xs font-bold uppercase tracking-wider text-slate-400">Total pesan</p>
              <p class="text-2xl font-black text-slate-900 mt-2">{{ (messages || []).length }}</p>
            </div>
            <div class="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm">
              <p class="text-xs font-bold uppercase tracking-wider text-slate-400">Total dilihat</p>
              <p class="text-2xl font-black text-slate-900 mt-2">👀 {{ totalViews }}</p>
            </div>
            <div class="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm">
              <p class="text-xs font-bold uppercase tracking-wider text-slate-400">Total suka</p>
              <p class="text-2xl font-black text-slate-900 mt-2">❤️ {{ totalLikes }}</p>
            </div>
          </section>

          <div class="mb-6">
            <input
              v-model="search"
              type="search"
              placeholder="Cari pengirim atau isi pesan..."
              class="w-full md:w-96 bg-white border border-slate-200 rounded-2xl px-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
            />
            <span class="text-xs font-bold text-slate-400 ml-3">{{ filtered.length }} pesan</span>
          </div>

          <div
            v-if="filtered.length === 0"
            class="min-h-[160px] flex flex-col items-center justify-center bg-white rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center"
          >
            <span class="text-3xl mb-2">🫥</span>
            <p class="text-slate-500 text-sm font-medium">
              {{ search ? 'Tidak ada pesan yang cocok dengan pencarian.' : 'Belum ada menfess yang masuk.' }}
            </p>
          </div>

          <div v-else class="columns-1 md:columns-2 xl:columns-3 gap-5">
            <article
              v-for="m in filtered"
              :key="m.id"
              class="break-inside-avoid mb-5 bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col gap-4"
            >
              <span class="self-start text-[11px] font-bold px-2.5 py-1 rounded-lg bg-violet-50 text-violet-700 max-w-full truncate">
                Dari: {{ m[COLS.sender] || 'anonymous' }}
              </span>

              <p class="text-sm text-slate-700 leading-relaxed whitespace-pre-line break-words">"{{ m[COLS.message] }}"</p>

              <div class="flex items-center justify-between pt-3 border-t border-slate-100">
                <div class="min-w-0">
                  <p class="text-xs font-bold text-slate-400 truncate">{{ formatDate(m[COLS.createdAt]) }}</p>
                  <p class="text-xs font-medium text-slate-400">👀 {{ m[COLS.views] || 0 }} · ❤️ {{ m[COLS.likes] || 0 }}</p>
                </div>
                <button
                  type="button"
                  class="text-xs font-bold px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-red-100 text-slate-600 hover:text-red-600 transition-colors shrink-0"
                  @click="askDelete(m)"
                >
                  Hapus
                </button>
              </div>
            </article>
          </div>
        </template>
      </div>
    </main>

    <!-- Form modal (siarkan pesan) -->
    <div
      v-if="showForm"
      class="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
      @click.self="closeForm"
    >
      <div class="bg-white rounded-[2rem] w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        <div class="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
          <h2 class="text-xl font-black text-slate-900">Siarkan pesan</h2>
          <button type="button" class="text-slate-400 hover:text-slate-600 text-xl leading-none" aria-label="Tutup" @click="closeForm">✕</button>
        </div>

        <div class="px-8 py-6 space-y-5">
          <div>
            <label for="m-sender" class="block text-xs font-bold text-slate-500 mb-2">Nama pengirim</label>
            <input
              id="m-sender"
              v-model="form.sender"
              type="text"
              placeholder="Contoh: Admin"
              class="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
            />
          </div>

          <div>
            <div class="flex items-center justify-between mb-2">
              <label for="m-message" class="block text-xs font-bold text-slate-500">Pesan</label>
              <span class="text-[11px] font-medium" :class="form.message.length > MAX_MESSAGE ? 'text-red-500' : 'text-slate-400'">
                {{ form.message.length }}/{{ MAX_MESSAGE }}
              </span>
            </div>
            <textarea
              id="m-message"
              v-model="form.message"
              rows="5"
              placeholder="Tulis pengumuman atau pesan di sini..."
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
            {{ saving ? 'Mengirim...' : 'Siarkan' }}
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
        <h2 class="text-lg font-black text-slate-900 mb-2">Hapus menfess ini?</h2>
        <p class="text-sm text-slate-500 mb-6">
          "{{ preview(deleteTarget[COLS.message]) }}" akan dihapus permanen dan tidak bisa dikembalikan.
        </p>
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