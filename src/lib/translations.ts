export type Language = "en" | "zh" | "ms" | "hi" | "ta" | "id" | "ja" | "ko" | "th" | "fr" | "es";

export const LANGUAGES: { code: Language; label: string; nativeLabel: string }[] = [
  { code: "en", label: "English", nativeLabel: "English" },
  { code: "zh", label: "Chinese", nativeLabel: "中文" },
  { code: "ms", label: "Malay", nativeLabel: "Bahasa Melayu" },
  { code: "hi", label: "Hindi", nativeLabel: "हिन्दी" },
  { code: "ta", label: "Tamil", nativeLabel: "தமிழ்" },
  { code: "id", label: "Indonesian", nativeLabel: "Bahasa Indonesia" },
  { code: "ja", label: "Japanese", nativeLabel: "日本語" },
  { code: "ko", label: "Korean", nativeLabel: "한국어" },
  { code: "th", label: "Thai", nativeLabel: "ไทย" },
  { code: "fr", label: "French", nativeLabel: "Français" },
  { code: "es", label: "Spanish", nativeLabel: "Español" },
];

type TranslationKeys = {
  // Navigation
  home: string;
  match: string;
  plan: string;
  messages: string;
  me: string;
  settings: string;
  // Common
  save: string;
  cancel: string;
  back: string;
  search: string;
  loading: string;
  signOut: string;
  // Home
  searchPlaceholder: string;
  // Match
  findLocals: string;
  swipeHint: string;
  noMoreLocals: string;
  refresh: string;
  discover: string;
  likedYou: string;
  // Messages
  noConversations: string;
  typeMessage: string;
  culturalContext: string;
  // Profile
  yourProfile: string;
  edit: string;
  preview: string;
  photos: string;
  addPhoto: string;
  bio: string;
  interests: string;
  location: string;
  languages: string;
  // Settings
  notifications: string;
  privacy: string;
  localGuide: string;
  support: string;
  pushNotifications: string;
  emailNotifications: string;
  newMatchAlerts: string;
  showOnlineStatus: string;
  showProfileInSearch: string;
  helpCenter: string;
  contactUs: string;
  termsOfService: string;
  privacyPolicy: string;
  language: string;
  // Planner
  myTrips: string;
  newTrip: string;
  // Subscription
  subscription: string;
  // Smart Itinerary
  smartItinerary: string;
  generateItinerary: string;
  addToPlanner: string;
  // Common Phrases
  commonPhrases: string;
  // Posts
  shareExperience: string;
  post: string;
  // Report
  report: string;
  block: string;
  reportUser: string;
  blockUser: string;
};

