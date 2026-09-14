// FR bundle. Mirrors the key shape of `en.ts`, which is the source
// of truth — see `tests/i18nParity.test.ts`. Every `{placeholder}` must survive
// translation; a dropped one renders as literal text and reads as a bug.
export default {
  'gameName': 'Bug Crunch',
  'cancel': 'Annuler',
  'close': 'Fermer',
  'ok': 'Ok',
  'continue': 'Continuer',
  'tapToContinue': 'Touche pour continuer',
  'clickToContinue': 'Clique pour continuer',
  'rewards': 'RÉCOMPENSES',
  'tip': 'Astuce',
  'crazyGamesOnly': 'Ce jeu est uniquement disponible sur',
  'ui': {
    'next': 'Suivant',
    'replay': 'Rejouer',
    'back': 'Retour',
    'play': 'Jouer',
    'pause': 'Pause',
    'menu': 'Menu',
    'home': 'Accueil',
    'info': 'Infos'
  },
  'hud': {
    'score': 'Score',
    'time': 'Temps',
    'chain': 'Chaîne Splat : {n}',
    'level': 'Niveau {n}'
  },
  'worlds': {
    'picnic': 'Nappe de pique-nique',
    'backyard': 'Jardin en friche',
    'attic': 'Grenier poussiéreux',
    'arcade': 'Arcade néon'
  },
  'bugs': {
    'ant': 'Fourmis',
    'sprinter': 'Fourmis sprinteuses',
    'beetle': 'Scarabées',
    'flea': 'Puces',
    'caterpillar': 'Chenilles',
    'stinkbug': 'Punaises',
    'centipede': 'Mille-pattes',
    'pinatafly': 'Mouches piñata',
    'moth': 'Papillons de nuit',
    'robobug': 'Robo-insectes'
  },
  'bosses': {
    'queenAnt': 'Reine Fourmi Goliath',
    'beetleKing': 'Roi Scarabée Épineux',
    'matriarch': 'Matriarche Mille-pattes',
    'roachPrime': 'Méca-Cafard Prime'
  },
  'boss': {
    'tell': {
      'stomp': 'Écrase le boss !',
      'summon': 'Balaie l\'essaim !',
      'pods': 'Écrase les œufs !',
      'charge': 'Maintiens et frappe !',
      'spin': 'Sors du cercle !',
      'shield': 'Brise le bouclier !',
      'beam': 'Évite le rayon !'
    }
  },
  'shoes': {
    'stats': {
      'speed': 'Vitesse',
      'radius': 'Zone d\'écrasement',
      'pierce': 'Perforation'
    },
    'sneaker': {
      'name': 'Basket classique',
      'perk': 'Équilibrée et vite prête.',
      'trade': 'Bonne partout, excellente nulle part.'
    },
    'steelBoot': {
      'name': 'Botte à bout d\'acier',
      'perk': 'Les piquants ne te font rien. Les frappes étourdissent autour.',
      'trade': 'Lourde et lente à lever.'
    },
    'bunnySlipper': {
      'name': 'Chausson lapin',
      'perk': 'Pas silencieux : les sauteurs ne te voient pas venir.',
      'trade': 'Incapable de briser une carapace.'
    },
    'rollerSkate': {
      'name': 'Patin à roulettes',
      'perk': 'Écrase puis glisse pour labourer toute une ligne.',
      'trade': 'Zone d\'écrasement très étroite.'
    },
    'cleatBoot': {
      'name': 'Chaussure à crampons',
      'perk': 'Les crampons percent carapaces et glandes.',
      'trade': 'La plus petite zone du vestiaire.'
    },
    'electricSock': {
      'name': 'Chaussette électrique',
      'perk': 'Chaque écrasement envoie des éclairs à trois insectes.',
      'trade': 'Les éclairs n\'achèvent que les faibles.'
    }
  },
  'locker': {
    'title': 'Vestiaire',
    'buy': 'Acheter {n}',
    'wear': 'Porter',
    'worn': 'Portée',
    'needStars': '{n} étoiles de plus',
    'needCoins': '{n} pièces de plus',
    'price': 'Prix : {n} pièces',
    'starGate': 'Débloqué à {n} étoiles',
    'adUnlock': 'Regarde une vidéo pour débloquer'
  },
  'chest': {
    'label': 'Coffre au trésor',
    'ready': 'Ouvrir le coffre pour {n} pièces',
    'filling': 'Coffre au trésor — en remplissage',
    'spent': 'Coffre au trésor — vide jusqu’à demain'
  },
  'reveal': {
    'world': 'Un nouvel endroit à écraser !',
    'shoe': 'De nouvelles chaussures !',
    'stars': 'Palier d’étoiles !',
    'record': 'Nouveau record !',
    'chest': 'Trésor !',
    'foe': 'Une nouvelle bestiole !',
    'starsTotal': '{n} étoiles',
    'recordScore': '{n} points',
    'recordBeat': 'Ancien record : {n}',
    'chestCoins': '+{n} pièces'
  },
  'fever': {
    'filling': 'Fièvre Splat : {n}% pleine',
    'ready': 'Fièvre Splat prête — touche pour lancer',
    'running': 'Fièvre Splat en cours'
  },
  'objectives': {
    'clear': 'Termine le niveau',
    'combo': 'Atteins une chaîne ×{n}',
    'noSpike': 'Ne prends aucun dégât de piquant',
    'time': 'Finis avec {n}s restantes',
    'accuracy': 'Touche {n}% de tes écrasements',
    'fever': 'Déclenche la Fièvre Splat {n}×',
    'kind': 'Écrase {n} {bug}',
    'feverKills': 'Écrase {n} en une Fièvre',
    'noMiss': 'Rate au plus {n} écrasements',
    'score': 'Marque {n} points'
  },
  'quests': {
    'onTrack': '{objective} — en bonne voie',
    'progress': '{objective} — {n}% fait',
    'missed': '{objective} — manqué'
  },
  'hints': {
    'move': {
      'touch': 'Touche pour bouger',
      'desktop': 'Clique pour bouger'
    },
    'slam': {
      'touch': 'Maintiens puis relâche pour une grosse frappe',
      'desktop': 'Maintiens le bouton pour une grosse frappe'
    },
    'sprinter': {
      'touch': 'Les sprinteuses fuient — tape où elles s’arrêtent',
      'desktop': 'Les sprinteuses fuient la chaussure — reste immobile, puis clique'
    },
    'beetle': {
      'touch': 'Les scarabées ont une carapace : maintiens et frappe',
      'desktop': 'Les scarabées ont une carapace : maintiens et frappe'
    },
    'flea': {
      'touch': 'Les puces sautent : frappe où elles atterrissent',
      'desktop': 'Les puces sautent : frappe où elles atterrissent'
    },
    'spike': {
      'touch': 'N\'écrase pas les piquants !',
      'desktop': 'N\'écrase pas les piquants !'
    },
    'stink': {
      'touch': 'Les punaises brouillent l\'écran quand on les écrase',
      'desktop': 'Les punaises brouillent l\'écran quand on les écrase'
    },
    'fever': {
      'touch': 'La fiole est pleine — touche la flamme !',
      'desktop': 'La fiole est pleine — clique la flamme !'
    },
    'honey': {
      'touch': 'Le miel immobilise les sauteurs',
      'desktop': 'Le miel immobilise les sauteurs'
    },
    'web': {
      'touch': 'Les toiles ralentissent ton pied',
      'desktop': 'Les toiles ralentissent ton pied'
    },
    'belt': {
      'touch': 'Le tapis emporte les insectes',
      'desktop': 'Le tapis emporte les insectes'
    },
    'sweeper': {
      'touch': 'La balayeuse écrase les insectes gratuitement',
      'desktop': 'La balayeuse écrase les insectes gratuitement'
    },
    'boss': {
      'touch': 'Maintiens et frappe quand le boss s\'élance',
      'desktop': 'Maintiens et frappe quand le boss s\'élance'
    },
    'pods': {
      'touch': 'Écrase les œufs avant l\'éclosion !',
      'desktop': 'Écrase les œufs avant l\'éclosion !'
    }
  },
  'result': {
    'cleared': 'Niveau réussi !',
    'timeUp': 'Temps écoulé !',
    'upNext': 'Ensuite : {n}',
    'retryLevel': 'On retente ?',
    'campaignDone': 'Tous les niveaux réussis !',
    'newRecord': 'Nouveau record !',
    'nextLevel': 'Niveau suivant',
    'tryAgain': 'Réessayer',
    'squishes': 'Insectes écrasés',
    'starsEarned': '{n} étoiles sur 3',
    'rankOf': 'sur {n}',
    'worldUnlocked': '{n} débloqué !'
  },
  'leaderboard': {
    'title': 'Classement',
    'rank': 'Rang',
    'player': 'Joueur',
    'score': 'Score',
    'level': 'Niveau',
    'you': 'Toi',
    'yourRank': 'Tu es #{n} sur {total}',
    'of': 'sur {n}',
    'unranked': 'Termine un niveau pour entrer',
    'loading': 'Chargement du classement…',
    'empty': 'Personne n\'a encore marqué',
    'failed': 'Classement inaccessible'
  },
  'options': {
    'title': 'Réglages',
    'general': 'Général',
    'play': 'Jeu',
    'audio': 'Audio',
    'close': 'Enregistrer et fermer',
    'language': 'Langue',
    'difficulty': 'Difficulté',
    'soundEffects': 'Effets sonores',
    'music': 'Musique',
    'musicTrack': 'Piste musicale',
    'haptics': 'Vibration',
    'on': 'Oui',
    'off': 'Non',
    'difficulties': {
      'easy': 'Facile',
      'medium': 'Normal',
      'hard': 'Difficile'
    },
    'difficultyHints': {
      'easy': 'Insectes plus lents et plus de temps.',
      'medium': 'Le jeu tel qu\'il a été conçu.',
      'hard': 'Insectes plus rapides et terrains chargés.'
    },
    'musicTracks': {
      'trance': 'Groove des insectes',
      'cozy': 'Pique-nique tranquille'
    },
    'juiceStyle': 'Style de splat',
    'juiceStyles': {
      'ooze': 'Bave cartoon',
      'confetti': 'Piñata de confettis',
      'bubble': 'Bulles de savon'
    },
    'juiceStyleHints': {
      'ooze': 'Bave colorée. Le jeu ne change pas.',
      'confetti': 'Les insectes éclatent en confettis. Le jeu ne change pas.',
      'bubble': 'Les insectes deviennent des bulles. Le jeu ne change pas.'
    },
    'highVis': 'Grand cercle d\'écrasement',
    'highVisHint': 'Un anneau plus épais et plus vif là où ton pied va tomber.',
    'singleTap': 'Visée facile',
    'singleTapHint': 'Touche n\'importe où, ton pied file vers l\'insecte le plus proche.'
  },
  'loading': {
    'boo': 'Bouh !',
    'laugh': 'Hi hi !',
    'tooLong': 'Toujours en chargement… vérifie ta connexion ?'
  },
  'saveStatus': {
    'restoredTitle': 'Progression restaurée',
    'restoredBody': 'Nous avons récupéré ta sauvegarde et ajouté {n} pièces.',
    'pausedTitle': 'Sauvegarde en pause',
    'pausedBody': 'Le service de sauvegarde est injoignable. Ta progression est à l\'abri sur cet appareil.',
    'retry': 'Réessayer',
    'dismiss': 'Fermer',
    'tap': 'Touche pour fermer'
  },
  'adsBlocked': {
    'title': 'Bloqueur de pub détecté',
    'body': 'Bug Crunch est gratuit grâce aux pubs. Désactive ton bloqueur et recharge.',
    'allowPrefix': 'Autorise les pubs sur',
    'allowSuffix': 'et recharge la page.',
    'gotIt': 'Compris'
  },
  'license': {
    'denied': 'Cette copie n\'a pas pu être vérifiée'
  }
}
