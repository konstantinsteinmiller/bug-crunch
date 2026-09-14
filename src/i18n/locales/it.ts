// IT bundle. Mirrors the key shape of `en.ts`, which is the source
// of truth — see `tests/i18nParity.test.ts`. Every `{placeholder}` must survive
// translation; a dropped one renders as literal text and reads as a bug.
export default {
  'gameName': 'Bug Crunch',
  'cancel': 'Annulla',
  'close': 'Chiudi',
  'ok': 'Ok',
  'continue': 'Continua',
  'tapToContinue': 'Tocca per continuare',
  'clickToContinue': 'Clicca per continuare',
  'rewards': 'RICOMPENSE',
  'tip': 'Consiglio',
  'crazyGamesOnly': 'Questo gioco è disponibile solo su',
  'ui': {
    'next': 'Avanti',
    'replay': 'Rigioca',
    'back': 'Indietro',
    'play': 'Gioca',
    'pause': 'Pausa',
    'menu': 'Menu',
    'home': 'Home',
    'info': 'Info'
  },
  'hud': {
    'score': 'Punti',
    'time': 'Tempo',
    'chain': 'Catena Splat: {n}',
    'level': 'Livello {n}'
  },
  'worlds': {
    'picnic': 'Tovaglia da picnic',
    'backyard': 'Giardino selvatico',
    'attic': 'Soffitta polverosa',
    'arcade': 'Sala giochi al neon'
  },
  'bugs': {
    'ant': 'Formiche',
    'sprinter': 'Formiche scattanti',
    'beetle': 'Scarabei',
    'flea': 'Pulci',
    'caterpillar': 'Bruchi',
    'stinkbug': 'Cimici',
    'centipede': 'Millepiedi',
    'pinatafly': 'Mosche piñata',
    'moth': 'Falene',
    'robobug': 'Robo-insetti'
  },
  'bosses': {
    'queenAnt': 'Regina Formica Golia',
    'beetleKing': 'Re Scarabeo Spinoso',
    'matriarch': 'Matriarca Millepiedi',
    'roachPrime': 'Mecha-Scarafaggio Prime'
  },
  'boss': {
    'tell': {
      'stomp': 'Pesta il boss!',
      'summon': 'Spazza via lo sciame!',
      'pods': 'Schiaccia le uova!',
      'charge': 'Tieni premuto e colpisci!',
      'spin': 'Esci dal cerchio!',
      'shield': 'Rompi lo scudo!',
      'beam': 'Schiva il raggio!'
    }
  },
  'shoes': {
    'stats': {
      'speed': 'Velocità',
      'radius': 'Area di pestata',
      'pierce': 'Perforazione'
    },
    'sneaker': {
      'name': 'Scarpa classica',
      'perk': 'Equilibrata e subito pronta.',
      'trade': 'Non eccelle in niente.'
    },
    'steelBoot': {
      'name': 'Scarpa antinfortunistica',
      'perk': 'Le spine non ti feriscono. I colpi stordiscono tutt\'intorno.',
      'trade': 'Pesante e lenta da sollevare.'
    },
    'bunnySlipper': {
      'name': 'Pantofola coniglio',
      'perk': 'Passo silenzioso: i saltatori non ti vedono arrivare.',
      'trade': 'Non rompe nessun guscio.'
    },
    'rollerSkate': {
      'name': 'Pattino a rotelle',
      'perk': 'Pesta e continua a trascinare per arare un\'intera linea.',
      'trade': 'Pestata molto stretta.'
    },
    'cleatBoot': {
      'name': 'Scarpa con tacchetti',
      'perk': 'I tacchetti bucano gusci e ghiandole.',
      'trade': 'La pestata più piccola dell\'armadietto.'
    },
    'electricSock': {
      'name': 'Calzino elettrico',
      'perk': 'Ogni pestata manda fulmini ad altri tre insetti.',
      'trade': 'I fulmini finiscono solo i deboli.'
    }
  },
  'locker': {
    'title': 'Armadietto',
    'buy': 'Compra {n}',
    'wear': 'Indossa',
    'worn': 'Indossata',
    'needStars': '{n} stelle in più',
    'needCoins': '{n} monete in più',
    'price': 'Prezzo: {n} monete',
    'starGate': 'Si sblocca a {n} stelle',
    'adUnlock': 'Guarda un video per sbloccare'
  },
  'chest': {
    'label': 'Forziere',
    'ready': 'Apri il forziere per {n} monete',
    'filling': 'Forziere — si sta riempiendo',
    'spent': 'Forziere — vuoto fino a domani'
  },
  'reveal': {
    'world': 'Un nuovo posto da pestare!',
    'shoe': 'Scarpe nuove!',
    'stars': 'Traguardo di stelle!',
    'record': 'Nuovo record!',
    'chest': 'Tesoro!',
    'foe': 'Un nuovo insetto!',
    'starsTotal': '{n} stelle',
    'recordScore': '{n} punti',
    'recordBeat': 'Vecchio record: {n}',
    'chestCoins': '+{n} monete'
  },
  'fever': {
    'filling': 'Febbre Splat: {n}% piena',
    'ready': 'Febbre Splat pronta — tocca per iniziare',
    'running': 'Febbre Splat attiva'
  },
  'objectives': {
    'clear': 'Supera il livello',
    'combo': 'Raggiungi una catena ×{n}',
    'noSpike': 'Non subire danni da spine',
    'time': 'Finisci con {n}s di margine',
    'accuracy': 'Centra il {n}% delle pestate',
    'fever': 'Attiva la Febbre Splat {n}×',
    'kind': 'Schiaccia {n} {bug}',
    'feverKills': 'Schiaccia {n} in una Febbre',
    'noMiss': 'Sbaglia al massimo {n} pestate',
    'score': 'Fai {n} punti'
  },
  'hints': {
    'move': {
      'touch': 'Tocca per muoverti',
      'desktop': 'Clicca per muoverti'
    },
    'slam': {
      'touch': 'Tieni premuto e rilascia per una pestata forte',
      'desktop': 'Tieni premuto il tasto per una pestata forte'
    },
    'sprinter': {
      'touch': 'Le scattanti scappano — pesta dove si fermano',
      'desktop': 'Le scattanti scappano dalla scarpa — stai fermo, poi clicca'
    },
    'beetle': {
      'touch': 'Gli scarabei hanno il guscio: tieni premuto e colpisci',
      'desktop': 'Gli scarabei hanno il guscio: tieni premuto e colpisci'
    },
    'flea': {
      'touch': 'Le pulci saltano: colpisci dove atterrano',
      'desktop': 'Le pulci saltano: colpisci dove atterrano'
    },
    'spike': {
      'touch': 'Non pestare quelli con le spine!',
      'desktop': 'Non pestare quelli con le spine!'
    },
    'stink': {
      'touch': 'Le cimici annebbiano lo schermo se schiacciate',
      'desktop': 'Le cimici annebbiano lo schermo se schiacciate'
    },
    'fever': {
      'touch': 'La fiala è piena — tocca la fiamma!',
      'desktop': 'La fiala è piena — clicca la fiamma!'
    },
    'honey': {
      'touch': 'Il miele blocca i saltatori',
      'desktop': 'Il miele blocca i saltatori'
    },
    'web': {
      'touch': 'Le ragnatele rallentano il tuo piede',
      'desktop': 'Le ragnatele rallentano il tuo piede'
    },
    'belt': {
      'touch': 'Il nastro trasporta gli insetti',
      'desktop': 'Il nastro trasporta gli insetti'
    },
    'sweeper': {
      'touch': 'La spazzatrice schiaccia insetti gratis',
      'desktop': 'La spazzatrice schiaccia insetti gratis'
    },
    'boss': {
      'touch': 'Tieni premuto e colpisci quando il boss carica',
      'desktop': 'Tieni premuto e colpisci quando il boss carica'
    },
    'pods': {
      'touch': 'Schiaccia le uova prima che si schiudano!',
      'desktop': 'Schiaccia le uova prima che si schiudano!'
    }
  },
  'result': {
    'cleared': 'Livello superato!',
    'timeUp': 'Tempo scaduto!',
    'upNext': 'Prossimo: {n}',
    'retryLevel': 'Riproviamo?',
    'campaignDone': 'Tutti i livelli superati!',
    'newRecord': 'Nuovo record!',
    'nextLevel': 'Livello successivo',
    'tryAgain': 'Riprova',
    'squishes': 'Insetti schiacciati',
    'starsEarned': '{n} stelle su 3',
    'rankOf': 'su {n}',
    'worldUnlocked': '{n} sbloccato!'
  },
  'leaderboard': {
    'title': 'Classifica',
    'rank': 'Posizione',
    'player': 'Giocatore',
    'score': 'Punti',
    'level': 'Livello',
    'you': 'Tu',
    'yourRank': 'Sei #{n} su {total}',
    'of': 'su {n}',
    'unranked': 'Supera un livello per entrare',
    'loading': 'Caricamento classifica…',
    'empty': 'Nessuno ha ancora fatto punti',
    'failed': 'Classifica non raggiungibile'
  },
  'options': {
    'title': 'Impostazioni',
    'general': 'Generale',
    'play': 'Gioco',
    'audio': 'Audio',
    'close': 'Salva e chiudi',
    'language': 'Lingua',
    'difficulty': 'Difficoltà',
    'soundEffects': 'Effetti sonori',
    'music': 'Musica',
    'musicTrack': 'Brano musicale',
    'haptics': 'Vibrazione',
    'on': 'Sì',
    'off': 'No',
    'difficulties': {
      'easy': 'Facile',
      'medium': 'Normale',
      'hard': 'Difficile'
    },
    'difficultyHints': {
      'easy': 'Insetti più lenti e più tempo.',
      'medium': 'Il gioco come è stato pensato.',
      'hard': 'Insetti più veloci e campi più affollati.'
    },
    'musicTracks': {
      'trance': 'Groove degli insetti',
      'cozy': 'Picnic tranquillo'
    },
    'juiceStyle': 'Stile splat',
    'juiceStyles': {
      'ooze': 'Melma da cartone',
      'confetti': 'Piñata di coriandoli',
      'bubble': 'Bolle di sapone'
    },
    'juiceStyleHints': {
      'ooze': 'Melma colorata. Il gioco non cambia.',
      'confetti': 'Gli insetti esplodono in coriandoli. Il gioco non cambia.',
      'bubble': 'Gli insetti diventano bolle. Il gioco non cambia.'
    },
    'highVis': 'Cerchio di pestata grande',
    'highVisHint': 'Un anello più spesso e luminoso dove cadrà il piede.',
    'singleTap': 'Mira facile',
    'singleTapHint': 'Tocca ovunque e il piede vola sull\'insetto più vicino.'
  },
  'loading': {
    'boo': 'Bu!',
    'laugh': 'Ih ih!',
    'tooLong': 'Ancora in caricamento… controlli la connessione?'
  },
  'saveStatus': {
    'restoredTitle': 'Progressi ripristinati',
    'restoredBody': 'Abbiamo recuperato il salvataggio e aggiunto {n} monete.',
    'pausedTitle': 'Salvataggio in pausa',
    'pausedBody': 'Non riusciamo a raggiungere il servizio di salvataggio. I tuoi progressi sono al sicuro su questo dispositivo.',
    'retry': 'Riprova',
    'dismiss': 'Chiudi',
    'tap': 'Tocca per chiudere'
  },
  'adsBlocked': {
    'title': 'Blocco pubblicità rilevato',
    'body': 'Bug Crunch è gratis grazie alla pubblicità. Disattiva il blocco e ricarica.',
    'allowPrefix': 'Consenti le pubblicità su',
    'allowSuffix': 'e ricarica la pagina.',
    'gotIt': 'Capito'
  },
  'license': {
    'denied': 'Non è stato possibile verificare questa copia'
  }
}
