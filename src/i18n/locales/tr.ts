// TR bundle. Mirrors the key shape of `en.ts`, which is the source
// of truth — see `tests/i18nParity.test.ts`. Every `{placeholder}` must survive
// translation; a dropped one renders as literal text and reads as a bug.
export default {
  'gameName': 'Bug Crunch',
  'cancel': 'İptal',
  'close': 'Kapat',
  'ok': 'Tamam',
  'continue': 'Devam',
  'tapToContinue': 'Devam için dokun',
  'clickToContinue': 'Devam için tıkla',
  'cutscene': {
    // The skip control on a cutscene. A cutscene never replays, so the
    // control is irreversible and gets a word rather than a bare glyph.
    'skip': 'Atla'
  },
  'rewards': 'ÖDÜLLER',
  'tip': 'İpucu',
  'crazyGamesOnly': 'Bu oyun yalnızca şurada mevcut:',
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
    'score': 'Puan',
    'time': 'Süre',
    'chain': 'Splat zinciri: {n}',
    'level': 'Bölüm {n}'
  },
  'worlds': {
    'picnic': 'Piknik örtüsü',
    'backyard': 'Bakımsız bahçe',
    'attic': 'Tozlu tavan arası',
    'arcade': 'Neon oyun salonu'
  },
  'bugs': {
    'ant': 'Karıncalar',
    'sprinter': 'Koşucu Karıncalar',
    'beetle': 'Böcekler',
    'flea': 'Pireler',
    'caterpillar': 'Tırtıllar',
    'stinkbug': 'Kokarcalar',
    'centipede': 'Kırkayaklar',
    'pinatafly': 'Piñata sinekleri',
    'moth': 'Güveler',
    'robobug': 'Robo-böcekler'
  },
  'bosses': {
    'queenAnt': 'Goliath Karınca Kraliçesi',
    'beetleKing': 'Dikenli Böcek Kralı',
    'matriarch': 'Kırkayak Ana',
    'roachPrime': 'Meka-Hamamböceği Prime'
  },
  'boss': {
    'tell': {
      'stomp': 'Patrona bas!',
      'summon': 'Sürüyü temizle!',
      'pods': 'Yumurtaları ez!',
      'charge': 'Basılı tut ve vur!',
      'spin': 'Halkadan çık!',
      'shield': 'Kalkanı kır!',
      'beam': 'Işından kaç!'
    }
  },
  'shoes': {
    'stats': {
      'speed': 'Hız',
      'radius': 'Basma alanı',
      'pierce': 'Zırh delme'
    },
    'sneaker': {
      'name': 'Klasik spor ayakkabı',
      'perk': 'Dengeli ve çabuk toparlanır.',
      'trade': 'Hiçbir şeyde üstün değil.'
    },
    'steelBoot': {
      'name': 'Çelik burunlu bot',
      'perk': 'Dikenler sana işlemez. Vuruşlar çevredekileri sersemletir.',
      'trade': 'Ağır ve yavaş kalkar.'
    },
    'bunnySlipper': {
      'name': 'Tavşan terlik',
      'perk': 'Sessiz adım — zıplayanlar geldiğini görmez.',
      'trade': 'Hiçbir kabuğu kıramaz.'
    },
    'rollerSkate': {
      'name': 'Paten',
      'perk': 'Bas ve sürüklemeye devam et, koca bir çizgiyi sür.',
      'trade': 'Çok dar basma alanı.'
    },
    'cleatBoot': {
      'name': 'Krampon',
      'perk': 'Kramponlar kabukları ve bezleri deler.',
      'trade': 'Dolaptaki en küçük basma alanı.'
    },
    'electricSock': {
      'name': 'Elektrikli çorap',
      'perk': 'Her basış üç böceğe daha yıldırım gönderir.',
      'trade': 'Yıldırımlar yalnızca zayıfları bitirir.'
    }
  },
  'locker': {
    'title': 'Dolap',
    'buy': 'Satın al {n}',
    'wear': 'Giy',
    'worn': 'Giyili',
    'needStars': '{n} yıldız daha',
    'needCoins': '{n} altın daha',
    'price': 'Fiyat: {n} altın',
    'starGate': '{n} yıldızda açılır',
    'adUnlock': 'Açmak için video izle'
  },
  'chest': {
    'label': 'Hazine sandığı',
    'ready': 'Sandığı {n} altına aç',
    'filling': 'Hazine sandığı — doluyor',
    'spent': 'Hazine sandığı — yarına kadar boş'
  },
  'reveal': {
    'world': 'Ezmek için yeni bir yer!',
    'shoe': 'Yeni ayakkabı!',
    'stars': 'Yıldız hedefi!',
    'record': 'Yeni rekor!',
    'chest': 'Hazine!',
    'foe': 'Yeni bir böcek!',
    'starsTotal': '{n} yıldız',
    'recordScore': '{n} puan',
    'recordBeat': 'Eski rekor: {n}',
    'chestCoins': '+{n} altın'
  },
  'fever': {
    'filling': 'Splat Ateşi: %{n} dolu',
    'ready': 'Splat Ateşi hazır — başlamak için dokun',
    'running': 'Splat Ateşi sürüyor'
  },
  'objectives': {
    'clear': 'Bölümü bitir',
    'combo': '×{n} zincire ulaş',
    'noSpike': 'Dikenlerden hasar alma',
    'time': '{n}sn kala bitir',
    'accuracy': 'Basışlarının %{n} kadarını tutturt',
    'fever': 'Splat Ateşi\'ni {n}× başlat',
    'kind': '{n} {bug} ez',
    'feverKills': 'Tek Ateş\'te {n} tane ez',
    'noMiss': 'En fazla {n} basış ıskala',
    'score': '{n} puan topla'
  },
  'quests': {
    'title': 'Yıldız hedefleri',
    'onTrack': '{objective} — yolunda',
    'progress': '{objective} — {n}% tamam',
    'missed': '{objective} — kaçırıldı'
  },
  'hints': {
    'move': {
      'touch': 'Hareket için dokun',
      'desktop': 'Hareket için tıkla'
    },
    'slam': {
      'touch': 'Basılı tut, bırak — güçlü vuruş',
      'desktop': 'Düğmeyi basılı tut — güçlü vuruş'
    },
    'sprinter': {
      'touch': 'Koşucular kaçar — durdukları yere bas',
      'desktop': 'Koşucular ayakkabıdan kaçar — kıpırdama, sonra tıkla'
    },
    'beetle': {
      'touch': 'Böceklerin kabuğu var — tut ve vur',
      'desktop': 'Böceklerin kabuğu var — tut ve vur'
    },
    'flea': {
      'touch': 'Pireler zıplar — indikleri yere bas',
      'desktop': 'Pireler zıplar — indikleri yere bas'
    },
    'spike': {
      'touch': 'Dikenlilere basma!',
      'desktop': 'Dikenlilere basma!'
    },
    'stink': {
      'touch': 'Kokarcalar ezilince ekranı bulandırır',
      'desktop': 'Kokarcalar ezilince ekranı bulandırır'
    },
    'fever': {
      'touch': 'Şişe doldu — aleve dokun!',
      'desktop': 'Şişe doldu — aleve tıkla!'
    },
    'honey': {
      'touch': 'Bal zıplayanları yerinde tutar',
      'desktop': 'Bal zıplayanları yerinde tutar'
    },
    'web': {
      'touch': 'Örümcek ağları ayağını yavaşlatır',
      'desktop': 'Örümcek ağları ayağını yavaşlatır'
    },
    'belt': {
      'touch': 'Bant böcekleri taşır',
      'desktop': 'Bant böcekleri taşır'
    },
    'sweeper': {
      'touch': 'Süpürge böcekleri bedavaya ezer',
      'desktop': 'Süpürge böcekleri bedavaya ezer'
    },
    'boss': {
      'touch': 'Patron hazırlanırken tut ve vur',
      'desktop': 'Patron hazırlanırken tut ve vur'
    },
    'pods': {
      'touch': 'Yumurtaları çatlamadan ez!',
      'desktop': 'Yumurtaları çatlamadan ez!'
    }
  },
  'result': {
    'cleared': 'Bölüm tamam!',
    'timeUp': 'Süre doldu!',
    'upNext': 'Sırada: {n}',
    'retryLevel': 'Tekrar mı?',
    'campaignDone': 'Tüm bölümler tamam!',
    'newRecord': 'Yeni rekor!',
    'nextLevel': 'Sonraki bölüm',
    'tryAgain': 'Tekrar dene',
    'squishes': 'Ezilen böcek',
    'starsEarned': '3 yıldızdan {n} tanesi',
    'rankOf': '/ {n}',
    'worldUnlocked': '{n} açıldı!'
  },
  'leaderboard': {
    'title': 'Sıralama',
    'rank': 'Sıra',
    'player': 'Oyuncu',
    'score': 'Puan',
    'level': 'Bölüm',
    'you': 'Sen',
    'yourRank': '{total} kişi içinde #{n} sıradasın',
    'of': '/ {n}',
    'unranked': 'Sıralamaya girmek için bir bölüm bitir',
    'loading': 'Sıralama yükleniyor…',
    'empty': 'Henüz kimse puan yapmadı',
    'failed': 'Sıralamaya ulaşılamadı'
  },
  'options': {
    'title': 'Ayarlar',
    'general': 'Genel',
    'play': 'Oyun',
    'audio': 'Ses',
    'close': 'Kaydet ve kapat',
    'language': 'Dil',
    'difficulty': 'Zorluk',
    'soundEffects': 'Ses efektleri',
    'music': 'Müzik',
    'musicTrack': 'Müzik parçası',
    'haptics': 'Titreşim',
    'on': 'Açık',
    'off': 'Kapalı',
    'difficulties': {
      'easy': 'Kolay',
      'medium': 'Normal',
      'hard': 'Zor'
    },
    'difficultyHints': {
      'easy': 'Daha yavaş böcekler ve daha çok süre.',
      'medium': 'Oyun tasarlandığı gibi.',
      'hard': 'Daha hızlı böcekler ve daha kalabalık alan.'
    },
    'musicTracks': {
      'parade': 'Çıtır geçit töreni',
      'trance': 'Böcek grooveu',
      'cozy': 'Sakin piknik'
    },
    'juiceStyle': 'Splat tarzı',
    'juiceStyles': {
      'ooze': 'Çizgi film balçığı',
      'confetti': 'Konfetili piñata',
      'bubble': 'Sabun köpüğü'
    },
    'juiceStyleHints': {
      'ooze': 'Renkli balçık. Oyun aynı kalır.',
      'confetti': 'Böcekler konfetiye dönüşür. Oyun aynı kalır.',
      'bubble': 'Böcekler köpük olur. Oyun aynı kalır.'
    },
    'highVis': 'Büyük basma halkası',
    'highVisHint': 'Ayağının ineceği yerde daha kalın, daha parlak bir halka.',
    'singleTap': 'Kolay nişan',
    'singleTapHint': 'Nereye dokunursan dokun, ayağın en yakın böceğe uçar.'
  },
  'loading': {
    'boo': 'Bö!',
    'laugh': 'Hi hi!',
    'tooLong': 'Hâlâ yükleniyor… bağlantını kontrol eder misin?'
  },
  'saveStatus': {
    'restoredTitle': 'İlerleme geri geldi',
    'restoredBody': 'Kaydını geri getirdik ve {n} altın ekledik.',
    'pausedTitle': 'Kaydetme duraklatıldı',
    'pausedBody': 'Kayıt servisine ulaşamıyoruz. İlerlemen bu cihazda güvende.',
    'retry': 'Yeniden',
    'dismiss': 'Kapat',
    'tap': 'Kapatmak için dokun'
  },
  'adsBlocked': {
    'title': 'Reklam engelleyici bulundu',
    'body': 'Bug Crunch reklamlar sayesinde ücretsiz. Engelleyiciyi kapat ve sayfayı yenile.',
    'allowPrefix': 'Şurada reklamlara izin ver:',
    'allowSuffix': 've sayfayı yenile.',
    'gotIt': 'Anladım'
  },
  'license': {
    'denied': 'Bu kopya doğrulanamadı'
  }
}
