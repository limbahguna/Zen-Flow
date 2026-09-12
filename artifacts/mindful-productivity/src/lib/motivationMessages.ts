/**
 * Daily motivation messages — static library, no AI/API calls.
 * 30 messages × 3 active languages (EN/ID/JA) plus legacy fields kept for
 * historical bundled data — legacy fields are inert and unreachable through
 * the public API which is strictly typed to LanguageCode (en | id | ja).
 *
 * Daily selection: deterministic from local date string (YYYY-MM-DD) so the
 * message is stable across refreshes on the same day and changes at midnight.
 */

import type { LanguageCode } from "./translations";

/**
 * Internal text record type — includes the three active launch languages plus
 * legacy fields (es/de/ar/zh) retained in the bundle but not exposed via the
 * public API.  Extra fields beyond LanguageCode are allowed here; callers only
 * receive strings for active LanguageCode keys.
 */
type MessageTextRecord = Record<LanguageCode, string> & Record<string, string>;

export interface MotivationMessage {
  id: number;
  /** Translations keyed by language code (en/id/ja required; legacy keys retained). */
  text: MessageTextRecord;
}

export const MOTIVATION_MESSAGES: MotivationMessage[] = [
  {
    id: 0,
    text: {
      en: "Small progress is still progress.",
      id: "Kemajuan kecil tetaplah kemajuan.",
      es: "El progreso pequeño sigue siendo progreso.",
      de: "Kleiner Fortschritt ist immer noch Fortschritt.",
      ja: "小さな進歩も、確かな進歩です。",
      ar: "التقدم الصغير لا يزال تقدمًا.",
      zh: "小小的进步，也是进步。",
    },
  },
  {
    id: 1,
    text: {
      en: "Focus on one step you can take today.",
      id: "Fokus pada satu langkah yang bisa kamu lakukan hari ini.",
      es: "Enfócate en un paso que puedas dar hoy.",
      de: "Konzentriere dich auf einen Schritt, den du heute machen kannst.",
      ja: "今日できる一歩に集中しましょう。",
      ar: "ركّز على خطوة واحدة يمكنك اتخاذها اليوم.",
      zh: "专注于今天你能迈出的一步。",
    },
  },
  {
    id: 2,
    text: {
      en: "Rest is not giving up.",
      id: "Istirahat bukan berarti menyerah.",
      es: "Descansar no es rendirse.",
      de: "Ruhe ist kein Aufgeben.",
      ja: "休むことは、諦めることではありません。",
      ar: "الراحة ليست استسلامًا.",
      zh: "休息不是放弃。",
    },
  },
  {
    id: 3,
    text: {
      en: "You don't have to be perfect to move forward.",
      id: "Kamu tidak harus sempurna untuk terus melangkah.",
      es: "No tienes que ser perfecto para avanzar.",
      de: "Du musst nicht perfekt sein, um voranzukommen.",
      ja: "前に進むために、完璧である必要はありません。",
      ar: "لست بحاجة إلى أن تكون مثاليًا للمضي قدمًا.",
      zh: "你不需要完美，才能向前迈进。",
    },
  },
  {
    id: 4,
    text: {
      en: "Every difficult moment passes.",
      id: "Setiap momen sulit akan berlalu.",
      es: "Cada momento difícil pasa.",
      de: "Jeder schwierige Moment vergeht.",
      ja: "つらい瞬間は、必ず過ぎ去ります。",
      ar: "كل لحظة صعبة ستمر.",
      zh: "每一个艰难的时刻都会过去。",
    },
  },
  {
    id: 5,
    text: {
      en: "You are more capable than you think.",
      id: "Kamu lebih mampu dari yang kamu kira.",
      es: "Eres más capaz de lo que crees.",
      de: "Du bist fähiger, als du denkst.",
      ja: "あなたは自分が思うより、ずっと有能です。",
      ar: "أنت أكثر قدرة مما تعتقد.",
      zh: "你比你想象的更有能力。",
    },
  },
  {
    id: 6,
    text: {
      en: "Today is a good day to try something small.",
      id: "Hari ini adalah hari yang baik untuk mencoba sesuatu yang kecil.",
      es: "Hoy es un buen día para intentar algo pequeño.",
      de: "Heute ist ein guter Tag, um etwas Kleines auszuprobieren.",
      ja: "今日は、小さなことを試してみるのにいい日です。",
      ar: "اليوم يوم جيد لتجربة شيء صغير.",
      zh: "今天是尝试一件小事的好日子。",
    },
  },
  {
    id: 7,
    text: {
      en: "Being kind to yourself is a strength, not a weakness.",
      id: "Bersikap baik pada diri sendiri adalah kekuatan, bukan kelemahan.",
      es: "Ser amable contigo mismo es una fortaleza, no una debilidad.",
      de: "Freundlich zu dir selbst zu sein ist eine Stärke, keine Schwäche.",
      ja: "自分に優しくすることは、弱さではなく強さです。",
      ar: "أن تكون لطيفًا مع نفسك قوة، وليس ضعفًا.",
      zh: "善待自己是一种力量，而不是软弱。",
    },
  },
  {
    id: 8,
    text: {
      en: "One step at a time is always enough.",
      id: "Satu langkah pada satu waktu selalu cukup.",
      es: "Un paso a la vez siempre es suficiente.",
      de: "Ein Schritt nach dem anderen ist immer genug.",
      ja: "一度に一歩ずつ、それで十分です。",
      ar: "خطوة واحدة في كل مرة كافية دائمًا.",
      zh: "一次迈出一步，始终足够。",
    },
  },
  {
    id: 9,
    text: {
      en: "It's okay to not have all the answers right now.",
      id: "Tidak apa-apa jika kamu belum punya semua jawabannya sekarang.",
      es: "Está bien no tener todas las respuestas ahora mismo.",
      de: "Es ist in Ordnung, gerade nicht alle Antworten zu haben.",
      ja: "今すべての答えを持っていなくても、それでいいのです。",
      ar: "لا بأس بعدم امتلاك كل الإجابات الآن.",
      zh: "现在没有所有答案，没关系。",
    },
  },
  {
    id: 10,
    text: {
      en: "You are not your thoughts. You can observe them without obeying them.",
      id: "Kamu bukan pikiranmu. Kamu bisa mengamati tanpa harus mengikutinya.",
      es: "No eres tus pensamientos. Puedes observarlos sin obedecerlos.",
      de: "Du bist nicht deine Gedanken. Du kannst sie beobachten, ohne ihnen zu gehorchen.",
      ja: "あなたはあなたの思考ではありません。思考を観察することができます。",
      ar: "أنت لست أفكارك. يمكنك مراقبتها دون إطاعتها.",
      zh: "你不是你的想法。你可以观察它们，而不必服从它们。",
    },
  },
  {
    id: 11,
    text: {
      en: "Courage is starting, not finishing.",
      id: "Keberanian adalah memulai, bukan menyelesaikan.",
      es: "El valor es comenzar, no terminar.",
      de: "Mut bedeutet, anzufangen, nicht fertig zu werden.",
      ja: "勇気とは、始めることです。終わらせることではありません。",
      ar: "الشجاعة تكمن في البداية، لا في النهاية.",
      zh: "勇气在于开始，而不在于完成。",
    },
  },
  {
    id: 12,
    text: {
      en: "A slow day is still a day worth having.",
      id: "Hari yang lambat tetaplah hari yang berharga.",
      es: "Un día lento sigue siendo un día que vale la pena.",
      de: "Ein langsamer Tag ist immer noch ein Tag, der es wert ist.",
      ja: "ゆっくりな日も、意味のある一日です。",
      ar: "اليوم البطيء لا يزال يومًا يستحق.",
      zh: "缓慢的一天，仍然是值得拥有的一天。",
    },
  },
  {
    id: 13,
    text: {
      en: "You are doing the best you can with what you have.",
      id: "Kamu melakukan yang terbaik yang bisa kamu lakukan dengan apa yang kamu miliki.",
      es: "Estás haciendo lo mejor que puedes con lo que tienes.",
      de: "Du tust das Beste, was du mit dem kannst, was du hast.",
      ja: "今持っているものでできる最善を尽くしています。",
      ar: "أنت تبذل قصارى جهدك بما لديك.",
      zh: "你正在用你所拥有的，尽自己最大的努力。",
    },
  },
  {
    id: 14,
    text: {
      en: "Even small actions create momentum.",
      id: "Bahkan tindakan kecil pun menciptakan momentum.",
      es: "Incluso las pequeñas acciones crean impulso.",
      de: "Selbst kleine Handlungen erzeugen Schwung.",
      ja: "小さな行動でも、勢いを生み出します。",
      ar: "حتى الأفعال الصغيرة تخلق زخمًا.",
      zh: "即使是小小的行动，也能创造动力。",
    },
  },
  {
    id: 15,
    text: {
      en: "Pause, breathe, and begin again.",
      id: "Berhenti sejenak, bernapas, dan mulai lagi.",
      es: "Pausa, respira y comienza de nuevo.",
      de: "Innehalten, atmen und neu beginnen.",
      ja: "立ち止まって、深呼吸して、また始めましょう。",
      ar: "توقف، تنفس، وابدأ من جديد.",
      zh: "停下来，深呼吸，然后重新开始。",
    },
  },
  {
    id: 16,
    text: {
      en: "Progress often happens in the quiet moments.",
      id: "Kemajuan sering terjadi di momen-momen yang tenang.",
      es: "El progreso suele ocurrir en los momentos tranquilos.",
      de: "Fortschritt geschieht oft in den stillen Momenten.",
      ja: "進歩は、静かな瞬間に生まれることが多いです。",
      ar: "كثيرًا ما يحدث التقدم في اللحظات الهادئة.",
      zh: "进步往往发生在宁静的时刻。",
    },
  },
  {
    id: 17,
    text: {
      en: "What matters is that you're here and trying.",
      id: "Yang penting adalah kamu ada di sini dan mencoba.",
      es: "Lo que importa es que estás aquí e intentándolo.",
      de: "Was zählt, ist, dass du hier bist und es versuchst.",
      ja: "大切なのは、あなたがここにいて、取り組んでいることです。",
      ar: "المهم أنك هنا وتحاول.",
      zh: "重要的是，你在这里，你在努力。",
    },
  },
  {
    id: 18,
    text: {
      en: "Let today be a little lighter than yesterday.",
      id: "Biarkan hari ini sedikit lebih ringan dari kemarin.",
      es: "Deja que hoy sea un poco más ligero que ayer.",
      de: "Lass diesen Tag ein wenig leichter sein als gestern.",
      ja: "今日が昨日より少し軽い一日になりますように。",
      ar: "دع اليوم يكون أخف قليلًا من الأمس.",
      zh: "让今天比昨天轻松一点点。",
    },
  },
  {
    id: 19,
    text: {
      en: "You've navigated difficult days before, and you can again.",
      id: "Kamu sudah melewati hari-hari sulit sebelumnya, dan kamu bisa melakukannya lagi.",
      es: "Has navegado por días difíciles antes y puedes hacerlo de nuevo.",
      de: "Du hast schwierige Tage schon durchgestanden und kannst es wieder tun.",
      ja: "あなたはこれまで困難な日々を乗り越えてきました。また乗り越えられます。",
      ar: "لقد تجاوزت أيامًا صعبة من قبل، ويمكنك ذلك مرة أخرى.",
      zh: "你曾经度过艰难的日子，你还能再度过。",
    },
  },
  {
    id: 20,
    text: {
      en: "Gentleness towards yourself is a form of wisdom.",
      id: "Kelembutan pada diri sendiri adalah bentuk kebijaksanaan.",
      es: "La gentileza hacia uno mismo es una forma de sabiduría.",
      de: "Sanftheit mit sich selbst ist eine Form der Weisheit.",
      ja: "自分への優しさは、知恵の一形態です。",
      ar: "اللطف مع النفس شكل من أشكال الحكمة.",
      zh: "对自己温柔，是一种智慧。",
    },
  },
  {
    id: 21,
    text: {
      en: "Every moment is a fresh start.",
      id: "Setiap momen adalah awal yang baru.",
      es: "Cada momento es un nuevo comienzo.",
      de: "Jeder Moment ist ein neuer Anfang.",
      ja: "すべての瞬間は、新しいスタートです。",
      ar: "كل لحظة بداية جديدة.",
      zh: "每一刻都是全新的开始。",
    },
  },
  {
    id: 22,
    text: {
      en: "You don't have to do everything at once.",
      id: "Kamu tidak harus melakukan segalanya sekaligus.",
      es: "No tienes que hacerlo todo a la vez.",
      de: "Du musst nicht alles auf einmal tun.",
      ja: "すべてを一度にやる必要はありません。",
      ar: "لست مضطرًا إلى فعل كل شيء دفعة واحدة.",
      zh: "你不必一次做完所有事情。",
    },
  },
  {
    id: 23,
    text: {
      en: "Trust the process, even when it feels slow.",
      id: "Percayai prosesnya, bahkan ketika terasa lambat.",
      es: "Confía en el proceso, incluso cuando parece lento.",
      de: "Vertraue dem Prozess, auch wenn er sich langsam anfühlt.",
      ja: "たとえ遅く感じても、プロセスを信じましょう。",
      ar: "ثق بالعملية حتى عندما تبدو بطيئة.",
      zh: "相信过程，即使它看起来很缓慢。",
    },
  },
  {
    id: 24,
    text: {
      en: "Your effort today matters, regardless of the outcome.",
      id: "Usahamu hari ini berarti, terlepas dari hasilnya.",
      es: "Tu esfuerzo hoy importa, independientemente del resultado.",
      de: "Deine heutige Anstrengung zählt, unabhängig vom Ergebnis.",
      ja: "今日の努力は、結果に関わらず意味があります。",
      ar: "جهدك اليوم مهم بغض النظر عن النتيجة.",
      zh: "你今天的努力很重要，无论结果如何。",
    },
  },
  {
    id: 25,
    text: {
      en: "Consistency, not perfection, creates lasting change.",
      id: "Konsistensi, bukan kesempurnaan, yang menciptakan perubahan yang bertahan.",
      es: "La consistencia, no la perfección, crea cambios duraderos.",
      de: "Beständigkeit, nicht Perfektion, schafft dauerhaften Wandel.",
      ja: "完璧ではなく、継続が長続きする変化を生み出します。",
      ar: "الاتساق، لا الكمال، هو ما يخلق التغيير الدائم.",
      zh: "持续性，而非完美，才能创造持久的改变。",
    },
  },
  {
    id: 26,
    text: {
      en: "Uncertainty is uncomfortable, but you can sit with it.",
      id: "Ketidakpastian memang tidak nyaman, tapi kamu bisa menghadapinya.",
      es: "La incertidumbre es incómoda, pero puedes convivir con ella.",
      de: "Unsicherheit ist unangenehm, aber du kannst damit umgehen.",
      ja: "不確かさは不快かもしれませんが、向き合うことができます。",
      ar: "عدم اليقين أمر غير مريح، لكن يمكنك التعايش معه.",
      zh: "不确定性令人不舒服，但你可以与之共处。",
    },
  },
  {
    id: 27,
    text: {
      en: "The goal isn't to eliminate stress, but to navigate it with care.",
      id: "Tujuannya bukan menghilangkan stres, tapi melewatinya dengan bijak.",
      es: "El objetivo no es eliminar el estrés, sino navegarlo con cuidado.",
      de: "Das Ziel ist nicht, Stress zu beseitigen, sondern ihn achtsam zu bewältigen.",
      ja: "目標はストレスをなくすことではなく、注意深く対処することです。",
      ar: "الهدف ليس القضاء على التوتر، بل التعامل معه بعناية.",
      zh: "目标不是消除压力，而是小心地应对它。",
    },
  },
  {
    id: 28,
    text: {
      en: "Small wins deserve to be noticed.",
      id: "Kemenangan kecil layak untuk diperhatikan.",
      es: "Las pequeñas victorias merecen ser reconocidas.",
      de: "Kleine Erfolge verdienen es, wahrgenommen zu werden.",
      ja: "小さな勝利は、認められるべきです。",
      ar: "الانتصارات الصغيرة تستحق أن تُلاحَظ.",
      zh: "小小的胜利值得被关注。",
    },
  },
  {
    id: 29,
    text: {
      en: "You are allowed to change your mind and your pace.",
      id: "Kamu boleh mengubah pikiranmu dan kecepatanmu.",
      es: "Se te permite cambiar de opinión y de ritmo.",
      de: "Du darfst deine Meinung und dein Tempo ändern.",
      ja: "考えやペースを変えることは、許されています。",
      ar: "يُسمح لك بتغيير رأيك وإيقاعك.",
      zh: "你可以改变你的想法和节奏。",
    },
  },
];

