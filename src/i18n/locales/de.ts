// DE bundle. Mirrors the key shape of `en.ts`, which is the source
// of truth — see `tests/i18nParity.test.ts`. Every `{placeholder}` must survive
// translation; a dropped one renders as literal text and reads as a bug.
export default {
  'gameName': 'Bug Crunch',
  'cancel': 'Abbrechen',
  'close': 'Schließen',
  'ok': 'Ok',
  'continue': 'Weiter',
  'tapToContinue': 'Zum Fortfahren tippen',
  'clickToContinue': 'Zum Fortfahren klicken',
  'cutscene': {
    // The skip control on a cutscene. A cutscene never replays, so the
    // control is irreversible and gets a word rather than a bare glyph.
    'skip': 'Überspringen'
  },
  'rewards': 'BELOHNUNGEN',
  'tip': 'Tipp',
  'crazyGamesOnly': 'Dieses Spiel ist nur verfügbar auf',
  'ui': {
    'next': 'Weiter',
    'replay': 'Nochmal',
    'back': 'Zurück',
    'play': 'Spielen',
    'pause': 'Pause',
    'menu': 'Menü',
    'home': 'Start',
    'info': 'Info'
  },
  'hud': {
    'score': 'Punkte',
    'time': 'Zeit',
    'chain': 'Platsch-Kette: {n}',
    'level': 'Level {n}'
  },
  'worlds': {
    'picnic': 'Picknickdecke',
    'backyard': 'Wilder Garten',
    'attic': 'Staubiger Dachboden',
    'arcade': 'Neon-Arcade'
  },
  'bugs': {
    'ant': 'Ameisen',
    'sprinter': 'Flitzameisen',
    'beetle': 'Käfer',
    'flea': 'Flöhe',
    'caterpillar': 'Raupen',
    'stinkbug': 'Stinkwanzen',
    'centipede': 'Tausendfüßler',
    'pinatafly': 'Piñata-Fliegen',
    'moth': 'Motten',
    'robobug': 'Robo-Käfer'
  },
  'bosses': {
    'queenAnt': 'Goliath-Ameisenkönigin',
    'beetleKing': 'Dornrücken-Käferkönig',
    'matriarch': 'Tausendfüßler-Matriarchin',
    'roachPrime': 'Mecha-Schabe Prime'
  },
  'boss': {
    'tell': {
      'stomp': 'Stampf den Boss!',
      'summon': 'Räum den Schwarm weg!',
      'pods': 'Zermatsch die Eier!',
      'charge': 'Halten und zuschlagen!',
      'spin': 'Raus aus dem Ring!',
      'shield': 'Schlag den Schild ein!',
      'beam': 'Weich dem Strahl aus!'
    }
  },
  'shoes': {
    'stats': {
      'speed': 'Tempo',
      'radius': 'Trittfläche',
      'pierce': 'Panzerbruch'
    },
    'sneaker': {
      'name': 'Klassischer Sneaker',
      'perk': 'Ausgewogen und schnell wieder bereit.',
      'trade': 'In nichts besonders gut.'
    },
    'steelBoot': {
      'name': 'Stahlkappenstiefel',
      'perk': 'Stacheln tun dir nichts. Schläge betäuben alles ringsum.',
      'trade': 'Schwer und langsam zu heben.'
    },
    'bunnySlipper': {
      'name': 'Hasenpantoffel',
      'perk': 'Lautlos — springende Käfer merken dich nicht.',
      'trade': 'Knackt überhaupt keinen Panzer.'
    },
    'rollerSkate': {
      'name': 'Rollschuh',
      'perk': 'Auftreten und weiterziehen pflügt eine ganze Linie.',
      'trade': 'Sehr schmale Trittfläche.'
    },
    'cleatBoot': {
      'name': 'Stollenschuh',
      'perk': 'Stollen stechen durch Panzer und Stinkdrüsen.',
      'trade': 'Die kleinste Trittfläche im Spind.'
    },
    'electricSock': {
      'name': 'Elektrosocke',
      'perk': 'Jeder Tritt schickt Blitze zu drei weiteren Käfern.',
      'trade': 'Die Blitze erwischen nur schwache Käfer.'
    }
  },
  'locker': {
    'title': 'Spind',
    'buy': 'Kaufen {n}',
    'wear': 'Anziehen',
    'worn': 'Getragen',
    'needStars': 'Noch {n} Sterne',
    'needCoins': 'Noch {n} Münzen',
    'price': 'Preis: {n} Münzen',
    'starGate': 'Ab {n} Sternen',
    'adUnlock': 'Video ansehen und freischalten'
  },
  'chest': {
    'label': 'Schatztruhe',
    'ready': 'Schatztruhe für {n} Münzen öffnen',
    'filling': 'Schatztruhe — füllt sich',
    'spent': 'Schatztruhe — bis morgen leer'
  },
  'reveal': {
    'world': 'Neuer Ort zum Stampfen!',
    'shoe': 'Neue Schuhe!',
    'stars': 'Sternziel erreicht!',
    'record': 'Neuer Bestwert!',
    'chest': 'Schatz!',
    'foe': 'Ein neues Krabbeltier!',
    'starsTotal': '{n} Sterne',
    'recordScore': '{n} Punkte',
    'recordBeat': 'Alter Bestwert: {n}',
    'chestCoins': '+{n} Münzen',
    'move': 'Neuer Trick!'
  },
  'moves': {
    'spin': 'Fersen-Dreh',
    'skid': 'Rutscher',
    'quake': 'Beben-Stampfer',
    'echo': 'Echo-Stampfer'
  },
  'party': {
    'title': 'Käferparty!',
    'count': '{n} Käfer',
    'best': 'Bestwert: {n}',
    'newBest': 'Neuer Party-Rekord!'
  },
  'fever': {
    'filling': 'Platsch-Fieber: {n}% voll',
    'ready': 'Platsch-Fieber bereit — tippen',
    'running': 'Platsch-Fieber läuft'
  },
  'objectives': {
    'clear': 'Level schaffen',
    'combo': '×{n}-Kette erreichen',
    'noSpike': 'Keinen Stachel-Schaden',
    'time': 'Mit {n}s Rest fertig werden',
    'accuracy': '{n}% der Tritte treffen',
    'fever': 'Platsch-Fieber {n}× auslösen',
    'kind': '{n} {bug} zermatschen',
    'feverKills': '{n} in einem Fieber schaffen',
    'noMiss': 'Höchstens {n} Tritte daneben',
    'score': '{n} Punkte holen'
  },
  'quests': {
    'title': 'Sternziele',
    'onTrack': '{objective} — auf Kurs',
    'progress': '{objective} — {n}% geschafft',
    'missed': '{objective} — verpasst'
  },
  'hints': {
    'move': {
      'touch': 'Tippen zum Bewegen',
      'desktop': 'Klicken zum Bewegen'
    },
    'slam': {
      'touch': 'Halten, dann loslassen für einen Wuchtschlag',
      'desktop': 'Taste halten für einen Wuchtschlag'
    },
    'sprinter': {
      'touch': 'Flitzer rennen weg — tippe, wo sie stehen bleiben',
      'desktop': 'Flitzer fliehen vor dem Schuh — still halten, dann klicken'
    },
    'beetle': {
      'touch': 'Käfer haben Panzer — halten und zuschlagen',
      'desktop': 'Käfer haben Panzer — halten und zuschlagen'
    },
    'flea': {
      'touch': 'Flöhe springen weg — triff die Landung',
      'desktop': 'Flöhe springen weg — triff die Landung'
    },
    'spike': {
      'touch': 'Nicht auf die Stacheligen treten!',
      'desktop': 'Nicht auf die Stacheligen treten!'
    },
    'stink': {
      'touch': 'Stinkwanzen vernebeln den Bildschirm',
      'desktop': 'Stinkwanzen vernebeln den Bildschirm'
    },
    'fever': {
      'touch': 'Das Glas ist voll — tipp die Flamme!',
      'desktop': 'Das Glas ist voll — klick die Flamme!'
    },
    'honey': {
      'touch': 'Honig hält Springer fest',
      'desktop': 'Honig hält Springer fest'
    },
    'web': {
      'touch': 'Spinnweben bremsen deinen Fuß',
      'desktop': 'Spinnweben bremsen deinen Fuß'
    },
    'belt': {
      'touch': 'Das Band trägt Käfer mit sich',
      'desktop': 'Das Band trägt Käfer mit sich'
    },
    'sweeper': {
      'touch': 'Der Kehrer zermatscht Käfer gratis',
      'desktop': 'Der Kehrer zermatscht Käfer gratis'
    },
    'boss': {
      'touch': 'Halten und schlagen, wenn der Boss ausholt',
      'desktop': 'Halten und schlagen, wenn der Boss ausholt'
    },
    'pods': {
      'touch': 'Zermatsch die Eier, bevor sie schlüpfen!',
      'desktop': 'Zermatsch die Eier, bevor sie schlüpfen!'
    }
  },
  'result': {
    'cleared': 'Level geschafft!',
    'timeUp': 'Zeit abgelaufen!',
    'upNext': 'Als Nächstes: {n}',
    'retryLevel': 'Nochmal?',
    'campaignDone': 'Alle Level geschafft!',
    'newRecord': 'Neuer Rekord!',
    'nextLevel': 'Nächstes Level',
    'tryAgain': 'Nochmal',
    'squishes': 'Zermatschte Käfer',
    'starsEarned': '{n} von 3 Sternen',
    'rankOf': 'von {n}',
    'worldUnlocked': '{n} freigeschaltet!',
    'peekNext': 'Blick auf {n}',
    'secondWind': 'Zweite Luft: Dein nächster Versuch startet mit vollem Fläschchen',
    'hintSlam': 'Tipp: Halten, um die Panzer zu knacken',
    'hintAvoid': 'Tipp: Lass die stacheligen in Ruhe',
    'missed': 'Noch {n} Käfer'
  },
  'leaderboard': {
    'title': 'Bestenliste',
    'rank': 'Platz',
    'player': 'Spieler',
    'score': 'Punkte',
    'level': 'Level',
    'you': 'Du',
    'yourRank': 'Du bist #{n} von {total}',
    'of': 'von {n}',
    'unranked': 'Schaff ein Level für die Liste',
    'loading': 'Liste wird geladen…',
    'empty': 'Noch hat niemand gepunktet',
    'failed': 'Bestenliste nicht erreichbar'
  },
  'options': {
    'title': 'Einstellungen',
    'general': 'Allgemein',
    'play': 'Spiel',
    'audio': 'Audio',
    'close': 'Speichern & schließen',
    'language': 'Sprache',
    'difficulty': 'Schwierigkeit',
    'soundEffects': 'Soundeffekte',
    'music': 'Musik',
    'musicTrack': 'Musikstück',
    'haptics': 'Vibration',
    'on': 'An',
    'off': 'Aus',
    'difficulties': {
      'easy': 'Leicht',
      'medium': 'Normal',
      'hard': 'Schwer'
    },
    'difficultyHints': {
      'easy': 'Langsamere Käfer und mehr Zeit.',
      'medium': 'Das Spiel, wie es gedacht ist.',
      'hard': 'Schnellere Käfer und vollere Felder.'
    },
    'musicTracks': {
      'parade': 'Knusper-Parade',
      'trance': 'Käfer-Groove',
      'cozy': 'Gemütliches Picknick'
    },
    'juiceStyle': 'Platsch-Stil',
    'juiceStyles': {
      'ooze': 'Comic-Schleim',
      'confetti': 'Konfetti-Piñata',
      'bubble': 'Seifenblasen'
    },
    'juiceStyleHints': {
      'ooze': 'Bunter Comic-Schleim. Das Spiel bleibt gleich.',
      'confetti': 'Käfer platzen zu Konfetti. Das Spiel bleibt gleich.',
      'bubble': 'Käfer werden zu Seifenblasen. Das Spiel bleibt gleich.'
    },
    'highVis': 'Großer Trittkreis',
    'highVisHint': 'Ein dickerer, hellerer Ring dort, wo dein Fuß landet.',
    'singleTap': 'Zielhilfe',
    'singleTapHint': 'Tipp irgendwohin — dein Fuß fliegt zum nächsten Käfer.'
  },
  'loading': {
    'uhOh': 'Oh-oh!',
    'missed': 'Daneben!',
    'tooLong': 'Lädt noch… Verbindung prüfen?'
  },
  'saveStatus': {
    'restoredTitle': 'Fortschritt wiederhergestellt',
    'restoredBody': 'Wir haben deinen Spielstand zurückgeholt und {n} Münzen dazugelegt.',
    'pausedTitle': 'Speichern pausiert',
    'pausedBody': 'Der Speicherdienst ist nicht erreichbar. Dein Fortschritt ist auf diesem Gerät sicher.',
    'retry': 'Erneut',
    'dismiss': 'Schließen',
    'tap': 'Zum Schließen tippen'
  },
  'adsBlocked': {
    'title': 'Werbeblocker erkannt',
    'body': 'Bug Crunch ist dank Werbung kostenlos. Bitte schalte deinen Werbeblocker aus und lade neu.',
    'allowPrefix': 'Werbung erlauben auf',
    'allowSuffix': 'und die Seite neu laden.',
    'gotIt': 'Alles klar'
  },
  'license': {
    'denied': 'Diese Kopie konnte nicht überprüft werden'
  }
}
