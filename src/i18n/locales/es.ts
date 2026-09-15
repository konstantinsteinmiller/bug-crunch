// ES bundle. Mirrors the key shape of `en.ts`, which is the source
// of truth — see `tests/i18nParity.test.ts`. Every `{placeholder}` must survive
// translation; a dropped one renders as literal text and reads as a bug.
export default {
  'gameName': 'Bug Crunch',
  'cancel': 'Cancelar',
  'close': 'Cerrar',
  'ok': 'Ok',
  'continue': 'Continuar',
  'tapToContinue': 'Toca para continuar',
  'clickToContinue': 'Haz clic para continuar',
  'cutscene': {
    // The skip control on a cutscene. A cutscene never replays, so the
    // control is irreversible and gets a word rather than a bare glyph.
    'skip': 'Saltar'
  },
  'rewards': 'RECOMPENSAS',
  'tip': 'Consejo',
  'crazyGamesOnly': 'Este juego solo está disponible en',
  'ui': {
    'next': 'Siguiente',
    'replay': 'Repetir',
    'back': 'Atrás',
    'play': 'Jugar',
    'pause': 'Pausa',
    'menu': 'Menú',
    'home': 'Inicio',
    'info': 'Info'
  },
  'hud': {
    'score': 'Puntos',
    'time': 'Tiempo',
    'chain': 'Cadena Splat: {n}',
    'level': 'Nivel {n}'
  },
  'worlds': {
    'picnic': 'Manta de pícnic',
    'backyard': 'Jardín salvaje',
    'attic': 'Desván polvoriento',
    'arcade': 'Arcade de neón'
  },
  'bugs': {
    'ant': 'Hormigas',
    'sprinter': 'Hormigas veloces',
    'beetle': 'Escarabajos',
    'flea': 'Pulgas',
    'caterpillar': 'Orugas',
    'stinkbug': 'Chinches',
    'centipede': 'Ciempiés',
    'pinatafly': 'Moscas piñata',
    'moth': 'Polillas',
    'robobug': 'Robobichos'
  },
  'bosses': {
    'queenAnt': 'Hormiga Reina Goliat',
    'beetleKing': 'Rey Escarabajo Espinoso',
    'matriarch': 'Matriarca Ciempiés',
    'roachPrime': 'Meca-Cucaracha Prime'
  },
  'boss': {
    'tell': {
      'stomp': '¡Pisa al jefe!',
      'summon': '¡Limpia el enjambre!',
      'pods': '¡Aplasta los huevos!',
      'charge': '¡Mantén pulsado y golpea!',
      'spin': '¡Sal del círculo!',
      'shield': '¡Rompe el escudo!',
      'beam': '¡Esquiva el rayo!'
    }
  },
  'shoes': {
    'stats': {
      'speed': 'Velocidad',
      'radius': 'Área de pisada',
      'pierce': 'Perforación'
    },
    'sneaker': {
      'name': 'Zapatilla clásica',
      'perk': 'Equilibrada y rápida de recuperar.',
      'trade': 'No destaca en nada.'
    },
    'steelBoot': {
      'name': 'Bota con punta de acero',
      'perk': 'Las púas no te hacen nada. Los pisotones aturden alrededor.',
      'trade': 'Pesada y lenta de levantar.'
    },
    'bunnySlipper': {
      'name': 'Zapatilla de conejo',
      'perk': 'Paso silencioso: los bichos saltarines no te ven venir.',
      'trade': 'No puede romper ningún caparazón.'
    },
    'rollerSkate': {
      'name': 'Patín',
      'perk': 'Pisa y sigue arrastrando para arrasar una línea entera.',
      'trade': 'Pisada muy estrecha.'
    },
    'cleatBoot': {
      'name': 'Bota de tacos',
      'perk': 'Los tacos atraviesan caparazones y glándulas.',
      'trade': 'La pisada más pequeña del vestuario.'
    },
    'electricSock': {
      'name': 'Calcetín eléctrico',
      'perk': 'Cada pisotón lanza rayos a tres bichos más.',
      'trade': 'Los rayos solo rematan a los débiles.'
    }
  },
  'locker': {
    'title': 'Vestuario',
    'buy': 'Comprar {n}',
    'wear': 'Poner',
    'worn': 'Puesta',
    'needStars': '{n} estrellas más',
    'needCoins': '{n} monedas más',
    'price': 'Precio: {n} monedas',
    'starGate': 'Se abre con {n} estrellas',
    'adUnlock': 'Mira un vídeo para desbloquear'
  },
  'chest': {
    'label': 'Cofre del tesoro',
    'ready': 'Abre el cofre por {n} monedas',
    'filling': 'Cofre del tesoro — llenándose',
    'spent': 'Cofre del tesoro — vacío hasta mañana'
  },
  'reveal': {
    'world': '¡Nuevo lugar para pisar!',
    'shoe': '¡Zapatos nuevos!',
    'stars': '¡Meta de estrellas!',
    'record': '¡Nuevo récord!',
    'chest': '¡Tesoro!',
    'foe': '¡Un bicho nuevo!',
    'starsTotal': '{n} estrellas',
    'recordScore': '{n} puntos',
    'recordBeat': 'Récord anterior: {n}',
    'chestCoins': '+{n} monedas'
  },
  'fever': {
    'filling': 'Fiebre Splat: {n}% llena',
    'ready': 'Fiebre Splat lista: toca para empezar',
    'running': 'Fiebre Splat activa'
  },
  'objectives': {
    'clear': 'Supera el nivel',
    'combo': 'Llega a una cadena ×{n}',
    'noSpike': 'No recibas daño de púas',
    'time': 'Termina con {n}s de sobra',
    'accuracy': 'Acierta el {n}% de tus pisotones',
    'fever': 'Activa la Fiebre Splat {n}×',
    'kind': 'Aplasta {n} {bug}',
    'feverKills': 'Aplasta {n} en una Fiebre',
    'noMiss': 'Falla como mucho {n} pisotones',
    'score': 'Consigue {n} puntos'
  },
  'quests': {
    'title': 'Objetivos de estrella',
    'onTrack': '{objective} — en camino',
    'progress': '{objective} — {n}% hecho',
    'missed': '{objective} — perdido'
  },
  'hints': {
    'move': {
      'touch': 'Toca para mover',
      'desktop': 'Haz clic para mover'
    },
    'slam': {
      'touch': 'Mantén y suelta para un pisotón fuerte',
      'desktop': 'Mantén el botón para un pisotón fuerte'
    },
    'sprinter': {
      'touch': 'Las veloces huyen — pisa donde se paran',
      'desktop': 'Las veloces huyen del zapato — quédate quieto y haz clic'
    },
    'beetle': {
      'touch': 'Los escarabajos tienen caparazón: mantén y golpea',
      'desktop': 'Los escarabajos tienen caparazón: mantén y golpea'
    },
    'flea': {
      'touch': 'Las pulgas saltan: pisa donde aterrizan',
      'desktop': 'Las pulgas saltan: pisa donde aterrizan'
    },
    'spike': {
      'touch': '¡No pises a los que tienen púas!',
      'desktop': '¡No pises a los que tienen púas!'
    },
    'stink': {
      'touch': 'Las chinches nublan la pantalla al aplastarlas',
      'desktop': 'Las chinches nublan la pantalla al aplastarlas'
    },
    'fever': {
      'touch': '¡El frasco está lleno: toca la llama!',
      'desktop': '¡El frasco está lleno: haz clic en la llama!'
    },
    'honey': {
      'touch': 'La miel deja quietos a los saltarines',
      'desktop': 'La miel deja quietos a los saltarines'
    },
    'web': {
      'touch': 'Las telarañas frenan tu pie',
      'desktop': 'Las telarañas frenan tu pie'
    },
    'belt': {
      'touch': 'La cinta arrastra a los bichos',
      'desktop': 'La cinta arrastra a los bichos'
    },
    'sweeper': {
      'touch': 'La barredora aplasta bichos gratis',
      'desktop': 'La barredora aplasta bichos gratis'
    },
    'boss': {
      'touch': 'Mantén y golpea cuando el jefe se prepare',
      'desktop': 'Mantén y golpea cuando el jefe se prepare'
    },
    'pods': {
      'touch': '¡Aplasta los huevos antes de que eclosionen!',
      'desktop': '¡Aplasta los huevos antes de que eclosionen!'
    }
  },
  'result': {
    'cleared': '¡Nivel superado!',
    'timeUp': '¡Se acabó el tiempo!',
    'upNext': 'A continuación: {n}',
    'retryLevel': '¿Otra vez?',
    'campaignDone': '¡Todos los niveles superados!',
    'newRecord': '¡Nuevo récord!',
    'nextLevel': 'Siguiente nivel',
    'tryAgain': 'Reintentar',
    'squishes': 'Bichos aplastados',
    'starsEarned': '{n} de 3 estrellas',
    'rankOf': 'de {n}',
    'worldUnlocked': '¡{n} desbloqueado!'
  },
  'leaderboard': {
    'title': 'Clasificación',
    'rank': 'Puesto',
    'player': 'Jugador',
    'score': 'Puntos',
    'level': 'Nivel',
    'you': 'Tú',
    'yourRank': 'Eres el #{n} de {total}',
    'of': 'de {n}',
    'unranked': 'Supera un nivel para entrar',
    'loading': 'Cargando la clasificación…',
    'empty': 'Todavía no hay puntuaciones',
    'failed': 'No se pudo cargar la clasificación'
  },
  'options': {
    'title': 'Ajustes',
    'general': 'General',
    'play': 'Juego',
    'audio': 'Audio',
    'close': 'Guardar y cerrar',
    'language': 'Idioma',
    'difficulty': 'Dificultad',
    'soundEffects': 'Efectos de sonido',
    'music': 'Música',
    'musicTrack': 'Pista musical',
    'haptics': 'Vibración',
    'on': 'Sí',
    'off': 'No',
    'difficulties': {
      'easy': 'Fácil',
      'medium': 'Normal',
      'hard': 'Difícil'
    },
    'difficultyHints': {
      'easy': 'Bichos más lentos y más tiempo.',
      'medium': 'El juego tal y como se diseñó.',
      'hard': 'Bichos más rápidos y tableros más llenos.'
    },
    'musicTracks': {
      'trance': 'Ritmo bicho',
      'cozy': 'Pícnic tranquilo'
    },
    'juiceStyle': 'Estilo de splat',
    'juiceStyles': {
      'ooze': 'Baba de dibujos',
      'confetti': 'Piñata de confeti',
      'bubble': 'Pompas de jabón'
    },
    'juiceStyleHints': {
      'ooze': 'Baba de colores. El juego no cambia.',
      'confetti': 'Los bichos estallan en confeti. El juego no cambia.',
      'bubble': 'Los bichos se vuelven pompas. El juego no cambia.'
    },
    'highVis': 'Círculo de pisada grande',
    'highVisHint': 'Un anillo más grueso y brillante donde caerá tu pie.',
    'singleTap': 'Puntería fácil',
    'singleTapHint': 'Toca donde sea y tu pie vuela al bicho más cercano.'
  },
  'loading': {
    'boo': '¡Bu!',
    'laugh': '¡Ji ji!',
    'tooLong': 'Sigue cargando… ¿revisas tu conexión?'
  },
  'saveStatus': {
    'restoredTitle': 'Progreso restaurado',
    'restoredBody': 'Hemos recuperado tu partida y añadido {n} monedas.',
    'pausedTitle': 'Guardado en pausa',
    'pausedBody': 'No podemos contactar con el servicio de guardado. Tu progreso está a salvo en este dispositivo.',
    'retry': 'Reintentar',
    'dismiss': 'Descartar',
    'tap': 'Toca para cerrar'
  },
  'adsBlocked': {
    'title': 'Bloqueador de anuncios detectado',
    'body': 'Bug Crunch es gratis gracias a los anuncios. Desactiva tu bloqueador y recarga.',
    'allowPrefix': 'Permite anuncios en',
    'allowSuffix': 'y recarga la página.',
    'gotIt': 'Entendido'
  },
  'license': {
    'denied': 'No se ha podido verificar esta copia'
  }
}
