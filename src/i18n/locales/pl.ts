export default {
  'gameName': 'Survivalist',
  'cancel': 'Anuluj',
  'close': 'Zamknij',
  'ok': 'Ok',
  'continue': 'Kontynuuj',
  'tapToContinue': 'Dotknij, aby kontynuować',
  'clickToContinue': 'Kliknij, aby kontynuować',
  'rewards': 'NAGRODY',
  'tip': 'Wskazówka',
  'crazyGamesOnly': 'Ta gra jest dostępna tylko na',

  // Shared UI labels. NOT dead keys: they are the `aria-label` on the game's
  // icon-only buttons, read aloud rather than shown. See `en.ts`.
  'ui': {
    'next': 'Dalej',
    'replay': 'Powtórz',
    'back': 'Wstecz',
    'play': 'Graj',
    'pause': 'Pauza',
    'menu': 'Menu',
    'home': 'Ekran główny',
    'info': 'Info'
  },

  'hud': {
    'stage': 'Etap {n}',
    'best': 'Rekord {n}',
    'boss': 'Boss',
    'miniboss': 'Miniboss',
    'fireRate': 'Tempo',
    'incoming': 'Nadchodzi atak!',
    'dodge': 'Unik',
    'milestone': '{n} w szeregu!',
    'weaponActive': '{name} gotowy',
    'weaponLocked': '{name} zablokowany — trafiono {n} z {total} dźwigni',
    'weaponGift': '{name} przed tobą — za darmo, bez dźwigni',
    'weaponFree': 'GRATIS'
  },

  'weapons': {
    'rocket': 'Wyrzutnia rakiet',
    'gatling': 'Gatling'
  },

  'tutorial': {
    'touch': 'Przesuń palcem, by ruszyć oddziałem',
    'desktop': 'Poruszaj myszą, by kierować oddziałem'
  },
  'hints': {
    'move': { 'touch': 'Dotknij, aby się ruszyć', 'desktop': 'Kliknij, aby się ruszyć' },
    'gate': { 'touch': 'Strzelaj w bramę: +1 co pół sekundy', 'desktop': 'Strzelaj w bramę: +1 co pół sekundy' },
    'trap': { 'touch': 'Czerwone bramy ZMNIEJSZAJĄ oddział — wybierz drugą!', 'desktop': 'Czerwone bramy ZMNIEJSZAJĄ oddział — wybierz drugą!' },
    'divider': { 'touch': 'Nigdy nie dotykaj filaru między bramami', 'desktop': 'Nigdy nie dotykaj filaru między bramami' },
    'crate': { 'touch': 'Zielone skrzynie: każdy bije mocniej', 'desktop': 'Zielone skrzynie: każdy bije mocniej' },
    'rate': { 'touch': 'Niebieskie skrzynie: każdy strzela szybciej', 'desktop': 'Niebieskie skrzynie: każdy strzela szybciej' },
    'boss': { 'touch': 'Trzymaj się z dala od czerwonego kręgu!', 'desktop': 'Trzymaj się z dala od czerwonego kręgu!' },
    'lever': { 'touch': 'Zestrzel OBIE dźwignie przy krawędziach — otwierają skrzynię z bronią', 'desktop': 'Zestrzel OBIE dźwignie przy krawędziach — otwierają skrzynię z bronią' },
    'guard': { 'touch': 'Tarcza w górze — strzały nic nie robią. UCIEKAJ!', 'desktop': 'Tarcza w górze — strzały nic nie robią. UCIEKAJ!' },
    'cage': { 'touch': 'Strzelaj do klatek — więźniowie dołączą do oddziału', 'desktop': 'Strzelaj do klatek — więźniowie dołączą do oddziału' },
    'shieldBox': { 'touch': 'Skrzynia tarczy — czeka i blokuje jeden duży cios', 'desktop': 'Skrzynia tarczy — czeka i blokuje jeden duży cios' }
  },

  'flow': {

    'unlocked': 'Odblokowano!',

    'guardian': "Anioł stróż cię uratował!",

    'guardianSub': "Wróciło {n} ocalałych",

    'next': "Dalej: {label} · {when}"

  },

  'ladder': {
    'weaponPick': "Wybierz broń",
    'nextStage': "następny poziom",
    'stagesAway': "za {n} poziomy"
  },
  'weaponPick': {
    'title': "Wybierz swoją broń",
    'subtitle': "Twoja na poziom {n}. Więcej czeka na drodze.",
    'take': "Bierz",
    'rocket': {
      'a': "Salwa samonaprowadzająca",
      'b': "Obrażenia wybuchowe"
    },
    'gatling': {
      'a': "Dwa razy szybszy ogień",
      'b': "Szybciej pompuje bramy"
    }
  },
  'result': {
    'stageClear': 'Etap ukończony!',
    'wipedOut': 'Oddział wybity',
    'reachedStage': 'Etap {n}',
    'newRecord': 'Nowy rekord!',
    'rallied': 'Drugi oddech',
    'peakSquad': 'Największy oddział',
    'kills': 'Zabici',
    'tripleCoins': '3×',
    'tripleBonus': '(+{n})',
    'tripleClaimed': 'Monety potrojone!',
    'nextStage': 'Następny etap',
    'tryAgain': 'Spróbuj ponownie',
    'upgrade': 'Ulepsz',
    'upgradeHint': 'Ulepsz swój oddział!',
    'rankOf': 'z {n}',
    'upNext': 'Dalej: Poziom {n}'
  },

  // Two strings only; everything ON the card comes from keys this file
  // already had (see en.ts). `action` is the accessible name of an
  // icon-only button. `text` rides in the share sheet and is read by the
  // person who receives the picture, so it is a boast, and it has to still
  // make sense if the image never arrives.
  'share': {
    'action': 'Udostępnij wynik',
    'text': 'Dotarłem do poziomu {n} w {game}. Zajdziesz dalej?'
  },

  'leaderboard': {
    'title': 'Ranking',
    'rank': '#',
    'player': 'Gracz',
    'stage': 'Etap',
    'squad': 'Oddział',
    'empty': 'Brak wyników. Bądź pierwszy!',
    'failed': 'Nie można wczytać rankingu.',
    'loading': 'Wczytywanie…',
    'you': 'Ty',
    'yourRank': 'Jesteś #{n}',
    'of': 'z {n} graczy'
  },

  'chest': {
    'label': 'Skrzynia skarbów',
    'ready': 'Otwórz skrzynię za {n} monet',
    'filling': 'Skrzynia skarbów — napełnia się',
    'spent': 'Skrzynia skarbów — pusta do jutra'
  },

  // Daily expedition. See en.ts for what each state means, why the multiplier
  // is split from any word, and why `hud` has to stay one short word.
  'expedition': {
    'title': 'Codzienna wyprawa',
    'hud': 'Wyprawa',
    'multiplier': '{n}×',
    'available': 'Codzienna wyprawa — dzisiejsza trasa, potrójne monety',
    'confirm': 'Rozpocznij wyprawę',
    'spent': 'Codzienna wyprawa — nowa trasa za {time}',
    'done': 'Wróć jutro',
    'back': 'Powrót do kampanii'
  },

  'skills': {

    'grenade': 'Granat',

    'shield': 'Tarcza'

  },

  'upgrades': {
    'title': 'Ulepszenia',
    'spotlight': 'Wydaj!',
    'level': 'Poz. {n}',
    'maxed': 'Maks',
    'names': {
      'squad': 'Oddział',
      'power': 'Siła ognia',
      'rate': 'Szybkostrzelność',
      'range': 'Zasięg',
      'scavenge': 'Zbieractwo',
      'grenade': 'Granat',
      'shield': 'Tarcza',
      'rocket': 'Moc rakiet',
      'gatling': 'Moc Gatlinga'
    },
    'descriptions': {
      'squad': 'Zaczynaj każdy etap z większą liczbą ocalałych.',
      'power': 'Każdy ocalały zadaje większe obrażenia na strzał.',
      'rate': 'Każdy ocalały strzela szybciej.',
      'range': 'Twój oddział otwiera ogień dalej na drodze.',
      'scavenge': 'Zdobywaj więcej monet w każdej rundzie.',
      'grenade': 'Rzuć granat, by zadać potężne obrażenia.',
      'shield': 'Zmniejsz o połowę obrażenia oddziału na kilka sekund.',
      'rocket': 'Wyrzutnie rakiet zdobyte na etapie zadają więcej obrażeń.',
      'gatling': 'Gatlingi zdobyte na etapie zadają więcej obrażeń.'
    }
  },

  'options': {
    'title': 'Opcje', 'general': 'Ogólne', 'audio': 'Dźwięk', 'language': 'Język',
    'difficulty': 'Trudność', 'soundEffects': 'Efekty dźwiękowe', 'music': 'Muzyka', 'musicTrack': 'Utwór',
    'musicTracks': { 'cozy': 'Przytulna harmonia', 'trance': 'Tunel trance' },
    'haptics': 'Wibracje', 'on': 'Wł.', 'off': 'Wył.',
    'close': 'Zapisz i zamknij',
    'difficulties': { 'easy': 'Łatwy', 'medium': 'Średni', 'hard': 'Trudny' },
    'difficultyHints': {
      'easy': 'Słabsi wrogowie i cieńsze barykady.',
      'medium': 'Standardowa rozgrywka.',
      'hard': 'Twardsi wrogowie i mocniejsze barykady.'
    }
  },

  'adsBlocked': {
    'title': 'Nie udało się wyświetlić reklamy',
    'body': 'Chcieliśmy pokazać film, byś odebrał nagrodę, ale coś w przeglądarce blokuje reklamy.',
    'allowPrefix': 'Zezwól na reklamy na',
    'allowSuffix': '(lub wstrzymaj blokadę reklam dla tej gry) i spróbuj ponownie.',
    'gotIt': 'Rozumiem'
  },
  'saveStatus': {
    'restoredTitle': 'Zapis w chmurze przywrócony', 'restoredBody': '+{n} monet bonusu za odzyskanie',
    'tap': 'dotknij', 'pausedTitle': 'Synchronizacja wstrzymana',
    'pausedBody': 'Grasz offline. Postęp jest zapisywany tutaj.',
    'retry': 'Ponów', 'dismiss': 'zamknij'
  },
  'loading': { 'tooLong': 'Ładowanie trwa zbyt długo? Wyłącz blokadę reklam i odśwież.', 'boo': 'Bu!', 'laugh': 'Hahaha!' },
  'license': { 'denied': 'Odmowa dostępu: kup licencję.' }
}
