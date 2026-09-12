/**
 * Bundled local lessons — all 24 entries with EN/ID/JA translations.
 * Stable IDs, categories, sort_order, and reading_time are language-invariant.
 * Only title and content vary by locale.
 * No runtime API calls; content is entirely static.
 */

import type { LessonRow } from "./lessons";
import type { LanguageCode } from "./translations";

interface LocalLessonLocale {
  title: string;
  content: string;
}

interface LocalLessonDef {
  id: string;
  category: string;
  reading_time_minutes: number;
  sort_order: number;
  locales: Record<LanguageCode, LocalLessonLocale>;
}

// ── 24 bundled lessons ────────────────────────────────────────────────────────

const LOCAL_LESSON_DEFS: LocalLessonDef[] = [
  // ── Procrastination (6) ───────────────────────────────────────────────────
  {
    id: "local-proc-7",
    category: "procrastination",
    reading_time_minutes: 2,
    sort_order: 107,
    locales: {
      en: {
        title: "The perfectionism trap",
        content:
          "Waiting until conditions are perfect is a form of avoidance. Done is better than perfect. The gap between a finished project and a perfect one is usually invisible to everyone except you.",
      },
      id: {
        title: "Jebakan perfeksionisme",
        content:
          "Menunggu sampai kondisi sempurna adalah bentuk penghindaran. Selesai lebih baik daripada sempurna. Celah antara proyek yang selesai dan yang sempurna biasanya tidak terlihat oleh siapa pun kecuali dirimu.",
      },
      ja: {
        title: "完璧主義の罠",
        content:
          "完璧な状況を待つことは回避の一形態です。完成は完璧に勝ります。完成したプロジェクトと完璧なプロジェクトの差は、あなた以外には見えないことがほとんどです。",
      },
    },
  },
  {
    id: "local-proc-8",
    category: "procrastination",
    reading_time_minutes: 2,
    sort_order: 108,
    locales: {
      en: {
        title: "Why you procrastinate on things you want to do",
        content:
          "Procrastination isn't laziness — it's an emotional regulation problem. You're avoiding the discomfort of starting, not the task itself. Once you start, the discomfort usually fades within 5 minutes.",
      },
      id: {
        title: "Mengapa kamu menunda hal-hal yang ingin dilakukan",
        content:
          "Menunda bukan kemalasan — itu masalah regulasi emosi. Kamu menghindari ketidaknyamanan saat memulai, bukan tugas itu sendiri. Begitu kamu mulai, ketidaknyamanan biasanya hilang dalam 5 menit.",
      },
      ja: {
        title: "やりたいことを先延ばしにする理由",
        content:
          "先延ばしは怠慢ではなく、感情調整の問題です。タスク自体ではなく、始める際の不快感を避けているのです。一度始めれば、不快感は通常5分以内に消えます。",
      },
    },
  },
  {
    id: "local-proc-9",
    category: "procrastination",
    reading_time_minutes: 2,
    sort_order: 109,
    locales: {
      en: {
        title: "Time blindness and how to fix it",
        content:
          "Many people who procrastinate have poor internal time sense. External timers, visible clocks, and time-blocking aren't crutches — they're tools that replace a skill your brain struggles with.",
      },
      id: {
        title: "Kebutaan waktu dan cara mengatasinya",
        content:
          "Banyak orang yang suka menunda memiliki rasa waktu internal yang buruk. Timer eksternal, jam yang terlihat, dan pemblokiran waktu bukanlah tongkat penyangga — itu adalah alat yang menggantikan kemampuan yang sulit dilakukan otakmu.",
      },
      ja: {
        title: "時間感覚のなさとその対処法",
        content:
          "先延ばしをする人の多くは、内部の時間感覚が弱いです。外部タイマー、見えやすい時計、タイムブロッキングは松葉杖ではなく、脳が苦手とするスキルを補うツールです。",
      },
    },
  },
  {
    id: "local-proc-10",
    category: "procrastination",
    reading_time_minutes: 2,
    sort_order: 110,
    locales: {
      en: {
        title: "Decision fatigue",
        content:
          "Every decision you make depletes a limited resource. By afternoon, your brain is tired of choosing. Solution: make important decisions in the morning, automate routine ones.",
      },
      id: {
        title: "Kelelahan dalam mengambil keputusan",
        content:
          "Setiap keputusan yang kamu buat menguras sumber daya yang terbatas. Sore hari, otakmu lelah memilih. Solusinya: buat keputusan penting di pagi hari, otomatiskan yang rutin.",
      },
      ja: {
        title: "決断疲れ",
        content:
          "決断のたびに限られたリソースが消耗します。午後になると脳は選択に疲れています。解決策：重要な決断は朝に行い、ルーティンは自動化しましょう。",
      },
    },
  },
  {
    id: "local-proc-11",
    category: "procrastination",
    reading_time_minutes: 2,
    sort_order: 111,
    locales: {
      en: {
        title: "The paradox of choice",
        content:
          "More options = more anxiety = more procrastination. When you have too many tasks, pick ANY one. The 'right' choice matters less than making a choice at all.",
      },
      id: {
        title: "Paradoks pilihan",
        content:
          "Lebih banyak pilihan = lebih banyak kecemasan = lebih banyak penundaan. Ketika kamu memiliki terlalu banyak tugas, pilih MANA SAJA. Pilihan yang 'tepat' tidak sepenting membuat pilihan sama sekali.",
      },
      ja: {
        title: "選択のパラドックス",
        content:
          "選択肢が多い＝不安が多い＝先延ばしが多い。タスクが多すぎる場合は、どれか一つを選びましょう。「正しい」選択よりも、選択すること自体の方が重要です。",
      },
    },
  },
  {
    id: "local-proc-12",
    category: "procrastination",
    reading_time_minutes: 2,
    sort_order: 112,
    locales: {
      en: {
        title: "Activation energy",
        content:
          "Starting is the hardest part of any task. Physicists call it activation energy — the initial push needed to start a reaction. Make the push tiny: open the document, write one word, put on your shoes.",
      },
      id: {
        title: "Energi aktivasi",
        content:
          "Memulai adalah bagian tersulit dari tugas apa pun. Fisikawan menyebutnya energi aktivasi — dorongan awal yang dibutuhkan untuk memulai reaksi. Buat dorongannya sekecil mungkin: buka dokumennya, tulis satu kata, kenakan sepatumu.",
      },
      ja: {
        title: "活性化エネルギー",
        content:
          "始めることはどんなタスクでも最も難しい部分です。物理学者はこれを活性化エネルギーと呼びます——反応を起こすために必要な最初の一押し。その一押しを小さくしましょう：ドキュメントを開く、一語書く、靴を履く。",
      },
    },
  },

  // ── Anxiety (6) ───────────────────────────────────────────────────────────
  {
    id: "local-anx-7",
    category: "anxiety",
    reading_time_minutes: 2,
    sort_order: 207,
    locales: {
      en: {
        title: "The worry window",
        content:
          "Schedule 15 minutes daily for worrying. When anxious thoughts appear outside this time, write them down and say 'I'll worry about this at 4pm.' Your brain learns that worry has a time and place.",
      },
      id: {
        title: "Jendela kekhawatiran",
        content:
          "Jadwalkan 15 menit setiap hari untuk khawatir. Ketika pikiran cemas muncul di luar waktu ini, tuliskan dan katakan 'Saya akan khawatir soal ini pukul 16.00.' Otakmu belajar bahwa kekhawatiran memiliki waktu dan tempat.",
      },
      ja: {
        title: "心配ウィンドウ",
        content:
          "毎日15分、心配する時間を設けましょう。その時間外に不安な思考が浮かんだら書き留めて「これは午後4時に心配する」と言いましょう。脳は心配には時間と場所があることを学びます。",
      },
    },
  },
  {
    id: "local-anx-8",
    category: "anxiety",
    reading_time_minutes: 2,
    sort_order: 208,
    locales: {
      en: {
        title: "Anxiety is not the enemy",
        content:
          "Anxiety evolved to keep you safe. The problem isn't feeling anxious — it's when anxiety fires for non-threats. Thank your anxiety for trying to protect you, then examine if the threat is real.",
      },
      id: {
        title: "Kecemasan bukan musuh",
        content:
          "Kecemasan berevolusi untuk menjagamu tetap aman. Masalahnya bukan merasa cemas — melainkan saat kecemasan terpicu untuk hal yang bukan ancaman. Terima kasih kecemaasanmu karena berusaha melindungimu, lalu periksa apakah ancamannya nyata.",
      },
      ja: {
        title: "不安は敵ではない",
        content:
          "不安はあなたを安全に保つために進化しました。問題は不安を感じることではなく、不安が脅威でないことに反応する時です。不安に守ろうとしてくれていることへの感謝を伝え、脅威が本物かどうか検討しましょう。",
      },
    },
  },
  {
    id: "local-anx-9",
    category: "anxiety",
    reading_time_minutes: 2,
    sort_order: 209,
    locales: {
      en: {
        title: "The 5-4-3-2-1 grounding technique",
        content:
          "When anxiety spikes, name 5 things you see, 4 you can touch, 3 you hear, 2 you smell, 1 you taste. This pulls your brain from 'what if' back to 'what is.'",
      },
      id: {
        title: "Teknik grounding 5-4-3-2-1",
        content:
          "Ketika kecemasan melonjak, sebutkan 5 hal yang kamu lihat, 4 yang bisa kamu sentuh, 3 yang kamu dengar, 2 yang kamu cium, 1 yang kamu rasakan. Ini menarik otakmu dari 'bagaimana jika' kembali ke 'apa yang ada'.",
      },
      ja: {
        title: "5-4-3-2-1グラウンディング法",
        content:
          "不安が急上昇したら、見えるもの5つ、触れるもの4つ、聞こえるもの3つ、嗅げるもの2つ、味わえるもの1つを声に出しましょう。これで脳が「もし〜なら」から「今ここにあるもの」に戻ります。",
      },
    },
  },
  {
    id: "local-anx-10",
    category: "anxiety",
    reading_time_minutes: 2,
    sort_order: 210,
    locales: {
      en: {
        title: "Why mornings feel hardest",
        content:
          "Cortisol peaks 30-45 minutes after waking. This is normal. If you feel most anxious in the morning, it's not a sign something is wrong — it's biology. It will ease.",
      },
      id: {
        title: "Mengapa pagi terasa paling berat",
        content:
          "Kortisol memuncak 30-45 menit setelah bangun. Ini normal. Jika kamu merasa paling cemas di pagi hari, itu bukan tanda ada yang salah — itu biologi. Ini akan mereda.",
      },
      ja: {
        title: "朝が一番辛く感じる理由",
        content:
          "コルチゾールは起床後30〜45分でピークに達します。これは正常です。朝に最も不安を感じるとしたら、何かが間違っているサインではなく、生物学的なものです。やがて和らぎます。",
      },
    },
  },
  {
    id: "local-anx-11",
    category: "anxiety",
    reading_time_minutes: 2,
    sort_order: 211,
    locales: {
      en: {
        title: "Social anxiety decoded",
        content:
          "The fear of being judged is universal. But research shows people think about you far less than you imagine. This is called the spotlight effect — you're not in anyone's spotlight.",
      },
      id: {
        title: "Memahami kecemasan sosial",
        content:
          "Ketakutan untuk dihakimi itu universal. Tetapi penelitian menunjukkan orang memikirkanmu jauh lebih sedikit dari yang kamu bayangkan. Ini disebut efek sorotan — kamu tidak ada dalam sorotan siapa pun.",
      },
      ja: {
        title: "社交不安を解読する",
        content:
          "批判されることへの恐れは普遍的です。しかし研究によると、人々はあなたが想像するよりずっと少ししかあなたのことを考えていません。これをスポットライト効果と呼びます——あなたは誰のスポットライトの中にもいません。",
      },
    },
  },
  {
    id: "local-anx-12",
    category: "anxiety",
    reading_time_minutes: 2,
    sort_order: 212,
    locales: {
      en: {
        title: "Physical symptoms of anxiety",
        content:
          "Racing heart, tight chest, shallow breathing, stomach knots — anxiety lives in the body, not just the mind. That's why breathing exercises work: you're treating the physical root.",
      },
      id: {
        title: "Gejala fisik kecemasan",
        content:
          "Jantung berdebar, dada sesak, napas dangkal, perut mulas — kecemasan hidup di tubuh, bukan hanya pikiran. Itulah mengapa latihan pernapasan berhasil: kamu mengobati akar fisiknya.",
      },
      ja: {
        title: "不安の身体症状",
        content:
          "心拍の速まり、胸の締め付け、浅い呼吸、胃の締め付け——不安は心だけでなく身体にも宿ります。だからこそ呼吸法が効果的です：身体的な根本を治療しているのです。",
      },
    },
  },

  // ── CBT (4) ───────────────────────────────────────────────────────────────
  {
    id: "local-cbt-7",
    category: "cbt",
    reading_time_minutes: 2,
    sort_order: 307,
    locales: {
      en: {
        title: "All-or-nothing thinking",
        content:
          "Seeing things in black and white — 'If I can't do it perfectly, why bother?' Reality is gray. A B+ project submitted beats an A+ project that never gets done.",
      },
      id: {
        title: "Pemikiran semua atau tidak sama sekali",
        content:
          "Melihat hal-hal dalam hitam dan putih — 'Jika tidak bisa melakukannya dengan sempurna, untuk apa?' Kenyataannya abu-abu. Proyek bernilai B+ yang diserahkan mengalahkan proyek bernilai A+ yang tidak pernah selesai.",
      },
      ja: {
        title: "白黒思考",
        content:
          "物事を白か黒かで見る——「完璧にできないなら意味がない？」現実はグレーです。提出したB+のプロジェクトは、決して完成しないA+のプロジェクトより価値があります。",
      },
    },
  },
  {
    id: "local-cbt-8",
    category: "cbt",
    reading_time_minutes: 2,
    sort_order: 308,
    locales: {
      en: {
        title: "Catastrophizing",
        content:
          "Your brain jumps to the worst-case scenario. 'I made a mistake at work' becomes 'I'll get fired and lose everything.' Ask: what's the MOST LIKELY outcome? It's almost never the catastrophe.",
      },
      id: {
        title: "Berpikir bencana",
        content:
          "Otakmu langsung melompat ke skenario terburuk. 'Saya membuat kesalahan di tempat kerja' menjadi 'Saya akan dipecat dan kehilangan segalanya.' Tanyakan: apa hasil yang PALING MUNGKIN? Hampir tidak pernah bencana.",
      },
      ja: {
        title: "破局的思考",
        content:
          "脳は最悪のシナリオに飛びつきます。「仕事でミスをした」が「解雇されてすべてを失う」になります。問いかけましょう：最も可能性の高い結果は何か？それはほぼ決して惨事ではありません。",
      },
    },
  },
  {
    id: "local-cbt-9",
    category: "cbt",
    reading_time_minutes: 2,
    sort_order: 309,
    locales: {
      en: {
        title: "Mind reading",
        content:
          "Assuming you know what others think: 'They think I'm stupid.' You can't read minds. The thought feels like fact, but it's fiction. Check the evidence.",
      },
      id: {
        title: "Membaca pikiran",
        content:
          "Menganggap kamu tahu apa yang dipikirkan orang lain: 'Mereka pikir saya bodoh.' Kamu tidak bisa membaca pikiran. Pikiran itu terasa seperti fakta, tapi itu fiksi. Periksa buktinya.",
      },
      ja: {
        title: "読心術（マインドリーディング）",
        content:
          "他者の考えがわかると思い込む：「彼らは私が馬鹿だと思っている。」心は読めません。その思考は事実のように感じますが、フィクションです。証拠を確認しましょう。",
      },
    },
  },
  {
    id: "local-cbt-10",
    category: "cbt",
    reading_time_minutes: 2,
    sort_order: 310,
    locales: {
      en: {
        title: "Should statements",
        content:
          "'I should be more productive. I should exercise more.' Should creates guilt. Replace with 'I want to' or 'I choose to.' Feel the difference.",
      },
      id: {
        title: "Pernyataan 'seharusnya'",
        content:
          "'Saya seharusnya lebih produktif. Saya seharusnya lebih banyak berolahraga.' Kata 'seharusnya' menciptakan rasa bersalah. Ganti dengan 'Saya ingin' atau 'Saya memilih untuk.' Rasakan perbedaannya.",
      },
      ja: {
        title: "「〜すべき」という思考",
        content:
          "「もっと生産的にすべきだ。もっと運動すべきだ。」「すべき」は罪悪感を生みます。「〜したい」や「〜することを選ぶ」に置き換えましょう。違いを感じてください。",
      },
    },
  },

  // ── Motivation (4) ────────────────────────────────────────────────────────
  {
    id: "local-mot-5",
    category: "motivation",
    reading_time_minutes: 2,
    sort_order: 405,
    locales: {
      en: {
        title: "Motivation follows action",
        content:
          "Don't wait to feel motivated to start. Start, and motivation follows. This is called behavioral activation — the most counterintuitive truth about getting things done.",
      },
      id: {
        title: "Motivasi mengikuti tindakan",
        content:
          "Jangan tunggu merasa termotivasi untuk memulai. Mulailah, dan motivasi akan mengikuti. Ini disebut aktivasi perilaku — kebenaran paling tidak intuitif tentang menyelesaikan sesuatu.",
      },
      ja: {
        title: "行動が動機を生む",
        content:
          "やる気が出るまで待つ必要はありません。始めれば動機がついてきます。これを行動活性化と呼びます——物事を成し遂げることについての最も直感に反する真実です。",
      },
    },
  },
  {
    id: "local-mot-6",
    category: "motivation",
    reading_time_minutes: 2,
    sort_order: 406,
    locales: {
      en: {
        title: "The progress principle",
        content:
          "Small wins create momentum. Track every tiny completion. Harvard research shows that the #1 driver of motivation at work is making progress — even small progress.",
      },
      id: {
        title: "Prinsip kemajuan",
        content:
          "Kemenangan kecil menciptakan momentum. Catat setiap penyelesaian kecil. Penelitian Harvard menunjukkan bahwa pendorong motivasi #1 di tempat kerja adalah membuat kemajuan — bahkan kemajuan kecil.",
      },
      ja: {
        title: "進歩の原則",
        content:
          "小さな勝利がモメンタムを生みます。小さな完了を全て記録しましょう。ハーバードの研究によると、職場での動機の第1のドライバーは進歩すること——小さな進歩でもよいのです。",
      },
    },
  },
  {
    id: "local-mot-7",
    category: "motivation",
    reading_time_minutes: 2,
    sort_order: 407,
    locales: {
      en: {
        title: "Identity-based goals",
        content:
          "Instead of 'I want to run,' try 'I am someone who moves their body.' Goals change behavior temporarily. Identity changes it permanently.",
      },
      id: {
        title: "Tujuan berbasis identitas",
        content:
          "Alih-alih 'Saya ingin berlari,' coba 'Saya adalah seseorang yang menggerakkan tubuhnya.' Tujuan mengubah perilaku sementara. Identitas mengubahnya secara permanen.",
      },
      ja: {
        title: "アイデンティティベースの目標",
        content:
          "「走りたい」ではなく「私は体を動かす人間だ」と言ってみましょう。目標は行動を一時的に変えます。アイデンティティは永続的に変えます。",
      },
    },
  },
  {
    id: "local-mot-8",
    category: "motivation",
    reading_time_minutes: 2,
    sort_order: 408,
    locales: {
      en: {
        title: "Rest is not the enemy",
        content:
          "Burnout doesn't come from hard work — it comes from working without recovery. Rest is productive. Sleep is productive. Doing nothing is sometimes the most productive thing.",
      },
      id: {
        title: "Istirahat bukan musuh",
        content:
          "Burnout tidak datang dari kerja keras — melainkan dari bekerja tanpa pemulihan. Istirahat itu produktif. Tidur itu produktif. Tidak melakukan apa-apa terkadang adalah hal yang paling produktif.",
      },
      ja: {
        title: "休息は敵ではない",
        content:
          "燃え尽きは激しい仕事からではなく、回復なく働くことから来ます。休息は生産的です。睡眠は生産的です。何もしないことが最も生産的なこともあります。",
      },
    },
  },

  // ── Habits (4) ────────────────────────────────────────────────────────────
  {
    id: "local-hab-5",
    category: "habits",
    reading_time_minutes: 2,
    sort_order: 505,
    locales: {
      en: {
        title: "Habit stacking",
        content:
          "Attach new habits to existing ones. 'After I pour my morning coffee, I will write one intention.' The existing habit becomes the trigger for the new one.",
      },
      id: {
        title: "Menumpuk kebiasaan",
        content:
          "Tempelkan kebiasaan baru pada yang sudah ada. 'Setelah menuangkan kopi pagi, saya akan menulis satu niat.' Kebiasaan yang sudah ada menjadi pemicu untuk yang baru.",
      },
      ja: {
        title: "習慣のスタッキング",
        content:
          "新しい習慣を既存のものに紐付けましょう。「朝のコーヒーを注いだ後、一つの意図を書く。」既存の習慣が新しいものへのトリガーになります。",
      },
    },
  },
  {
    id: "local-hab-6",
    category: "habits",
    reading_time_minutes: 2,
    sort_order: 506,
    locales: {
      en: {
        title: "The 2-day rule",
        content:
          "Never skip a habit two days in a row. One day off is rest. Two days off is the start of a new habit — the habit of not doing it.",
      },
      id: {
        title: "Aturan 2 hari",
        content:
          "Jangan pernah melewatkan kebiasaan dua hari berturut-turut. Satu hari libur adalah istirahat. Dua hari libur adalah awal dari kebiasaan baru — kebiasaan untuk tidak melakukannya.",
      },
      ja: {
        title: "2日ルール",
        content:
          "習慣を2日連続でスキップしないでください。1日休むのは休息です。2日休むのは新しい習慣の始まり——それをしない習慣です。",
      },
    },
  },
  {
    id: "local-hab-7",
    category: "habits",
    reading_time_minutes: 2,
    sort_order: 507,
    locales: {
      en: {
        title: "Environment design",
        content:
          "Your environment shapes your behavior more than willpower. Want to read more? Put a book on your pillow. Want to stop scrolling? Charge your phone in another room.",
      },
      id: {
        title: "Desain lingkungan",
        content:
          "Lingkunganmu membentuk perilakumu lebih dari kemauan keras. Ingin lebih banyak membaca? Letakkan buku di bantalmu. Ingin berhenti scrolling? Charge ponselmu di ruangan lain.",
      },
      ja: {
        title: "環境設計",
        content:
          "環境は意志力よりもあなたの行動を形作ります。もっと読書したいですか？枕の上に本を置きましょう。スクロールをやめたいですか？別の部屋でスマホを充電しましょう。",
      },
    },
  },
  {
    id: "local-hab-8",
    category: "habits",
    reading_time_minutes: 2,
    sort_order: 508,
    locales: {
      en: {
        title: "The compound effect",
        content:
          "1% better every day = 37x better in a year. 1% worse every day = nearly zero. Tiny consistent improvements beat dramatic one-time efforts.",
      },
      id: {
        title: "Efek majemuk",
        content:
          "1% lebih baik setiap hari = 37x lebih baik dalam setahun. 1% lebih buruk setiap hari = hampir nol. Perbaikan kecil yang konsisten mengalahkan upaya dramatis satu kali.",
      },
      ja: {
        title: "複利効果",
        content:
          "毎日1%向上＝1年で37倍向上。毎日1%悪化＝ほぼゼロ。小さく一貫した改善は、劇的な一度きりの努力に勝ります。",
      },
    },
  },
];

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns all 22 local lessons resolved to the given locale.
 * Falls back to English for any missing locale content.
 */
export function getLocalLessons(lang: LanguageCode): LessonRow[] {
  return LOCAL_LESSON_DEFS.map((def) => {
    const locale = def.locales[lang] ?? def.locales.en;
    return {
      id: def.id,
      title: locale.title,
      content: locale.content,
      category: def.category,
      reading_time_minutes: def.reading_time_minutes,
      sort_order: def.sort_order,
      active: true,
      created_at: "2024-01-01T00:00:00Z",
    };
  });
}

/** All unique local lesson IDs — used to filter remote duplicates */
export const LOCAL_LESSON_IDS: Set<string> = new Set(
  LOCAL_LESSON_DEFS.map((d) => d.id),
);
