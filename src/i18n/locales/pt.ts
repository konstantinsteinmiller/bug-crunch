export default {
  'gameName': 'Survivalist',
  'cancel': 'Cancelar',
  'close': 'Fechar',
  'ok': 'Ok',
  'continue': 'Continuar',
  'tapToContinue': 'Toque para continuar',
  'clickToContinue': 'Clique para continuar',
  'rewards': 'RECOMPENSAS',
  'tip': 'Dica',
  'crazyGamesOnly': 'Este jogo só está disponível em',

  // Shared UI labels. NOT dead keys: they are the `aria-label` on the game's
  // icon-only buttons, read aloud rather than shown. See `en.ts`.
  'ui': {
    'next': 'Próximo',
    'replay': 'Repetir',
    'back': 'Voltar',
    'play': 'Jogar',
    'pause': 'Pausa',
    'menu': 'Menu',
    'home': 'Início',
    'info': 'Info'
  },

  'hud': {
    'stage': 'Fase {n}',
    'best': 'Recorde {n}',
    'boss': 'Chefe',
    'miniboss': 'Minichefe',
    'fireRate': 'Ritmo',
    'incoming': 'Ataque a caminho!',
    'dodge': 'Desvie',
    'milestone': '{n} em campo!',
    'weaponActive': '{name} pronto',
    'weaponLocked': '{name} bloqueado — {n} de {total} alavancas atingidas',
    'weaponGift': '{name} à frente — grátis, sem alavancas',
    'weaponFree': 'GRÁTIS'
  },

  'weapons': {
    'rocket': 'Lança-foguetes',
    'gatling': 'Metralhadora Gatling'
  },

  'tutorial': {
    'touch': 'Deslize para mover seu esquadrão',
    'desktop': 'Mova o mouse para guiar seu esquadrão'
  },
  'hints': {
    'move': { 'touch': 'Toque para mover', 'desktop': 'Clique para mover' },
    'gate': { 'touch': 'Continue atirando no portão: +1 a cada meio segundo', 'desktop': 'Continue atirando no portão: +1 a cada meio segundo' },
    'trap': { 'touch': 'Portões vermelhos DIMINUEM o esquadrão: pegue o outro!', 'desktop': 'Portões vermelhos DIMINUEM o esquadrão: pegue o outro!' },
    'divider': { 'touch': 'Nunca toque no pilar entre os portões', 'desktop': 'Nunca toque no pilar entre os portões' },
    'crate': { 'touch': 'Caixas verdes: todos batem mais forte', 'desktop': 'Caixas verdes: todos batem mais forte' },
    'rate': { 'touch': 'Caixas azuis: todos atiram mais rápido', 'desktop': 'Caixas azuis: todos atiram mais rápido' },
    'boss': { 'touch': 'Fique fora do círculo vermelho!', 'desktop': 'Fique fora do círculo vermelho!' },
    'lever': { 'touch': 'Atire nas DUAS alavancas nas bordas: elas abrem a caixa de arma', 'desktop': 'Atire nas DUAS alavancas nas bordas: elas abrem a caixa de arma' },
    'guard': { 'touch': 'Escudo ativo: seus tiros não fazem nada. SAIA DAÍ!', 'desktop': 'Escudo ativo: seus tiros não fazem nada. SAIA DAÍ!' },
    'cage': { 'touch': 'Atire nas jaulas: os prisioneiros entram no seu esquadrão', 'desktop': 'Atire nas jaulas: os prisioneiros entram no seu esquadrão' },
    'shieldBox': { 'touch': 'Caixa escudo: espera e bloqueia um golpe grande', 'desktop': 'Caixa escudo: espera e bloqueia um golpe grande' }
  },

  'flow': {

    'unlocked': 'Desbloqueado!',

    'guardian': "Um anjo da guarda salvou você!",

    'guardianSub': "{n} sobreviventes voltaram",

    'next': "A seguir: {label} · {when}"

  },

  'ladder': {
    'weaponPick': "Escolher uma arma",
    'nextStage': "próximo nível",
    'stagesAway': "em {n} níveis"
  },
  'weaponPick': {
    'title': "Escolha a sua arma",
    'subtitle': "Sua no nível {n}. Há mais esperando na estrada.",
    'take': "Pegar",
    'rocket': {
      'a': "Salva teleguiada",
      'b': "Dano explosivo"
    },
    'gatling': {
      'a': "Cadência de tiro dobrada",
      'b': "Carrega portões mais rápido"
    }
  },
  'result': {
    'stageClear': 'Fase concluída!',
    'wipedOut': 'Esquadrão dizimado',
    'reachedStage': 'Fase {n}',
    'newRecord': 'Novo recorde!',
    'rallied': 'Segundo fôlego',
    'peakSquad': 'Maior esquadrão',
    'kills': 'Abates',
    'tripleCoins': '3×',
    'tripleBonus': '(+{n})',
    'tripleClaimed': 'Moedas triplicadas!',
    'nextStage': 'Próxima fase',
    'tryAgain': 'Tentar de novo',
    'upgrade': 'Melhorar',
    'upgradeHint': 'Melhore seu esquadrão!',
    'rankOf': 'de {n}',
    'upNext': 'A seguir: Nível {n}'
  },

  // Two strings only; everything ON the card comes from keys this file
  // already had (see en.ts). `action` is the accessible name of an
  // icon-only button. `text` rides in the share sheet and is read by the
  // person who receives the picture, so it is a boast, and it has to still
  // make sense if the image never arrives.
  'share': {
    'action': 'Compartilhar partida',
    'text': 'Cheguei à fase {n} em {game}. Consegue ir mais longe?'
  },

  'leaderboard': {
    'title': 'Classificação',
    'rank': '#',
    'player': 'Jogador',
    'stage': 'Fase',
    'squad': 'Esquadrão',
    'empty': 'Ainda não há marcas. Seja o primeiro!',
    'failed': 'Não foi possível carregar a classificação.',
    'loading': 'Carregando…',
    'you': 'Você',
    'yourRank': 'Você é #{n}',
    'of': 'de {n} jogadores'
  },

  'chest': {
    'label': 'Baú do tesouro',
    'ready': 'Abrir o baú por {n} moedas',
    'filling': 'Baú do tesouro: enchendo',
    'spent': 'Baú do tesouro: vazio até amanhã'
  },

  // Daily expedition. See en.ts for what each state means, why the multiplier
  // is split from any word, and why `hud` has to stay one short word.
  'expedition': {
    'title': 'Expedição diária',
    'hud': 'Expedição',
    'multiplier': '{n}×',
    'available': 'Expedição diária — a estrada de hoje, moedas triplicadas',
    'confirm': 'Iniciar expedição',
    'spent': 'Expedição diária — nova estrada em {time}',
    'done': 'Volte amanhã',
    'back': 'Voltar à campanha'
  },

  'skills': {

    'grenade': 'Granada',

    'shield': 'Escudo'

  },

  'upgrades': {
    'title': 'Melhorias',
    'spotlight': 'Gaste!',
    'level': 'Nv {n}',
    'maxed': 'Máx',
    'names': {
      'squad': 'Esquadrão',
      'power': 'Poder de fogo',
      'rate': 'Cadência',
      'range': 'Alcance',
      'scavenge': 'Coleta',
      'grenade': 'Granada',
      'shield': 'Escudo',
      'rocket': 'Poder do foguete',
      'gatling': 'Poder da Gatling'
    },
    'descriptions': {
      'squad': 'Comece cada fase com mais sobreviventes.',
      'power': 'Cada sobrevivente causa mais dano por tiro.',
      'rate': 'Cada sobrevivente atira mais rápido.',
      'range': 'Seu esquadrão abre fogo mais adiante na estrada.',
      'scavenge': 'Ganhe mais moedas em cada partida.',
      'grenade': 'Lance uma granada para causar dano pesado.',
      'shield': 'Reduza pela metade o dano ao esquadrão por alguns segundos.',
      'rocket': 'Lança-foguetes que você libera na fase causam mais dano.',
      'gatling': 'Gatlings que você libera na fase causam mais dano.'
    }
  },

  'options': {
    'title': 'Opções', 'general': 'Geral', 'audio': 'Áudio', 'language': 'Idioma',
    'difficulty': 'Dificuldade', 'soundEffects': 'Efeitos sonoros', 'music': 'Música', 'musicTrack': 'Faixa musical',
    'musicTracks': { 'cozy': 'Harmonia aconchegante', 'trance': 'Túnel trance' },
    'haptics': 'Vibração', 'on': 'Ligado', 'off': 'Desligado',
    'close': 'Salvar e fechar',
    'difficulties': { 'easy': 'Fácil', 'medium': 'Médio', 'hard': 'Difícil' },
    'difficultyHints': {
      'easy': 'Inimigos mais fracos e barricadas mais finas.',
      'medium': 'A partida padrão.',
      'hard': 'Inimigos mais duros e barricadas mais resistentes.'
    }
  },

  'adsBlocked': {
    'title': 'Não foi possível exibir o anúncio',
    'body': 'Tentamos mostrar um vídeo para você ganhar sua recompensa, mas algo no seu navegador está bloqueando anúncios.',
    'allowPrefix': 'Permita anúncios em',
    'allowSuffix': '(ou pause seu bloqueador para este jogo) e tente novamente.',
    'gotIt': 'Entendi'
  },
  'saveStatus': {
    'restoredTitle': 'Salvamento na nuvem restaurado', 'restoredBody': '+{n} moedas de bônus pela recuperação',
    'tap': 'toque', 'pausedTitle': 'Sincronização pausada',
    'pausedBody': 'Jogando offline. Seu progresso está salvo aqui.',
    'retry': 'Tentar de novo', 'dismiss': 'dispensar'
  },
  'loading': { 'tooLong': 'O carregamento está demorando? Desative seu bloqueador de anúncios e recarregue.', 'boo': 'Bu!', 'laugh': 'Hahaha!' },
  'license': { 'denied': 'Acesso negado: adquira uma licença.' }
}
