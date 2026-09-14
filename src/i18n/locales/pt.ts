// PT bundle. Mirrors the key shape of `en.ts`, which is the source
// of truth — see `tests/i18nParity.test.ts`. Every `{placeholder}` must survive
// translation; a dropped one renders as literal text and reads as a bug.
export default {
  'gameName': 'Bug Crunch',
  'cancel': 'Cancelar',
  'close': 'Fechar',
  'ok': 'Ok',
  'continue': 'Continuar',
  'tapToContinue': 'Toque para continuar',
  'clickToContinue': 'Clique para continuar',
  'rewards': 'RECOMPENSAS',
  'tip': 'Dica',
  'crazyGamesOnly': 'Este jogo só está disponível em',
  'ui': {
    'next': 'Seguinte',
    'replay': 'Repetir',
    'back': 'Voltar',
    'play': 'Jogar',
    'pause': 'Pausa',
    'menu': 'Menu',
    'home': 'Início',
    'info': 'Info'
  },
  'hud': {
    'score': 'Pontos',
    'time': 'Tempo',
    'chain': 'Corrente Splat: {n}',
    'level': 'Nível {n}'
  },
  'worlds': {
    'picnic': 'Toalha de piquenique',
    'backyard': 'Quintal selvagem',
    'attic': 'Sótão empoeirado',
    'arcade': 'Arcade de néon'
  },
  'bugs': {
    'ant': 'Formigas',
    'sprinter': 'Formigas velozes',
    'beetle': 'Besouros',
    'flea': 'Pulgas',
    'caterpillar': 'Lagartas',
    'stinkbug': 'Percevejos',
    'centipede': 'Centopeias',
    'pinatafly': 'Moscas piñata',
    'moth': 'Mariposas',
    'robobug': 'Robôs-inseto'
  },
  'bosses': {
    'queenAnt': 'Rainha Formiga Golias',
    'beetleKing': 'Rei Besouro Espinhoso',
    'matriarch': 'Matriarca Centopeia',
    'roachPrime': 'Meca-Barata Prime'
  },
  'boss': {
    'tell': {
      'stomp': 'Pisa o chefe!',
      'summon': 'Limpa o enxame!',
      'pods': 'Esmaga os ovos!',
      'charge': 'Segura e bate!',
      'spin': 'Sai do círculo!',
      'shield': 'Quebra o escudo!',
      'beam': 'Desvia do raio!'
    }
  },
  'shoes': {
    'stats': {
      'speed': 'Velocidade',
      'radius': 'Área da pisada',
      'pierce': 'Perfuração'
    },
    'sneaker': {
      'name': 'Ténis clássico',
      'perk': 'Equilibrado e rápido a recuperar.',
      'trade': 'Não se destaca em nada.'
    },
    'steelBoot': {
      'name': 'Bota com biqueira de aço',
      'perk': 'Espinhos não te magoam. As pisadas atordoam à volta.',
      'trade': 'Pesada e lenta a levantar.'
    },
    'bunnySlipper': {
      'name': 'Pantufa de coelho',
      'perk': 'Passo silencioso: os saltitões não te veem chegar.',
      'trade': 'Não quebra carapaça nenhuma.'
    },
    'rollerSkate': {
      'name': 'Patim',
      'perk': 'Pisa e continua a arrastar para varrer uma linha inteira.',
      'trade': 'Pisada muito estreita.'
    },
    'cleatBoot': {
      'name': 'Chuteira',
      'perk': 'Os pitons furam carapaças e glândulas.',
      'trade': 'A menor pisada do cacifo.'
    },
    'electricSock': {
      'name': 'Meia elétrica',
      'perk': 'Cada pisada lança raios a mais três insetos.',
      'trade': 'Os raios só acabam com os fracos.'
    }
  },
  'locker': {
    'title': 'Cacifo',
    'buy': 'Comprar {n}',
    'wear': 'Calçar',
    'worn': 'Calçado',
    'needStars': 'Mais {n} estrelas',
    'needCoins': 'Mais {n} moedas',
    'price': 'Preço: {n} moedas',
    'starGate': 'Abre com {n} estrelas',
    'adUnlock': 'Vê um vídeo para desbloquear'
  },
  'chest': {
    'label': 'Baú do tesouro',
    'ready': 'Abrir o baú por {n} moedas',
    'filling': 'Baú do tesouro — a encher',
    'spent': 'Baú do tesouro — vazio até amanhã'
  },
  'reveal': {
    'world': 'Novo lugar para pisar!',
    'shoe': 'Sapatos novos!',
    'stars': 'Meta de estrelas!',
    'record': 'Novo recorde!',
    'chest': 'Tesouro!',
    'foe': 'Um bicho novo!',
    'starsTotal': '{n} estrelas',
    'recordScore': '{n} pontos',
    'recordBeat': 'Recorde anterior: {n}',
    'chestCoins': '+{n} moedas'
  },
  'fever': {
    'filling': 'Febre Splat: {n}% cheia',
    'ready': 'Febre Splat pronta — toca para começar',
    'running': 'Febre Splat a decorrer'
  },
  'objectives': {
    'clear': 'Termina o nível',
    'combo': 'Chega a uma corrente ×{n}',
    'noSpike': 'Não leves dano de espinhos',
    'time': 'Acaba com {n}s de sobra',
    'accuracy': 'Acerta {n}% das pisadas',
    'fever': 'Ativa a Febre Splat {n}×',
    'kind': 'Esmaga {n} {bug}',
    'feverKills': 'Esmaga {n} numa Febre',
    'noMiss': 'Falha no máximo {n} pisadas',
    'score': 'Faz {n} pontos'
  },
  'quests': {
    'onTrack': '{objective} — no caminho certo',
    'progress': '{objective} — {n}% feito',
    'missed': '{objective} — perdido'
  },
  'hints': {
    'move': {
      'touch': 'Toca para mover',
      'desktop': 'Clica para mover'
    },
    'slam': {
      'touch': 'Segura e larga para uma pisada forte',
      'desktop': 'Segura o botão para uma pisada forte'
    },
    'sprinter': {
      'touch': 'As velozes fogem — pisa onde elas param',
      'desktop': 'As velozes fogem do sapato — fica parado e clica'
    },
    'beetle': {
      'touch': 'Besouros têm carapaça: segura e bate',
      'desktop': 'Besouros têm carapaça: segura e bate'
    },
    'flea': {
      'touch': 'As pulgas saltam: acerta onde aterram',
      'desktop': 'As pulgas saltam: acerta onde aterram'
    },
    'spike': {
      'touch': 'Não pises os espinhosos!',
      'desktop': 'Não pises os espinhosos!'
    },
    'stink': {
      'touch': 'Percevejos turvam o ecrã quando esmagados',
      'desktop': 'Percevejos turvam o ecrã quando esmagados'
    },
    'fever': {
      'touch': 'O frasco está cheio — toca na chama!',
      'desktop': 'O frasco está cheio — clica na chama!'
    },
    'honey': {
      'touch': 'O mel prende os saltitões',
      'desktop': 'O mel prende os saltitões'
    },
    'web': {
      'touch': 'As teias travam o teu pé',
      'desktop': 'As teias travam o teu pé'
    },
    'belt': {
      'touch': 'A esteira leva os insetos com ela',
      'desktop': 'A esteira leva os insetos com ela'
    },
    'sweeper': {
      'touch': 'A varredora esmaga insetos de graça',
      'desktop': 'A varredora esmaga insetos de graça'
    },
    'boss': {
      'touch': 'Segura e bate quando o chefe se preparar',
      'desktop': 'Segura e bate quando o chefe se preparar'
    },
    'pods': {
      'touch': 'Esmaga os ovos antes de eclodirem!',
      'desktop': 'Esmaga os ovos antes de eclodirem!'
    }
  },
  'result': {
    'cleared': 'Nível concluído!',
    'timeUp': 'Acabou o tempo!',
    'upNext': 'A seguir: {n}',
    'retryLevel': 'Outra vez?',
    'campaignDone': 'Todos os níveis concluídos!',
    'newRecord': 'Novo recorde!',
    'nextLevel': 'Nível seguinte',
    'tryAgain': 'Tentar de novo',
    'squishes': 'Insetos esmagados',
    'starsEarned': '{n} de 3 estrelas',
    'rankOf': 'de {n}',
    'worldUnlocked': '{n} desbloqueado!'
  },
  'leaderboard': {
    'title': 'Classificação',
    'rank': 'Posição',
    'player': 'Jogador',
    'score': 'Pontos',
    'level': 'Nível',
    'you': 'Tu',
    'yourRank': 'És o #{n} de {total}',
    'of': 'de {n}',
    'unranked': 'Termina um nível para entrar',
    'loading': 'A carregar a classificação…',
    'empty': 'Ainda ninguém pontuou',
    'failed': 'Não foi possível chegar à classificação'
  },
  'options': {
    'title': 'Definições',
    'general': 'Geral',
    'play': 'Jogo',
    'audio': 'Áudio',
    'close': 'Guardar e fechar',
    'language': 'Idioma',
    'difficulty': 'Dificuldade',
    'soundEffects': 'Efeitos sonoros',
    'music': 'Música',
    'musicTrack': 'Faixa musical',
    'haptics': 'Vibração',
    'on': 'Sim',
    'off': 'Não',
    'difficulties': {
      'easy': 'Fácil',
      'medium': 'Normal',
      'hard': 'Difícil'
    },
    'difficultyHints': {
      'easy': 'Insetos mais lentos e mais tempo.',
      'medium': 'O jogo tal como foi desenhado.',
      'hard': 'Insetos mais rápidos e campos mais cheios.'
    },
    'musicTracks': {
      'trance': 'Groove dos insetos',
      'cozy': 'Piquenique calmo'
    },
    'juiceStyle': 'Estilo de splat',
    'juiceStyles': {
      'ooze': 'Gosma de desenho',
      'confetti': 'Piñata de confetes',
      'bubble': 'Bolhas de sabão'
    },
    'juiceStyleHints': {
      'ooze': 'Gosma colorida. O jogo é o mesmo.',
      'confetti': 'Os insetos rebentam em confetes. O jogo é o mesmo.',
      'bubble': 'Os insetos viram bolhas. O jogo é o mesmo.'
    },
    'highVis': 'Círculo de pisada grande',
    'highVisHint': 'Um anel mais grosso e brilhante onde o teu pé vai cair.',
    'singleTap': 'Pontaria fácil',
    'singleTapHint': 'Toca em qualquer sítio e o pé voa para o inseto mais próximo.'
  },
  'loading': {
    'boo': 'Bu!',
    'laugh': 'Hi hi!',
    'tooLong': 'Ainda a carregar… verifica a ligação?'
  },
  'saveStatus': {
    'restoredTitle': 'Progresso restaurado',
    'restoredBody': 'Recuperámos o teu jogo e juntámos {n} moedas.',
    'pausedTitle': 'Gravação em pausa',
    'pausedBody': 'Não conseguimos aceder ao serviço de gravação. O teu progresso está seguro neste dispositivo.',
    'retry': 'Tentar de novo',
    'dismiss': 'Dispensar',
    'tap': 'Toca para fechar'
  },
  'adsBlocked': {
    'title': 'Bloqueador de anúncios detetado',
    'body': 'O Bug Crunch é grátis graças aos anúncios. Desliga o bloqueador e recarrega.',
    'allowPrefix': 'Permite anúncios em',
    'allowSuffix': 'e recarrega a página.',
    'gotIt': 'Entendido'
  },
  'license': {
    'denied': 'Não foi possível verificar esta cópia'
  }
}
