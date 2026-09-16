import { resolveUrl } from "./api";

/** هل الرابط يحتاج CORS؟ data:/blob: نظيفة دائماً ولا تحتاج crossOrigin. */
export function needsCors(src: string): boolean {
  if (!src) return false;
  if (src.startsWith("data:") || src.startsWith("blob:")) return false;
  return /^https?:\/\//i.test(src);
}

/** تحميل صورة دون تلوّث الكانفس: لا نضبط crossOrigin إلا للروابط البعيدة فعلاً. */
export function loadCleanImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (needsCors(src)) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image load failed (CORS or decode)"));
    img.src = src;
  });
}

/** تحويل أي رابط (نسبي/مطلق/data) إلى dataURL — يضمن كانفس نظيفاً تماماً.
 *  يُستخدم بعد عمليات الباكند: النتيجة تُجلب عبر نفس الـorigin (proxy) ثم تُخزّن
 *  كـ dataURL فلا يعود هناك أي taint أبداً عند الحفظ/التصدير. */
export async function toCleanDataUrl(url: string): Promise<string> {
  if (!url) throw new Error("empty url");
  if (url.startsWith("data:")) return url;
  const absolute = /^https?:\/\//i.test(url) ? url : resolveUrl(url);
  // same-origin (عبر Vite proxy) — لا مشكلة CORS. cross-origin — نحاول CORS أولاً.
  const res = await fetch(absolute, { mode: "cors", credentials: "omit" });
  if (!res.ok) throw new Error(`fetch image failed: ${res.status}`);
  const blob = await res.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("blob to dataURL failed"));
    reader.readAsDataURL(blob);
  });
}

/** نفس السابقة لكن لا ترمي: عند الفشل تعيد الرابط الأصلي (لعدم كسر التدفق). */
export async function toCleanDataUrlBestEffort(url: string): Promise<string> {
  try {
    return await toCleanDataUrl(url);
  } catch {
    return url;
  }
}
