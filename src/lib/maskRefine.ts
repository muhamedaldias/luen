/* ── تنقية قناع ألفا: دوال نقية بلا DOM (قابلة للاختبار المباشر) ──
 * تستخدمها إزالة الخلفية (العصبية والكلاسيكية) لمعالجة عيوب القناع الخام:
 * البقع الشاردة، الهالة الملونة حول الحواف، والانتقالات غير المؤكدة. */

/** وسم المكوّنات المتصلة (8-اتصال): مساحات وصناديق إحاطة لكل مكوّن. */
type ComponentMap = {
  count: number;
  labels: Int32Array;
  areas: number[];
  bx0: number[];
  bx1: number[];
  by0: number[];
  by1: number[];
};

function labelMaskComponents(mask: Uint8ClampedArray, w: number, h: number): ComponentMap {
  const n = w * h;
  const bin = new Uint8Array(n);
  for (let i = 0; i < n; i++) bin[i] = mask[i] > 127 ? 1 : 0;
  const labels = new Int32Array(n);
  const stack = new Int32Array(n);
  const areas: number[] = [];
  const bx0: number[] = [];
  const bx1: number[] = [];
  const by0: number[] = [];
  const by1: number[] = [];
  let comp = 0;
  for (let seed = 0; seed < n; seed++) {
    if (!bin[seed] || labels[seed]) continue;
    comp++;
    let sp = 0;
    let area = 0;
    stack[sp++] = seed;
    labels[seed] = comp;
    let x0 = seed % w, x1 = x0, y0 = (seed / w) | 0, y1 = y0;
    while (sp > 0) {
      const p = stack[--sp];
      area++;
      const px = p % w;
      const py = (p / w) | 0;
      if (px < x0) x0 = px;
      if (px > x1) x1 = px;
      if (py < y0) y0 = py;
      if (py > y1) y1 = py;
      for (let dy = -1; dy <= 1; dy++) {
        const y = py + dy;
        if (y < 0 || y >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const x = px + dx;
          if (x < 0 || x >= w || (!dx && !dy)) continue;
          const q = y * w + x;
          if (bin[q] && !labels[q]) {
            labels[q] = comp;
            stack[sp++] = q;
          }
        }
      }
    }
    areas[comp] = area;
    bx0[comp] = x0; bx1[comp] = x1; by0[comp] = y0; by1[comp] = y1;
  }
  return { count: comp, labels, areas, bx0, bx1, by0, by1 };
}

/** «ملاصق للحافة»: صندوقه كله داخل شريط خارجي ضحل (16% دخولًا، 30% عمقًا)
 * ويتماسك مع إطار الصورة — نمط بقايا قُصّت عند الحدود، لا جزء منفصل بمساحة حرة. */
function isEdgeHugging(c: ComponentMap, id: number, w: number, h: number): boolean {
  const inBand =
    (c.bx0[id] <= 0.16 * w && c.bx1[id] <= 0.3 * w) ||
    (c.bx0[id] >= 0.7 * w && c.bx1[id] >= 0.84 * w) ||
    (c.by0[id] <= 0.16 * h && c.by1[id] <= 0.3 * h) ||
    (c.by0[id] >= 0.7 * h && c.by1[id] >= 0.84 * h);
  const touchesFrame =
    c.bx0[id] === 0 || c.by0[id] === 0 || c.bx1[id] === w - 1 || c.by1[id] === h - 1;
  return inBand && touchesFrame;
}

function dropComponent(mask: Uint8ClampedArray, c: ComponentMap, id: number): void {
  for (let i = 0; i < mask.length; i++) if (c.labels[i] === id) mask[i] = 0;
}

/** يُبقي المكوّنات المتصلة الموثوقة ويصفّر المشبوهة (8-اتصال). قاعدتا الحذف:
 * 1) أي مكوّن أصغر من 8% من أكبر مكوّن.
 * 2) «الملاصق للحافة»: مكوّن يبدأ داخل شريط 16% الخارجي ولا يمتد عمقًا
 *    (حد 30%) ومساحته أقل من 45% من الأكبر — نمط بقايا الانعكاسات
 *    والإضاءة المنفصلة؛ الموضوع الحقيقي المقصوص عند الإطار يمتد أعمق من 30%.
 * تعدّل المصفوفة في مكانها. */
export function keepMajorMaskComponents(
  mask: Uint8ClampedArray,
  w: number,
  h: number,
  minRatioOfLargest = 0.08,
): void {
  const c = labelMaskComponents(mask, w, h);
  if (c.count <= 1) return;
  let largest = 0;
  for (let id = 1; id <= c.count; id++) if (c.areas[id] > largest) largest = c.areas[id];
  const min = largest * minRatioOfLargest;
  for (let id = 1; id <= c.count; id++) {
    if (c.areas[id] < min || (isEdgeHugging(c, id, w, h) && c.areas[id] < largest * 0.45)) {
      dropComponent(mask, c, id);
    }
  }
}

/** تصفية موثوقة بالنقرة: المستخدم نقر موضوعًا — يُبقى مكوّنه دائمًا، ومعه
 * المكوّنات غير الملاصقة للحافة التي تبلغ 30% من أكبر مكوّن فأكثر.
 * (ax, ay) إحداثيات النقرة بمساحة القناع نفسها. */
