// اختبار وحدات لأدوات تنقية قناع الألفا (TDD — يُنفَّذ عبر esbuild + node)
import {
  keepMajorMaskComponents,
  keepAnchorMaskComponents,
  sharpenAlpha,
  erodeAlpha,
  featherAlpha,
  maskSoftnessRatio,
} from "../src/lib/maskRefine.ts";

let failed = 0;
function eq(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) { failed++; console.log(`✗ ${name}\n   متوقع: ${JSON.stringify(expected)}\n   فعلي:  ${JSON.stringify(actual)}`); }
  else console.log(`✓ ${name}`);
}
function truthy(name, cond, detail = "") {
  if (!cond) { failed++; console.log(`✗ ${name} ${detail}`); } else console.log(`✓ ${name}`);
}

// ── 1) منحنى الثقة smoothstep (نطاق واسع 15%–85%) ──
eq("sharpen(0)=0", sharpenAlpha(0), 0);
eq("sharpen(255)=255", sharpenAlpha(255), 255);
truthy("sharpen(30)≈0 (تحت العتبة السفلى)", sharpenAlpha(30) <= 2, `=${sharpenAlpha(30)}`);
truthy("sharpen(225)≈255 (فوق العتبة العليا)", sharpenAlpha(225) >= 253, `=${sharpenAlpha(225)}`);
truthy("sharpen يقي الزجاج شبه الشفاف (128 يبقى وسطيًا)", sharpenAlpha(128) > 100 && sharpenAlpha(128) < 160,
  `=${sharpenAlpha(128)}`);
truthy("sharpen رتيبة تصاعدية", sharpenAlpha(100) < sharpenAlpha(128) && sharpenAlpha(128) < sharpenAlpha(160));

// ── 1ب) قياس نعومة القناع ──
{
  const m = new Uint8ClampedArray(100);
  m.fill(255); // معتم كليًا = صفر نعومة
  truthy("softness(معتم)=0", maskSoftnessRatio(m, 100) === 0);
  m.fill(128, 0, 50); // نصف البكسلات وسطية
  truthy("softness(نصف وسطي)=0.5", Math.abs(maskSoftnessRatio(m, 100) - 0.5) < 0.01);
}

// ── 2) استبقاء المكوّنات الكبيرة ──
{
  const w = 100, h = 100;
  const m = new Uint8ClampedArray(w * h);
  const blob = (cx, cy, bw, bh, v) => {
    for (let y = cy; y < cy + bh; y++) for (let x = cx; x < cx + bw; x++) m[y * w + x] = v;
  };
  blob(30, 30, 30, 30, 255);   // الموضوع: 900px
  blob(2, 2, 5, 8, 220);        // بقعة شاردة: 40px (< 8% من 900 = 72) → تُحذف
  blob(70, 70, 12, 12, 180);    // جزء ثانٍ مشروع: 144px (≥ 72) → يُبقى
  keepMajorMaskComponents(m, w, h);
  eq("الموضوع الرئيسي باقٍ", m[45 * w + 45], 255);
  eq("البقعة الشاردة حُذفت", m[5 * w + 4], 0);
  eq("الجزء الثانوي المشروع باقٍ", m[75 * w + 75], 180);
}
{
  // مكوّن واحد فقط: لا تغيير
  const w = 50, h = 50;
  const m = new Uint8ClampedArray(w * h);
  for (let y = 10; y < 40; y++) for (let x = 10; x < 40; x++) m[y * w + x] = 255;
  keepMajorMaskComponents(m, w, h);
  eq("مكوّن واحد يبقى كما هو", m[20 * w + 20], 255);
}
{
  // الانعكاس الملاصق للحافة: مستطيل أيسر كبير نسبيًا لكنه داخل شريط 16%
  const w = 200, h = 120;
  const m = new Uint8ClampedArray(w * h);
  for (let y = 30, y1 = 95; y < y1; y++) for (let x = 70; x < 130; x++) m[y * w + x] = 255; // الموضوع
  for (let y = 20, y1 = 90; y < y1; y++) for (let x = 0; x < 20; x++) m[y * w + x] = 200;  // انعكاس يلامس الإطار الأيسر
  keepMajorMaskComponents(m, w, h);
  truthy("الموضوع المركزي باقٍ", m[60 * w + 100] === 255);
  truthy("الانعكاس الملاصق للحافة (مماس للإطار) حُذف", m[50 * w + 10] === 0, `=${m[50 * w + 10]}`);
}
{
  // جزء مشروع صغير في منتصف الصورة: يبقى (ليس ملاصقًا للحافة)
  const w = 200, h = 120;
  const m = new Uint8ClampedArray(w * h);
  for (let y = 30, y1 = 95; y < y1; y++) for (let x = 70; x < 130; x++) m[y * w + x] = 255;
  for (let y = 60, y1 = 80; y < y1; y++) for (let x = 90; x < 110; x++) m[y * w + x] = 200;
  keepMajorMaskComponents(m, w, h);
  truthy("الجزء الوسطي الصغير يُبقى", m[70 * w + 100] === 200);
}
{
  // الإرساء بالنقرة: الموضوع (نقره المستخدم) + انعكاس حافة ضخم (60% من الأكبر) يُحذف
  const w = 200, h = 120;
  const m = new Uint8ClampedArray(w * h);
  for (let y = 30, y1 = 95; y < y1; y++) for (let x = 70; x < 130; x++) m[y * w + x] = 255; // الموضوع
  for (let y = 10, y1 = 100; y < y1; y++) for (let x = 0; x < 14; x++) m[y * w + x] = 220; // انعكاس ضخم يلامس الإطار
  keepAnchorMaskComponents(m, w, h, 100, 60); // نقرة داخل الموضوع
  truthy("إرساء: الموضوع المُنقر باقٍ", m[60 * w + 100] === 255);
  truthy("إرساء: الانعكاس الضخم الملاصق حُذف", m[50 * w + 6] === 0, `=${m[50 * w + 6]}`);
}
{
  // الإرساء: مكوّن ثانٍ مشروع غير ملاصق بالحافة وبكبر كافٍ يبقى
  const w = 200, h = 120;
  const m = new Uint8ClampedArray(w * h);
  for (let y = 30, y1 = 95; y < y1; y++) for (let x = 70; x < 130; x++) m[y * w + x] = 255; // الموضوع
  for (let y = 45, y1 = 90; y < y1; y++) for (let x = 140, x1 = 170; x < x1; x++) m[y * w + x] = 220; // قرين وسطي 1350px (34.6%)
  keepAnchorMaskComponents(m, w, h, 100, 60);
  truthy("إرساء: القرين الوسطي الموثوق باقٍ", m[70 * w + 155] === 220, `=${m[70 * w + 155]}`);
}

