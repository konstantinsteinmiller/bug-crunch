// ID bundle. Mirrors the key shape of `en.ts`, which is the source
// of truth — see `tests/i18nParity.test.ts`. Every `{placeholder}` must survive
// translation; a dropped one renders as literal text and reads as a bug.
export default {
  'gameName': 'Bug Crunch',
  'cancel': 'Batal',
  'close': 'Tutup',
  'ok': 'Oke',
  'continue': 'Lanjut',
  'tapToContinue': 'Ketuk untuk lanjut',
  'clickToContinue': 'Klik untuk lanjut',
  'rewards': 'HADIAH',
  'tip': 'Tips',
  'crazyGamesOnly': 'Game ini hanya tersedia di',
  'ui': {
    'next': 'Lanjut',
    'replay': 'Ulangi',
    'back': 'Kembali',
    'play': 'Main',
    'pause': 'Jeda',
    'menu': 'Menu',
    'home': 'Beranda',
    'info': 'Info'
  },
  'hud': {
    'score': 'Skor',
    'time': 'Waktu',
    'chain': 'Rantai Splat: {n}',
    'level': 'Level {n}'
  },
  'worlds': {
    'picnic': 'Tikar piknik',
    'backyard': 'Halaman rimbun',
    'attic': 'Loteng berdebu',
    'arcade': 'Arkade neon'
  },
  'bugs': {
    'ant': 'Semut',
    'sprinter': 'Semut Pelari',
    'beetle': 'Kumbang',
    'flea': 'Kutu loncat',
    'caterpillar': 'Ulat',
    'stinkbug': 'Kepik bau',
    'centipede': 'Kelabang',
    'pinatafly': 'Lalat piñata',
    'moth': 'Ngengat',
    'robobug': 'Robo-serangga'
  },
  'bosses': {
    'queenAnt': 'Ratu Semut Goliat',
    'beetleKing': 'Raja Kumbang Berduri',
    'matriarch': 'Ratu Kelabang',
    'roachPrime': 'Meka-Kecoa Prime'
  },
  'boss': {
    'tell': {
      'stomp': 'Injak bosnya!',
      'summon': 'Bersihkan kawanannya!',
      'pods': 'Remukkan telurnya!',
      'charge': 'Tahan lalu hantam!',
      'spin': 'Keluar dari lingkaran!',
      'shield': 'Hantam perisainya!',
      'beam': 'Hindari sinarnya!'
    }
  },
  'shoes': {
    'stats': {
      'speed': 'Kecepatan',
      'radius': 'Luas injakan',
      'pierce': 'Tembus baju zirah'
    },
    'sneaker': {
      'name': 'Sepatu kets klasik',
      'perk': 'Seimbang dan cepat siap lagi.',
      'trade': 'Tidak unggul di mana pun.'
    },
    'steelBoot': {
      'name': 'Sepatu ujung baja',
      'perk': 'Duri tidak melukaimu. Hantaman membuat sekitarnya pingsan.',
      'trade': 'Berat dan lambat diangkat.'
    },
    'bunnySlipper': {
      'name': 'Sandal kelinci',
      'perk': 'Langkah senyap — serangga peloncat tidak menyadarimu.',
      'trade': 'Sama sekali tidak bisa memecah cangkang.'
    },
    'rollerSkate': {
      'name': 'Sepatu roda',
      'perk': 'Injak lalu terus seret untuk membabat satu garis penuh.',
      'trade': 'Luas injakan sangat sempit.'
    },
    'cleatBoot': {
      'name': 'Sepatu pul',
      'perk': 'Pulnya menembus cangkang dan kelenjar bau.',
      'trade': 'Injakan tersempit di loker.'
    },
    'electricSock': {
      'name': 'Kaus kaki listrik',
      'perk': 'Setiap injakan menyambar tiga serangga lain.',
      'trade': 'Sambarannya hanya menghabisi yang lemah.'
    }
  },
  'locker': {
    'title': 'Loker',
    'buy': 'Beli {n}',
    'wear': 'Pakai',
    'worn': 'Dipakai',
    'needStars': 'Kurang {n} bintang',
    'needCoins': 'Kurang {n} koin',
    'price': 'Harga: {n} koin',
    'starGate': 'Terbuka di {n} bintang',
    'adUnlock': 'Tonton video untuk membuka'
  },
  'chest': {
    'label': 'Peti harta',
    'ready': 'Buka peti seharga {n} koin',
    'filling': 'Peti harta — sedang terisi',
    'spent': 'Peti harta — kosong sampai besok'
  },
  'reveal': {
    'world': 'Tempat baru untuk diinjak!',
    'shoe': 'Sepatu baru!',
    'stars': 'Tonggak bintang!',
    'record': 'Rekor baru!',
    'chest': 'Harta!',
    'foe': 'Serangga baru!',
    'starsTotal': '{n} bintang',
    'recordScore': '{n} poin',
    'recordBeat': 'Rekor lama: {n}',
    'chestCoins': '+{n} koin'
  },
  'fever': {
    'filling': 'Demam Splat: {n}%',
    'ready': 'Demam Splat siap — ketuk untuk mulai',
    'running': 'Demam Splat berjalan'
  },
  'objectives': {
    'clear': 'Selesaikan level',
    'combo': 'Capai rantai ×{n}',
    'noSpike': 'Jangan kena duri',
    'time': 'Selesai dengan sisa {n} detik',
    'accuracy': 'Kena {n}% dari injakanmu',
    'fever': 'Picu Demam Splat {n}×',
    'kind': 'Remukkan {n} {bug}',
    'feverKills': 'Remukkan {n} dalam satu Demam',
    'noMiss': 'Meleset maksimal {n} kali',
    'score': 'Kumpulkan {n} poin'
  },
  'quests': {
    'title': 'Target bintang',
    'onTrack': '{objective} — sesuai jalur',
    'progress': '{objective} — {n}% selesai',
    'missed': '{objective} — terlewat'
  },
  'hints': {
    'move': {
      'touch': 'Ketuk untuk bergerak',
      'desktop': 'Klik untuk bergerak'
    },
    'slam': {
      'touch': 'Tahan lalu lepas untuk hantaman keras',
      'desktop': 'Tahan tombol untuk hantaman keras'
    },
    'sprinter': {
      'touch': 'Si pelari kabur — injak di tempat ia berhenti',
      'desktop': 'Si pelari kabur dari sepatu — diam dulu, lalu klik'
    },
    'beetle': {
      'touch': 'Kumbang bercangkang — tahan lalu hantam',
      'desktop': 'Kumbang bercangkang — tahan lalu hantam'
    },
    'flea': {
      'touch': 'Kutu meloncat — injak tempat mendaratnya',
      'desktop': 'Kutu meloncat — injak tempat mendaratnya'
    },
    'spike': {
      'touch': 'Jangan injak yang berduri!',
      'desktop': 'Jangan injak yang berduri!'
    },
    'stink': {
      'touch': 'Kepik bau mengaburkan layar saat diremukkan',
      'desktop': 'Kepik bau mengaburkan layar saat diremukkan'
    },
    'fever': {
      'touch': 'Botolnya penuh — ketuk apinya!',
      'desktop': 'Botolnya penuh — klik apinya!'
    },
    'honey': {
      'touch': 'Madu menahan serangga peloncat',
      'desktop': 'Madu menahan serangga peloncat'
    },
    'web': {
      'touch': 'Sarang laba-laba memperlambat kakimu',
      'desktop': 'Sarang laba-laba memperlambat kakimu'
    },
    'belt': {
      'touch': 'Ban berjalan membawa serangga',
      'desktop': 'Ban berjalan membawa serangga'
    },
    'sweeper': {
      'touch': 'Penyapu meremukkan serangga secara gratis',
      'desktop': 'Penyapu meremukkan serangga secara gratis'
    },
    'boss': {
      'touch': 'Tahan lalu hantam saat bos bersiap',
      'desktop': 'Tahan lalu hantam saat bos bersiap'
    },
    'pods': {
      'touch': 'Remukkan telurnya sebelum menetas!',
      'desktop': 'Remukkan telurnya sebelum menetas!'
    }
  },
  'result': {
    'cleared': 'Level selesai!',
    'timeUp': 'Waktu habis!',
    'upNext': 'Berikutnya: {n}',
    'retryLevel': 'Coba lagi?',
    'campaignDone': 'Semua level selesai!',
    'newRecord': 'Rekor baru!',
    'nextLevel': 'Level berikutnya',
    'tryAgain': 'Coba lagi',
    'squishes': 'Serangga diremukkan',
    'starsEarned': '{n} dari 3 bintang',
    'rankOf': 'dari {n}',
    'worldUnlocked': '{n} terbuka!'
  },
  'leaderboard': {
    'title': 'Papan peringkat',
    'rank': 'Peringkat',
    'player': 'Pemain',
    'score': 'Skor',
    'level': 'Level',
    'you': 'Kamu',
    'yourRank': 'Kamu #{n} dari {total}',
    'of': 'dari {n}',
    'unranked': 'Selesaikan satu level untuk masuk papan',
    'loading': 'Memuat papan peringkat…',
    'empty': 'Belum ada yang mencetak skor',
    'failed': 'Tidak bisa menghubungi papan peringkat'
  },
  'options': {
    'title': 'Pengaturan',
    'general': 'Umum',
    'play': 'Permainan',
    'audio': 'Audio',
    'close': 'Simpan & tutup',
    'language': 'Bahasa',
    'difficulty': 'Kesulitan',
    'soundEffects': 'Efek suara',
    'music': 'Musik',
    'musicTrack': 'Lagu',
    'haptics': 'Getar',
    'on': 'Nyala',
    'off': 'Mati',
    'difficulties': {
      'easy': 'Mudah',
      'medium': 'Normal',
      'hard': 'Sulit'
    },
    'difficultyHints': {
      'easy': 'Serangga lebih lambat dan waktu lebih lama.',
      'medium': 'Game seperti yang dirancang.',
      'hard': 'Serangga lebih cepat dan papan lebih ramai.'
    },
    'musicTracks': {
      'trance': 'Groove serangga',
      'cozy': 'Piknik santai'
    },
    'juiceStyle': 'Gaya splat',
    'juiceStyles': {
      'ooze': 'Lendir kartun',
      'confetti': 'Piñata konfeti',
      'bubble': 'Gelembung sabun'
    },
    'juiceStyleHints': {
      'ooze': 'Lendir warna-warni. Gamenya tetap sama.',
      'confetti': 'Serangga meledak jadi konfeti. Gamenya tetap sama.',
      'bubble': 'Serangga jadi gelembung. Gamenya tetap sama.'
    },
    'highVis': 'Lingkaran injak besar',
    'highVisHint': 'Cincin lebih tebal dan terang di tempat kakimu akan mendarat.',
    'singleTap': 'Bidik mudah',
    'singleTapHint': 'Ketuk di mana saja dan kakimu melayang ke serangga terdekat.'
  },
  'loading': {
    'boo': 'Dor!',
    'laugh': 'Hihi!',
    'tooLong': 'Masih memuat… cek koneksimu?'
  },
  'saveStatus': {
    'restoredTitle': 'Progres dipulihkan',
    'restoredBody': 'Kami kembalikan simpananmu dan menambah {n} koin.',
    'pausedTitle': 'Penyimpanan dijeda',
    'pausedBody': 'Kami tidak bisa menghubungi layanan simpan. Progresmu aman di perangkat ini.',
    'retry': 'Coba lagi',
    'dismiss': 'Tutup',
    'tap': 'Ketuk untuk menutup'
  },
  'adsBlocked': {
    'title': 'Pemblokir iklan terdeteksi',
    'body': 'Bug Crunch gratis berkat iklan. Matikan pemblokirmu lalu muat ulang.',
    'allowPrefix': 'Izinkan iklan di',
    'allowSuffix': 'lalu muat ulang halaman.',
    'gotIt': 'Oke'
  },
  'license': {
    'denied': 'Salinan ini tidak dapat diverifikasi'
  }
}
