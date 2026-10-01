  <!-- pages/structure.vue -->
  <!-- Versi satu file: langsung ke Supabase, tanpa server/api/members.get.js. Butuh modul @nuxtjs/supabase. -->
  <script setup>
  useHead({
    title: 'Struktur Kelas & Anggota | Siscverse',
    meta: [{ name: 'description', content: 'Direktori anggota kelas Siscverse dari backend web.' }],
    link: [
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
      { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Outfit:wght@400;500;600;700;800&display=swap' }
    ]
  })

  /* ===== AMBIL DATA LANGSUNG DARI SUPABASE ===== */
  const supabase = useSupabaseClient()

  const { data: rows, pending, error } = useAsyncData(
    'members-list',
    async () => {
      const { data, error } = await supabase.from('members').select('*')
      if (error) throw error
      return data ?? []
    },
    { lazy: true, default: () => [] }
  )

  // Error fetch tampil di console browser (F12) supaya tidak tertelan diam-diam
  watch(error, (e) => { if (e) console.error('[members] gagal:', e) }, { immediate: true })

  /* ===== RESOLVER FOTO ===== */
  function resolvePhoto(row) {
    const path = row.photo_url || row.photo || row.image_url || row.image || row.avatar_url || row.avatar || row.foto
    return path || ''
  }

  /* ===== FORMAT TANGGAL & FOTO RUSAK ===== */
  // Tanggal dari database (yyyy-mm-dd) -> "16 Mei 2007"
  const fmtBirth = (v) => {
    if (!v) return ''
    const str = String(v)
    if (!/^\d{4}-\d{2}-\d{2}/.test(str)) return str
    const d = new Date(str.slice(0, 10) + 'T00:00:00')
    return isNaN(d) ? str : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
  }
  // Foto yang gagal dimuat (misal folder Drive belum publik) diganti inisial
  const brokenPhotos = reactive(new Set())
  const photoOk = (url) => !!url && !brokenPhotos.has(url)

  /* ===== MAPPING DATA KE UI ===== */
  // Bersihkan karakter tak terlihat (sering ikut saat copy dari WhatsApp) dan spasi berlebih
  const clean = (v) => String(v ?? '').replace(/[\u200B-\u200D\u2060\uFEFF]/g, '').replace(/\s+/g, ' ').trim()

  const allMembers = computed(() => {
    const list = Array.isArray(rows.value) ? rows.value : []
    return list.map((row, index) => {
      const name = clean(row.name || row.nama || row.full_name) || 'Penjelajah Tanpa Nama'
      const role = row.role || row.jabatan || 'Anggota Kelas'
      const birth = fmtBirth(row.birth_date || row.birth || row.birthday || row.tanggal_lahir)

      let ig = row.instagram || row.ig || ''
      if (ig && !ig.startsWith('@')) ig = `@${ig}`

      const photo = resolvePhoto(row)

      const roleLower = String(role).toLowerCase()
      let category = 'Anggota Kadet'
      let color = '#64748b'

      if (roleLower.includes('ketua') || roleLower.includes('wakil') || roleLower.includes('sekretaris') || roleLower.includes('bendahara')) {
        category = 'Pengurus Inti'
        if (roleLower.includes('ketua') && !roleLower.includes('wakil')) color = '#f59e0b'
        else if (roleLower.includes('wakil')) color = '#3b82f6'
        else if (roleLower.includes('sekretaris')) color = '#10b981'
        else if (roleLower.includes('bendahara')) color = '#f43f5e'
      } else if (roleLower.includes('pj') || roleLower.includes('penanggung jawab')) {
        category = 'Penanggung Jawab Matkul'
        color = '#8b5cf6'
      }

      return {
        id: row.id ?? index,
        name,
        role,
        category,
        birth,
        instagram: ig,
        photo,
        color,
        bio: row.bio || row.deskripsi || row.quotes || row.quote || 'Kadet aktif Siscverse yang siap menjelajahi galaksi perkuliahan.'
      }
    })
  })

  /* ===== RASI BINTANG: hanya LAYOUT, isi bintang diambil dari backend =====
    Tiap bintang (slot) dicocokkan dengan kolom role/jabatan di database.
    Slot yang belum ada datanya tampil redup ("Belum diisi"). */
  const SLOTS = [
    { key: 'ketua', label: 'Ketua', color: '#f59e0b', size: 'lg', test: r => r.includes('ketua') && !r.includes('wakil') },
    { key: 'wakil', label: 'Wakil Ketua', color: '#3b82f6', size: 'lg', test: r => r.includes('wakil') },
    { key: 'sekretaris', label: 'Sekretaris', color: '#10b981', size: 'md', test: r => r.includes('sekretaris') },
    { key: 'bendahara', label: 'Bendahara', color: '#f43f5e', size: 'md', test: r => r.includes('bendahara') && !/\b(ii|2)\b/.test(r) },
    { key: 'bendahara-2', label: 'Bendahara II', color: '#f43f5e', size: 'md', test: r => r.includes('bendahara') && /\b(ii|2)\b/.test(r) },
    ...[
      ['Konsep Sistem Informasi', ['konsep', 'sistem informasi']],
      ['Bahasa Inggris', ['inggris']],
      ['Algoritma', ['algoritma']],
      ['Pancasila', ['pancasila']],
      ['Pemrograman', ['pemrograman']],
      ['Matematika Dasar', ['matematika']],
      ['Agama Islam', ['agama']],
      ['Bahasa Indonesia', ['indonesia']]
    ].map(([label, kws], i) => ({
      key: `pj-${i}`, label, prefix: 'PJ', color: '#8b5cf6', size: 'sm',
      test: r => kws.some(k => r.includes(k))
    }))
  ]

  // Posisi bintang (satuan viewBox) dan garis penghubungnya.
  // wide = desktop/tablet, tall = layar HP (zig-zag vertikal).
  const PJ_CHAIN = [0, 1, 2, 3, 4, 5, 6, 7].slice(0, -1).map(i => [`pj-${i}`, `pj-${i + 1}`])
  const LAYOUTS = {
    wide: {
      W: 1000, H: 820,
      pos: {
        ketua: [400, 100], wakil: [600, 100],
        sekretaris: [300, 270], bendahara: [700, 270], 'bendahara-2': [880, 300],
        'pj-0': [100, 480], 'pj-1': [300, 430], 'pj-2': [500, 500], 'pj-3': [700, 430],
        'pj-4': [900, 480], 'pj-5': [220, 660], 'pj-6': [500, 720], 'pj-7': [780, 660]
      },
      edges: [
        ['ketua', 'wakil'], ['ketua', 'sekretaris'], ['wakil', 'bendahara'],
        ['sekretaris', 'pj-0'], ['sekretaris', 'pj-1'], ['bendahara', 'pj-3'], ['bendahara', 'bendahara-2'], ['bendahara-2', 'pj-4'],
        ['pj-0', 'pj-1'], ['pj-1', 'pj-2'], ['pj-2', 'pj-3'], ['pj-3', 'pj-4'],
        ['pj-0', 'pj-5'], ['pj-5', 'pj-6'], ['pj-6', 'pj-7'], ['pj-7', 'pj-4'], ['pj-2', 'pj-6']
      ]
    },
    tall: {
      W: 400, H: 1200,
      pos: {
        ketua: [105, 90], wakil: [295, 90],
        sekretaris: [75, 260], bendahara: [325, 260], 'bendahara-2': [200, 380],
        'pj-0': [90, 510], 'pj-1': [300, 570], 'pj-2': [100, 690], 'pj-3': [300, 760],
        'pj-4': [100, 880], 'pj-5': [300, 950], 'pj-6': [100, 1070], 'pj-7': [300, 1140]
      },
      edges: [
        ['ketua', 'wakil'], ['ketua', 'sekretaris'], ['wakil', 'bendahara'],
        ['sekretaris', 'bendahara-2'], ['bendahara', 'bendahara-2'],
        ['bendahara-2', 'pj-0'], ['bendahara', 'pj-1'], ...PJ_CHAIN
      ]
    }
  }

  const constellation = computed(() => {
    const used = new Set()
    return SLOTS.map(s => {
      const member = allMembers.value.find(m => !used.has(m.id) && s.test(String(m.role).toLowerCase())) || null
      if (member) used.add(member.id)
      return { ...s, member }
    })
  })

  const pct = (v, total) => ((v / total) * 100).toFixed(3) + '%'
  const nodes = computed(() => constellation.value.map(s => {
    const w = LAYOUTS.wide.pos[s.key], t = LAYOUTS.tall.pos[s.key]
    return {
      ...s,
      style: {
        '--c': s.color,
        '--dx': pct(w[0], LAYOUTS.wide.W), '--dy': pct(w[1], LAYOUTS.wide.H),
        '--mx': pct(t[0], LAYOUTS.tall.W), '--my': pct(t[1], LAYOUTS.tall.H)
      }
    }
  }))
  const edgePath = (l, [a, b]) => `M ${l.pos[a][0]} ${l.pos[a][1]} L ${l.pos[b][0]} ${l.pos[b][1]}`
  const isBond = ([a, b]) => a === 'ketua' && b === 'wakil'
  const legend = [
    { label: 'Ketua', color: '#f59e0b' }, { label: 'Wakil', color: '#3b82f6' },
    { label: 'Sekretaris', color: '#10b981' }, { label: 'Bendahara', color: '#f43f5e' },
    { label: 'PJ Matkul', color: '#8b5cf6' }
  ]

  const initials = (n) => String(n || '').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()

  /* ===== PENCARIAN & FILTER ===== */
  const searchQuery = ref('')
  const selectedCategory = ref('Semua')
  const categories = ['Semua', 'Pengurus Inti', 'Penanggung Jawab Matkul', 'Anggota Kadet']

  // Kepengurusan mengikuti urutan bintang di rasi; sisanya anggota, urut abjad
  const rankById = computed(() => {
    const map = new Map()
    constellation.value.forEach((s, i) => { if (s.member) map.set(s.member.id, i) })
    return map
  })

  const filteredMembers = computed(() => {
    const q = searchQuery.value.toLowerCase()
    return allMembers.value
      .filter(m => {
        const matchesSearch = m.name.toLowerCase().includes(q) || String(m.role).toLowerCase().includes(q)
        const matchesCat = selectedCategory.value === 'Semua' || m.category === selectedCategory.value
        return matchesSearch && matchesCat
      })
      .sort((a, b) =>
        (rankById.value.get(a.id) ?? 999) - (rankById.value.get(b.id) ?? 999) ||
        a.name.localeCompare(b.name, 'id')
      )
  })

  const memberGroups = computed(() => {
    const pengurus = filteredMembers.value.filter(m => rankById.value.has(m.id))
    const anggota = filteredMembers.value.filter(m => !rankById.value.has(m.id))
    const head = pengurus.length > 0 && anggota.length > 0
    return [
      { title: 'Kepengurusan', list: pengurus, head },
      { title: 'Anggota', list: anggota, head }
    ]
  })

  /* ===== MODAL PREVIEW ===== */
  const activeModalMember = ref(null)
  function openPreview(member) { activeModalMember.value = member }
  function closeModal() { activeModalMember.value = null }
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
          <div class="badge-glass">DIREKTORI SERVER SISCVERSE</div>
          <h1 class="title">Jajaran Pengurus &<br/><span class="text-gradient">Anggota Kelas</span></h1>
          <p class="subtitle">Ensiklopedia formasi tim Siscverse yang tersinkronisasi dengan dashboard. Klik bintang untuk melihat profil.</p>
        </header>

        <!-- PENCARIAN & FILTER -->
        <div class="filter-section">
          <div class="search-box">
            <svg class="icon-search" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input v-model="searchQuery" type="text" placeholder="Cari penjelajah atau jabatan..." class="search-input" />
          </div>

          <div class="tabs">
            <button v-for="cat in categories" :key="cat" @click="selectedCategory = cat" :class="['tab-btn', { active: selectedCategory === cat }]">
              {{ cat }}
            </button>
          </div>
        </div>

        <!-- LOADER -->
        <div v-if="pending" class="loading-state">
          <div class="spinner"></div>
          <p>Memuat data dari Dashboard...</p>
        </div>

        <div v-else>
          <!-- RASI BINTANG STRUKTUR KELAS -->
          <section v-if="selectedCategory === 'Semua' && !searchQuery" class="group-section">
            <h2 class="group-title">Rasi Siscverse</h2>

            <div class="sky-map">
              <svg v-for="(l, name) in LAYOUTS" :key="name" :class="['lines', 'lines--' + name]" :viewBox="`0 0 ${l.W} ${l.H}`" preserveAspectRatio="none" aria-hidden="true">
                <path v-for="(e, i) in l.edges" :key="i" :d="edgePath(l, e)" pathLength="1" :class="['edge', { bond: isBond(e) }]" :style="{ '--i': i }" />
              </svg>

              <button
                v-for="n in nodes" :key="n.key" type="button"
                :class="['cnode', 'cnode--' + n.size, { 'is-empty': !n.member }]"
                :style="n.style" :disabled="!n.member"
                @click="n.member && openPreview(n.member)"
              >
                <span class="cstar">
                  <img v-if="n.member && photoOk(n.member.photo)" :src="n.member.photo" :alt="n.member.name" referrerpolicy="no-referrer" @error="brokenPhotos.add(n.member.photo)" />
                  <span v-else-if="n.member" class="cinit">{{ initials(n.member.name) }}</span>
                  <span v-else class="cplus">&#10022;</span>
                </span>
                <span class="clabel">
                  <span class="crole">{{ n.prefix ? n.prefix + ' ' : '' }}{{ n.label }}</span>
                  <span class="cname">{{ n.member ? n.member.name : 'Belum diisi' }}</span>
                </span>
              </button>
            </div>

            <div class="sky-legend">
              <span v-for="l in legend" :key="l.label" class="legend-item"><i :style="{ background: l.color, boxShadow: `0 0 10px ${l.color}` }"></i>{{ l.label }}</span>
            </div>
          </section>

          <!-- DIREKTORI ANGGOTA LENGKAP -->
          <section class="group-section">
            <div class="title-row">
              <h2 class="group-title">Direktori Lengkap</h2>
              <span class="count-badge">{{ filteredMembers.length }} Data</span>
            </div>

            <template v-for="g in memberGroups" :key="g.title">
              <div v-if="g.head" class="sub-head">
                <h3>{{ g.title }}</h3>
                <span>{{ g.list.length }}</span>
              </div>
              <div v-if="g.list.length" class="members-grid">
                <div v-for="member in g.list" :key="member.id" class="member-list-card" :style="{ '--accent': member.color }" @click="openPreview(member)">

                  <div class="member-frame">
                    <img v-if="photoOk(member.photo)" :src="member.photo" :alt="member.name" class="frame-img" referrerpolicy="no-referrer" @error="brokenPhotos.add(member.photo)" />
                    <div v-else class="mesh-fallback mini-mesh">
                      <span>{{ initials(member.name) }}</span>
                    </div>
                  </div>

                  <div class="member-data">
                    <h4 class="member-name">{{ member.name }}</h4>
                    <p class="member-role" :style="{ color: member.color }">{{ member.role }}</p>
                  </div>

                </div>
              </div>
            </template>

            <div v-if="filteredMembers.length === 0" class="empty-state">
              <div class="empty-icon">!</div>
              <p v-if="error">Gagal memuat data: {{ error.message }}</p>
              <p v-else>Data tidak ditemukan di database Anda.</p>
            </div>
          </section>
        </div>

      </main>

      <!-- MODAL PRATINJAU (FROSTED GLASS) -->
      <transition name="modal-zoom">
        <div v-if="activeModalMember" class="modal-backdrop" @click.self="closeModal">
          <div class="modal-glass-panel" :style="{ '--accent': activeModalMember.color }">
            <button class="close-btn" @click="closeModal">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>

            <div class="modal-content-wrap">
              <div class="modal-frame-wrapper">
                <div class="modal-frame">
                  <img v-if="photoOk(activeModalMember.photo)" :src="activeModalMember.photo" :alt="activeModalMember.name" class="frame-img" referrerpolicy="no-referrer" @error="brokenPhotos.add(activeModalMember.photo)" />
                  <div v-else class="mesh-fallback giant-mesh">
                    <span>{{ initials(activeModalMember.name) }}</span>
                  </div>
                </div>
              </div>

              <div class="modal-details">
                <div class="modal-head">
                  <span class="modal-role" :style="{ color: activeModalMember.color }">{{ activeModalMember.role }}</span>
                  <h2 class="modal-name">{{ activeModalMember.name }}</h2>
                </div>

                <div class="modal-data-box">
                  <div class="data-item">
                    <span class="d-icon">📅</span>
                    <div>
                      <span class="d-label">Tanggal Lahir</span>
                      <span class="d-value">{{ activeModalMember.birth || 'Dirahasiakan' }}</span>
                    </div>
                  </div>
                  <div class="data-item">
                    <span class="d-icon">📸</span>
                    <div>
                      <span class="d-label">Instagram</span>
                      <a v-if="activeModalMember.instagram" :href="`https://instagram.com/${activeModalMember.instagram.replace('@','')}`" target="_blank" class="d-value link">
                        {{ activeModalMember.instagram }}
                      </a>
                      <span v-else class="d-value text-muted">-</span>
                    </div>
                  </div>
                </div>

                <div class="bio-box">
                  <p>{{ activeModalMember.bio }}</p>
                </div>

                <button class="btn-primary" @click="closeModal">Tutup Profil</button>
              </div>
            </div>
          </div>
        </div>
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

  .main-layout { max-width: 1100px; margin: 0 auto; padding: 5rem 1.5rem; position: relative; z-index: 10; }

  /* ================= HEADER ================= */
  .header-section { margin-bottom: 4rem; text-align: center; display: flex; flex-direction: column; align-items: center; }
  .badge-glass {
    display: inline-block; padding: 0.5rem 1.5rem; margin-bottom: 1.5rem;
    font-family: 'Outfit', sans-serif; font-size: 0.8rem; font-weight: 700; letter-spacing: 0.2em;
    background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border); border-radius: 100px; backdrop-filter: blur(10px);
  }
  .title { font-family: 'Outfit', sans-serif; font-size: clamp(2.5rem, 6vw, 4.5rem); font-weight: 800; line-height: 1.1; margin-bottom: 1rem; letter-spacing: -0.02em; }
  .text-gradient { background: linear-gradient(135deg, #fff, #94a3b8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
  .subtitle { font-size: 1.1rem; color: var(--text-secondary); max-width: 600px; line-height: 1.6; }

  /* ================= LOADING STATE ================= */
  .loading-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 5rem 0; gap: 1rem; color: var(--text-secondary); }
  .spinner { width: 40px; height: 40px; border: 4px solid rgba(255,255,255,0.1); border-top-color: #3b82f6; border-radius: 50%; animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* ================= FILTER & SEARCH ================= */
  .filter-section { display: flex; flex-direction: column; align-items: center; gap: 1.5rem; margin-bottom: 5rem; }
  .search-box { position: relative; width: 100%; max-width: 600px; }
  .icon-search { position: absolute; top: 50%; left: 1.5rem; transform: translateY(-50%); color: var(--text-secondary); }
  .search-input {
    width: 100%; padding: 1.25rem 1.5rem 1.25rem 3.5rem;
    background: var(--glass-bg); backdrop-filter: blur(16px);
    border: 1px solid var(--glass-border); border-radius: 100px;
    font-size: 1.05rem; color: #fff; transition: all 0.3s; outline: none;
    box-shadow: 0 10px 30px rgba(0,0,0,0.2);
  }
  .search-input:focus { border-color: #3b82f6; box-shadow: 0 0 20px rgba(59, 130, 246, 0.3); }

  .tabs { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.75rem; }
  .tab-btn {
    padding: 0.6rem 1.5rem; background: var(--glass-bg); backdrop-filter: blur(10px);
    border: 1px solid var(--glass-border); border-radius: 100px;
    color: var(--text-secondary); font-family: 'Outfit', sans-serif; font-size: 0.95rem; font-weight: 600;
    cursor: pointer; transition: all 0.2s;
  }
  .tab-btn:hover { background: rgba(255,255,255,0.1); color: #fff; }
  .tab-btn.active { background: #fff; color: #000; border-color: #fff; box-shadow: 0 0 15px rgba(255,255,255,0.3); }

  /* ================= KARTU PENGURUS INTI ================= */
  .group-section { margin-bottom: 5rem; }
  .title-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 2rem; border-bottom: 1px solid var(--glass-border); padding-bottom: 1rem; }
  .group-title { font-family: 'Outfit', sans-serif; font-size: 1.4rem; font-weight: 700; color: #fff; letter-spacing: 0.05em; text-transform: uppercase; }
  .count-badge { padding: 0.3rem 0.8rem; background: var(--glass-bg); border: 1px solid var(--glass-border); border-radius: 100px; font-size: 0.85rem; color: var(--text-secondary); }
  .group-section > .group-title { border-bottom: 1px solid var(--glass-border); padding-bottom: 1rem; margin-bottom: 2rem; }

  .core-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.5rem; }
  .glass-card {
    background: var(--glass-bg); backdrop-filter: blur(20px);
    border: 1px solid var(--glass-border); border-radius: 24px;
    padding: 1.25rem; display: flex; flex-direction: column;
    cursor: pointer; transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .glass-card:hover {
    transform: translateY(-8px);
    background: rgba(30, 40, 60, 0.6);
    border-color: var(--accent);
    box-shadow: 0 20px 40px rgba(0,0,0,0.6), inset 0 0 20px rgba(255,255,255,0.05);
  }

  .card-frame {
    width: 100%; aspect-ratio: 1 / 1; border-radius: 16px; overflow: hidden;
    margin-bottom: 1.25rem; border: 1px solid rgba(255,255,255,0.05); background: #000; position: relative;
  }
  .frame-img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.6s ease; }
  .glass-card:hover .frame-img { transform: scale(1.05); }

  .mesh-fallback {
    width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
    background: linear-gradient(135deg, var(--accent), #0f172a);
  }
  .mesh-fallback span { font-family: 'Outfit', sans-serif; font-size: 3.5rem; font-weight: 700; color: #fff; text-shadow: 0 4px 10px rgba(0,0,0,0.3); }

  .card-info { display: flex; flex-direction: column; align-items: flex-start; gap: 0.4rem; padding: 0 0.5rem; }
  .role-badge { padding: 0.3rem 0.75rem; border-radius: 6px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; }
  .name-text { font-family: 'Outfit', sans-serif; font-size: 1.3rem; font-weight: 600; color: #fff; letter-spacing: -0.01em; }
  .hint-text { font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.5rem; opacity: 0; transform: translateX(-10px); transition: all 0.3s; }
  .glass-card:hover .hint-text { opacity: 1; transform: translateX(0); color: var(--accent); }

  /* ================= RASI BINTANG ================= */
  .sky-map { position: relative; width: 100%; aspect-ratio: 1000 / 820; margin: 1rem 0 1.5rem; }
  .lines { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none; }
  .lines--tall { display: none; }
  .edge {
    fill: none; stroke: rgba(148, 163, 184, 0.35); stroke-width: 1.5; stroke-linecap: round;
    stroke-dasharray: 1; stroke-dashoffset: 1;
    animation: draw 1.4s ease forwards; animation-delay: calc(var(--i) * 90ms);
  }
  .edge.bond { stroke: rgba(245, 158, 11, 0.85); stroke-width: 2.5; filter: drop-shadow(0 0 6px rgba(245, 158, 11, 0.8)); }
  @keyframes draw { to { stroke-dashoffset: 0; } }

  .cnode {
    position: absolute; left: var(--dx); top: var(--dy); transform: translate(-50%, calc(var(--size) * -0.5));
    display: flex; flex-direction: column; align-items: center; gap: 0.6rem;
    width: 150px; padding: 0; background: none; border: none; color: inherit; font: inherit;
    cursor: pointer; z-index: 2; --size: 64px;
  }
  .cnode--lg { --size: 92px; width: 190px; }
  .cnode--md { --size: 74px; width: 160px; }
  .cnode:focus-visible { outline: 2px solid var(--c); outline-offset: 6px; border-radius: 16px; }

  .cstar {
    position: relative; width: var(--size); height: var(--size); border-radius: 50%;
    display: grid; place-items: center; overflow: hidden;
    border: 2px solid var(--c);
    background: radial-gradient(circle at 30% 30%, color-mix(in srgb, var(--c) 45%, #0f172a), #0b1020);
    box-shadow: 0 0 0 5px color-mix(in srgb, var(--c) 15%, transparent), 0 0 26px color-mix(in srgb, var(--c) 55%, transparent);
    transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s;
    animation: twinkle 4.5s ease-in-out infinite;
  }
  .cnode:nth-of-type(2n) .cstar { animation-delay: -1.5s; }
  .cnode:nth-of-type(3n) .cstar { animation-delay: -3s; }
  .cstar img { width: 100%; height: 100%; object-fit: cover; }
  .cinit { font-family: 'Outfit', sans-serif; font-weight: 700; font-size: calc(var(--size) * 0.36); color: #fff; }
  .cplus { font-size: calc(var(--size) * 0.35); color: var(--c); opacity: 0.7; }
  .cnode:hover .cstar {
    transform: scale(1.12);
    box-shadow: 0 0 0 7px color-mix(in srgb, var(--c) 22%, transparent), 0 0 40px color-mix(in srgb, var(--c) 80%, transparent);
  }
  @keyframes twinkle {
    0%, 100% { box-shadow: 0 0 0 5px color-mix(in srgb, var(--c) 15%, transparent), 0 0 20px color-mix(in srgb, var(--c) 40%, transparent); }
    50% { box-shadow: 0 0 0 7px color-mix(in srgb, var(--c) 20%, transparent), 0 0 34px color-mix(in srgb, var(--c) 70%, transparent); }
  }

  .clabel { display: flex; flex-direction: column; align-items: center; gap: 0.15rem; text-align: center; text-shadow: 0 0 8px #05050a, 0 0 4px #05050a; }
  .crole { font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--c); }
  .cname {
    font-family: 'Outfit', sans-serif; font-size: 0.95rem; font-weight: 600; color: #fff; line-height: 1.25;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  }
  .cnode--lg .cname { font-size: 1.15rem; }

  .cnode.is-empty { cursor: default; opacity: 0.5; }
  .cnode.is-empty .cstar { border-style: dashed; animation: none; box-shadow: none; }
  .cnode.is-empty .cname { color: var(--text-secondary); font-weight: 500; }

  .sky-legend { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.5rem 1.5rem; color: var(--text-secondary); font-size: 0.85rem; }
  .legend-item { display: inline-flex; align-items: center; gap: 0.5rem; }
  .legend-item i { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }

  @media (max-width: 700px) {
    .sky-map { aspect-ratio: 400 / 1200; }
    .lines--wide { display: none; }
    .lines--tall { display: block; }
    .cnode { left: var(--mx); top: var(--my); width: 130px; --size: 56px; }
    .cnode--lg { --size: 72px; width: 150px; }
    .cnode--md { --size: 60px; width: 130px; }
    .cname { font-size: 0.85rem; }
    .cnode--lg .cname { font-size: 1rem; }
  }
  @media (prefers-reduced-motion: reduce) {
    .edge { animation: none; stroke-dashoffset: 0; }
    .cstar { animation: none; }
  }

  /* ================= DIREKTORI ANGGOTA (LIST) ================= */
  .members-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1.25rem; }
  .member-list-card {
    display: flex; align-items: center; gap: 1.25rem; padding: 1rem;
    background: var(--glass-bg); backdrop-filter: blur(10px);
    border: 1px solid var(--glass-border); border-radius: 20px;
    cursor: pointer; transition: all 0.3s;
  }
  .member-list-card:hover {
    background: rgba(30, 40, 60, 0.6); border-color: var(--accent);
    transform: translateX(6px); box-shadow: 0 10px 25px rgba(0,0,0,0.4);
  }

  .member-frame {
    width: 64px; height: 64px; border-radius: 14px; overflow: hidden;
    flex-shrink: 0; background: #000; border: 1px solid rgba(255,255,255,0.05);
  }
  .mini-mesh span { font-size: 1.6rem; }

  .member-data { display: flex; flex-direction: column; gap: 0.2rem; }
  .member-name { font-family: 'Outfit', sans-serif; font-size: 1.15rem; font-weight: 600; color: #fff; }
  .member-role { font-size: 0.8rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }

  .sub-head { display: flex; align-items: baseline; gap: 0.75rem; margin: 0 0 1rem; font-family: 'Outfit', sans-serif; color: var(--text-secondary); }
  .sub-head h3 { font-size: 1.05rem; font-weight: 600; color: #fff; }
  .sub-head span { font-size: 0.85rem; }
  .members-grid + .sub-head { margin-top: 2.5rem; }

  .empty-state { padding: 4rem 0; display: flex; flex-direction: column; align-items: center; gap: 1rem; color: var(--text-secondary); }
  .empty-icon { width: 48px; height: 48px; border-radius: 50%; border: 2px solid var(--text-secondary); display: grid; place-items: center; font-size: 1.5rem; font-weight: 700; }

  /* ================= MODAL PREVIEW KACA ================= */
  .modal-backdrop {
    position: fixed; inset: 0; background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(12px);
    display: flex; align-items: center; justify-content: center; padding: 1.5rem; z-index: 9999;
  }
  .modal-glass-panel {
    position: relative; width: 100%; max-width: 800px;
    background: rgba(15, 20, 30, 0.7); backdrop-filter: blur(30px);
    border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 32px;
    box-shadow: 0 30px 80px rgba(0,0,0,0.8), inset 0 0 0 1px rgba(255,255,255,0.05);
  }
  .close-btn {
    position: absolute; top: 1.5rem; right: 1.5rem; width: 44px; height: 44px;
    background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.1); border-radius: 50%;
    color: #fff; display: grid; place-items: center; cursor: pointer; z-index: 10; transition: all 0.2s;
  }
  .close-btn:hover { background: rgba(255,255,255,0.2); transform: rotate(90deg); }

  .modal-content-wrap { display: flex; padding: 2.5rem; gap: 3rem; }

  .modal-frame-wrapper { flex-shrink: 0; width: 300px; }
  .modal-frame {
    width: 100%; aspect-ratio: 3 / 4; border-radius: 20px; overflow: hidden;
    border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 20px 40px rgba(0,0,0,0.5);
  }
  .giant-mesh span { font-size: 5rem; }

  .modal-details { flex-grow: 1; display: flex; flex-direction: column; justify-content: center; }
  .modal-head { margin-bottom: 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 1.5rem; }
  .modal-role { display: inline-block; font-size: 0.9rem; font-weight: 700; color: var(--accent); text-transform: uppercase; letter-spacing: 0.15em; margin-bottom: 0.5rem; }
  .modal-name { font-family: 'Outfit', sans-serif; font-size: 2.5rem; font-weight: 700; color: #fff; line-height: 1.1; }

  .modal-data-box { display: flex; flex-direction: column; gap: 1rem; margin-bottom: 1.5rem; }
  .data-item { display: flex; align-items: flex-start; gap: 1rem; }
  .d-icon { font-size: 1.25rem; background: rgba(255,255,255,0.05); width: 40px; height: 40px; display: grid; place-items: center; border-radius: 10px; }
  .d-label { display: block; font-size: 0.8rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.2rem; }
  .d-value { font-size: 1.1rem; font-weight: 500; color: #fff; }
  .text-muted { color: var(--text-secondary) !important; }
  .link { color: #3b82f6; text-decoration: none; transition: color 0.2s; }
  .link:hover { color: #60a5fa; text-decoration: underline; }

  .bio-box {
    padding: 1rem; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05);
    border-radius: 12px; margin-bottom: 1.5rem; color: #cbd5e1; font-size: 0.95rem; line-height: 1.5;
  }

  .btn-primary {
    padding: 1.1rem; width: 100%; background: #fff; color: #000;
    font-family: 'Outfit', sans-serif; font-size: 1rem; font-weight: 700; letter-spacing: 0.05em;
    border: none; border-radius: 16px; cursor: pointer; transition: all 0.3s;
  }
  .btn-primary:hover { background: #e2e8f0; transform: translateY(-2px); box-shadow: 0 10px 25px rgba(255,255,255,0.2); }

  .modal-zoom-enter-active, .modal-zoom-leave-active { transition: opacity 0.3s, transform 0.3s; }
  .modal-zoom-enter-from, .modal-zoom-leave-to { opacity: 0; transform: scale(0.95) translateY(20px); }

  /* ================= KEYFRAMES ================= */
  @keyframes float { 0% { transform: translate(0, 0) scale(1); } 100% { transform: translate(30px, 30px) scale(1.1); } }

  /* ================= RESPONSIVE ================= */
  @media (max-width: 768px) {
    .core-grid { grid-template-columns: repeat(2, 1fr); }
    .modal-content-wrap { flex-direction: column; gap: 2rem; padding: 2rem 1.5rem; }
    .modal-frame-wrapper { width: 100%; max-width: 260px; margin: 0 auto; }
    .modal-frame { aspect-ratio: 1 / 1; border-radius: 50%; border: 4px solid var(--accent); }
    .modal-name { font-size: 2rem; }
  }
  @media (max-width: 480px) {
    .title { font-size: 2.2rem; }
    .modal-glass-panel { max-width: 100%; border-radius: 32px 32px 0 0; position: fixed; bottom: 0; margin: 0; border-bottom: none; }
    .modal-backdrop { align-items: flex-end; padding: 0; }
    .modal-content-wrap { max-height: 85vh; overflow-y: auto; }
  }
  </style>