/**
 * Returns a deterministic index (0–29) for a given date string (YYYY-MM-DD).
 * The same date always produces the same index.
 */
export function dailyIndex(dateStr: string): number {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = ((hash << 5) - hash + dateStr.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % MOTIVATION_MESSAGES.length;
}

/** Returns today's date string in YYYY-MM-DD (local time). */
export function todayDateStr(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Returns the message for a given date and language. */
export function getDailyMessage(dateStr: string, lang: LanguageCode): string {
  const idx = dailyIndex(dateStr);
  return MOTIVATION_MESSAGES[idx].text[lang] ?? MOTIVATION_MESSAGES[idx].text.en;
}

/** Returns a message by explicit index and language. */
export function getMessageByIndex(idx: number, lang: LanguageCode): string {
  const safeIdx = ((idx % MOTIVATION_MESSAGES.length) + MOTIVATION_MESSAGES.length) % MOTIVATION_MESSAGES.length;
  return MOTIVATION_MESSAGES[safeIdx].text[lang] ?? MOTIVATION_MESSAGES[safeIdx].text.en;
}

/** Returns all favourite message IDs from localStorage. */
export function getFavourites(): number[] {
  try {
    const raw = localStorage.getItem("mindful_motivation_favorites");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is number => typeof x === "number");
  } catch {
    return [];
  }
}

/** Toggles a favourite message ID in localStorage. Returns new state. */
export function toggleFavourite(id: number): boolean {
  const favs = getFavourites();
  const idx = favs.indexOf(id);
  let next: number[];
  if (idx === -1) {
    next = [...favs, id];
  } else {
    next = favs.filter((x) => x !== id);
  }
  try { localStorage.setItem("mindful_motivation_favorites", JSON.stringify(next)); } catch {}
  return idx === -1; // returns true if newly saved
}
