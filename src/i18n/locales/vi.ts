// VI bundle. Mirrors the key shape of `en.ts`, which is the source
// of truth — see `tests/i18nParity.test.ts`. Every `{placeholder}` must survive
// translation; a dropped one renders as literal text and reads as a bug.
export default {
  'gameName': 'Bug Crunch',
  'cancel': 'Hủy',
  'close': 'Đóng',
  'ok': 'Ok',
  'continue': 'Tiếp tục',
  'tapToContinue': 'Chạm để tiếp tục',
  'clickToContinue': 'Nhấp để tiếp tục',
  'cutscene': {
    // The skip control on a cutscene. A cutscene never replays, so the
    // control is irreversible and gets a word rather than a bare glyph.
    'skip': 'Bỏ qua'
  },
  'rewards': 'PHẦN THƯỞNG',
  'tip': 'Mẹo',
  'crazyGamesOnly': 'Trò chơi này chỉ có trên',
  'ui': {
    'next': 'Tiếp',
    'replay': 'Chơi lại',
    'back': 'Quay lại',
    'play': 'Chơi',
    'pause': 'Tạm dừng',
    'menu': 'Menu',
    'home': 'Trang chính',
    'info': 'Thông tin'
  },
  'hud': {
    'score': 'Điểm',
    'time': 'Thời gian',
    'chain': 'Chuỗi Splat: {n}',
    'level': 'Màn {n}'
  },
  'worlds': {
    'picnic': 'Tấm bạt dã ngoại',
    'backyard': 'Sân sau um tùm',
    'attic': 'Gác xép bụi bặm',
    'arcade': 'Sảnh game neon'
  },
  'bugs': {
    'ant': 'Kiến',
    'sprinter': 'Kiến chạy nhanh',
    'beetle': 'Bọ cánh cứng',
    'flea': 'Bọ chét',
    'caterpillar': 'Sâu bướm',
    'stinkbug': 'Bọ xít',
    'centipede': 'Rết',
    'pinatafly': 'Ruồi piñata',
    'moth': 'Bướm đêm',
    'robobug': 'Bọ máy'
  },
  'bosses': {
    'queenAnt': 'Kiến Chúa Goliath',
    'beetleKing': 'Vua Bọ Gai Lưng',
    'matriarch': 'Rết Mẫu Hậu',
    'roachPrime': 'Gián Máy Prime'
  },
  'boss': {
    'tell': {
      'stomp': 'Giẫm trùm đi!',
      'summon': 'Dọn sạch bầy!',
      'pods': 'Đạp nát trứng!',
      'charge': 'Giữ rồi nện xuống!',
      'spin': 'Ra khỏi vòng!',
      'shield': 'Nện vỡ khiên!',
      'beam': 'Né tia sáng!'
    }
  },
  'shoes': {
    'stats': {
      'speed': 'Tốc độ',
      'radius': 'Vùng giẫm',
      'pierce': 'Xuyên giáp'
    },
    'sneaker': {
      'name': 'Giày thể thao cổ điển',
      'perk': 'Cân bằng, nhấc chân lại rất nhanh.',
      'trade': 'Không nổi trội ở điểm nào.'
    },
    'steelBoot': {
      'name': 'Bốt mũi thép',
      'perk': 'Gai không làm bạn đau. Cú nện làm choáng mọi thứ quanh đó.',
      'trade': 'Nặng và nhấc lên chậm.'
    },
    'bunnySlipper': {
      'name': 'Dép thỏ',
      'perk': 'Bước chân êm — lũ bọ nhảy không hay biết.',
      'trade': 'Không phá nổi vỏ cứng nào.'
    },
    'rollerSkate': {
      'name': 'Giày trượt',
      'perk': 'Giẫm rồi kéo lê để càn cả một hàng.',
      'trade': 'Vùng giẫm rất hẹp.'
    },
    'cleatBoot': {
      'name': 'Giày đinh',
      'perk': 'Đinh xuyên thẳng qua vỏ và túi hôi.',
      'trade': 'Vùng giẫm nhỏ nhất trong tủ.'
    },
    'electricSock': {
      'name': 'Tất điện',
      'perk': 'Mỗi cú giẫm phóng tia điện sang ba con bọ khác.',
      'trade': 'Tia điện chỉ hạ được con yếu.'
    }
  },
  'locker': {
    'title': 'Tủ đồ',
    'buy': 'Mua {n}',
    'wear': 'Mang',
    'worn': 'Đang mang',
    'needStars': 'Còn thiếu {n} sao',
    'needCoins': 'Còn thiếu {n} xu',
    'price': 'Giá: {n} xu',
    'starGate': 'Mở ở {n} sao',
    'adUnlock': 'Xem video để mở khoá'
  },
  'chest': {
    'label': 'Rương kho báu',
    'ready': 'Mở rương lấy {n} xu',
    'filling': 'Rương kho báu — đang đầy dần',
    'spent': 'Rương kho báu — trống đến mai'
  },
  'reveal': {
    'world': 'Nơi mới để giẫm!',
    'shoe': 'Giày mới!',
    'stars': 'Mốc sao!',
    'record': 'Kỷ lục mới!',
    'chest': 'Kho báu!',
    'foe': 'Một con bọ mới!',
    'starsTotal': '{n} sao',
    'recordScore': '{n} điểm',
    'recordBeat': 'Kỷ lục cũ: {n}',
    'chestCoins': '+{n} xu'
  },
  'fever': {
    'filling': 'Cuồng Splat: {n}%',
    'ready': 'Cuồng Splat sẵn sàng — chạm để bắt đầu',
    'running': 'Cuồng Splat đang chạy'
  },
  'objectives': {
    'clear': 'Hoàn thành màn',
    'combo': 'Đạt chuỗi ×{n}',
    'noSpike': 'Không dính sát thương gai',
    'time': 'Xong khi còn {n} giây',
    'accuracy': 'Trúng {n}% cú giẫm',
    'fever': 'Kích hoạt Cuồng Splat {n}×',
    'kind': 'Đạp nát {n} {bug}',
    'feverKills': 'Đạp nát {n} con trong một lần Cuồng',
    'noMiss': 'Hụt tối đa {n} cú',
    'score': 'Ghi {n} điểm'
  },
  'quests': {
    'title': 'Mục tiêu sao',
    'onTrack': '{objective} — đang đạt',
    'progress': '{objective} — được {n}%',
    'missed': '{objective} — đã lỡ'
  },
  'hints': {
    'move': {
      'touch': 'Chạm để di chuyển',
      'desktop': 'Nhấp để di chuyển'
    },
    'slam': {
      'touch': 'Giữ rồi thả để nện mạnh',
      'desktop': 'Giữ nút để nện mạnh'
    },
    'sprinter': {
      'touch': 'Kiến chạy nhanh bỏ chạy — giẫm chỗ chúng dừng',
      'desktop': 'Kiến chạy nhanh né giày — đứng yên rồi bấm'
    },
    'beetle': {
      'touch': 'Bọ cánh cứng có vỏ — giữ rồi nện',
      'desktop': 'Bọ cánh cứng có vỏ — giữ rồi nện'
    },
    'flea': {
      'touch': 'Bọ chét nhảy đi — giẫm nơi chúng đáp xuống',
      'desktop': 'Bọ chét nhảy đi — giẫm nơi chúng đáp xuống'
    },
    'spike': {
      'touch': 'Đừng giẫm mấy con có gai!',
      'desktop': 'Đừng giẫm mấy con có gai!'
    },
    'stink': {
      'touch': 'Bọ xít làm mờ màn hình khi bị đạp nát',
      'desktop': 'Bọ xít làm mờ màn hình khi bị đạp nát'
    },
    'fever': {
      'touch': 'Ống đã đầy — chạm ngọn lửa!',
      'desktop': 'Ống đã đầy — nhấp ngọn lửa!'
    },
    'honey': {
      'touch': 'Mật ong giữ chân lũ bọ nhảy',
      'desktop': 'Mật ong giữ chân lũ bọ nhảy'
    },
    'web': {
      'touch': 'Mạng nhện làm chân bạn chậm lại',
      'desktop': 'Mạng nhện làm chân bạn chậm lại'
    },
    'belt': {
      'touch': 'Băng chuyền cuốn bọ đi theo',
      'desktop': 'Băng chuyền cuốn bọ đi theo'
    },
    'sweeper': {
      'touch': 'Máy quét đạp bọ giúp bạn miễn phí',
      'desktop': 'Máy quét đạp bọ giúp bạn miễn phí'
    },
    'boss': {
      'touch': 'Giữ rồi nện khi trùm lấy đà',
      'desktop': 'Giữ rồi nện khi trùm lấy đà'
    },
    'pods': {
      'touch': 'Đạp nát trứng trước khi chúng nở!',
      'desktop': 'Đạp nát trứng trước khi chúng nở!'
    }
  },
  'result': {
    'cleared': 'Qua màn!',
    'timeUp': 'Hết giờ!',
    'upNext': 'Tiếp theo: {n}',
    'retryLevel': 'Thử lại nhé?',
    'campaignDone': 'Đã qua hết các màn!',
    'newRecord': 'Kỷ lục mới!',
    'nextLevel': 'Màn kế tiếp',
    'tryAgain': 'Thử lại',
    'squishes': 'Bọ đã đạp nát',
    'starsEarned': '{n} trên 3 sao',
    'rankOf': 'trên {n}',
    'worldUnlocked': 'Đã mở {n}!'
  },
  'leaderboard': {
    'title': 'Bảng xếp hạng',
    'rank': 'Hạng',
    'player': 'Người chơi',
    'score': 'Điểm',
    'level': 'Màn',
    'you': 'Bạn',
    'yourRank': 'Bạn hạng #{n} trên {total}',
    'of': 'trên {n}',
    'unranked': 'Qua một màn để lên bảng',
    'loading': 'Đang tải bảng xếp hạng…',
    'empty': 'Chưa ai ghi điểm cả',
    'failed': 'Không kết nối được bảng xếp hạng'
  },
  'options': {
    'title': 'Cài đặt',
    'general': 'Chung',
    'play': 'Lối chơi',
    'audio': 'Âm thanh',
    'close': 'Lưu và đóng',
    'language': 'Ngôn ngữ',
    'difficulty': 'Độ khó',
    'soundEffects': 'Hiệu ứng âm thanh',
    'music': 'Nhạc',
    'musicTrack': 'Bản nhạc',
    'haptics': 'Rung',
    'on': 'Bật',
    'off': 'Tắt',
    'difficulties': {
      'easy': 'Dễ',
      'medium': 'Thường',
      'hard': 'Khó'
    },
    'difficultyHints': {
      'easy': 'Bọ chậm hơn và nhiều thời gian hơn.',
      'medium': 'Trò chơi đúng như thiết kế.',
      'hard': 'Bọ nhanh hơn và sân đông hơn.'
    },
    'musicTracks': {
      'trance': 'Nhịp bọ',
      'cozy': 'Dã ngoại thảnh thơi'
    },
    'juiceStyle': 'Kiểu splat',
    'juiceStyles': {
      'ooze': 'Nhớt hoạt hình',
      'confetti': 'Piñata giấy màu',
      'bubble': 'Bong bóng xà phòng'
    },
    'juiceStyleHints': {
      'ooze': 'Nhớt nhiều màu. Lối chơi không đổi.',
      'confetti': 'Bọ nổ thành giấy màu. Lối chơi không đổi.',
      'bubble': 'Bọ hóa bong bóng. Lối chơi không đổi.'
    },
    'highVis': 'Vòng giẫm lớn',
    'highVisHint': 'Vòng dày và sáng hơn ở chỗ chân bạn sắp đáp.',
    'singleTap': 'Ngắm dễ',
    'singleTapHint': 'Chạm bất cứ đâu, chân sẽ bay tới con bọ gần nhất.'
  },
  'loading': {
    'boo': 'Hù!',
    'laugh': 'Hi hi!',
    'tooLong': 'Vẫn đang tải… kiểm tra kết nối nhé?'
  },
  'saveStatus': {
    'restoredTitle': 'Đã khôi phục tiến trình',
    'restoredBody': 'Chúng tôi đã lấy lại bản lưu và tặng thêm {n} xu.',
    'pausedTitle': 'Đã tạm dừng lưu',
    'pausedBody': 'Không liên lạc được dịch vụ lưu. Tiến trình của bạn vẫn an toàn trên thiết bị này.',
    'retry': 'Thử lại',
    'dismiss': 'Bỏ qua',
    'tap': 'Chạm để đóng'
  },
  'adsBlocked': {
    'title': 'Phát hiện trình chặn quảng cáo',
    'body': 'Bug Crunch miễn phí nhờ quảng cáo. Hãy tắt trình chặn rồi tải lại trang.',
    'allowPrefix': 'Cho phép quảng cáo trên',
    'allowSuffix': 'rồi tải lại trang.',
    'gotIt': 'Đã hiểu'
  },
  'license': {
    'denied': 'Không xác minh được bản sao này'
  }
}
