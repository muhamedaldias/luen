import { useRef, useState } from "react";
import { uploadImage } from "../lib/api";

export interface BlendParams {
  foregroundUrl: string;
  foregroundId: string | null;
  mode: string;
  scale: number;
  x: number;
  y: number;
  feather: number;
  colorMatch: boolean;
}

const MODES = [
  { v: "seamless_normal", label: "Seamless — طبيعي (Poisson)", hint: "أدق إدخال لجسم بنفس الإضاءة — الأفضل للمنتجات" },
  { v: "seamless_mixed", label: "Seamless — نسيج مختلط", hint: "يحافظ على نسيج الخلفية — الأفضل للأسطح (خشب/قماش)" },
  { v: "seamless_mono", label: "Seamless — أحادي + نقل إضاءة", hint: "الأفضل عند اختلاف الإضاءة بين الصورتين" },
  { v: "pyramid", label: "هرم لابلاس متعدد النطاقات", hint: "الأفضل للبانوراما والتداخلات الواسعة بلا خط فاصل" },
  { v: "feather", label: "ريشة ناعمة + مطابقة لون", hint: "الأسرع — تركيب شعار/عنصر بحواف ناعمة" },
];

export default function BlendDialog({ busy = false, hasBackend = false, onClose, onConfirm }: { busy?: boolean; hasBackend?: boolean; onClose: () => void; onConfirm: (p: BlendParams) => void }) {
  const [fgUrl, setFgUrl] = useState<string | null>(null);
  const [fgId, setFgId] = useState<string | null>(null);
  const [fgName, setFgName] = useState("");
  const [mode, setMode] = useState("seamless_normal");
  const [scale, setScale] = useState(40);
  const [x, setX] = useState(50);
  const [y, setY] = useState(50);
  const [feather, setFeather] = useState(12);
  const [colorMatch, setColorMatch] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setFgName(file.name);
    const reader = new FileReader();
    reader.onload = () => setFgUrl(reader.result as string);
    reader.readAsDataURL(file);
    if (hasBackend) {
      setUploading(true);
      try {
        const up = await uploadImage(file);
        setFgId(up.image_id);
      } catch {
        setFgId(null);
      } finally {
        setUploading(false);
      }
    }
  }

  const canGo = !!fgUrl && !uploading && !busy;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 440, maxWidth: "100%", maxHeight: "90vh", overflow: "auto", borderRadius: 12, padding: 18, background: "var(--card)", border: "1px solid var(--border)", boxShadow: "0 16px 48px rgba(0,0,0,0.6)" }}>
        <h3 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 700, color: "var(--foreground)" }}>دمج صورتين — خوارزميات OpenCV عالية الجودة</h3>
        <p style={{ margin: "0 0 12px", fontSize: 11, color: "var(--muted-foreground)", lineHeight: 1.7 }}>
          الصورة الحالية هي الخلفية. اختر الصورة الأمامية ثم الخوارزمية الأنسب — كلها تعمل بدقة float32 وتحافظ على الشفافية.
        </p>
        <button onClick={() => fileRef.current?.click()} style={{ width: "100%", minHeight: 74, borderRadius: 8, cursor: "pointer", background: "var(--secondary)", color: "var(--foreground)", border: "1px dashed var(--border)", fontSize: 12, padding: 10 }}>
          {fgUrl ? (
            <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <img src={fgUrl} alt="fg" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 6 }} />
              <span style={{ textAlign: "left" }}>{fgName || "foreground"} {uploading ? "— uploading…" : fgId ? "— ready (backend)" : "— ready (local)"}<br /><span style={{ color: "var(--muted-foreground)", fontSize: 11 }}>اضغط لتغيير الصورة</span></span>
            </span>
          ) : ("اختر الصورة الأمامية (PNG/JPG)")}
        </button>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
        <p style={{ margin: "12px 0 6px", fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)" }}>الخوارزمية</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {MODES.map((m) => (
            <label key={m.v} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "8px 10px", borderRadius: 8, cursor: "pointer", background: mode === m.v ? "rgba(201,123,74,0.12)" : "var(--secondary)", border: mode === m.v ? "1px solid var(--accent)" : "1px solid var(--border)" }}>
              <input type="radio" checked={mode === m.v} onChange={() => setMode(m.v)} style={{ marginTop: 2, accentColor: "var(--accent)" }} />
              <span><span style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--foreground)" }}>{m.label}</span><span style={{ display: "block", fontSize: 11, color: "var(--muted-foreground)" }}>{m.hint}</span></span>
            </label>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
          <Slider label={`حجم الأمامية ${scale}%`} value={scale} min={5} max={100} onChange={setScale} />
          <Slider label={`تنعيم الحواف ${feather}px`} value={feather} min={0} max={60} onChange={setFeather} />
          <Slider label={`موضع X ${x}%`} value={x} min={0} max={100} onChange={setX} />
          <Slider label={`موضع Y ${y}%`} value={y} min={0} max={100} onChange={setY} />
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontSize: 12, color: "var(--foreground)", cursor: "pointer" }}>
          <input type="checkbox" checked={colorMatch} onChange={(e) => setColorMatch(e.target.checked)} style={{ accentColor: "var(--accent)" }} />
          مطابقة لون تلقائية (Reinhard LAB) قبل الدمج — موصى به دائماً
        </label>
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button onClick={onClose} style={{ flex: 1, height: 34, borderRadius: 6, fontSize: 12, cursor: "pointer", background: "transparent", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}>إلغاء</button>
          <button disabled={!canGo} onClick={() => fgUrl && onConfirm({ foregroundUrl: fgUrl, foregroundId: fgId, mode, scale, x, y, feather, colorMatch })} style={{ flex: 2, height: 34, borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: canGo ? "pointer" : "not-allowed", background: "var(--primary)", color: "var(--primary-foreground)", border: "none", opacity: canGo ? 1 : 0.5 }}>
            {busy || uploading ? "جارٍ الدمج…" : "دمج الصورتين"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Slider({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <label style={{ display: "block", fontSize: 11, color: "var(--muted-foreground)" }}>
      {label}
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} style={{ width: "100%", accentColor: "var(--accent)" }} />
    </label>
  );
}
