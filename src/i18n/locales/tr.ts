export default {
  'gameName': 'Survivalist',
  'cancel': 'İptal',
  'close': 'Kapat',
  'ok': 'Tamam',
  'continue': 'Devam',
  'tapToContinue': 'Devam etmek için dokun',
  'clickToContinue': 'Devam etmek için tıkla',
  'rewards': 'ÖDÜLLER',
  'tip': 'İpucu',
  'crazyGamesOnly': 'Bu oyun yalnızca şurada mevcut:',

  // Shared UI labels. NOT dead keys: they are the `aria-label` on the game's
  // icon-only buttons, read aloud rather than shown. See `en.ts`.
  'ui': {
    'next': 'İleri',
    'replay': 'Tekrar',
    'back': 'Geri',
    'play': 'Oyna',
    'pause': 'Duraklat',
    'menu': 'Menü',
    'home': 'Ana ekran',
    'info': 'Bilgi'
  },

  'hud': {
    'stage': 'Bölüm {n}',
    'best': 'Rekor {n}',
    'boss': 'Patron',
    'miniboss': 'Mini Patron',
    'fireRate': 'Hız',
    'incoming': 'Saldırı geliyor!',
    'dodge': 'Kaç',
    'milestone': '{n} savaşçı!',
    'weaponActive': '{name} hazır',
    'weaponLocked': '{name} kilitli — {total} kolun {n} tanesi vuruldu',
    'weaponGift': '{name} ileride — bedava, kol yok',
    'weaponFree': 'BEDAVA'
  },

  'weapons': {
    'rocket': 'Roketatar',
    'gatling': 'Gatling'
  },

  'tutorial': {
    'touch': 'Takımını hareket ettirmek için kaydır',
    'desktop': 'Takımını yönlendirmek için fareyi oynat'
  },
  'hints': {
    'move': { 'touch': 'Hareket için dokun', 'desktop': 'Hareket için tıkla' },
    'gate': { 'touch': 'Kapıya ateş etmeye devam et: her yarım saniyede +1', 'desktop': 'Kapıya ateş etmeye devam et: her yarım saniyede +1' },
    'trap': { 'touch': 'Kırmızı kapı ekibi AZALTIR — diğerine geç!', 'desktop': 'Kırmızı kapı ekibi AZALTIR — diğerine geç!' },
    'divider': { 'touch': 'Kapılar arasındaki direğe asla dokunma', 'desktop': 'Kapılar arasındaki direğe asla dokunma' },
    'crate': { 'touch': 'Yeşil sandık: herkes daha sert vurur', 'desktop': 'Yeşil sandık: herkes daha sert vurur' },
    'rate': { 'touch': 'Mavi sandık: herkes daha hızlı ateş eder', 'desktop': 'Mavi sandık: herkes daha hızlı ateş eder' },
    'boss': { 'touch': 'Kırmızı halkanın dışında kal!', 'desktop': 'Kırmızı halkanın dışında kal!' },
    'lever': { 'touch': 'Yol kenarındaki HER İKİ kolu da vur — silah sandığını açarlar', 'desktop': 'Yol kenarındaki HER İKİ kolu da vur — silah sandığını açarlar' },
    'guard': { 'touch': 'Kalkan açık — ateşin işe yaramıyor. KAÇ!', 'desktop': 'Kalkan açık — ateşin işe yaramıyor. KAÇ!' },
    'cage': { 'touch': 'Kafeslere ateş et — tutsaklar takımına katılır', 'desktop': 'Kafeslere ateş et — tutsaklar takımına katılır' },
    'shieldBox': { 'touch': 'Kalkan sandığı — bekler, sonra bir büyük darbeyi engeller', 'desktop': 'Kalkan sandığı — bekler, sonra bir büyük darbeyi engeller' }
  },

  'flow': {

    'unlocked': 'Açıldı!',

    'guardian': "Bir koruyucu melek seni kurtardı!",

    'guardianSub': "{n} hayatta kalan geri döndü",

    'next': "Sırada: {label} · {when}"

  },

  'ladder': {
    'weaponPick': "Silah seç",
    'nextStage': "sonraki bölüm",
    'stagesAway': "{n} bölüm sonra"
  },
  'weaponPick': {
    'title': "Silahını seç",
    'subtitle': "Bölüm {n} için senin. Yolda daha fazlası bekliyor.",
    'take': "Al",
    'rocket': {
      'a': "Güdümlü salvo",
      'b': "Patlama hasarı"
    },
    'gatling': {
      'a': "İki kat atış hızı",
      'b': "Kapıları daha hızlı doldurur"
    }
  },
  'result': {
    'stageClear': 'Bölüm tamamlandı!',
    'wipedOut': 'Ekip yok edildi',
    'reachedStage': 'Bölüm {n}',
    'newRecord': 'Yeni rekor!',
    'rallied': 'İkinci nefes',
    'peakSquad': 'En büyük ekip',
    'kills': 'Öldürme',
    'tripleCoins': '3×',
    'tripleBonus': '(+{n})',
    'tripleClaimed': 'Altınlar üçe katlandı!',
    'nextStage': 'Sonraki bölüm',
    'tryAgain': 'Tekrar dene',
    'upgrade': 'Geliştir',
    'upgradeHint': 'Takımını geliştir!',
    'rankOf': '{n} içinde',
    'upNext': 'Sırada: Bölüm {n}'
  },

  // Two strings only; everything ON the card comes from keys this file
  // already had (see en.ts). `action` is the accessible name of an
  // icon-only button. `text` rides in the share sheet and is read by the
  // person who receives the picture, so it is a boast, and it has to still
  // make sense if the image never arrives.
  'share': {
    'action': 'Koşuyu paylaş',
    'text': '{game} oyununda {n}. bölüme ulaştım. Daha ileri gidebilir misin?'
  },

  'leaderboard': {
    'title': 'Liderlik Tablosu',
    'rank': '#',
    'player': 'Oyuncu',
    'stage': 'Bölüm',
    'squad': 'Ekip',
    'empty': 'Henüz skor yok. İlk sen ol!',
    'failed': 'Liderlik tablosuna ulaşılamadı.',
    'loading': 'Yükleniyor…',
    'you': 'Sen',
    'yourRank': 'Sıran #{n}',
    'of': '{n} oyuncu içinde'
  },

  'chest': {
    'label': 'Hazine sandığı',
    'ready': 'Sandığı {n} altın karşılığında aç',
    'filling': 'Hazine sandığı doluyor',
    'spent': 'Hazine sandığı yarına kadar boş'
  },

  // Daily expedition. See en.ts for what each state means, why the multiplier
  // is split from any word, and why `hud` has to stay one short word.
  'expedition': {
    'title': 'Günlük Sefer',
    'hud': 'Sefer',
    'multiplier': '{n}×',
    'available': 'Günlük sefer — bugünün yolu, üç kat madeni para',
    'confirm': 'Seferi başlat',
    'spent': 'Günlük sefer — yeni yol {time} sonra',
    'done': 'Yarın gel',
    'back': 'Kampanyaya dön'
  },

  'skills': {

    'grenade': 'El Bombası',

    'shield': 'Kalkan'

  },

  'upgrades': {
    'title': 'Geliştirmeler',
    'spotlight': 'Harca!',
    'level': 'Sv {n}',
    'maxed': 'Maks',
    'names': {
      'squad': 'Ekip',
      'power': 'Ateş gücü',
      'rate': 'Atış hızı',
      'range': 'Menzil',
      'scavenge': 'Toplayıcılık',
      'grenade': 'El Bombası',
      'shield': 'Kalkan',
      'rocket': 'Roket Gücü',
      'gatling': 'Gatling Gücü'
    },
    'descriptions': {
      'squad': 'Her bölüme daha çok hayatta kalanla başla.',
      'power': 'Her hayatta kalan atış başına daha çok hasar verir.',
      'rate': 'Her hayatta kalan daha hızlı ateş eder.',
      'range': 'Takımın yolda daha ileriden ateş açar.',
      'scavenge': 'Her turdan daha çok altın kazan.',
      'grenade': 'Ağır hasar için el bombası at.',
      'shield': 'Birkaç saniye boyunca alınan hasarı yarıya indirir.',
      'rocket': 'Bölümde açtığın roketatarlar daha çok hasar verir.',
      'gatling': 'Bölümde açtığın Gatlingler daha çok hasar verir.'
    }
  },

  'options': {
    'title': 'Seçenekler', 'general': 'Genel', 'audio': 'Ses', 'language': 'Dil',
    'difficulty': 'Zorluk', 'soundEffects': 'Ses Efektleri', 'music': 'Müzik', 'musicTrack': 'Müzik Parçası',
    'musicTracks': { 'cozy': 'Huzurlu Uyum', 'trance': 'Trance Tüneli' },
    'haptics': 'Titreşim', 'on': 'Açık', 'off': 'Kapalı',
    'close': 'Kaydet ve Kapat',
    'difficulties': { 'easy': 'Kolay', 'medium': 'Orta', 'hard': 'Zor' },
    'difficultyHints': {
      'easy': 'Daha zayıf düşmanlar ve ince barikatlar.',
      'medium': 'Standart tur.',
      'hard': 'Daha güçlü düşmanlar ve ağır barikatlar.'
    }
  },

  'adsBlocked': {
    'title': 'Reklam gösterilemedi',
    'body': 'Ödülünü kazanabilmen için bir video göstermek istedik ama tarayıcındaki bir şey reklamları engelliyor.',
    'allowPrefix': 'Lütfen şu adreste reklamlara izin ver:',
    'allowSuffix': '(veya bu oyun için reklam engelleyiciyi duraklat) ve tekrar dene.',
    'gotIt': 'Anladım'
  },
  'saveStatus': {
    'restoredTitle': 'Bulut kaydı geri yüklendi', 'restoredBody': 'Kurtarma için +{n} bonus altın',
    'tap': 'dokun', 'pausedTitle': 'Bulut eşitlemesi duraklatıldı',
    'pausedBody': 'Çevrimdışı oynuyorsun. İlerlemen burada kaydediliyor.',
    'retry': 'Yeniden dene', 'dismiss': 'kapat'
  },
  'loading': { 'tooLong': 'Yükleme çok mu uzun sürüyor? Reklam engelleyiciyi kapatıp sayfayı yenile.', 'boo': 'Bö!', 'laugh': 'Hahaha!' },
  'license': { 'denied': 'Erişim reddedildi: lütfen bir lisans satın al.' }
}