export function keepAnchorMaskComponents(
  mask: Uint8ClampedArray,
  w: number,
  h: number,
  ax: number,
  ay: number,
  minRatioOfLargest = 0.3,
): void {
  const c = labelMaskComponents(mask, w, h);
  if (c.count <= 1) return;
  const cx = Math.min(w - 1, Math.max(0, Math.round(ax)));
  const cy = Math.min(h - 1, Math.max(0, Math.round(ay)));
  const anchorId = c.labels[cy * w + cx];
  let largest = 0;
  for (let id = 1; id <= c.count; id++) if (c.areas[id] > largest) largest = c.areas[id];
  const min = largest * minRatioOfLargest;
  for (let id = 1; id <= c.count; id++) {
    if (id === anchorId) continue;
    const trusted = c.areas[id] >= min && !isEdgeHugging(c, id, w, h);
    if (!trusted) dropComponent(mask, c, id);
  }
}

/** نسبة بكسلات القناع «غير المؤكدة» (بين 64 و191) — قياس نعومة الموضوع.
 * الزجاج المصنفر والشفاف يعطيان نسبة عالية؛ الموضوع المعتم نسبة منخفضة. */
export function maskSoftnessRatio(mask: Uint8ClampedArray, n: number): number {
  let mid = 0;
  for (let i = 0; i < n; i++) if (mask[i] > 64 && mask[i] < 192) mid++;
  return mid / Math.max(1, n);
}

/** منحنى ثقة smoothstep بنطاق واسع (15%–85%): يكتم الهالات الخافتة دون
 * أكل الموضوعات شبه الشفافة (زجاج، أقمشة) التي تسكن منتصف النطاق. */
export function sharpenAlpha(a: number): number {
  let t = (a / 255 - 0.15) / 0.7;
  if (t <= 0) return 0;
  if (t >= 1) return 255;
  return Math.round(t * t * (3 - 2 * t) * 255);
}

/** تآكل منفصل (min filter بنافذة (2r+1)²) — يبتلع 1-3px من حافة الخلفية
 * فيختفي الهalo الملون العالق على حدود الموضوع. */
export function erodeAlpha(
  alpha: Uint8ClampedArray,
  w: number,
  h: number,
  r: number,
): void {
  if (r <= 0) return;
  const tmp = new Uint8ClampedArray(alpha.length);
  // مرور أفقي
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let m = 255;
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(w - 1, x + r);
      for (let k = x0; k <= x1; k++) {
        const v = alpha[row + k];
        if (v < m) m = v;
      }
      tmp[row + x] = m;
    }
  }
  // مرور رأسي
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let m = 255;
      const y0 = Math.max(0, y - r);
      const y1 = Math.min(h - 1, y + r);
      for (let k = y0; k <= y1; k++) {
        const v = tmp[k * w + x];
        if (v < m) m = v;
      }
      alpha[y * w + x] = m;
    }
  }
}

/** ريشة ناعمة: مرورّا صندوق منفصلان (تقريب غاوسي) — يعيد للحدود انتقالًا طبيعيًا
 * بعد التآكل بدل حد قاطع مسنن. */
export function featherAlpha(
  alpha: Uint8ClampedArray,
  w: number,
  h: number,
  r: number,
): void {
  if (r <= 0) return;
  const tmp = new Uint8ClampedArray(alpha.length);
  const boxBlur = (src: Uint8ClampedArray, dst: Uint8ClampedArray, horizontal: boolean) => {
    const span = 2 * r + 1;
    if (horizontal) {
      for (let y = 0; y < h; y++) {
        const row = y * w;
        let sum = 0;
        for (let k = -r; k <= r; k++) sum += src[row + Math.min(w - 1, Math.max(0, k))];
        for (let x = 0; x < w; x++) {
          dst[row + x] = Math.round(sum / span);
          const add = src[row + Math.min(w - 1, x + r + 1)];
          const sub = src[row + Math.max(0, x - r)];
          sum += add - sub;
        }
      }
    } else {
      for (let x = 0; x < w; x++) {
        let sum = 0;
        for (let k = -r; k <= r; k++) sum += src[Math.min(h - 1, Math.max(0, k)) * w + x];
        for (let y = 0; y < h; y++) {
          dst[y * w + x] = Math.round(sum / span);
          const add = src[Math.min(h - 1, y + r + 1) * w + x];
          const sub = src[Math.max(0, y - r) * w + x];
          sum += add - sub;
        }
      }
    }
  };
  boxBlur(alpha, tmp, true);
  boxBlur(tmp, alpha, false);
  boxBlur(alpha, tmp, true);
  boxBlur(tmp, alpha, false);
}

/** أنصاف أقطار التنقية بحسب حجم الصورة: صور صغيرة لمسة خفيفة، كبيرة أقوى. */
export function refineRadii(minSide: number): { erode: number; feather: number } {
  return {
    erode: Math.min(3, Math.max(1, Math.round(minSide / 400))),
    feather: Math.min(4, Math.max(1, Math.round(minSide / 300))),
  };
}
