// utils/kongData.ts
// SATU-SATUNYA sumber data untuk Kong (dipakai server AI dan cadangan di browser).
// Samakan dengan data asli kelas kamu. Kong tidak akan menjawab di luar data ini.
export const KONG_DATA = {
  anggota: 32,
  saldo: 1450000,
  saldoNote: 'naik Rp 50.000 hari ini',
  jadwal: [
    { hari: 'Selasa', d: 2, jam: '08:00', mapel: 'Pemrograman Web', alias: ['pemrograman web', 'pemweb', 'web'] },
    { hari: 'Rabu', d: 3, jam: '09:30', mapel: 'Basis Data', alias: ['basis data', 'database', 'basdat', 'sql'] },
    { hari: 'Kamis', d: 4, jam: '08:00', mapel: 'Desain Antarmuka', alias: ['desain antarmuka', 'antarmuka', 'ui', 'ux', 'desain'] },
    { hari: 'Jumat', d: 5, jam: '07:30', mapel: 'Bahasa Indonesia', alias: ['bahasa indonesia', 'bindo', 'indonesia'] }
  ],
  aturan: [
    'Saling menghargai: boleh beda pendapat, tidak boleh merendahkan.',
    'Anonim bukan tanpa etika: menfess tidak dipakai untuk menyerang atau membuka aib orang.',
    'Jaga privasi anggota: data di arsip hanya untuk keperluan kelas.',
    'Bayar kas tepat waktu: catatan iuran terbuka supaya adil untuk semua.',
    'Laporkan yang janggal: ada info keliru di arsip? Sampaikan ke pengurus.'
  ]
}