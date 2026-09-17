// KO bundle. Mirrors the key shape of `en.ts`, which is the source
// of truth — see `tests/i18nParity.test.ts`. Every `{placeholder}` must survive
// translation; a dropped one renders as literal text and reads as a bug.
export default {
  'gameName': 'Bug Crunch',
  'cancel': '취소',
  'close': '닫기',
  'ok': '확인',
  'continue': '계속',
  'tapToContinue': '탭해서 계속',
  'clickToContinue': '클릭해서 계속',
  'cutscene': {
    // The skip control on a cutscene. A cutscene never replays, so the
    // control is irreversible and gets a word rather than a bare glyph.
    'skip': '건너뛰기'
  },
  'rewards': '보상',
  'tip': '팁',
  'crazyGamesOnly': '이 게임은 다음에서만 즐길 수 있어요:',
  'ui': {
    'next': '다음',
    'replay': '다시하기',
    'back': '뒤로',
    'play': '플레이',
    'pause': '일시정지',
    'menu': '메뉴',
    'home': '홈',
    'info': '정보'
  },
  'hud': {
    'score': '점수',
    'time': '시간',
    'chain': '스플랫 체인: {n}',
    'level': '레벨 {n}'
  },
  'worlds': {
    'picnic': '소풍 돗자리',
    'backyard': '덤불 뒷마당',
    'attic': '먼지 쌓인 다락',
    'arcade': '네온 오락실'
  },
  'bugs': {
    'ant': '개미',
    'sprinter': '질주 개미',
    'beetle': '딱정벌레',
    'flea': '벼룩',
    'caterpillar': '애벌레',
    'stinkbug': '노린재',
    'centipede': '지네',
    'pinatafly': '피냐타 파리',
    'moth': '나방',
    'robobug': '로보벌레'
  },
  'bosses': {
    'queenAnt': '골리앗 여왕개미',
    'beetleKing': '가시등 딱정벌레 왕',
    'matriarch': '지네 여왕',
    'roachPrime': '메카 바퀴 프라임'
  },
  'boss': {
    'tell': {
      'stomp': '보스를 밟아!',
      'summon': '떼를 치워!',
      'pods': '알을 뭉개!',
      'charge': '꾹 눌렀다 내리쳐!',
      'spin': '원 밖으로!',
      'shield': '내리쳐서 방패를 깨!',
      'beam': '빔을 피해!'
    }
  },
  'shoes': {
    'stats': {
      'speed': '속도',
      'radius': '밟는 범위',
      'pierce': '장갑 관통'
    },
    'sneaker': {
      'name': '클래식 운동화',
      'perk': '균형 잡히고 금방 다시 밟을 수 있어요.',
      'trade': '특별히 잘하는 건 없어요.'
    },
    'steelBoot': {
      'name': '강철 앞코 부츠',
      'perk': '가시가 통하지 않아요. 내려찍으면 주변이 기절해요.',
      'trade': '무겁고 드는 속도가 느려요.'
    },
    'bunnySlipper': {
      'name': '토끼 슬리퍼',
      'perk': '발소리 없음 — 뛰는 벌레가 눈치채지 못해요.',
      'trade': '껍질은 전혀 못 깨요.'
    },
    'rollerSkate': {
      'name': '롤러스케이트',
      'perk': '밟고 계속 끌면 한 줄을 통째로 밀어버려요.',
      'trade': '밟는 범위가 아주 좁아요.'
    },
    'cleatBoot': {
      'name': '스터드 축구화',
      'perk': '스터드가 껍질과 냄새주머니를 뚫어요.',
      'trade': '사물함에서 가장 좁은 범위예요.'
    },
    'electricSock': {
      'name': '전기 양말',
      'perk': '밟을 때마다 벌레 3마리에게 번개가 튀어요.',
      'trade': '번개는 약한 벌레만 끝내요.'
    }
  },
  'locker': {
    'title': '사물함',
    'buy': '{n}에 구매',
    'wear': '착용',
    'worn': '착용 중',
    'needStars': '별 {n}개 더',
    'needCoins': '코인 {n}개 더',
    'price': '가격: {n} 코인',
    'starGate': '별 {n}개에 열림',
    'adUnlock': '영상 보고 잠금 해제'
  },
  'chest': {
    'label': '보물 상자',
    'ready': '{n} 코인으로 보물 상자 열기',
    'filling': '보물 상자 — 채워지는 중',
    'spent': '보물 상자 — 내일까지 비었음'
  },
  'reveal': {
    'world': '새로운 무대!',
    'shoe': '새 신발!',
    'stars': '별 목표 달성!',
    'record': '최고 기록 경신!',
    'chest': '보물!',
    'foe': '새로운 벌레!',
    'starsTotal': '별 {n}개',
    'recordScore': '{n}점',
    'recordBeat': '이전 기록: {n}',
    'chestCoins': '+{n} 코인'
  },
  'fever': {
    'filling': '스플랫 피버: {n}%',
    'ready': '스플랫 피버 준비 완료 — 탭',
    'running': '스플랫 피버 진행 중'
  },
  'objectives': {
    'clear': '레벨 클리어',
    'combo': '×{n} 체인 달성',
    'noSpike': '가시 피해 없이',
    'time': '{n}초 남기고 완료',
    'accuracy': '밟기 {n}% 명중',
    'fever': '스플랫 피버 {n}회 발동',
    'kind': '{bug} {n}마리 뭉개기',
    'feverKills': '피버 한 번에 {n}마리',
    'noMiss': '헛발질 {n}회 이하',
    'score': '{n}점 획득'
  },
  'quests': {
    'title': '별 목표',
    'onTrack': '{objective} — 유지 중',
    'progress': '{objective} — {n}% 진행',
    'missed': '{objective} — 놓침'
  },
  'hints': {
    'move': {
      'touch': '탭해서 이동',
      'desktop': '클릭해서 이동'
    },
    'slam': {
      'touch': '꾹 눌렀다 떼면 강한 내리찍기',
      'desktop': '버튼을 꾹 누르면 강한 내리찍기'
    },
    'sprinter': {
      'touch': '질주 개미는 도망쳐요 — 멈추는 곳을 밟으세요',
      'desktop': '질주 개미는 신발을 피해요 — 가만히 있다가 클릭'
    },
    'beetle': {
      'touch': '딱정벌레는 껍질이 있어요 — 꾹 눌렀다 내리쳐요',
      'desktop': '딱정벌레는 껍질이 있어요 — 꾹 눌렀다 내리쳐요'
    },
    'flea': {
      'touch': '벼룩은 뛰어요 — 착지 지점을 노려요',
      'desktop': '벼룩은 뛰어요 — 착지 지점을 노려요'
    },
    'spike': {
      'touch': '가시 달린 애들은 밟지 마세요!',
      'desktop': '가시 달린 애들은 밟지 마세요!'
    },
    'stink': {
      'touch': '노린재를 뭉개면 화면이 흐려져요',
      'desktop': '노린재를 뭉개면 화면이 흐려져요'
    },
    'fever': {
      'touch': '병이 가득 찼어요 — 불꽃을 탭!',
      'desktop': '병이 가득 찼어요 — 불꽃을 클릭!'
    },
    'honey': {
      'touch': '꿀은 뛰는 벌레를 붙잡아요',
      'desktop': '꿀은 뛰는 벌레를 붙잡아요'
    },
    'web': {
      'touch': '거미줄은 발을 느리게 해요',
      'desktop': '거미줄은 발을 느리게 해요'
    },
    'belt': {
      'touch': '벨트가 벌레를 실어 날라요',
      'desktop': '벨트가 벌레를 실어 날라요'
    },
    'sweeper': {
      'touch': '청소기는 공짜로 벌레를 뭉개요',
      'desktop': '청소기는 공짜로 벌레를 뭉개요'
    },
    'boss': {
      'touch': '보스가 힘을 모으면 꾹 눌렀다 내리쳐요',
      'desktop': '보스가 힘을 모으면 꾹 눌렀다 내리쳐요'
    },
    'pods': {
      'touch': '알이 부화하기 전에 뭉개요!',
      'desktop': '알이 부화하기 전에 뭉개요!'
    }
  },
  'result': {
    'cleared': '레벨 클리어!',
    'timeUp': '시간 종료!',
    'upNext': '다음: {n}',
    'retryLevel': '다시 해볼까요?',
    'campaignDone': '모든 레벨 클리어!',
    'newRecord': '신기록!',
    'nextLevel': '다음 레벨',
    'tryAgain': '다시 시도',
    'squishes': '뭉갠 벌레',
    'starsEarned': '3개 중 {n}개 별',
    'rankOf': '/ {n}',
    'worldUnlocked': '{n} 해금!'
  },
  'leaderboard': {
    'title': '순위표',
    'rank': '순위',
    'player': '플레이어',
    'score': '점수',
    'level': '레벨',
    'you': '나',
    'yourRank': '{total}명 중 #{n}위',
    'of': '/ {n}',
    'unranked': '레벨을 클리어하면 순위표에 올라요',
    'loading': '순위표 불러오는 중…',
    'empty': '아직 아무도 점수를 올리지 않았어요',
    'failed': '순위표에 연결하지 못했어요'
  },
  'options': {
    'title': '설정',
    'general': '일반',
    'play': '게임',
    'audio': '오디오',
    'close': '저장하고 닫기',
    'language': '언어',
    'difficulty': '난이도',
    'soundEffects': '효과음',
    'music': '음악',
    'musicTrack': '음악 트랙',
    'haptics': '진동',
    'on': '켜기',
    'off': '끄기',
    'difficulties': {
      'easy': '쉬움',
      'medium': '보통',
      'hard': '어려움'
    },
    'difficultyHints': {
      'easy': '벌레가 더 느리고 시간이 더 길어요.',
      'medium': '원래 설계된 그대로의 게임이에요.',
      'hard': '벌레가 더 빠르고 화면이 더 북적여요.'
    },
    'musicTracks': {
      'parade': '와작와작 퍼레이드',
      'trance': '벌레 그루브',
      'cozy': '느긋한 소풍'
    },
    'juiceStyle': '스플랫 스타일',
    'juiceStyles': {
      'ooze': '만화 점액',
      'confetti': '색종이 피냐타',
      'bubble': '비눗방울'
    },
    'juiceStyleHints': {
      'ooze': '알록달록한 점액. 게임은 똑같아요.',
      'confetti': '벌레가 색종이로 터져요. 게임은 똑같아요.',
      'bubble': '벌레가 비눗방울이 돼요. 게임은 똑같아요.'
    },
    'highVis': '큰 밟기 링',
    'highVisHint': '발이 닿을 자리에 더 굵고 밝은 링을 그려요.',
    'singleTap': '쉬운 조준',
    'singleTapHint': '아무 데나 탭하면 발이 가장 가까운 벌레로 날아가요.'
  },
  'loading': {
    'boo': '와!',
    'laugh': '히히!',
    'tooLong': '아직 불러오는 중… 연결을 확인해 볼까요?'
  },
  'saveStatus': {
    'restoredTitle': '진행 상황 복구됨',
    'restoredBody': '저장을 되찾고 코인 {n}개를 더했어요.',
    'pausedTitle': '저장 일시정지',
    'pausedBody': '저장 서비스에 연결할 수 없어요. 진행 상황은 이 기기에 안전하게 있어요.',
    'retry': '재시도',
    'dismiss': '닫기',
    'tap': '탭해서 닫기'
  },
  'adsBlocked': {
    'title': '광고 차단기 감지됨',
    'body': 'Bug Crunch는 광고 덕분에 무료예요. 차단기를 끄고 새로고침해 주세요.',
    'allowPrefix': '다음에서 광고 허용:',
    'allowSuffix': '그리고 페이지를 새로고침하세요.',
    'gotIt': '알겠어요'
  },
  'license': {
    'denied': '이 사본을 확인할 수 없습니다'
  }
}
