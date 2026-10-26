import { LANGUAGE_OPTIONS, type LanguageCode } from "@/lib/translations";

export const WEB_AUTH_ARABIC = "ar" as const;

export type WebAuthLanguage = LanguageCode | typeof WEB_AUTH_ARABIC;

export const WEB_ARABIC_OPTION = {
  code: WEB_AUTH_ARABIC,
  label: "العربية",
} as const;

export function webAuthLanguageOptions(native: boolean) {
  if (native) return LANGUAGE_OPTIONS;
  return [...LANGUAGE_OPTIONS, WEB_ARABIC_OPTION];
}

export function isWebAuthLanguage(value: unknown): value is WebAuthLanguage {
  return (
    value === "en" ||
    value === "id" ||
    value === "ja" ||
    value === WEB_AUTH_ARABIC
  );
}

export const AUTH_ARABIC_COPY: Record<string, string> = {
  "auth.language.label": "اختر لغتك",
  "auth.language.ariaLabel": "اختر اللغة",
  "auth.tagline": "رفيقك الهادئ.",
  "auth.google.redirecting": "جارٍ التحويل…",
  "auth.google.cta": "المتابعة بالحساب",
  "auth.google.failed": "تعذر تسجيل الدخول عبر Google",
  "auth.divider": "أو المتابعة بالبريد",
  "auth.tab.signin": "تسجيل الدخول",
  "auth.tab.signup": "إنشاء حساب",
  "auth.label.email": "البريد الإلكتروني",
  "auth.label.password": "كلمة المرور",
  "auth.placeholder.email": "you@example.com",
  "auth.signin.loading": "جارٍ تسجيل الدخول…",
  "auth.signin.submit": "تسجيل الدخول",
  "auth.signin.error": "تعذر تسجيل الدخول",
  "auth.signup.loading": "جارٍ إنشاء الحساب…",
  "auth.signup.submit": "إنشاء حساب",
  "auth.signup.error": "تعذر إنشاء الحساب",
  "auth.signup.success.title": "تم إنشاء الحساب",
  "auth.signup.success.desc": "مرحبًا. سجّل الدخول بحسابك الجديد.",
  "auth.signup.age": "أؤكد أن عمري 16 سنة أو أكثر",
  "auth.signup.terms.prefix": "بالتسجيل، أنت توافق على",
  "auth.signup.terms.and": "و",
  "auth.signup.terms.privacy": "سياسة الخصوصية",
  "auth.signup.terms.terms": "شروط الخدمة",
  "auth.reset.forgot": "نسيت كلمة المرور؟",
  "auth.reset.request.loading": "جارٍ إرسال رابط إعادة التعيين…",
  "auth.reset.emailRequired.title": "أدخل بريدك الإلكتروني",
  "auth.reset.emailRequired.desc": "أدخل بريد الحساب قبل طلب رابط إعادة التعيين.",
  "auth.reset.request.error": "تعذر إعادة تعيين كلمة المرور",
  "auth.reset.request.success.title": "تحقق من بريدك",
  "auth.reset.request.success.desc": "افتح رابط إعادة تعيين كلمة المرور على هذا الجهاز.",
};

export function webAuthText(
  lang: WebAuthLanguage,
  key: string,
  fallback: (key: string) => string,
): string {
  if (lang === WEB_AUTH_ARABIC) {
    return AUTH_ARABIC_COPY[key] ?? fallback(key);
  }
  return fallback(key);
}
