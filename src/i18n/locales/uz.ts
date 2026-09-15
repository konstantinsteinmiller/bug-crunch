// UZ bundle. Mirrors the key shape of `en.ts`, which is the source
// of truth — see `tests/i18nParity.test.ts`. Every `{placeholder}` must survive
// translation; a dropped one renders as literal text and reads as a bug.
export default {
  'gameName': 'Bug Crunch',
  'cancel': 'Bekor qilish',
  'close': 'Yopish',
  'ok': 'Ok',
  'continue': 'Davom etish',
  'tapToContinue': 'Davom etish uchun bosing',
  'clickToContinue': 'Davom etish uchun cherting',
  'rewards': 'MUKOFOTLAR',
  'tip': 'Maslahat',
  'crazyGamesOnly': 'Bu oʻyin faqat quyidagida mavjud:',
  'ui': {
    'next': 'Keyingi',
    'replay': 'Qaytadan',
    'back': 'Orqaga',
    'play': 'Oʻynash',
    'pause': 'Pauza',
    'menu': 'Menyu',
    'home': 'Bosh sahifa',
    'info': 'Maʼlumot'
  },
  'hud': {
    'score': 'Ochko',
    'time': 'Vaqt',
    'chain': 'Splat zanjiri: {n}',
    'level': 'Daraja {n}'
  },
  'worlds': {
    'picnic': 'Piknik toʻshagi',
    'backyard': 'Oʻsib ketgan hovli',
    'attic': 'Changli tom osti',
    'arcade': 'Neon arkada'
  },
  'bugs': {
    'ant': 'Chumolilar',
    'sprinter': 'Yugurchi chumolilar',
    'beetle': 'Qoʻngʻizlar',
    'flea': 'Burgalar',
    'caterpillar': 'Qurtlar',
    'stinkbug': 'Sassiq qandalalar',
    'centipede': 'Qirqoyoqlar',
    'pinatafly': 'Pinyata pashshalari',
    'moth': 'Kuyalar',
    'robobug': 'Robo-hasharotlar'
  },
  'bosses': {
    'queenAnt': 'Goliaf Chumoli Malikasi',
    'beetleKing': 'Tikanli Qoʻngʻiz Shohi',
    'matriarch': 'Qirqoyoq Onasi',
    'roachPrime': 'Mexa-Tarakan Praym'
  },
  'boss': {
    'tell': {
      'stomp': 'Boshliqni bos!',
      'summon': 'Toʻdani tozala!',
      'pods': 'Tuxumlarni ezib tashla!',
      'charge': 'Bosib turib urib yubor!',
      'spin': 'Halqadan chiq!',
      'shield': 'Qalqonni urib sindir!',
      'beam': 'Nurdan qoch!'
    }
  },
  'shoes': {
    'stats': {
      'speed': 'Tezlik',
      'radius': 'Bosish maydoni',
      'pierce': 'Zirh teshish'
    },
    'sneaker': {
      'name': 'Klassik krossovka',
      'perk': 'Muvozanatli va tez tayyor boʻladi.',
      'trade': 'Hech narsada ajralib turmaydi.'
    },
    'steelBoot': {
      'name': 'Poʻlat uchli botinka',
      'perk': 'Tikanlar zarar yetkazmaydi. Zarba atrofdagini garang qiladi.',
      'trade': 'Ogʻir va sekin koʻtariladi.'
    },
    'bunnySlipper': {
      'name': 'Quyon shippak',
      'perk': 'Ovozsiz qadam — sakrovchi hasharotlar sezmaydi.',
      'trade': 'Hech qanday qobiqni sindira olmaydi.'
    },
    'rollerSkate': {
      'name': 'Rolik',
      'perk': 'Bosib, sudrab butun bir chiziqni supur.',
      'trade': 'Bosish maydoni juda tor.'
    },
    'cleatBoot': {
      'name': 'Tikanli butsa',
      'perk': 'Tikanlar qobiq va hid bezini teshib oʻtadi.',
      'trade': 'Shkafdagi eng kichik maydon.'
    },
    'electricSock': {
      'name': 'Elektr paypoq',
      'perk': 'Har bosishda yana uchta hasharotga chaqmoq uradi.',
      'trade': 'Chaqmoq faqat kuchsizlarini tugatadi.'
    }
  },
  'locker': {
    'title': 'Shkaf',
    'buy': '{n} ga sotib olish',
    'wear': 'Kiyish',
    'worn': 'Kiyilgan',
    'needStars': 'Yana {n} yulduz',
    'needCoins': 'Yana {n} tanga',
    'price': 'Narxi: {n} tanga',
    'starGate': '{n} yulduzda ochiladi',
    'adUnlock': 'Ochish uchun video ko‘r'
  },
  'chest': {
    'label': 'Xazina sandig‘i',
    'ready': 'Sandiqni {n} tangaga och',
    'filling': 'Xazina sandig‘i — to‘lmoqda',
    'spent': 'Xazina sandig‘i — ertagacha bo‘sh'
  },
  'reveal': {
    'world': 'Bosadigan yangi joy!',
    'shoe': 'Yangi poyabzal!',
    'stars': 'Yulduz marrasi!',
    'record': 'Yangi rekord!',
    'chest': 'Xazina!',
    'foe': 'Yangi hasharot!',
    'starsTotal': '{n} yulduz',
    'recordScore': '{n} ochko',
    'recordBeat': 'Eski rekord: {n}',
    'chestCoins': '+{n} tanga'
  },
  'fever': {
    'filling': 'Splat isitmasi: {n}%',
    'ready': 'Splat isitmasi tayyor — bosing',
    'running': 'Splat isitmasi davom etmoqda'
  },
  'objectives': {
    'clear': 'Darajani tugat',
    'combo': '×{n} zanjirga yet',
    'noSpike': 'Tikandan zarar olma',
    'time': '{n} soniya qolganda tugat',
    'accuracy': 'Bosishlarning {n}% i tegsin',
    'fever': 'Splat isitmasini {n} marta yoq',
    'kind': '{n} ta {bug} ezib tashla',
    'feverKills': 'Bir isitmada {n} tasini ez',
    'noMiss': 'Koʻpi bilan {n} marta adash',
    'score': '{n} ochko toʻpla'
  },
  'quests': {
    'title': 'Yulduz maqsadlari',
    'onTrack': '{objective} — yoʻlida',
    'progress': '{objective} — {n}% bajarildi',
    'missed': '{objective} — qoʻldan ketdi'
  },
  'hints': {
    'move': {
      'touch': 'Harakat uchun bosing',
      'desktop': 'Harakat uchun cherting'
    },
    'slam': {
      'touch': 'Bosib turing va qoʻyib yuboring — kuchli zarba',
      'desktop': 'Tugmani bosib turing — kuchli zarba'
    },
    'sprinter': {
      'touch': 'Yugurchilar qochadi — to‘xtagan joyiga bos',
      'desktop': 'Yugurchilar poyabzaldan qochadi — qimirlama, keyin bos'
    },
    'beetle': {
      'touch': 'Qoʻngʻizlarda qobiq bor — bosib turib uring',
      'desktop': 'Qoʻngʻizlarda qobiq bor — bosib turib uring'
    },
    'flea': {
      'touch': 'Burgalar sakraydi — qoʻngan joyiga uring',
      'desktop': 'Burgalar sakraydi — qoʻngan joyiga uring'
    },
    'spike': {
      'touch': 'Tikanlilarni bosmang!',
      'desktop': 'Tikanlilarni bosmang!'
    },
    'stink': {
      'touch': 'Sassiq qandala ezilganda ekranni xiralashtiradi',
      'desktop': 'Sassiq qandala ezilganda ekranni xiralashtiradi'
    },
    'fever': {
      'touch': 'Shisha toʻldi — alangani bosing!',
      'desktop': 'Shisha toʻldi — alangani cherting!'
    },
    'honey': {
      'touch': 'Asal sakrovchilarni ushlab qoladi',
      'desktop': 'Asal sakrovchilarni ushlab qoladi'
    },
    'web': {
      'touch': 'Oʻrgimchak toʻri oyogʻingizni sekinlashtiradi',
      'desktop': 'Oʻrgimchak toʻri oyogʻingizni sekinlashtiradi'
    },
    'belt': {
      'touch': 'Tasma hasharotlarni olib ketadi',
      'desktop': 'Tasma hasharotlarni olib ketadi'
    },
    'sweeper': {
      'touch': 'Supurgi hasharotlarni bepul ezadi',
      'desktop': 'Supurgi hasharotlarni bepul ezadi'
    },
    'boss': {
      'touch': 'Boshliq tayyorlanganda bosib turib uring',
      'desktop': 'Boshliq tayyorlanganda bosib turib uring'
    },
    'pods': {
      'touch': 'Tuxumlar ochilmasdan oldin ezib tashla!',
      'desktop': 'Tuxumlar ochilmasdan oldin ezib tashla!'
    }
  },
  'result': {
    'cleared': 'Daraja tugadi!',
    'timeUp': 'Vaqt tugadi!',
    'upNext': 'Keyingisi: {n}',
    'retryLevel': 'Yana bir marta?',
    'campaignDone': 'Barcha darajalar tugadi!',
    'newRecord': 'Yangi rekord!',
    'nextLevel': 'Keyingi daraja',
    'tryAgain': 'Qayta urinish',
    'squishes': 'Ezilgan hasharotlar',
    'starsEarned': '3 tadan {n} yulduz',
    'rankOf': '{n} tadan',
    'worldUnlocked': '{n} ochildi!'
  },
  'leaderboard': {
    'title': 'Reyting',
    'rank': 'Oʻrin',
    'player': 'Oʻyinchi',
    'score': 'Ochko',
    'level': 'Daraja',
    'you': 'Siz',
    'yourRank': 'Siz {total} tadan #{n} oʻrindasiz',
    'of': '{n} tadan',
    'unranked': 'Reytingga tushish uchun bir daraja tugating',
    'loading': 'Reyting yuklanmoqda…',
    'empty': 'Hali hech kim ochko toʻplamagan',
    'failed': 'Reytingga ulanib boʻlmadi'
  },
  'options': {
    'title': 'Sozlamalar',
    'general': 'Umumiy',
    'play': 'Oʻyin',
    'audio': 'Ovoz',
    'close': 'Saqlab yopish',
    'language': 'Til',
    'difficulty': 'Qiyinlik',
    'soundEffects': 'Ovoz effektlari',
    'music': 'Musiqa',
    'musicTrack': 'Musiqa trigi',
    'haptics': 'Tebranish',
    'on': 'Yoqilgan',
    'off': 'Oʻchirilgan',
    'difficulties': {
      'easy': 'Oson',
      'medium': 'Oddiy',
      'hard': 'Qiyin'
    },
    'difficultyHints': {
      'easy': 'Hasharotlar sekinroq, vaqt koʻproq.',
      'medium': 'Oʻyin qanday moʻljallangan boʻlsa, shunday.',
      'hard': 'Hasharotlar tezroq, maydon gavjumroq.'
    },
    'musicTracks': {
      'trance': 'Hasharot ritmi',
      'cozy': 'Osoyishta piknik'
    },
    'juiceStyle': 'Sachrash uslubi',
    'juiceStyles': {
      'ooze': 'Multfilm shilimshigʻi',
      'confetti': 'Konfetti pinyata',
      'bubble': 'Sovun pufakchalari'
    },
    'juiceStyleHints': {
      'ooze': 'Rang-barang shilimshiq. Oʻyin oʻzgarmaydi.',
      'confetti': 'Hasharotlar konfettiga aylanadi. Oʻyin oʻzgarmaydi.',
      'bubble': 'Hasharotlar pufakchaga aylanadi. Oʻyin oʻzgarmaydi.'
    },
    'highVis': 'Katta bosish halqasi',
    'highVisHint': 'Oyoq tushadigan joyda qalinroq va yorqinroq halqa.',
    'singleTap': 'Oson nishon',
    'singleTapHint': 'Istalgan joyni bosing — oyoq eng yaqin hasharotga uchadi.'
  },
  'loading': {
    'boo': 'Bu!',
    'laugh': 'Hi-hi!',
    'tooLong': 'Hamon yuklanmoqda… aloqani tekshirasizmi?'
  },
  'saveStatus': {
    'restoredTitle': 'Progress tiklandi',
    'restoredBody': 'Saqlovingizni qaytardik va {n} tanga qoʻshdik.',
    'pausedTitle': 'Saqlash toʻxtatildi',
    'pausedBody': 'Saqlash xizmatiga ulana olmayapmiz. Progressingiz shu qurilmada xavfsiz.',
    'retry': 'Qayta urinish',
    'dismiss': 'Yopish',
    'tap': 'Yopish uchun bosing'
  },
  'adsBlocked': {
    'title': 'Reklama bloklagich aniqlandi',
    'body': 'Bug Crunch reklama tufayli bepul. Bloklagichni oʻchirib, sahifani qayta yuklang.',
    'allowPrefix': 'Quyidagida reklamaga ruxsat bering:',
    'allowSuffix': 'va sahifani qayta yuklang.',
    'gotIt': 'Tushunarli'
  },
  'license': {
    'denied': 'Bu nusxani tekshirib boʻlmadi'
  }
}