// ── 3) التآكل (min filter منفصل) ──
{
  const w = 9, h = 9;
  const a = new Uint8ClampedArray(w * h);
  for (let y = 2; y < 7; y++) for (let x = 2; x < 7; x++) a[y * w + x] = 255; // مربع 5×5
  erodeAlpha(a, w, h, 1);
  eq("تآكل 1px: مركز المربع باقٍ", a[4 * w + 4], 255);
  eq("تآكل 1px: حافة المربع تذوب", a[2 * w + 2], 0);
  eq("تآكل 1px: الزوايا الخارجية صفر", a[0], 0);
  // خط بسماكة 1px يتلاشى كليًا بتآكل 1
  const b = new Uint8ClampedArray(w * h);
  for (let x = 1; x < 8; x++) b[4 * w + x] = 255;
  erodeAlpha(b, w, h, 1);
  truthy("خط 1px يتلاشى تحت التآكل", b[4 * w + 4] === 0);
}

// ── 4) الريشة (تمويه منفصل) ──
{
  const w = 16, h = 4;
  const a = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < 8; x++) a[y * w + x] = 255; // نصف أيسر معتم
  featherAlpha(a, w, h, 1);
  truthy("الريشة: بعيد عن الحد يبقى معتمًا", a[1 * w + 2] === 255);
  truthy("الريشة: بعيد عن الحد يبقى شفافًا", a[1 * w + 13] === 0);
  const at = (x) => a[1 * w + x];
  truthy("الريشة: انتقال متدرج عبر الحد", at(6) > at(7) && at(7) > 0 && at(8) < 255 && at(7) > at(9),
    `(${at(6)},${at(7)},${at(8)},${at(9)})`);
}

// ── 5) تكامل: بقعة شاردة + هالة على قناع واقعي ──
{
  const w = 60, h = 60;
  const m = new Uint8ClampedArray(w * h);
  for (let y = 10; y < 50; y++) for (let x = 15; x < 45; x++) m[y * w + x] = 255; // موضوع
  for (let y = 3; y < 9; y++) for (let x = 3; x < 10; x++) m[y * w + x] = 200;   // شاذد
  keepMajorMaskComponents(m, w, h);
  erodeAlpha(m, w, h, 1);
  featherAlpha(m, w, h, 1);
  truthy("تكامل: الشاذد اختفى", m[5 * w + 5] === 0);
  truthy("تكامل: قلب الموضوع معتم", m[30 * w + 30] === 255);
  truthy("تكامل: حافة الموضوع أصبحت ناعمة (هالة أقل)", m[10 * w + 30] < 255 && m[10 * w + 30] > 0,
    `=${m[10 * w + 30]}`);
}

console.log(failed === 0 ? "\nALL TESTS PASSED" : `\n${failed} TEST(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);
