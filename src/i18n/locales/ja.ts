// JA bundle. Mirrors the key shape of `en.ts`, which is the source
// of truth — see `tests/i18nParity.test.ts`. Every `{placeholder}` must survive
// translation; a dropped one renders as literal text and reads as a bug.
export default {
  'gameName': 'Bug Crunch',
  'cancel': 'キャンセル',
  'close': '閉じる',
  'ok': 'OK',
  'continue': 'つづける',
  'tapToContinue': 'タップでつづける',
  'clickToContinue': 'クリックでつづける',
  'cutscene': {
    // The skip control on a cutscene. A cutscene never replays, so the
    // control is irreversible and gets a word rather than a bare glyph.
    'skip': 'スキップ'
  },
  'rewards': 'ごほうび',
  'tip': 'ヒント',
  'crazyGamesOnly': 'このゲームは次でのみ遊べます:',
  'ui': {
    'next': 'つぎへ',
    'replay': 'もう一度',
    'back': 'もどる',
    'play': 'あそぶ',
    'pause': '一時停止',
    'menu': 'メニュー',
    'home': 'ホーム',
    'info': '情報'
  },
  'hud': {
    'score': 'スコア',
    'time': 'タイム',
    'chain': 'スプラットチェイン: {n}',
    'level': 'レベル {n}'
  },
  'worlds': {
    'picnic': 'ピクニックシート',
    'backyard': 'のび放題の庭',
    'attic': 'ほこりっぽい屋根裏',
    'arcade': 'ネオンゲーセン'
  },
  'bugs': {
    'ant': 'アリ',
    'sprinter': 'ダッシュアリ',
    'beetle': 'カブトムシ',
    'flea': 'ノミ',
    'caterpillar': 'イモムシ',
    'stinkbug': 'カメムシ',
    'centipede': 'ムカデ',
    'pinatafly': 'ピニャータバエ',
    'moth': 'ガ',
    'robobug': 'ロボむし'
  },
  'bosses': {
    'queenAnt': 'ゴリアテ女王アリ',
    'beetleKing': 'トゲ背カブト王',
    'matriarch': 'ムカデの女王',
    'roachPrime': 'メカゴキブリ・プライム'
  },
  'boss': {
    'tell': {
      'stomp': 'ボスをふみつぶせ！',
      'summon': 'むれをかたづけろ！',
      'pods': 'たまごをつぶせ！',
      'charge': '長おしして叩きつけろ！',
      'spin': 'リングの外へ！',
      'shield': 'たたいてシールドを割れ！',
      'beam': 'ビームをかわせ！'
    }
  },
  'shoes': {
    'stats': {
      'speed': 'スピード',
      'radius': 'ふみ範囲',
      'pierce': 'よろい貫通'
    },
    'sneaker': {
      'name': '定番スニーカー',
      'perk': 'バランスよく、すぐ次をふめる。',
      'trade': 'とくいなことは特にない。'
    },
    'steelBoot': {
      'name': '鉄芯ブーツ',
      'perk': 'トゲが効かない。叩きつけると周りがしびれる。',
      'trade': '重くて持ち上げが遅い。'
    },
    'bunnySlipper': {
      'name': 'うさぎスリッパ',
      'perk': '足音ゼロ。とびはねる虫に気づかれない。',
      'trade': 'こうらはまったく割れない。'
    },
    'rollerSkate': {
      'name': 'ローラースケート',
      'perk': 'ふんだまま引きずって一直線になぎ倒す。',
      'trade': 'ふみ範囲がとても細い。'
    },
    'cleatBoot': {
      'name': 'スパイクシューズ',
      'perk': 'スパイクがこうらもニオイ袋も貫く。',
      'trade': 'ロッカーで一番せまいふみ範囲。'
    },
    'electricSock': {
      'name': 'でんきくつした',
      'perk': 'ふむたびに3匹まで電気が飛ぶ。',
      'trade': '電気はよわい虫しか倒せない。'
    }
  },
  'locker': {
    'title': 'ロッカー',
    'buy': '{n} でこうにゅう',
    'wear': 'はく',
    'worn': 'そうび中',
    'needStars': 'あと {n} スター',
    'needCoins': 'あと {n} コイン',
    'price': 'ねだん: {n}コイン',
    'starGate': 'スター{n}こで かいきん',
    'adUnlock': 'どうがを見てアンロック'
  },
  'chest': {
    'label': 'たからばこ',
    'ready': 'たからばこを {n}コインで ひらく',
    'filling': 'たからばこ — たまっています',
    'spent': 'たからばこ — あしたまで からっぽ'
  },
  'reveal': {
    'world': 'あたらしい ステージ！',
    'shoe': 'あたらしい くつ！',
    'stars': 'スターの もくひょう たっせい！',
    'record': 'ハイスコア こうしん！',
    'chest': 'おたから！',
    'foe': 'あたらしい むし！',
    'starsTotal': 'スター{n}こ',
    'recordScore': '{n}てん',
    'recordBeat': 'まえのきろく: {n}',
    'chestCoins': '+{n}コイン'
  },
  'fever': {
    'filling': 'スプラットフィーバー: {n}%',
    'ready': 'スプラットフィーバー準備OK — タップ',
    'running': 'スプラットフィーバー中'
  },
  'objectives': {
    'clear': 'レベルをクリア',
    'combo': '×{n} チェインを出す',
    'noSpike': 'トゲのダメージをうけない',
    'time': 'のこり {n} 秒でクリア',
    'accuracy': 'ふみの {n}% を当てる',
    'fever': 'フィーバーを {n} 回発動',
    'kind': '{bug} を {n} 匹つぶす',
    'feverKills': '1回のフィーバーで {n} 匹',
    'noMiss': 'ミスは {n} 回まで',
    'score': '{n} 点をとる'
  },
  'quests': {
    'title': 'スターもくひょう',
    'onTrack': '{objective} — じゅんちょう',
    'progress': '{objective} — {n}% すすんだ',
    'missed': '{objective} — のがした'
  },
  'hints': {
    'move': {
      'touch': 'タップで移動',
      'desktop': 'クリックで移動'
    },
    'slam': {
      'touch': '長おししてはなすと強ぶみ',
      'desktop': 'ボタン長おしで強ぶみ'
    },
    'sprinter': {
      'touch': 'ダッシュアリは にげる — とまったところを ふもう',
      'desktop': 'ダッシュアリは くつから にげる — じっとして クリック'
    },
    'beetle': {
      'touch': 'カブトはこうら持ち — 長おしして叩く',
      'desktop': 'カブトはこうら持ち — 長おしして叩く'
    },
    'flea': {
      'touch': 'ノミは跳ねる — 着地点をねらえ',
      'desktop': 'ノミは跳ねる — 着地点をねらえ'
    },
    'spike': {
      'touch': 'トゲのある虫はふむな！',
      'desktop': 'トゲのある虫はふむな！'
    },
    'stink': {
      'touch': 'カメムシをつぶすと画面がかすむ',
      'desktop': 'カメムシをつぶすと画面がかすむ'
    },
    'fever': {
      'touch': 'びんが満タン — ほのおをタップ！',
      'desktop': 'びんが満タン — ほのおをクリック！'
    },
    'honey': {
      'touch': 'ハチミツは跳ねる虫を足止めする',
      'desktop': 'ハチミツは跳ねる虫を足止めする'
    },
    'web': {
      'touch': 'クモの巣は足をおそくする',
      'desktop': 'クモの巣は足をおそくする'
    },
    'belt': {
      'touch': 'ベルトは虫をはこぶ',
      'desktop': 'ベルトは虫をはこぶ'
    },
    'sweeper': {
      'touch': 'そうじ機はタダで虫をつぶす',
      'desktop': 'そうじ機はタダで虫をつぶす'
    },
    'boss': {
      'touch': 'ボスがためたら長おしして叩く',
      'desktop': 'ボスがためたら長おしして叩く'
    },
    'pods': {
      'touch': 'たまごがかえる前につぶせ！',
      'desktop': 'たまごがかえる前につぶせ！'
    }
  },
  'result': {
    'cleared': 'レベルクリア！',
    'timeUp': 'タイムアップ！',
    'upNext': 'つぎは: {n}',
    'retryLevel': 'もう一度？',
    'campaignDone': '全レベルクリア！',
    'newRecord': '新記録！',
    'nextLevel': 'つぎのレベル',
    'tryAgain': 'もう一度',
    'squishes': 'つぶした虫',
    'starsEarned': '3つ中 {n} スター',
    'rankOf': '/ {n}',
    'worldUnlocked': '{n} かいほう！'
  },
  'leaderboard': {
    'title': 'ランキング',
    'rank': '順位',
    'player': 'プレイヤー',
    'score': 'スコア',
    'level': 'レベル',
    'you': 'あなた',
    'yourRank': '{total} 人中 #{n} 位',
    'of': '/ {n}',
    'unranked': 'レベルをクリアするとランキングに載ります',
    'loading': 'ランキングを読み込み中…',
    'empty': 'まだ誰もスコアを出していません',
    'failed': 'ランキングに接続できませんでした'
  },
  'options': {
    'title': '設定',
    'general': '一般',
    'play': 'ゲーム',
    'audio': 'サウンド',
    'close': '保存して閉じる',
    'language': '言語',
    'difficulty': '難易度',
    'soundEffects': '効果音',
    'music': '音楽',
    'musicTrack': '曲',
    'haptics': '振動',
    'on': 'オン',
    'off': 'オフ',
    'difficulties': {
      'easy': 'かんたん',
      'medium': 'ふつう',
      'hard': 'むずかしい'
    },
    'difficultyHints': {
      'easy': '虫はゆっくり、時間は長め。',
      'medium': 'デザインどおりのゲーム。',
      'hard': '虫は速く、画面はにぎやか。'
    },
    'musicTracks': {
      'parade': 'ザクザクパレード',
      'trance': 'むしグルーヴ',
      'cozy': 'のんびりピクニック'
    },
    'juiceStyle': 'スプラットの見た目',
    'juiceStyles': {
      'ooze': 'カートゥーンスライム',
      'confetti': '紙ふぶきピニャータ',
      'bubble': 'シャボン玉'
    },
    'juiceStyleHints': {
      'ooze': 'カラフルなスライム。ゲーム内容は同じ。',
      'confetti': '虫が紙ふぶきになる。ゲーム内容は同じ。',
      'bubble': '虫がシャボン玉になる。ゲーム内容は同じ。'
    },
    'highVis': '大きいふみリング',
    'highVisHint': '足が着く場所に太くて明るいリングを出す。',
    'singleTap': 'かんたんねらい',
    'singleTapHint': 'どこをタップしても足が一番近い虫へ飛ぶ。'
  },
  'loading': {
    'boo': 'ばあ！',
    'laugh': 'ヒヒッ！',
    'tooLong': 'まだ読み込み中… 通信を確認してみて'
  },
  'saveStatus': {
    'restoredTitle': '進行状況を復元しました',
    'restoredBody': 'セーブを取り戻し、コインを {n} 枚追加しました。',
    'pausedTitle': 'セーブを一時停止中',
    'pausedBody': 'セーブサービスに接続できません。進行状況はこの端末に安全に残っています。',
    'retry': '再試行',
    'dismiss': '閉じる',
    'tap': 'タップで閉じる'
  },
  'adsBlocked': {
    'title': '広告ブロッカーを検出',
    'body': 'Bug Crunch は広告のおかげで無料です。ブロッカーをオフにして再読み込みしてください。',
    'allowPrefix': '次のサイトで広告を許可:',
    'allowSuffix': 'そしてページを再読み込み。',
    'gotIt': 'わかった'
  },
  'license': {
    'denied': 'このコピーは確認できませんでした'
  }
}
