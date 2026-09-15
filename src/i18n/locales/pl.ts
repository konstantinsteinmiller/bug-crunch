// PL bundle. Mirrors the key shape of `en.ts`, which is the source
// of truth — see `tests/i18nParity.test.ts`. Every `{placeholder}` must survive
// translation; a dropped one renders as literal text and reads as a bug.
export default {
  'gameName': 'Bug Crunch',
  'cancel': 'Anuluj',
  'close': 'Zamknij',
  'ok': 'Ok',
  'continue': 'Dalej',
  'tapToContinue': 'Dotknij, aby kontynuować',
  'clickToContinue': 'Kliknij, aby kontynuować',
  'rewards': 'NAGRODY',
  'tip': 'Wskazówka',
  'crazyGamesOnly': 'Ta gra jest dostępna tylko na',
  'ui': {
    'next': 'Dalej',
    'replay': 'Jeszcze raz',
    'back': 'Wstecz',
    'play': 'Graj',
    'pause': 'Pauza',
    'menu': 'Menu',
    'home': 'Start',
    'info': 'Info'
  },
  'hud': {
    'score': 'Punkty',
    'time': 'Czas',
    'chain': 'Seria Splat: {n}',
    'level': 'Poziom {n}'
  },
  'worlds': {
    'picnic': 'Koc piknikowy',
    'backyard': 'Zarośnięty ogród',
    'attic': 'Zakurzony strych',
    'arcade': 'Neonowy salon gier'
  },
  'bugs': {
    'ant': 'Mrówki',
    'sprinter': 'Mrówki biegacze',
    'beetle': 'Żuki',
    'flea': 'Pchły',
    'caterpillar': 'Gąsienice',
    'stinkbug': 'Smrodliwki',
    'centipede': 'Stonogi',
    'pinatafly': 'Muchy piniaty',
    'moth': 'Ćmy',
    'robobug': 'Roboowady'
  },
  'bosses': {
    'queenAnt': 'Królowa Mrówek Goliat',
    'beetleKing': 'Kolczasty Król Żuków',
    'matriarch': 'Matriarchini Stonóg',
    'roachPrime': 'Mecha-Karaluch Prime'
  },
  'boss': {
    'tell': {
      'stomp': 'Rozdepcz bossa!',
      'summon': 'Posprzątaj rój!',
      'pods': 'Rozgnieć jaja!',
      'charge': 'Przytrzymaj i uderz!',
      'spin': 'Uciekaj z kręgu!',
      'shield': 'Rozbij tarczę!',
      'beam': 'Unikaj promienia!'
    }
  },
  'shoes': {
    'stats': {
      'speed': 'Szybkość',
      'radius': 'Pole deptania',
      'pierce': 'Przebicie pancerza'
    },
    'sneaker': {
      'name': 'Klasyczny trampek',
      'perk': 'Wyważony i szybko gotowy.',
      'trade': 'W niczym nie wybitny.'
    },
    'steelBoot': {
      'name': 'But ze stalowym noskiem',
      'perk': 'Kolce ci niestraszne. Uderzenia ogłuszają wszystko dookoła.',
      'trade': 'Ciężki i wolno się go podnosi.'
    },
    'bunnySlipper': {
      'name': 'Kapeć króliczek',
      'perk': 'Cichy krok — skoczki cię nie zauważą.',
      'trade': 'Nie rozbije żadnego pancerza.'
    },
    'rollerSkate': {
      'name': 'Wrotka',
      'perk': 'Nadepnij i ciągnij, żeby zaorać całą linię.',
      'trade': 'Bardzo wąskie pole deptania.'
    },
    'cleatBoot': {
      'name': 'Korkotrampek',
      'perk': 'Korki przebijają pancerze i gruczoły.',
      'trade': 'Najmniejsze pole w szafce.'
    },
    'electricSock': {
      'name': 'Elektryczna skarpeta',
      'perk': 'Każde nadepnięcie ciska błyskawice w trzy kolejne owady.',
      'trade': 'Błyskawice dobijają tylko słabe.'
    }
  },
  'locker': {
    'title': 'Szafka',
    'buy': 'Kup {n}',
    'wear': 'Załóż',
    'worn': 'Założone',
    'needStars': 'Jeszcze {n} gwiazdek',
    'needCoins': 'Jeszcze {n} monet',
    'price': 'Cena: {n} monet',
    'starGate': 'Odblokowane przy {n} gwiazdkach',
    'adUnlock': 'Obejrzyj film, aby odblokować'
  },
  'chest': {
    'label': 'Skrzynia skarbów',
    'ready': 'Otwórz skrzynię za {n} monet',
    'filling': 'Skrzynia skarbów — napełnia się',
    'spent': 'Skrzynia skarbów — pusta do jutra'
  },
  'reveal': {
    'world': 'Nowe miejsce do deptania!',
    'shoe': 'Nowe buty!',
    'stars': 'Próg gwiazdek!',
    'record': 'Nowy rekord!',
    'chest': 'Skarb!',
    'foe': 'Nowy robal!',
    'starsTotal': '{n} gwiazdek',
    'recordScore': '{n} punktów',
    'recordBeat': 'Stary rekord: {n}',
    'chestCoins': '+{n} monet'
  },
  'fever': {
    'filling': 'Gorączka Splat: {n}% pełna',
    'ready': 'Gorączka Splat gotowa — dotknij',
    'running': 'Gorączka Splat trwa'
  },
  'objectives': {
    'clear': 'Ukończ poziom',
    'combo': 'Osiągnij serię ×{n}',
    'noSpike': 'Nie oberwij od kolców',
    'time': 'Skończ z {n}s zapasu',
    'accuracy': 'Trafiaj {n}% nadepnięć',
    'fever': 'Odpal Gorączkę Splat {n}×',
    'kind': 'Rozgnieć {n} {bug}',
    'feverKills': 'Rozgnieć {n} w jednej Gorączce',
    'noMiss': 'Spudłuj najwyżej {n} razy',
    'score': 'Zdobądź {n} punktów'
  },
  'quests': {
    'title': 'Cele gwiazdek',
    'onTrack': '{objective} — na dobrej drodze',
    'progress': '{objective} — {n}% zrobione',
    'missed': '{objective} — przepadło'
  },
  'hints': {
    'move': {
      'touch': 'Dotknij, aby się ruszyć',
      'desktop': 'Kliknij, aby się ruszyć'
    },
    'slam': {
      'touch': 'Przytrzymaj i puść, żeby mocno uderzyć',
      'desktop': 'Przytrzymaj przycisk, żeby mocno uderzyć'
    },
    'sprinter': {
      'touch': 'Biegacze uciekają — nadepnij tam, gdzie staną',
      'desktop': 'Biegacze uciekają przed butem — stój i kliknij'
    },
    'beetle': {
      'touch': 'Żuki mają pancerz — przytrzymaj i uderz',
      'desktop': 'Żuki mają pancerz — przytrzymaj i uderz'
    },
    'flea': {
      'touch': 'Pchły uciekają skokiem — traf w miejsce lądowania',
      'desktop': 'Pchły uciekają skokiem — traf w miejsce lądowania'
    },
    'spike': {
      'touch': 'Nie depcz kolczastych!',
      'desktop': 'Nie depcz kolczastych!'
    },
    'stink': {
      'touch': 'Smrodliwki zamazują ekran po rozgnieceniu',
      'desktop': 'Smrodliwki zamazują ekran po rozgnieceniu'
    },
    'fever': {
      'touch': 'Fiolka pełna — dotknij płomienia!',
      'desktop': 'Fiolka pełna — kliknij płomień!'
    },
    'honey': {
      'touch': 'Miód unieruchamia skoczki',
      'desktop': 'Miód unieruchamia skoczki'
    },
    'web': {
      'touch': 'Pajęczyny spowalniają stopę',
      'desktop': 'Pajęczyny spowalniają stopę'
    },
    'belt': {
      'touch': 'Taśma przesuwa owady',
      'desktop': 'Taśma przesuwa owady'
    },
    'sweeper': {
      'touch': 'Zamiatarka gniecie owady za darmo',
      'desktop': 'Zamiatarka gniecie owady za darmo'
    },
    'boss': {
      'touch': 'Przytrzymaj i uderz, gdy boss się zamachnie',
      'desktop': 'Przytrzymaj i uderz, gdy boss się zamachnie'
    },
    'pods': {
      'touch': 'Rozgnieć jaja, zanim się wyklują!',
      'desktop': 'Rozgnieć jaja, zanim się wyklują!'
    }
  },
  'result': {
    'cleared': 'Poziom zaliczony!',
    'timeUp': 'Czas minął!',
    'upNext': 'Dalej: {n}',
    'retryLevel': 'Jeszcze raz?',
    'campaignDone': 'Wszystkie poziomy zaliczone!',
    'newRecord': 'Nowy rekord!',
    'nextLevel': 'Następny poziom',
    'tryAgain': 'Spróbuj ponownie',
    'squishes': 'Rozgniecione owady',
    'starsEarned': '{n} z 3 gwiazdek',
    'rankOf': 'z {n}',
    'worldUnlocked': '{n} odblokowane!'
  },
  'leaderboard': {
    'title': 'Ranking',
    'rank': 'Miejsce',
    'player': 'Gracz',
    'score': 'Punkty',
    'level': 'Poziom',
    'you': 'Ty',
    'yourRank': 'Jesteś #{n} z {total}',
    'of': 'z {n}',
    'unranked': 'Ukończ poziom, żeby wejść do rankingu',
    'loading': 'Wczytywanie rankingu…',
    'empty': 'Nikt jeszcze nie zdobył punktów',
    'failed': 'Nie udało się pobrać rankingu'
  },
  'options': {
    'title': 'Ustawienia',
    'general': 'Ogólne',
    'play': 'Gra',
    'audio': 'Dźwięk',
    'close': 'Zapisz i zamknij',
    'language': 'Język',
    'difficulty': 'Poziom trudności',
    'soundEffects': 'Efekty dźwiękowe',
    'music': 'Muzyka',
    'musicTrack': 'Utwór',
    'haptics': 'Wibracje',
    'on': 'Wł.',
    'off': 'Wył.',
    'difficulties': {
      'easy': 'Łatwy',
      'medium': 'Normalny',
      'hard': 'Trudny'
    },
    'difficultyHints': {
      'easy': 'Wolniejsze owady i więcej czasu.',
      'medium': 'Gra taka, jak ją zaprojektowano.',
      'hard': 'Szybsze owady i pełniejsze plansze.'
    },
    'musicTracks': {
      'trance': 'Owadzi groove',
      'cozy': 'Spokojny piknik'
    },
    'juiceStyle': 'Styl plamy',
    'juiceStyles': {
      'ooze': 'Kreskówkowy śluz',
      'confetti': 'Piniata z konfetti',
      'bubble': 'Bańki mydlane'
    },
    'juiceStyleHints': {
      'ooze': 'Kolorowy śluz. Gra się nie zmienia.',
      'confetti': 'Owady wybuchają konfetti. Gra się nie zmienia.',
      'bubble': 'Owady zmieniają się w bańki. Gra się nie zmienia.'
    },
    'highVis': 'Duży krąg deptania',
    'highVisHint': 'Grubszy i jaśniejszy pierścień tam, gdzie wyląduje stopa.',
    'singleTap': 'Łatwe celowanie',
    'singleTapHint': 'Dotknij gdziekolwiek, a stopa poleci do najbliższego owada.'
  },
  'loading': {
    'boo': 'Bu!',
    'laugh': 'Chi chi!',
    'tooLong': 'Wciąż się wczytuje… sprawdź połączenie?'
  },
  'saveStatus': {
    'restoredTitle': 'Postęp przywrócony',
    'restoredBody': 'Odzyskaliśmy twój zapis i dodaliśmy {n} monet.',
    'pausedTitle': 'Zapis wstrzymany',
    'pausedBody': 'Nie możemy połączyć się z usługą zapisu. Twój postęp jest bezpieczny na tym urządzeniu.',
    'retry': 'Ponów',
    'dismiss': 'Zamknij',
    'tap': 'Dotknij, aby zamknąć'
  },
  'adsBlocked': {
    'title': 'Wykryto blokadę reklam',
    'body': 'Bug Crunch jest darmowy dzięki reklamom. Wyłącz blokadę i odśwież stronę.',
    'allowPrefix': 'Zezwól na reklamy na',
    'allowSuffix': 'i odśwież stronę.',
    'gotIt': 'Rozumiem'
  },
  'license': {
    'denied': 'Nie udało się zweryfikować tej kopii'
  }
}
