// AR bundle. Mirrors the key shape of `en.ts`, which is the source
// of truth — see `tests/i18nParity.test.ts`. Every `{placeholder}` must survive
// translation; a dropped one renders as literal text and reads as a bug.
export default {
  'gameName': 'Bug Crunch',
  'cancel': 'إلغاء',
  'close': 'إغلاق',
  'ok': 'حسناً',
  'continue': 'متابعة',
  'tapToContinue': 'المس للمتابعة',
  'clickToContinue': 'انقر للمتابعة',
  'cutscene': {
    // The skip control on a cutscene. A cutscene never replays, so the
    // control is irreversible and gets a word rather than a bare glyph.
    'skip': 'تخطٍ'
  },
  'rewards': 'المكافآت',
  'tip': 'نصيحة',
  'crazyGamesOnly': 'هذه اللعبة متاحة فقط على',
  'ui': {
    'next': 'التالي',
    'replay': 'إعادة',
    'back': 'رجوع',
    'play': 'العب',
    'pause': 'إيقاف مؤقت',
    'menu': 'القائمة',
    'home': 'الرئيسية',
    'info': 'معلومات'
  },
  'hud': {
    'score': 'النقاط',
    'time': 'الوقت',
    'chain': 'سلسلة Splat: {n}',
    'level': 'المستوى {n}'
  },
  'worlds': {
    'picnic': 'بساط النزهة',
    'backyard': 'الحديقة المتشابكة',
    'attic': 'العلّية المغبرّة',
    'arcade': 'صالة النيون'
  },
  'bugs': {
    'ant': 'النمل',
    'sprinter': 'نمل عدّاء',
    'beetle': 'الخنافس',
    'flea': 'البراغيث',
    'caterpillar': 'اليرقات',
    'stinkbug': 'البق النتن',
    'centipede': 'أم أربعة وأربعين',
    'pinatafly': 'ذباب البينياتا',
    'moth': 'العث',
    'robobug': 'الحشرات الآلية'
  },
  'bosses': {
    'queenAnt': 'ملكة النمل جوليات',
    'beetleKing': 'ملك الخنافس الشوكي',
    'matriarch': 'أم أربعة وأربعين الكبرى',
    'roachPrime': 'الصرصور الآلي برايم'
  },
  'boss': {
    'tell': {
      'stomp': 'ادعس الزعيم!',
      'summon': 'نظّف السرب!',
      'pods': 'اسحق البيض!',
      'charge': 'اضغط مطوّلاً ثم اضرب!',
      'spin': 'اخرج من الدائرة!',
      'shield': 'اضرب لتكسر الدرع!',
      'beam': 'تفادَ الشعاع!'
    }
  },
  'shoes': {
    'stats': {
      'speed': 'السرعة',
      'radius': 'مساحة الدعس',
      'pierce': 'اختراق الدرع'
    },
    'sneaker': {
      'name': 'حذاء رياضي كلاسيكي',
      'perk': 'متوازن ويعود جاهزاً بسرعة.',
      'trade': 'لا يتفوق في أي شيء تحديداً.'
    },
    'steelBoot': {
      'name': 'بوت بمقدمة فولاذية',
      'perk': 'الأشواك لا تؤذيك، والضربات تُدوّخ كل ما حولك.',
      'trade': 'ثقيل وبطيء الرفع.'
    },
    'bunnySlipper': {
      'name': 'شبشب الأرنب',
      'perk': 'خطوة صامتة — الحشرات القافزة لا تشعر بك.',
      'trade': 'لا يكسر أي صدفة إطلاقاً.'
    },
    'rollerSkate': {
      'name': 'حذاء التزلج',
      'perk': 'ادعس واستمر بالسحب لتجرف خطاً كاملاً.',
      'trade': 'مساحة دعس ضيقة جداً.'
    },
    'cleatBoot': {
      'name': 'حذاء بمسامير',
      'perk': 'المسامير تخترق الأصداف وغدد الرائحة.',
      'trade': 'أصغر مساحة دعس في الخزانة.'
    },
    'electricSock': {
      'name': 'الجورب الكهربائي',
      'perk': 'كل دعسة ترسل برقاً إلى ثلاث حشرات أخرى.',
      'trade': 'البرق يُجهز على الضعيفة فقط.'
    }
  },
  'locker': {
    'title': 'الخزانة',
    'buy': 'اشترِ بـ {n}',
    'wear': 'ارتدِ',
    'worn': 'مرتدى',
    'needStars': 'تحتاج {n} نجوم أخرى',
    'needCoins': 'تحتاج {n} عملة أخرى',
    'price': 'السعر: {n} عملة',
    'starGate': 'يُفتح عند {n} نجمة',
    'adUnlock': 'شاهد فيديو لفتحه'
  },
  'chest': {
    'label': 'صندوق الكنز',
    'ready': 'افتح صندوق الكنز مقابل {n} عملة',
    'filling': 'صندوق الكنز — يمتلئ',
    'spent': 'صندوق الكنز — فارغ حتى الغد'
  },
  'reveal': {
    'world': 'مكان جديد للدَّعس!',
    'shoe': 'حذاء جديد!',
    'stars': 'هدف النجوم!',
    'record': 'رقم قياسي جديد!',
    'chest': 'كنز!',
    'foe': 'حشرة جديدة!',
    'starsTotal': '{n} نجمة',
    'recordScore': '{n} نقطة',
    'recordBeat': 'الرقم السابق: {n}',
    'chestCoins': '+{n} عملة',
    'move': 'حركة جديدة!'
  },
  'moves': {
    'spin': 'دوران الكعب',
    'skid': 'انزلاق',
    'quake': 'ضربة الزلزال',
    'echo': 'دوسة الصدى'
  },
  'party': {
    'title': 'حفلة الحشرات!',
    'count': '{n} حشرة',
    'best': 'الأفضل: {n}',
    'newBest': 'رقم قياسي جديد للحفلة!'
  },
  'fever': {
    'filling': 'حُمّى Splat: {n}%',
    'ready': 'حُمّى Splat جاهزة — المس للبدء',
    'running': 'حُمّى Splat جارية'
  },
  'objectives': {
    'clear': 'أنهِ المستوى',
    'combo': 'حقّق سلسلة ×{n}',
    'noSpike': 'لا تتأذَّ من الأشواك',
    'time': 'أنهِ وبقي {n} ثانية',
    'accuracy': 'أصب {n}% من دعساتك',
    'fever': 'فعّل حُمّى Splat {n} مرات',
    'kind': 'اسحق {n} من {bug}',
    'feverKills': 'اسحق {n} في حُمّى واحدة',
    'noMiss': 'لا تُخطئ أكثر من {n} دعسات',
    'score': 'احصد {n} نقطة'
  },
  'quests': {
    'title': 'أهداف النجوم',
    'onTrack': '{objective} — على المسار الصحيح',
    'progress': '{objective} — {n}% مُنجز',
    'missed': '{objective} — ضائع'
  },
  'hints': {
    'move': {
      'touch': 'المس للتحرك',
      'desktop': 'انقر للتحرك'
    },
    'slam': {
      'touch': 'اضغط مطوّلاً ثم أفلت لضربة قوية',
      'desktop': 'اضغط الزر مطوّلاً لضربة قوية'
    },
    'sprinter': {
      'touch': 'العدّاءات تهرب — ادعس حيث تتوقف',
      'desktop': 'العدّاءات تهرب من الحذاء — اثبت ثم انقر'
    },
    'beetle': {
      'touch': 'الخنافس لها أصداف — اضغط مطوّلاً ثم اضرب',
      'desktop': 'الخنافس لها أصداف — اضغط مطوّلاً ثم اضرب'
    },
    'flea': {
      'touch': 'البراغيث تقفز — اضرب حيث تهبط',
      'desktop': 'البراغيث تقفز — اضرب حيث تهبط'
    },
    'spike': {
      'touch': 'لا تدعس ذوات الأشواك!',
      'desktop': 'لا تدعس ذوات الأشواك!'
    },
    'stink': {
      'touch': 'البق النتن يُشوّش الشاشة عند سحقه',
      'desktop': 'البق النتن يُشوّش الشاشة عند سحقه'
    },
    'fever': {
      'touch': 'القارورة امتلأت — المس اللهب!',
      'desktop': 'القارورة امتلأت — انقر اللهب!'
    },
    'honey': {
      'touch': 'العسل يُثبّت الحشرات القافزة',
      'desktop': 'العسل يُثبّت الحشرات القافزة'
    },
    'web': {
      'touch': 'بيوت العنكبوت تُبطئ قدمك',
      'desktop': 'بيوت العنكبوت تُبطئ قدمك'
    },
    'belt': {
      'touch': 'الحزام يحمل الحشرات معه',
      'desktop': 'الحزام يحمل الحشرات معه'
    },
    'sweeper': {
      'touch': 'الكنّاسة تسحق الحشرات مجاناً',
      'desktop': 'الكنّاسة تسحق الحشرات مجاناً'
    },
    'boss': {
      'touch': 'اضغط مطوّلاً واضرب عندما يستعد الزعيم',
      'desktop': 'اضغط مطوّلاً واضرب عندما يستعد الزعيم'
    },
    'pods': {
      'touch': 'اسحق البيض قبل أن يفقس!',
      'desktop': 'اسحق البيض قبل أن يفقس!'
    }
  },
  'result': {
    'cleared': 'تم اجتياز المستوى!',
    'timeUp': 'انتهى الوقت!',
    'upNext': 'التالي: {n}',
    'retryLevel': 'نعيدها؟',
    'campaignDone': 'اجتزت كل المستويات!',
    'newRecord': 'رقم قياسي جديد!',
    'nextLevel': 'المستوى التالي',
    'tryAgain': 'حاول مجدداً',
    'squishes': 'الحشرات المسحوقة',
    'starsEarned': '{n} من 3 نجوم',
    'rankOf': 'من {n}',
    'worldUnlocked': 'تم فتح {n}!',
    'peekNext': 'ألقِ نظرة على {n}',
    'secondWind': 'نَفَس ثانٍ: محاولتك التالية تبدأ بقارورة ممتلئة',
    'hintSlam': 'نصيحة: اضغط مطولًا لسحق الدروع',
    'hintAvoid': 'نصيحة: اترك الشائكة وشأنها',
    'missed': 'بقي {n} من الحشرات'
  },
  'leaderboard': {
    'title': 'لوحة المتصدرين',
    'rank': 'الترتيب',
    'player': 'اللاعب',
    'score': 'النقاط',
    'level': 'المستوى',
    'you': 'أنت',
    'yourRank': 'ترتيبك #{n} من {total}',
    'of': 'من {n}',
    'unranked': 'أنهِ مستوى لتدخل اللوحة',
    'loading': 'جارٍ تحميل اللوحة…',
    'empty': 'لم يسجّل أحد نقاطاً بعد',
    'failed': 'تعذّر الوصول إلى لوحة المتصدرين'
  },
  'options': {
    'title': 'الإعدادات',
    'general': 'عام',
    'play': 'اللعب',
    'audio': 'الصوت',
    'close': 'احفظ وأغلق',
    'language': 'اللغة',
    'difficulty': 'الصعوبة',
    'soundEffects': 'المؤثرات الصوتية',
    'music': 'الموسيقى',
    'musicTrack': 'المقطوعة',
    'haptics': 'الاهتزاز',
    'on': 'تشغيل',
    'off': 'إيقاف',
    'difficulties': {
      'easy': 'سهل',
      'medium': 'عادي',
      'hard': 'صعب'
    },
    'difficultyHints': {
      'easy': 'حشرات أبطأ ووقت أطول.',
      'medium': 'اللعبة كما صُمّمت.',
      'hard': 'حشرات أسرع وساحة أكثر ازدحاماً.'
    },
    'musicTracks': {
      'parade': 'موكب القرمشة',
      'trance': 'إيقاع الحشرات',
      'cozy': 'نزهة هادئة'
    },
    'juiceStyle': 'نمط البقعة',
    'juiceStyles': {
      'ooze': 'مخاط كرتوني',
      'confetti': 'بينياتا قصاصات',
      'bubble': 'فقاعات صابون'
    },
    'juiceStyleHints': {
      'ooze': 'مخاط ملوّن. اللعبة نفسها لا تتغير.',
      'confetti': 'الحشرات تنفجر قصاصات. اللعبة نفسها لا تتغير.',
      'bubble': 'الحشرات تصير فقاعات. اللعبة نفسها لا تتغير.'
    },
    'highVis': 'حلقة دعس كبيرة',
    'highVisHint': 'حلقة أسمك وأوضح في المكان الذي ستهبط عليه قدمك.',
    'singleTap': 'تصويب سهل',
    'singleTapHint': 'المس أي مكان فتطير قدمك إلى أقرب حشرة.'
  },
  'loading': {
    'uhOh': 'أوه لا!',
    'missed': 'لم تصبني!',
    'tooLong': 'ما زال التحميل جارياً… تحقّق من اتصالك؟'
  },
  'saveStatus': {
    'restoredTitle': 'تمت استعادة التقدّم',
    'restoredBody': 'أعدنا حفظك وأضفنا {n} عملة.',
    'pausedTitle': 'الحفظ متوقف مؤقتاً',
    'pausedBody': 'تعذّر الوصول إلى خدمة الحفظ. تقدّمك محفوظ بأمان على هذا الجهاز.',
    'retry': 'أعد المحاولة',
    'dismiss': 'تجاهل',
    'tap': 'المس للإغلاق'
  },
  'adsBlocked': {
    'title': 'تم رصد مانع إعلانات',
    'body': 'Bug Crunch مجانية بفضل الإعلانات. أوقف مانع الإعلانات ثم أعد تحميل الصفحة.',
    'allowPrefix': 'اسمح بالإعلانات على',
    'allowSuffix': 'ثم أعد تحميل الصفحة.',
    'gotIt': 'فهمت'
  },
  'license': {
    'denied': 'تعذّر التحقق من هذه النسخة'
  }
}