const translations: Record<Language, TranslationKeys> = {
  en: {
    home: "Home", match: "Match", plan: "Plan", messages: "Messages", me: "Me", settings: "Settings",
    save: "Save", cancel: "Cancel", back: "Back", search: "Search", loading: "Loading...", signOut: "Sign Out",
    searchPlaceholder: "Search destinations, locals...",
    findLocals: "Find Locals", swipeHint: "Swipe right to like, left to pass", noMoreLocals: "No More Locals", refresh: "Refresh", discover: "Discover", likedYou: "Liked You",
    noConversations: "No Conversations Yet", typeMessage: "Type a message...", culturalContext: "Cultural context",
    yourProfile: "Your Profile", edit: "Edit", preview: "Preview", photos: "Photos", addPhoto: "Add Photo", bio: "Bio", interests: "Interests", location: "Location", languages: "Languages",
    notifications: "Notifications", privacy: "Privacy", localGuide: "Local Guide", support: "Support",
    pushNotifications: "Push Notifications", emailNotifications: "Email Notifications", newMatchAlerts: "New Match Alerts",
    showOnlineStatus: "Show Online Status", showProfileInSearch: "Show Profile in Search",
    helpCenter: "Help Center", contactUs: "Contact Us", termsOfService: "Terms of Service", privacyPolicy: "Privacy Policy", language: "Language",
    myTrips: "My Trips", newTrip: "New Trip",
    subscription: "Subscription",
    smartItinerary: "Smart Itinerary", generateItinerary: "Generate Itinerary", addToPlanner: "Add to Planner",
    commonPhrases: "Common Phrases",
    shareExperience: "Share your travel experience... ✨", post: "Post",
    report: "Report", block: "Block", reportUser: "Report User", blockUser: "Block User",
  },
  zh: {
    home: "首页", match: "匹配", plan: "计划", messages: "消息", me: "我的", settings: "设置",
    save: "保存", cancel: "取消", back: "返回", search: "搜索", loading: "加载中...", signOut: "退出登录",
    searchPlaceholder: "搜索目的地、当地人...",
    findLocals: "寻找当地人", swipeHint: "右滑喜欢，左滑跳过", noMoreLocals: "暂无更多当地人", refresh: "刷新", discover: "发现", likedYou: "喜欢你的",
    noConversations: "暂无对话", typeMessage: "输入消息...", culturalContext: "文化背景",
    yourProfile: "你的资料", edit: "编辑", preview: "预览", photos: "照片", addPhoto: "添加照片", bio: "简介", interests: "兴趣", location: "位置", languages: "语言",
    notifications: "通知", privacy: "隐私", localGuide: "当地向导", support: "支持",
    pushNotifications: "推送通知", emailNotifications: "邮件通知", newMatchAlerts: "新匹配提醒",
    showOnlineStatus: "显示在线状态", showProfileInSearch: "在搜索中显示个人资料",
    helpCenter: "帮助中心", contactUs: "联系我们", termsOfService: "服务条款", privacyPolicy: "隐私政策", language: "语言",
    myTrips: "我的旅行", newTrip: "新旅行",
    subscription: "订阅",
    smartItinerary: "智能行程", generateItinerary: "生成行程", addToPlanner: "添加到计划",
    commonPhrases: "常用短语",
    shareExperience: "分享你的旅行体验... ✨", post: "发布",
    report: "举报", block: "拉黑", reportUser: "举报用户", blockUser: "拉黑用户",
  },
  ms: {
    home: "Laman", match: "Padanan", plan: "Rancang", messages: "Mesej", me: "Saya", settings: "Tetapan",
    save: "Simpan", cancel: "Batal", back: "Kembali", search: "Cari", loading: "Memuatkan...", signOut: "Log Keluar",
    searchPlaceholder: "Cari destinasi, penduduk tempatan...",
    findLocals: "Cari Penduduk Tempatan", swipeHint: "Leret kanan untuk suka, kiri untuk langkau", noMoreLocals: "Tiada Lagi", refresh: "Muat Semula", discover: "Terokai", likedYou: "Suka Anda",
    noConversations: "Tiada Perbualan Lagi", typeMessage: "Taip mesej...", culturalContext: "Konteks budaya",
    yourProfile: "Profil Anda", edit: "Sunting", preview: "Pratonton", photos: "Foto", addPhoto: "Tambah Foto", bio: "Bio", interests: "Minat", location: "Lokasi", languages: "Bahasa",
    notifications: "Pemberitahuan", privacy: "Privasi", localGuide: "Pemandu Tempatan", support: "Sokongan",
    pushNotifications: "Pemberitahuan Tolak", emailNotifications: "Pemberitahuan E-mel", newMatchAlerts: "Makluman Padanan Baru",
    showOnlineStatus: "Tunjuk Status Dalam Talian", showProfileInSearch: "Tunjuk Profil dalam Carian",
    helpCenter: "Pusat Bantuan", contactUs: "Hubungi Kami", termsOfService: "Terma Perkhidmatan", privacyPolicy: "Dasar Privasi", language: "Bahasa",
    myTrips: "Perjalanan Saya", newTrip: "Perjalanan Baru",
    subscription: "Langganan",
    smartItinerary: "Jadual Pintar", generateItinerary: "Jana Jadual", addToPlanner: "Tambah ke Perancang",
    commonPhrases: "Frasa Biasa",
    shareExperience: "Kongsi pengalaman perjalanan anda... ✨", post: "Hantar",
    report: "Lapor", block: "Sekat", reportUser: "Lapor Pengguna", blockUser: "Sekat Pengguna",
  },
  hi: {
    home: "होम", match: "मैच", plan: "योजना", messages: "संदेश", me: "मैं", settings: "सेटिंग्स",
    save: "सहेजें", cancel: "रद्द करें", back: "वापस", search: "खोजें", loading: "लोड हो रहा है...", signOut: "लॉग आउट",
    searchPlaceholder: "गंतव्य, स्थानीय लोग खोजें...",
    findLocals: "स्थानीय लोग खोजें", swipeHint: "पसंद के लिए दाएँ, पास के लिए बाएँ स्वाइप करें", noMoreLocals: "और कोई नहीं", refresh: "रीफ्रेश", discover: "खोजें", likedYou: "आपको पसंद किया",
    noConversations: "अभी कोई बातचीत नहीं", typeMessage: "संदेश टाइप करें...", culturalContext: "सांस्कृतिक संदर्भ",
    yourProfile: "आपकी प्रोफ़ाइल", edit: "संपादित करें", preview: "पूर्वावलोकन", photos: "तस्वीरें", addPhoto: "फोटो जोड़ें", bio: "बायो", interests: "रुचियाँ", location: "स्थान", languages: "भाषाएँ",
    notifications: "सूचनाएँ", privacy: "गोपनीयता", localGuide: "स्थानीय गाइड", support: "सहायता",
    pushNotifications: "पुश सूचनाएँ", emailNotifications: "ईमेल सूचनाएँ", newMatchAlerts: "नई मैच सूचनाएँ",
    showOnlineStatus: "ऑनलाइन स्थिति दिखाएँ", showProfileInSearch: "खोज में प्रोफ़ाइल दिखाएँ",
    helpCenter: "सहायता केंद्र", contactUs: "संपर्क करें", termsOfService: "सेवा की शर्तें", privacyPolicy: "गोपनीयता नीति", language: "भाषा",
    myTrips: "मेरी यात्राएँ", newTrip: "नई यात्रा",
    subscription: "सदस्यता",
    smartItinerary: "स्मार्ट यात्रा कार्यक्रम", generateItinerary: "यात्रा कार्यक्रम बनाएँ", addToPlanner: "योजनाकार में जोड़ें",
    commonPhrases: "सामान्य वाक्यांश",
    shareExperience: "अपना यात्रा अनुभव साझा करें... ✨", post: "पोस्ट",
    report: "रिपोर्ट", block: "ब्लॉक", reportUser: "उपयोगकर्ता की रिपोर्ट करें", blockUser: "उपयोगकर्ता को ब्लॉक करें",
  },
  ta: {
    home: "முகப்பு", match: "பொருத்தம்", plan: "திட்டம்", messages: "செய்திகள்", me: "நான்", settings: "அமைப்புகள்",
    save: "சேமி", cancel: "ரத்து", back: "பின்", search: "தேடு", loading: "ஏற்றுகிறது...", signOut: "வெளியேறு",
    searchPlaceholder: "இடங்கள், உள்ளூர் மக்கள் தேடு...",
    findLocals: "உள்ளூர் மக்களைக் கண்டறி", swipeHint: "விரும்ப வலது, தவிர்க்க இடது ஸ்வைப்", noMoreLocals: "மேலும் இல்லை", refresh: "புதுப்பி", discover: "கண்டறி", likedYou: "உங்களை விரும்பியவர்",
    noConversations: "இன்னும் உரையாடல்கள் இல்லை", typeMessage: "செய்தி தட்டச்சு செய்...", culturalContext: "கலாச்சார சூழல்",
    yourProfile: "உங்கள் சுயவிவரம்", edit: "திருத்து", preview: "முன்னோட்டம்", photos: "புகைப்படங்கள்", addPhoto: "புகைப்படம் சேர்", bio: "சுயவிவரம்", interests: "ஆர்வங்கள்", location: "இடம்", languages: "மொழிகள்",
    notifications: "அறிவிப்புகள்", privacy: "தனியுரிமை", localGuide: "உள்ளூர் வழிகாட்டி", support: "ஆதரவு",
    pushNotifications: "புஷ் அறிவிப்புகள்", emailNotifications: "மின்னஞ்சல் அறிவிப்புகள்", newMatchAlerts: "புதிய பொருத்த எச்சரிக்கைகள்",
    showOnlineStatus: "ஆன்லைன் நிலையைக் காட்டு", showProfileInSearch: "தேடலில் சுயவிவரம் காட்டு",
    helpCenter: "உதவி மையம்", contactUs: "தொடர்பு", termsOfService: "சேவை விதிமுறைகள்", privacyPolicy: "தனியுரிமை கொள்கை", language: "மொழி",
    myTrips: "என் பயணங்கள்", newTrip: "புதிய பயணம்",
    subscription: "சந்தா",
    smartItinerary: "ஸ்மார்ட் பயண திட்டம்", generateItinerary: "பயண திட்டம் உருவாக்கு", addToPlanner: "திட்டமிடலில் சேர்",
    commonPhrases: "பொதுவான சொற்றொடர்கள்",
    shareExperience: "உங்கள் பயண அனுபவத்தைப் பகிரவும்... ✨", post: "பதிவு",
    report: "புகார்", block: "தடை", reportUser: "பயனரைப் புகார் செய்", blockUser: "பயனரைத் தடை செய்",
  },
  id: {
    home: "Beranda", match: "Cocokkan", plan: "Rencana", messages: "Pesan", me: "Saya", settings: "Pengaturan",
    save: "Simpan", cancel: "Batal", back: "Kembali", search: "Cari", loading: "Memuat...", signOut: "Keluar",
    searchPlaceholder: "Cari destinasi, penduduk lokal...",
    findLocals: "Temukan Lokal", swipeHint: "Geser kanan untuk suka, kiri untuk lewati", noMoreLocals: "Tidak Ada Lagi", refresh: "Segarkan", discover: "Jelajahi", likedYou: "Menyukai Anda",
    noConversations: "Belum Ada Percakapan", typeMessage: "Ketik pesan...", culturalContext: "Konteks budaya",
    yourProfile: "Profil Anda", edit: "Edit", preview: "Pratinjau", photos: "Foto", addPhoto: "Tambah Foto", bio: "Bio", interests: "Minat", location: "Lokasi", languages: "Bahasa",
    notifications: "Notifikasi", privacy: "Privasi", localGuide: "Pemandu Lokal", support: "Dukungan",
    pushNotifications: "Notifikasi Push", emailNotifications: "Notifikasi Email", newMatchAlerts: "Peringatan Kecocokan Baru",
    showOnlineStatus: "Tampilkan Status Online", showProfileInSearch: "Tampilkan Profil di Pencarian",
    helpCenter: "Pusat Bantuan", contactUs: "Hubungi Kami", termsOfService: "Ketentuan Layanan", privacyPolicy: "Kebijakan Privasi", language: "Bahasa",
    myTrips: "Perjalanan Saya", newTrip: "Perjalanan Baru",
    subscription: "Langganan",
    smartItinerary: "Jadwal Pintar", generateItinerary: "Buat Jadwal", addToPlanner: "Tambah ke Perencana",
    commonPhrases: "Frasa Umum",
    shareExperience: "Bagikan pengalaman perjalanan Anda... ✨", post: "Kirim",
    report: "Laporkan", block: "Blokir", reportUser: "Laporkan Pengguna", blockUser: "Blokir Pengguna",
  },
  ja: {
    home: "ホーム", match: "マッチ", plan: "プラン", messages: "メッセージ", me: "マイページ", settings: "設定",
    save: "保存", cancel: "キャンセル", back: "戻る", search: "検索", loading: "読み込み中...", signOut: "ログアウト",
    searchPlaceholder: "目的地、地元の人を検索...",
    findLocals: "地元の人を探す", swipeHint: "右スワイプでいいね、左でパス", noMoreLocals: "これ以上ありません", refresh: "更新", discover: "発見", likedYou: "あなたをいいねした人",
    noConversations: "まだ会話はありません", typeMessage: "メッセージを入力...", culturalContext: "文化的背景",
    yourProfile: "プロフィール", edit: "編集", preview: "プレビュー", photos: "写真", addPhoto: "写真を追加", bio: "自己紹介", interests: "興味", location: "場所", languages: "言語",
    notifications: "通知", privacy: "プライバシー", localGuide: "ローカルガイド", support: "サポート",
    pushNotifications: "プッシュ通知", emailNotifications: "メール通知", newMatchAlerts: "新しいマッチ通知",
    showOnlineStatus: "オンライン状態を表示", showProfileInSearch: "検索にプロフィールを表示",
    helpCenter: "ヘルプセンター", contactUs: "お問い合わせ", termsOfService: "利用規約", privacyPolicy: "プライバシーポリシー", language: "言語",
    myTrips: "旅行一覧", newTrip: "新しい旅行",
    subscription: "サブスクリプション",
    smartItinerary: "スマート旅程", generateItinerary: "旅程を作成", addToPlanner: "プランナーに追加",
    commonPhrases: "よく使うフレーズ",
    shareExperience: "旅行体験を共有... ✨", post: "投稿",
    report: "報告", block: "ブロック", reportUser: "ユーザーを報告", blockUser: "ユーザーをブロック",
  },
  ko: {
    home: "홈", match: "매칭", plan: "계획", messages: "메시지", me: "내 정보", settings: "설정",
    save: "저장", cancel: "취소", back: "뒤로", search: "검색", loading: "로딩 중...", signOut: "로그아웃",
    searchPlaceholder: "여행지, 현지인 검색...",
    findLocals: "현지인 찾기", swipeHint: "오른쪽으로 좋아요, 왼쪽으로 패스", noMoreLocals: "더 이상 없습니다", refresh: "새로고침", discover: "탐색", likedYou: "당신을 좋아한 사람",
    noConversations: "아직 대화가 없습니다", typeMessage: "메시지 입력...", culturalContext: "문화적 맥락",
    yourProfile: "내 프로필", edit: "편집", preview: "미리보기", photos: "사진", addPhoto: "사진 추가", bio: "소개", interests: "관심사", location: "위치", languages: "언어",
    notifications: "알림", privacy: "개인정보", localGuide: "현지 가이드", support: "지원",
    pushNotifications: "푸시 알림", emailNotifications: "이메일 알림", newMatchAlerts: "새 매칭 알림",
    showOnlineStatus: "온라인 상태 표시", showProfileInSearch: "검색에서 프로필 표시",
    helpCenter: "도움말 센터", contactUs: "문의하기", termsOfService: "서비스 약관", privacyPolicy: "개인정보 처리방침", language: "언어",
    myTrips: "내 여행", newTrip: "새 여행",
    subscription: "구독",
    smartItinerary: "스마트 일정", generateItinerary: "일정 생성", addToPlanner: "플래너에 추가",
    commonPhrases: "자주 쓰는 표현",
    shareExperience: "여행 경험을 공유하세요... ✨", post: "게시",
    report: "신고", block: "차단", reportUser: "사용자 신고", blockUser: "사용자 차단",
  },
  th: {
    home: "หน้าแรก", match: "จับคู่", plan: "แผน", messages: "ข้อความ", me: "ฉัน", settings: "ตั้งค่า",
    save: "บันทึก", cancel: "ยกเลิก", back: "กลับ", search: "ค้นหา", loading: "กำลังโหลด...", signOut: "ออกจากระบบ",
    searchPlaceholder: "ค้นหาจุดหมาย, คนท้องถิ่น...",
    findLocals: "ค้นหาคนท้องถิ่น", swipeHint: "ปัดขวาเพื่อถูกใจ, ปัดซ้ายเพื่อข้าม", noMoreLocals: "ไม่มีอีกแล้ว", refresh: "รีเฟรช", discover: "สำรวจ", likedYou: "ถูกใจคุณ",
    noConversations: "ยังไม่มีการสนทนา", typeMessage: "พิมพ์ข้อความ...", culturalContext: "บริบททางวัฒนธรรม",
    yourProfile: "โปรไฟล์ของคุณ", edit: "แก้ไข", preview: "ดูตัวอย่าง", photos: "รูปภาพ", addPhoto: "เพิ่มรูป", bio: "เกี่ยวกับ", interests: "ความสนใจ", location: "สถานที่", languages: "ภาษา",
    notifications: "การแจ้งเตือน", privacy: "ความเป็นส่วนตัว", localGuide: "ไกด์ท้องถิ่น", support: "สนับสนุน",
    pushNotifications: "การแจ้งเตือนแบบพุช", emailNotifications: "การแจ้งเตือนอีเมล", newMatchAlerts: "แจ้งเตือนคู่ใหม่",
    showOnlineStatus: "แสดงสถานะออนไลน์", showProfileInSearch: "แสดงโปรไฟล์ในการค้นหา",
    helpCenter: "ศูนย์ช่วยเหลือ", contactUs: "ติดต่อเรา", termsOfService: "เงื่อนไขการให้บริการ", privacyPolicy: "นโยบายความเป็นส่วนตัว", language: "ภาษา",
    myTrips: "ทริปของฉัน", newTrip: "ทริปใหม่",
    subscription: "สมัครสมาชิก",
    smartItinerary: "แผนการเดินทางอัจฉริยะ", generateItinerary: "สร้างแผนการเดินทาง", addToPlanner: "เพิ่มในแผน",
    commonPhrases: "วลีทั่วไป",
    shareExperience: "แบ่งปันประสบการณ์การเดินทาง... ✨", post: "โพสต์",
    report: "รายงาน", block: "บล็อก", reportUser: "รายงานผู้ใช้", blockUser: "บล็อกผู้ใช้",
  },
  fr: {
    home: "Accueil", match: "Match", plan: "Planifier", messages: "Messages", me: "Moi", settings: "Paramètres",
    save: "Enregistrer", cancel: "Annuler", back: "Retour", search: "Rechercher", loading: "Chargement...", signOut: "Déconnexion",
    searchPlaceholder: "Rechercher des destinations, des locaux...",
    findLocals: "Trouver des locaux", swipeHint: "Glissez à droite pour aimer, à gauche pour passer", noMoreLocals: "Plus de locaux", refresh: "Actualiser", discover: "Découvrir", likedYou: "Vous ont aimé",
    noConversations: "Pas encore de conversations", typeMessage: "Tapez un message...", culturalContext: "Contexte culturel",
    yourProfile: "Votre profil", edit: "Modifier", preview: "Aperçu", photos: "Photos", addPhoto: "Ajouter une photo", bio: "Bio", interests: "Intérêts", location: "Lieu", languages: "Langues",
    notifications: "Notifications", privacy: "Confidentialité", localGuide: "Guide local", support: "Support",
    pushNotifications: "Notifications push", emailNotifications: "Notifications par e-mail", newMatchAlerts: "Alertes de nouveaux matchs",
    showOnlineStatus: "Afficher le statut en ligne", showProfileInSearch: "Afficher le profil dans la recherche",
    helpCenter: "Centre d'aide", contactUs: "Nous contacter", termsOfService: "Conditions d'utilisation", privacyPolicy: "Politique de confidentialité", language: "Langue",
    myTrips: "Mes voyages", newTrip: "Nouveau voyage",
    subscription: "Abonnement",
    smartItinerary: "Itinéraire intelligent", generateItinerary: "Générer un itinéraire", addToPlanner: "Ajouter au planificateur",
    commonPhrases: "Expressions courantes",
    shareExperience: "Partagez votre expérience de voyage... ✨", post: "Publier",
    report: "Signaler", block: "Bloquer", reportUser: "Signaler l'utilisateur", blockUser: "Bloquer l'utilisateur",
  },
  es: {
    home: "Inicio", match: "Match", plan: "Planificar", messages: "Mensajes", me: "Yo", settings: "Ajustes",
    save: "Guardar", cancel: "Cancelar", back: "Atrás", search: "Buscar", loading: "Cargando...", signOut: "Cerrar sesión",
    searchPlaceholder: "Buscar destinos, locales...",
    findLocals: "Encontrar Locales", swipeHint: "Desliza a la derecha para me gusta, izquierda para pasar", noMoreLocals: "No hay más locales", refresh: "Actualizar", discover: "Descubrir", likedYou: "Les gustaste",
    noConversations: "Sin conversaciones aún", typeMessage: "Escribe un mensaje...", culturalContext: "Contexto cultural",
    yourProfile: "Tu perfil", edit: "Editar", preview: "Vista previa", photos: "Fotos", addPhoto: "Agregar foto", bio: "Bio", interests: "Intereses", location: "Ubicación", languages: "Idiomas",
    notifications: "Notificaciones", privacy: "Privacidad", localGuide: "Guía local", support: "Soporte",
    pushNotifications: "Notificaciones push", emailNotifications: "Notificaciones por correo", newMatchAlerts: "Alertas de nuevos matches",
    showOnlineStatus: "Mostrar estado en línea", showProfileInSearch: "Mostrar perfil en búsqueda",
    helpCenter: "Centro de ayuda", contactUs: "Contáctenos", termsOfService: "Términos de servicio", privacyPolicy: "Política de privacidad", language: "Idioma",
    myTrips: "Mis viajes", newTrip: "Nuevo viaje",
    subscription: "Suscripción",
    smartItinerary: "Itinerario inteligente", generateItinerary: "Generar itinerario", addToPlanner: "Agregar al planificador",
    commonPhrases: "Frases comunes",
    shareExperience: "Comparte tu experiencia de viaje... ✨", post: "Publicar",
    report: "Reportar", block: "Bloquear", reportUser: "Reportar usuario", blockUser: "Bloquear usuario",
  },
};

export const getTranslations = (lang: Language): TranslationKeys => {
  return translations[lang] || translations.en;
};

export default translations;
