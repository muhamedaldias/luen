import { resolveUrl } from "./api";

/** Does the URL need CORS? data:/blob: are always clean and never need crossOrigin. */
export function needsCors(src: string): boolean {
  if (!src) return false;
  if (src.startsWith("data:") || src.startsWith("blob:")) return false;
  return /^https?:\/\//i.test(src);
}

/** Load an image without tainting the canvas: crossOrigin is set only for genuinely remote URLs. */
export function loadCleanImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (needsCors(src)) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image load failed (CORS or decode)"));
    img.src = src;
  });
}

/** Convert any URL (relative/absolute/data) into a dataURL — guarantees a fully clean canvas.
 *  Used after backend operations: the result is fetched through the same origin (proxy) and then stored
 *  as a dataURL, so no taint can ever remain at save/export time. */
export async function toCleanDataUrl(url: string): Promise<string> {
  if (!url) throw new Error("empty url");
  if (url.startsWith("data:")) return url;
  const absolute = /^https?:\/\//i.test(url) ? url : resolveUrl(url);
  // same-origin (through the Vite proxy) — no CORS problem. cross-origin — try CORS first.
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

/** Same as above but never throws: on failure it returns the original URL so the flow is not broken. */
export async function toCleanDataUrlBestEffort(url: string): Promise<string> {
  try {
    return await toCleanDataUrl(url);
  } catch {
    return url;
  }
}
