/**
 * Public marketing landing copy only.
 * Kept separate from app translations so Arabic can appear on the website
 * without changing in-app language options (en / id / ja).
 */

export const LANDING_LANGUAGES = {
  en: "English",
  id: "Bahasa Indonesia",
  ar: "العربية",
  ja: "日本語",
} as const;

export type LandingLanguage = keyof typeof LANDING_LANGUAGES;

export const LANDING_LANGUAGE_OPTIONS: { code: LandingLanguage; label: string }[] = [
  { code: "en", label: LANDING_LANGUAGES.en },
  { code: "id", label: LANDING_LANGUAGES.id },
  { code: "ar", label: LANDING_LANGUAGES.ar },
  { code: "ja", label: LANDING_LANGUAGES.ja },
];

export const LANDING_LANGUAGE_STORAGE_KEY = "mindful_landing_language";

export function isLandingLanguage(value: unknown): value is LandingLanguage {
  return typeof value === "string" && value in LANDING_LANGUAGES;
}

export function isLandingRtl(lang: LandingLanguage): boolean {
  return lang === "ar";
}

const copy = {
  en: {
    "meta.title": "Mindful Space — a calmer place to begin",
    "meta.description":
      "Mindful Space is a quiet web app for mood, intentions, journaling, short practices, sleep, and a companion that is not a therapist.",
    "nav.skip": "Skip to content",
    "nav.features": "Features",
    "nav.how": "How it works",
    "nav.login": "Log in",
    "nav.language": "Language",
    "hero.eyebrow": "Mindful Space",
    "hero.title": "A quieter way through busy days",
    "hero.lead":
      "For people who feel crowded by tasks, worry, or restlessness. Check in with how you feel, set a small intention, write a little, and practice in short steps — in your browser.",
    "hero.cta": "Get started",
    "hero.secondary": "Log in",
    "hero.visualLabel": "Sunlit path through a quiet forest",
    "who.photoAlt": "Sunrise over a quiet grassy hillside with a few trees",
    "who.title": "Made for ordinary, overloaded days",
    "who.body":
      "Mindful Space is a personal practice space. It is not therapy, diagnosis, or a substitute for professional care. If you are in crisis, please reach someone who can help.",
    "features.title": "What you can do here",
    "features.lead": "These tools already live in the app. Nothing extra is promised.",
    "features.mood.title": "Mood check-in",
    "features.mood.body": "Name how the day feels, then see simple trends over time.",
    "features.intentions.title": "Intentions",
    "features.intentions.body": "Write what you want to hold today, with an optional reminder.",
    "features.journal.title": "Journal",
    "features.journal.body": "Slow prompts that help you look at a thought without rushing it.",
    "features.practice.title": "Short practices",
    "features.practice.body": "Breathing, gentle movement, daily insights, and a focus timer.",
    "features.sleep.title": "Sleep",
    "features.sleep.body": "A wind-down check-in, a simple routine, and space to note the night.",
    "features.programs.title": "Programs and a daily plan",
    "features.programs.body": "Short guided paths and a plan for today, with progress you can review.",
    "features.companion.title": "Mindful Companion",
    "features.companion.body":
      "An AI companion that talks with you in the app. It is not medical advice, and monthly message limits apply.",
    "how.title": "Start in three quiet steps",
    "how.1.title": "Open the app",
    "how.1.body": "Log in or create an account. The same web app is waiting at this address.",
    "how.2.title": "Take one small action",
    "how.2.body": "A mood, an intention, a journal line, or a short practice is enough for today.",
    "how.3.title": "Return when you can",
    "how.3.body": "Your notes stay with your account so you can come back without starting over.",
    "close.title": "Begin when you are ready",
    "close.body":
      "No rush. When you want a calmer place to practice, the door is the login page.",
    "close.cta": "Get started",
    "disclaimer":
      "Mindful Space does not diagnose, treat, or replace professional mental-health care. If you need urgent help, use the crisis resources linked below.",
    "footer.nav": "Legal and account",
    "footer.privacy": "Privacy",
    "footer.terms": "Terms",
    "footer.crisis": "Crisis help",
    "footer.account": "Delete account",
    "footer.login": "Log in",
    "footer.tagline": "A personal space for practice — not a clinic.",
  },
  id: {
    "meta.title": "Mindful Space — tempat yang lebih tenang untuk memulai",
    "meta.description":
      "Mindful Space adalah aplikasi web yang tenang untuk suasana hati, niat, jurnal, latihan singkat, tidur, dan pendamping yang bukan terapis.",
    "nav.skip": "Lewati ke konten",
    "nav.features": "Fitur",
    "nav.how": "Cara kerja",
    "nav.login": "Masuk",
    "nav.language": "Bahasa",
    "hero.eyebrow": "Mindful Space",
    "hero.title": "Cara yang lebih tenang melewati hari yang penuh",
    "hero.lead":
      "Untuk orang yang merasa sesak oleh tugas, khawatir, atau gelisah. Cek perasaanmu, tulis niat kecil, mencatat sebentar, dan berlatih dalam langkah singkat — di peramban.",
    "hero.cta": "Mulai",
    "hero.secondary": "Masuk",
    "hero.visualLabel": "Jalur yang disinari matahari di hutan yang tenang",
    "who.photoAlt": "Matahari terbit di lereng berumput yang tenang dengan beberapa pohon",
    "who.title": "Untuk hari biasa yang terasa terlalu banyak",
    "who.body":
      "Mindful Space adalah ruang latihan pribadi. Ini bukan terapi, diagnosis, atau pengganti bantuan profesional. Jika kamu dalam krisis, mintalah bantuan orang yang bisa menolong.",
    "features.title": "Yang bisa kamu lakukan di sini",
    "features.lead": "Semua ini sudah ada di aplikasi. Tidak ada janji di luar itu.",
    "features.mood.title": "Cek suasana hati",
    "features.mood.body": "Namai bagaimana harimu terasa, lalu lihat tren sederhana dari waktu ke waktu.",
    "features.intentions.title": "Niat",
    "features.intentions.body": "Tulis apa yang ingin kamu jaga hari ini, dengan pengingat jika perlu.",
    "features.journal.title": "Jurnal",
    "features.journal.body": "Pertanyaan yang pelan, membantu melihat pikiran tanpa terburu-buru.",
    "features.practice.title": "Latihan singkat",
    "features.practice.body": "Pernapasan, gerakan lembut, wawasan harian, dan pengatur fokus.",
    "features.sleep.title": "Tidur",
    "features.sleep.body": "Cek sebelum istirahat, rutinitas sederhana, dan ruang untuk mencatat malam.",
    "features.programs.title": "Program dan rencana harian",
    "features.programs.body": "Jalur singkat yang terpandu dan rencana untuk hari ini, dengan progres yang bisa ditinjau.",
    "features.companion.title": "Pendamping Mindful",
    "features.companion.body":
      "Pendamping AI yang berbicara denganmu di aplikasi. Ini bukan saran medis, dan ada batas pesan bulanan.",
    "how.title": "Mulai dalam tiga langkah yang tenang",
    "how.1.title": "Buka aplikasinya",
    "how.1.body": "Masuk atau buat akun. Aplikasi web yang sama menunggu di alamat ini.",
    "how.2.title": "Lakukan satu hal kecil",
    "how.2.body": "Suasana hati, niat, sebaris jurnal, atau latihan singkat sudah cukup untuk hari ini.",
    "how.3.title": "Kembali kapan kamu bisa",
    "how.3.body": "Catatanmu tersimpan di akun, jadi kamu tidak perlu mulai dari nol.",
    "close.title": "Mulai ketika kamu siap",
    "close.body":
      "Tidak perlu terburu-buru. Jika kamu ingin ruang yang lebih tenang untuk berlatih, pintunya adalah halaman masuk.",
    "close.cta": "Mulai",
    "disclaimer":
      "Mindful Space tidak mendiagnosis, mengobati, atau menggantikan perawatan kesehatan mental profesional. Jika kamu butuh bantuan segera, gunakan sumber krisis di tautan bawah.",
    "footer.nav": "Hukum dan akun",
    "footer.privacy": "Privasi",
    "footer.terms": "Ketentuan",
    "footer.crisis": "Bantuan krisis",
    "footer.account": "Hapus akun",
    "footer.login": "Masuk",
    "footer.tagline": "Ruang pribadi untuk berlatih — bukan klinik.",
  },
  ar: {
    "meta.title": "Mindful Space — مكان أهدأ للبداية",
    "meta.description":
      "Mindful Space تطبيق ويب هادئ للمزاج والنوايا واليوميات وتمارين قصيرة والنوم، مع رفيق ليس معالجًا نفسيًا.",
    "nav.skip": "تخطَّ إلى المحتوى",
    "nav.features": "الميزات",
    "nav.how": "كيف يعمل",
    "nav.login": "تسجيل الدخول",
    "nav.language": "اللغة",
    "hero.eyebrow": "Mindful Space",
    "hero.title": "طريقة أهدأ لأيام مزدحمة",
    "hero.lead":
      "للأشخاص الذين يثقلهم العمل أو القلق أو التململ. راقب شعورك، ضع نية صغيرة، اكتب قليلًا، وتدرّب بخطوات قصيرة — في المتصفح.",
    "hero.cta": "ابدأ",
    "hero.secondary": "تسجيل الدخول",
    "hero.visualLabel": "مسار مشمس في غابة هادئة",
    "who.photoAlt": "شروق الشمس فوق تلة عشبية هادئة فيها بعض الأشجار",
    "who.title": "لأيام عادية تشعر بأنها فوق الطاقة",
    "who.body":
      "Mindful Space مساحة تمرين شخصية. ليست علاجًا ولا تشخيصًا ولا بديلًا عن الرعاية المهنية. إن كنت في أزمة، فاطلب مساعدة ممن يستطيع العون.",
    "features.title": "ما يمكنك فعله هنا",
    "features.lead": "هذه الأدوات موجودة فعلًا في التطبيق. لا وعود إضافية.",
    "features.mood.title": "تسجيل المزاج",
    "features.mood.body": "سمِّ شعور اليوم، ثم تابع اتجاهات بسيطة مع الوقت.",
    "features.intentions.title": "النوايا",
    "features.intentions.body": "اكتب ما تريد أن تتمسك به اليوم، مع تذكير اختياري.",
    "features.journal.title": "اليوميات",
    "features.journal.body": "أسئلة هادئة تساعدك على النظر إلى فكرة دون استعجال.",
    "features.practice.title": "تمارين قصيرة",
    "features.practice.body": "تنفس، حركة لطيفة، ومضات يومية، ومؤقت للتركيز.",
    "features.sleep.title": "النوم",
    "features.sleep.body": "تحقق قبل الراحة، وروتين بسيط، ومساحة لتدوين الليل.",
    "features.programs.title": "برامج وخطة يومية",
    "features.programs.body": "مسارات قصيرة موجَّهة وخطة لليوم، مع تقدم يمكنك مراجعته.",
    "features.companion.title": "الرفيق الهادئ",
    "features.companion.body":
      "رفيق بالذكاء الاصطناعي يتحدث معك داخل التطبيق. ليس نصيحة طبية، وتسري حدود شهرية على الرسائل.",
    "how.title": "ابدأ بثلاث خطوات هادئة",
    "how.1.title": "افتح التطبيق",
    "how.1.body": "سجّل الدخول أو أنشئ حسابًا. التطبيق نفسه ينتظرك على هذا العنوان.",
    "how.2.title": "افعل شيئًا صغيرًا",
    "how.2.body": "مزاج، أو نية، أو سطر في اليوميات، أو تمرين قصير يكفي لهذا اليوم.",
    "how.3.title": "عد حين تستطيع",
    "how.3.body": "ملاحظاتك تبقى مع حسابك حتى تعود دون أن تبدأ من الصفر.",
    "close.title": "ابدأ عندما تكون مستعدًا",
    "close.body":
      "لا عجلة. إذا أردت مكانًا أهدأ للتدرّب، فالباب هو صفحة تسجيل الدخول.",
    "close.cta": "ابدأ",
    "disclaimer":
      "Mindful Space لا يشخص ولا يعالج ولا يحل محل الرعاية النفسية المهنية. إن احتجت مساعدة عاجلة، استخدم موارد الأزمة في الروابط أدناه.",
    "footer.nav": "قانوني والحساب",
    "footer.privacy": "الخصوصية",
    "footer.terms": "الشروط",
    "footer.crisis": "مساعدة في الأزمة",
    "footer.account": "حذف الحساب",
    "footer.login": "تسجيل الدخول",
    "footer.tagline": "مساحة شخصية للتدريب — وليست عيادة.",
  },
  ja: {
    "meta.title": "Mindful Space — 静かに始められる場所",
    "meta.description":
      "Mindful Spaceは、気分・意図・ジャーナル・短い実践・睡眠、そしてセラピストではないコンパニオンのための静かなウェブアプリです。",
    "nav.skip": "本文へスキップ",
    "nav.features": "できること",
    "nav.how": "使い方",
    "nav.login": "ログイン",
    "nav.language": "言語",
    "hero.eyebrow": "Mindful Space",
    "hero.title": "忙しい日を、もう少し静かに",
    "hero.lead":
      "やることに追われたり、不安や落ち着かなさを感じる人のための場所です。気分を確かめ、小さな意図を置き、少し書いて、短い実践をする。ブラウザで使えます。",
    "hero.cta": "始める",
    "hero.secondary": "ログイン",
    "hero.visualLabel": "静かな森の中の陽だまりの道",
    "who.photoAlt": "木の立つ静かな丘に差し込む朝日",
    "who.title": "普通の、でも荷が重い日のために",
    "who.body":
      "Mindful Spaceは個人の実践の場です。治療でも診断でも、専門的なケアの代わりでもありません。危機にあるときは、助けてくれる人に連絡してください。",
    "features.title": "ここでできること",
    "features.lead": "いずれもアプリに既にある機能です。それ以上は約束しません。",
    "features.mood.title": "気分のチェックイン",
    "features.mood.body": "今日の感じ方に名前をつけ、シンプルな変化を見ていきます。",
    "features.intentions.title": "意図",
    "features.intentions.body": "今日大切にしたいことを書き、必要ならリマインダーをつけます。",
    "features.journal.title": "ジャーナル",
    "features.journal.body": "急がせず、考えを眺めるための静かな問いです。",
    "features.practice.title": "短い実践",
    "features.practice.body": "呼吸、やさしい動き、デイリーインサイト、フォーカスタイマー。",
    "features.sleep.title": "睡眠",
    "features.sleep.body": "休み前のチェックイン、簡単なルーティン、夜のメモ。",
    "features.programs.title": "プログラムと今日の計画",
    "features.programs.body": "短いガイド付きの道のりと、振り返れる今日のプラン。",
    "features.companion.title": "マインドフル・コンパニオン",
    "features.companion.body":
      "アプリ内で話せるAIコンパニオンです。医療助言ではなく、月ごとのメッセージ上限があります。",
    "how.title": "静かな三つのステップ",
    "how.1.title": "アプリを開く",
    "how.1.body": "ログインするか、アカウントを作ります。同じウェブアプリがこの住所で待っています。",
    "how.2.title": "小さなひとつをする",
    "how.2.body": "気分、意図、ジャーナルの一行、短い実践。今日はそれで十分です。",
    "how.3.title": "戻れるときに戻る",
    "how.3.body": "記録はアカウントに残るので、いちからやり直さなくてよいです。",
    "close.title": "準備ができたら、始めてください",
    "close.body":
      "急がなくて大丈夫です。静かに実践したいとき、入口はログインページです。",
    "close.cta": "始める",
    "disclaimer":
      "Mindful Spaceは診断・治療を行わず、専門的なメンタルヘルスケアの代わりにもなりません。緊急の助けが必要なときは、下の危機リソースを使ってください。",
    "footer.nav": "法務とアカウント",
    "footer.privacy": "プライバシー",
    "footer.terms": "利用規約",
    "footer.crisis": "危機のときの助け",
    "footer.account": "アカウント削除",
    "footer.login": "ログイン",
    "footer.tagline": "実践のための個人の場所です。診療所ではありません。",
  },
} as const;

export type LandingCopyKey = keyof typeof copy.en;

export function landingText(lang: LandingLanguage, key: LandingCopyKey): string {
  return copy[lang][key] ?? copy.en[key];
}

export function landingKeys(): LandingCopyKey[] {
  return Object.keys(copy.en) as LandingCopyKey[];
}

export function getStoredLandingLanguage(
  fallback: LandingLanguage = "en",
): LandingLanguage {
  try {
    const stored = localStorage.getItem(LANDING_LANGUAGE_STORAGE_KEY);
    if (isLandingLanguage(stored)) return stored;
  } catch {
    // storage denied
  }
  return fallback;
}

export function storeLandingLanguage(lang: LandingLanguage): void {
  try {
    localStorage.setItem(LANDING_LANGUAGE_STORAGE_KEY, lang);
  } catch {
    // storage denied
  }
}
