// مكتبة الأصول المدمجة: خلفيات منتجات وصور منتجات بخلفية شفافة — كلها
// مرسومة برمجياً كـ SVG (بلا ملفات خارجية، ترخيص حر، جودة عند أي تكبير).

export type AssetKind = "background" | "product";

export interface AssetDef {
  id: string;
  name: string;
  category: string;
  kind: AssetKind;
  w: number;
  h: number;
  svg: string;
}

/** مولد أرقام شبه عشوائي مثبّت البذرة — يضمن ثبات الأنماط بين الجلسات. */
function rng(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

function wrap(w: number, h: number, body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
}

export function assetDataUrl(asset: AssetDef): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(asset.svg)}`;
}

/* ── الخلفيات (800×600) ─────────────────────────────────────────── */

function studioBg(id: string, name: string, c1: string, c2: string, c3: string): AssetDef {
  const svg = wrap(800, 600,
    `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="0.6" stop-color="${c2}"/><stop offset="1" stop-color="${c3}"/></linearGradient>` +
    `<radialGradient id="v" cx="0.5" cy="0.42" r="0.8"><stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.15"/></radialGradient></defs>` +
    `<rect width="800" height="600" fill="url(#g)"/><ellipse cx="400" cy="520" rx="340" ry="58" fill="#000" opacity="0.06"/><rect width="800" height="600" fill="url(#v)"/>`);
  return { id, name, category: "Studio", kind: "background", w: 800, h: 600, svg };
}

function podiumBg(id: string, name: string, c1: string, c2: string, pc: string, pt: string, arch: boolean): AssetDef {
  const shape = arch
    ? `<path d="M235 600 V330 a165 165 0 0 1 330 0 V600 Z" fill="${pc}"/><ellipse cx="400" cy="560" rx="150" ry="20" fill="#000" opacity="0.10"/><rect x="320" y="470" width="160" height="90" fill="${pt}"/><ellipse cx="400" cy="470" rx="80" ry="15" fill="#fff" opacity="0.18"/>`
    : `<rect x="312" y="335" width="176" height="168" fill="${pc}"/><rect x="312" y="335" width="176" height="14" fill="#fff" opacity="0.10"/><ellipse cx="400" cy="335" rx="88" ry="18" fill="${pt}"/><ellipse cx="400" cy="512" rx="130" ry="18" fill="#000" opacity="0.13"/>`;
  const svg = wrap(800, 600,
    `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>` +
    `<rect width="800" height="600" fill="url(#g)"/>${shape}`);
  return { id, name, category: "Podium", kind: "background", w: 800, h: 600, svg };
}

function marbleBg(id: string, name: string, base: string, vein: string, light: string): AssetDef {
  const veins =
    `<path d="M-20 90 C 180 60, 260 190, 470 150 S 760 60, 830 130" stroke="${vein}" stroke-width="2.5" fill="none" opacity="0.30"/>` +
    `<path d="M-20 250 C 150 220, 330 330, 520 280 S 780 200, 830 300" stroke="${vein}" stroke-width="1.8" fill="none" opacity="0.22"/>` +
    `<path d="M-20 420 C 200 380, 300 500, 560 450 S 790 380, 830 460" stroke="${vein}" stroke-width="3" fill="none" opacity="0.26"/>` +
    `<path d="M60 -20 C 90 160, 30 320, 120 620" stroke="${vein}" stroke-width="1.4" fill="none" opacity="0.16"/>` +
    `<path d="M640 -20 C 610 180, 700 340, 620 620" stroke="${vein}" stroke-width="2" fill="none" opacity="0.18"/>` +
    `<path d="M-20 540 C 240 500, 480 570, 830 520" stroke="${vein}" stroke-width="1.2" fill="none" opacity="0.14"/>`;
  const svg = wrap(800, 600,
    `<defs><linearGradient id="sh" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${light}" stop-opacity="0.5"/><stop offset="1" stop-color="${light}" stop-opacity="0"/></linearGradient></defs>` +
    `<rect width="800" height="600" fill="${base}"/>${veins}<rect width="800" height="600" fill="url(#sh)"/>`);
  return { id, name, category: "Marble", kind: "background", w: 800, h: 600, svg };
}

function woodBg(id: string, name: string, base: string, dark: string, grain: string): AssetDef {
  const rand = rng(id.length * 977 + 31);
  let planks = "";
  for (let i = 0; i < 5; i++) {
    const y = i * 120;
    planks += `<rect x="0" y="${y}" width="800" height="120" fill="${base}"/><rect x="0" y="${y}" width="800" height="120" fill="${dark}" opacity="${(0.04 + i * 0.02).toFixed(2)}"/><rect x="0" y="${y + 118}" width="800" height="3" fill="${dark}" opacity="0.35"/>`;
  }
  let lines = "";
  for (let i = 0; i < 14; i++) {
    const y = Math.round(rand() * 590) + 5;
    lines += `<path d="M0 ${y} q 100 ${(rand() * 14 - 7).toFixed(1)}, 200 0 t 200 0 t 200 0 t 200 0" stroke="${grain}" stroke-width="1" fill="none" opacity="${(0.10 + rand() * 0.12).toFixed(2)}"/>`;
  }
  let knots = "";
  for (let i = 0; i < 3; i++) {
    const x = Math.round(80 + rand() * 640), y = Math.round(40 + rand() * 520);
    knots += `<ellipse cx="${x}" cy="${y}" rx="${(10 + rand() * 8).toFixed(0)}" ry="${(5 + rand() * 4).toFixed(0)}" fill="none" stroke="${grain}" stroke-width="1.6" opacity="0.3"/>`;
  }
  const svg = wrap(800, 600, `<rect width="800" height="600" fill="${base}"/>${planks}${lines}${knots}`);
  return { id, name, category: "Wood", kind: "background", w: 800, h: 600, svg };
}

function paperBg(id: string, name: string, base: string, fiber: string): AssetDef {
  const rand = rng(name.length * 613 + 7);
  let dots = "";
  for (let i = 0; i < 90; i++) {
    dots += `<circle cx="${(rand() * 800).toFixed(0)}" cy="${(rand() * 600).toFixed(0)}" r="${(0.8 + rand() * 1.8).toFixed(1)}" fill="${fiber}" opacity="${(0.05 + rand() * 0.09).toFixed(2)}"/>`;
  }
  const svg = wrap(800, 600,
    `<rect width="800" height="600" fill="${base}"/>${dots}` +
    `<rect x="0" y="0" width="800" height="600" fill="none" stroke="${fiber}" stroke-opacity="0.12" stroke-width="2"/>`);
  return { id, name, category: "Paper", kind: "background", w: 800, h: 600, svg };
}

function geoBg(id: string, name: string, base: string, c1: string, c2: string, pattern: "arcs" | "grid" | "memphis" | "waves"): AssetDef {
  let body = "";
  if (pattern === "arcs") {
    for (let r = 90; r <= 700; r += 90) {
      body += `<circle cx="120" cy="620" r="${r}" fill="none" stroke="${c1}" stroke-width="14" opacity="0.55"/>`;
    }
    body += `<circle cx="700" cy="-40" r="150" fill="${c2}" opacity="0.5"/><circle cx="700" cy="-40" r="95" fill="${base}" opacity="0.8"/>`;
  } else if (pattern === "grid") {
    for (let x = 0; x <= 800; x += 80) body += `<rect x="${x}" y="0" width="1.5" height="600" fill="${c1}" opacity="0.35"/>`;
    for (let y = 0; y <= 600; y += 80) body += `<rect x="0" y="${y}" width="800" height="1.5" fill="${c1}" opacity="0.35"/>`;
    body += `<rect x="480" y="160" width="240" height="240" fill="${c2}" opacity="0.8"/><rect x="560" y="240" width="240" height="240" fill="${c1}" opacity="0.45"/>`;
  } else if (pattern === "memphis") {
    body +=
      `<circle cx="130" cy="120" r="46" fill="none" stroke="${c1}" stroke-width="10"/><rect x="600" y="80" width="90" height="90" fill="${c2}" transform="rotate(18 645 125)"/>` +
      `<path d="M60 520 l70 -110 70 110 Z" fill="${c1}" opacity="0.85"/><path d="M320 80 l40 24 -40 24 Z" fill="${c2}"/>` +
      `<path d="M0 560 q 100 -50 200 0 t 200 0 t 200 0 t 200 0 V600 H0 Z" fill="${c1}" opacity="0.35"/>` +
      `<circle cx="700" cy="480" r="10" fill="${c1}"/><circle cx="740" cy="430" r="10" fill="${c2}"/><circle cx="660" cy="430" r="10" fill="${c1}" opacity="0.6"/>`;
  } else {
    for (let y = 80; y <= 620; y += 110) {
      body += `<path d="M-20 ${y} q 100 -46 200 0 t 200 0 t 200 0 t 200 0" stroke="${c1}" stroke-width="16" fill="none" opacity="0.5"/>`;
    }
    body += `<circle cx="650" cy="130" r="80" fill="${c2}" opacity="0.75"/>`;
  }
  const svg = wrap(800, 600, `<rect width="800" height="600" fill="${base}"/>${body}`);
  return { id, name, category: "Geometric", kind: "background", w: 800, h: 600, svg };
}

function neonBg(id: string, name: string, base: string, glow1: string, glow2: string): AssetDef {
  let grid = "";
  for (let x = 0; x <= 800; x += 66) grid += `<rect x="${x}" y="0" width="1" height="600" fill="#ffffff" opacity="0.05"/>`;
  for (let y = 0; y <= 600; y += 66) grid += `<rect x="0" y="${y}" width="800" height="1" fill="#ffffff" opacity="0.05"/>`;
  const svg = wrap(800, 600,
    `<defs><radialGradient id="n1"><stop offset="0" stop-color="${glow1}" stop-opacity="0.85"/><stop offset="1" stop-color="${glow1}" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="n2"><stop offset="0" stop-color="${glow2}" stop-opacity="0.75"/><stop offset="1" stop-color="${glow2}" stop-opacity="0"/></radialGradient></defs>` +
    `<rect width="800" height="600" fill="${base}"/>${grid}` +
    `<circle cx="620" cy="140" r="230" fill="url(#n1)"/><circle cx="160" cy="480" r="210" fill="url(#n2)"/>` +
    `<rect x="0" y="470" width="800" height="3" fill="${glow1}" opacity="0.5"/>`);
  return { id, name, category: "Neon", kind: "background", w: 800, h: 600, svg };
}

function seasonalBg(id: string, name: string, kind: "festive" | "spring" | "autumn" | "winter" | "summer" | "party"): AssetDef {
  const rand = rng(kind.length * 457 + 11);
  let body = "";
  if (kind === "festive") {
    body = `<rect width="800" height="600" fill="#14301F"/>`;
    for (let i = 0; i < 26; i++) {
      const x = rand() * 800, y = rand() * 600, r = 8 + rand() * 30;
      const c = rand() > 0.5 ? "#E8B84B" : "#C6604F";
      body += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${r.toFixed(0)}" fill="${c}" opacity="${(0.12 + rand() * 0.2).toFixed(2)}"/>`;
    }
    body += `<ellipse cx="400" cy="560" rx="360" ry="55" fill="#0C2015" opacity="0.9"/>`;
  } else if (kind === "spring") {
    body = `<rect width="800" height="600" fill="#EAF2E4"/><ellipse cx="400" cy="620" rx="460" ry="90" fill="#D3E4C6"/>`;
    for (let i = 0; i < 16; i++) {
      const x = rand() * 800, y = rand() * 560, rot = rand() * 360;
      body += `<ellipse cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" rx="10" ry="5" fill="${rand() > 0.5 ? "#F2B8C6" : "#FBD9A0"}" opacity="0.8" transform="rotate(${rot.toFixed(0)} ${x.toFixed(0)} ${y.toFixed(0)})"/>`;
    }
  } else if (kind === "autumn") {
    body = `<rect width="800" height="600" fill="#F2E4CE"/><path d="M0 470 q 130 -60 260 0 t 260 0 t 260 0 V600 H0 Z" fill="#D9A45B" opacity="0.55"/>`;
    for (let i = 0; i < 14; i++) {
      const x = rand() * 800, y = rand() * 520, rot = rand() * 360;
      body += `<ellipse cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" rx="12" ry="6" fill="${rand() > 0.5 ? "#C6604F" : "#B7791F"}" opacity="0.75" transform="rotate(${rot.toFixed(0)} ${x.toFixed(0)} ${y.toFixed(0)})"/>`;
    }
  } else if (kind === "winter") {
    body = `<rect width="800" height="600" fill="#DCE9F2"/><path d="M0 480 q 200 -90 400 0 t 400 -30 V600 H0 Z" fill="#F7FBFE"/><path d="M0 540 q 200 -60 400 0 t 400 -20 V600 H0 Z" fill="#E3EFF8"/>`;
    for (let i = 0; i < 40; i++) {
      body += `<circle cx="${(rand() * 800).toFixed(0)}" cy="${(rand() * 480).toFixed(0)}" r="${(2 + rand() * 4).toFixed(1)}" fill="#fff" opacity="${(0.5 + rand() * 0.4).toFixed(2)}"/>`;
    }
  } else if (kind === "summer") {
    body = `<defs><linearGradient id="sk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8ECBE8"/><stop offset="1" stop-color="#D9F0F7"/></linearGradient></defs>` +
      `<rect width="800" height="380" fill="url(#sk)"/><circle cx="640" cy="120" r="58" fill="#F6C86B"/><rect y="380" width="800" height="220" fill="#EFE3C8"/>` +
      `<path d="M0 390 q 50 -16 100 0 t 100 0 t 100 0 t 100 0 t 100 0 t 100 0 t 100 0 t 100 0" stroke="#7FB8D4" stroke-width="8" fill="none" opacity="0.6"/>`;
  } else {
    body = `<rect width="800" height="600" fill="#243B55"/>`;
    for (let i = 0; i < 30; i++) {
      const x = rand() * 800, y = rand() * 560;
      const c = ["#F25F5C", "#FFE066", "#247BA0", "#70C1B3"][Math.floor(rand() * 4)];
      body += rand() > 0.5
        ? `<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="12" height="6" fill="${c}" opacity="0.85" transform="rotate(${(rand() * 360).toFixed(0)} ${x.toFixed(0)} ${y.toFixed(0)})"/>`
        : `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="5" fill="${c}" opacity="0.85"/>`;
    }
  }
  return { id, name, category: "Seasonal", kind: "background", w: 800, h: 600, svg: wrap(800, 600, body) };
}

/* ── المنتجات (360×360 بخلفية شفافة) ────────────────────────────── */

const P_SHADOW = `<ellipse cx="180" cy="318" rx="108" ry="18" fill="#000" opacity="0.13"/>`;

function product(id: string, name: string, body: string): AssetDef {
  return { id, name, category: "Products", kind: "product", w: 360, h: 360, svg: wrap(360, 360, P_SHADOW + body) };
}

const ASSET_PRODUCTS: AssetDef[] = [
  product("perfume", "Perfume bottle",
    `<defs><linearGradient id="p" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F3D9A4"/><stop offset="1" stop-color="#D8A24A"/></linearGradient></defs>` +
    `<rect x="128" y="118" width="104" height="176" rx="16" fill="url(#p)"/><rect x="128" y="118" width="30" height="176" rx="14" fill="#fff" opacity="0.25"/>` +
    `<rect x="160" y="86" width="40" height="34" fill="#8C6239"/><rect x="150" y="56" width="60" height="34" rx="6" fill="#5C4632"/>` +
    `<circle cx="180" cy="200" r="22" fill="#fff" opacity="0.35"/>`),
  product("watch", "Wrist watch",
    `<rect x="156" y="52" width="48" height="110" rx="12" fill="#3A3A3A"/><rect x="156" y="200" width="48" height="110" rx="12" fill="#3A3A3A"/>` +
    `<circle cx="180" cy="182" r="66" fill="#4A4A4A"/><circle cx="180" cy="182" r="54" fill="#1E1E1E"/><circle cx="180" cy="182" r="54" fill="none" stroke="#C9A24B" stroke-width="3"/>` +
    `<rect x="177" y="138" width="6" height="46" rx="3" fill="#EDEBE7"/><rect x="180" y="179" width="34" height="6" rx="3" fill="#C9A24B"/>`),
  product("sneaker", "Sneaker",
    `<path d="M60 240 q 30 -90 90 -86 q 40 2 60 40 q 60 60 130 66 q 40 4 40 40 v 20 H60 Z" fill="#E8E4DC"/>` +
    `<path d="M60 300 v 18 a 12 12 0 0 0 12 12 h 296 a 12 12 0 0 0 12 -12 v -18 q -20 -14 -40 0 q -20 -14 -40 0 q -20 -14 -40 0 q -20 -14 -40 0 q -20 -14 -40 0 q -20 -14 -40 0 q -20 -14 -40 0 Z" fill="#C97B4A"/>` +
    `<path d="M150 160 q 40 30 90 40 M 140 190 q 44 26 92 34" stroke="#B8B2A6" stroke-width="6" fill="none"/>` +
    `<circle cx="292" cy="262" r="5" fill="#8C6239"/><circle cx="258" cy="250" r="5" fill="#8C6239"/>`),
  product("headphones", "Headphones",
    `<path d="M84 210 a 96 96 0 0 1 192 0" stroke="#2E2E2E" stroke-width="18" fill="none" stroke-linecap="round"/>` +
    `<rect x="62" y="196" width="52" height="86" rx="24" fill="#C97B4A"/><rect x="246" y="196" width="52" height="86" rx="24" fill="#C97B4A"/>` +
    `<rect x="74" y="214" width="28" height="50" rx="13" fill="#8C5A34"/><rect x="258" y="214" width="28" height="50" rx="13" fill="#8C5A34"/>`),
  product("mug", "Coffee mug",
    `<rect x="100" y="130" width="140" height="152" rx="20" fill="#EDEBE7"/><rect x="100" y="130" width="140" height="34" rx="16" fill="#fff" opacity="0.5"/>` +
    `<ellipse cx="170" cy="282" rx="70" ry="12" fill="#D9D5CE"/><path d="M240 162 h 30 a 34 34 0 0 1 0 78 h -30" stroke="#EDEBE7" stroke-width="16" fill="none"/>` +
    `<path d="M140 100 q 10 -22 0 -40 M 176 104 q 10 -22 0 -40" stroke="#B8B2A6" stroke-width="6" fill="none" stroke-linecap="round"/>`),
  product("sunglasses", "Sunglasses",
    `<rect x="52" y="150" width="106" height="72" rx="26" fill="#1E1E1E"/><rect x="202" y="150" width="106" height="72" rx="26" fill="#1E1E1E"/>` +
    `<rect x="64" y="160" width="82" height="52" rx="18" fill="#3E4A56" opacity="0.85"/><rect x="214" y="160" width="82" height="52" rx="18" fill="#3E4A56" opacity="0.85"/>` +
    `<path d="M158 168 h 44" stroke="#1E1E1E" stroke-width="10"/><path d="M52 162 L 20 140 M 308 162 L 340 140" stroke="#1E1E1E" stroke-width="10" stroke-linecap="round"/>`),
  product("plant", "Potted plant",
    `<path d="M180 190 q -70 -40 -60 -110 q 60 10 60 110 M 180 190 q 70 -40 60 -110 q -60 10 -60 110 M 180 200 v -60" stroke="#5E8C5A" stroke-width="10" fill="none" stroke-linecap="round"/>` +
    `<ellipse cx="140" cy="130" rx="34" ry="16" fill="#6FA87A" transform="rotate(-28 140 130)"/><ellipse cx="222" cy="122" rx="34" ry="16" fill="#6FA87A" transform="rotate(26 222 122)"/>` +
    `<path d="M124 218 h 112 l -12 96 h -88 Z" fill="#C97B4A"/><rect x="112" y="206" width="136" height="18" rx="8" fill="#A5693C"/>`),
  product("chair", "Chair",
    `<rect x="104" y="88" width="34" height="150" rx="14" fill="#8C5A34"/><rect x="222" y="88" width="34" height="150" rx="14" fill="#8C5A34"/>` +
    `<rect x="104" y="196" width="152" height="34" rx="14" fill="#C97B4A"/><rect x="118" y="228" width="18" height="86" fill="#8C5A34"/><rect x="224" y="228" width="18" height="86" fill="#8C5A34"/>` +
    `<rect x="112" y="96" width="136" height="16" rx="8" fill="#A5693C" opacity="0.6"/>`),
  product("lamp", "Desk lamp",
    `<rect x="96" y="292" width="110" height="18" rx="9" fill="#2E2E2E"/><rect x="146" y="180" width="12" height="118" fill="#2E2E2E" transform="rotate(14 152 240)"/>` +
    `<path d="M200 148 l 70 60" stroke="#2E2E2E" stroke-width="12" stroke-linecap="round"/>` +
    `<path d="M236 168 l 74 40 -22 52 -74 -40 Z" fill="#C97B4A"/><ellipse cx="296" cy="248" rx="40" ry="16" fill="#FFEFC9" opacity="0.5"/>` +
    `<circle cx="150" cy="298" r="8" fill="#C97B4A"/>`),
  product("camera", "Camera",
    `<rect x="66" y="120" width="228" height="150" rx="22" fill="#3A3A3A"/><rect x="146" y="96" width="68" height="30" rx="8" fill="#3A3A3A"/>` +
    `<circle cx="180" cy="196" r="54" fill="#232323"/><circle cx="180" cy="196" r="38" fill="#4A5A6A"/><circle cx="168" cy="184" r="12" fill="#fff" opacity="0.4"/>` +
    `<rect x="248" y="136" width="30" height="14" rx="4" fill="#C97B4A"/><circle cx="98" cy="146" r="8" fill="#EDEBE7" opacity="0.6"/>`),
  product("phone", "Smartphone",
    `<rect x="122" y="52" width="116" height="236" rx="24" fill="#232323"/><rect x="132" y="64" width="96" height="204" rx="14" fill="#4A5A6A"/>` +
    `<rect x="132" y="64" width="96" height="204" rx="14" fill="url(#)" opacity="0"/>` +
    `<rect x="164" y="272" width="32" height="6" rx="3" fill="#EDEBE7" opacity="0.6"/><circle cx="180" cy="78" r="5" fill="#EDEBE7" opacity="0.5"/>` +
    `<rect x="140" y="72" width="18" height="120" rx="9" fill="#fff" opacity="0.14"/>`),
  product("laptop", "Laptop",
    `<rect x="76" y="80" width="208" height="140" rx="10" fill="#2E2E2E"/><rect x="88" y="92" width="184" height="116" rx="4" fill="#4A5A6A"/>` +
    `<path d="M48 232 h 264 l 26 34 a 8 8 0 0 1 -8 10 H 30 a 8 8 0 0 1 -8 -10 Z" fill="#3A3A3A"/><rect x="150" y="238" width="60" height="8" rx="4" fill="#232323"/>` +
    `<rect x="96" y="100" width="20" height="100" rx="8" fill="#fff" opacity="0.10"/>`),
  product("tote", "Tote bag",
    `<path d="M96 140 h 168 l 14 152 a 12 12 0 0 1 -12 13 H 94 a 12 12 0 0 1 -12 -13 Z" fill="#D9BC96"/>` +
    `<path d="M136 140 v -26 a 44 44 0 0 1 88 0 v 26" stroke="#8C6239" stroke-width="12" fill="none"/>` +
    `<rect x="96" y="140" width="168" height="14" fill="#C6A874"/><rect x="150" y="200" width="60" height="44" rx="6" fill="#fff" opacity="0.35"/>`),
  product("lipstick", "Lipstick",
    `<rect x="150" y="196" width="60" height="92" rx="10" fill="#232323"/><rect x="150" y="196" width="60" height="18" rx="8" fill="#C97B4A"/>` +
    `<path d="M158 196 v -52 q 0 -14 14 -20 l 24 -10 v 82 Z" fill="#C6604F"/><path d="M158 176 v -32 q 0 -12 12 -18 l 26 -11" stroke="#EDEBE7" stroke-width="4" fill="none" opacity="0.4"/>` +
    `<rect x="146" y="188" width="68" height="12" rx="6" fill="#C9A24B"/>`),
  product("candle", "Candle",
    `<rect x="130" y="168" width="100" height="130" rx="16" fill="#F2E4CE"/><ellipse cx="180" cy="168" rx="50" ry="14" fill="#E4CFAF"/>` +
    `<rect x="176" y="128" width="8" height="42" rx="4" fill="#2E2E2E"/>` +
    `<ellipse cx="180" cy="108" rx="14" ry="24" fill="#F6C86B"/><ellipse cx="180" cy="114" rx="7" ry="14" fill="#FFF3D6"/>` +
    `<rect x="130" y="216" width="100" height="14" fill="#C97B4A" opacity="0.5"/>`),
  product("gift", "Gift box",
    `<rect x="92" y="170" width="176" height="122" rx="12" fill="#C6604F"/><rect x="80" y="146" width="200" height="34" rx="10" fill="#D97B62"/>` +
    `<rect x="166" y="146" width="28" height="146" fill="#F2E4CE"/><rect x="166" y="146" width="28" height="20" fill="#fff" opacity="0.3"/>` +
    `<path d="M180 146 q -44 -10 -40 -38 q 34 -6 40 38 M 180 146 q 44 -10 40 -38 q -34 -6 -40 38" fill="none" stroke="#F2E4CE" stroke-width="12"/>`),
  product("clock", "Wall clock",
    `<circle cx="180" cy="180" r="112" fill="#EDEBE7"/><circle cx="180" cy="180" r="112" fill="none" stroke="#C97B4A" stroke-width="12"/>` +
    `<circle cx="180" cy="180" r="6" fill="#232323"/><rect x="176" y="98" width="8" height="52" rx="4" fill="#232323"/>` +
    `<rect x="184" y="177" width="66" height="8" rx="4" fill="#C97B4A"/>` +
    `<g fill="#9C9891"><rect x="176" y="82" width="8" height="16" rx="3"/><rect x="176" y="262" width="8" height="16" rx="3"/><rect x="78" y="176" width="16" height="8" rx="3"/><rect x="266" y="176" width="16" height="8" rx="3"/></g>`),
  product("backpack", "Backpack",
    `<rect x="104" y="96" width="152" height="196" rx="34" fill="#4A5A6A"/><rect x="104" y="96" width="152" height="60" rx="30" fill="#3A4756"/>` +
    `<rect x="136" y="180" width="88" height="76" rx="18" fill="#C97B4A"/><rect x="136" y="180" width="88" height="22" rx="10" fill="#A5693C"/>` +
    `<path d="M138 96 q 42 -34 84 0" stroke="#2E3A46" stroke-width="14" fill="none"/><rect x="168" y="252" width="24" height="10" rx="5" fill="#EDEBE7" opacity="0.7"/>`),
  product("bottle", "Water bottle",
    `<rect x="146" y="96" width="68" height="196" rx="24" fill="#7FB8D4"/><rect x="146" y="96" width="24" height="196" rx="18" fill="#fff" opacity="0.25"/>` +
    `<rect x="160" y="56" width="40" height="42" rx="10" fill="#2E3A46"/><rect x="146" y="180" width="68" height="52" fill="#EDEBE7" opacity="0.85"/>` +
    `<circle cx="180" cy="206" r="16" fill="#C97B4A"/>`),
  product("keyboard", "Keyboard",
    `<rect x="52" y="140" width="256" height="96" rx="14" fill="#232323"/>` +
    `<g fill="#3A3A3A">${[0, 1, 2].map((r) => [0, 1, 2, 3, 4, 5, 6, 7, 8].map((c) => `<rect x="${68 + c * 26}" y="${154 + r * 26}" width="20" height="20" rx="4"/>`).join("")).join("")}</g>` +
    `<rect x="120" y="216" width="120" height="12" rx="5" fill="#3A3A3A"/>`),
];

/* ── التجميع ────────────────────────────────────────────────────── */

const ASSET_BACKGROUNDS: AssetDef[] = [
  studioBg("studio-sand", "Sand studio", "#F5E7D3", "#E7CFAF", "#D9BC96"),
  studioBg("studio-rose", "Rose studio", "#F6E3E0", "#EBC4C0", "#DFA9A6"),
  studioBg("studio-slate", "Slate studio", "#DCE3EA", "#BFCAD6", "#A3B1C1"),
  studioBg("studio-sage", "Sage studio", "#E2E8DC", "#C6D1BC", "#A9BB9E"),
  studioBg("studio-dusk", "Dusk studio", "#3A3F52", "#2C3040", "#20232E"),
  studioBg("studio-gold", "Golden hour", "#F3E2CE", "#E4C193", "#D0A06C"),
  podiumBg("podium-warm", "Warm podium", "#F3E2CE", "#E0B98C", "#D8A24A", "#F0D8AE", false),
  podiumBg("podium-cool", "Cool podium", "#DCE3EA", "#AEBECE", "#8CA3B8", "#C4D2DE", false),
  podiumBg("podium-dark", "Dark podium", "#23262E", "#16181E", "#33363F", "#41454F", false),
  podiumBg("podium-rose", "Rose podium", "#F6E3E0", "#E3B4AF", "#D98F88", "#F2C9C4", false),
  podiumBg("podium-arch-sand", "Sand arch", "#EFE0CB", "#DCC09A", "#E8D2B2", "#F4E6CE", true),
  podiumBg("podium-arch-sage", "Sage arch", "#E2E8DC", "#B9C9AC", "#CCD9BE", "#E4EDD9", true),
  marbleBg("marble-white", "White marble", "#F2F0EC", "#B8B2A6", "#ffffff"),
  marbleBg("marble-grey", "Grey marble", "#D9D9D6", "#8F8F8A", "#ffffff"),
  marbleBg("marble-beige", "Beige marble", "#EDE4D6", "#B39B7E", "#fff7ea"),
  marbleBg("marble-dark", "Dark marble", "#2A2A2E", "#6E6E76", "#3E3E46"),
  woodBg("wood-oak", "Light oak", "#D9B98C", "#B8945F", "#9C7A48"),
  woodBg("wood-walnut", "Walnut", "#9C7148", "#7A5636", "#5E4228"),
  woodBg("wood-espresso", "Espresso", "#5E4530", "#463323", "#332417"),
  woodBg("wood-white", "Whitewash", "#EDE7DC", "#D6CDBE", "#B8AC98"),
  paperBg("paper-white", "White paper", "#F7F5F0", "#B8B2A6"),
  paperBg("paper-kraft", "Kraft paper", "#D9BC96", "#8C6239"),
  paperBg("paper-cream", "Cream paper", "#F5EFE2", "#C0B49A"),
  paperBg("paper-grey", "Grey paper", "#E4E4E2", "#9A9A96"),
  geoBg("geo-arcs-warm", "Warm arcs", "#F5E7D3", "#C97B4A", "#E4B48C", "arcs"),
  geoBg("geo-arcs-cool", "Cool arcs", "#DCE3EA", "#5B7A99", "#8CA3B8", "arcs"),
  geoBg("geo-grid-warm", "Warm grid", "#F2E4CE", "#B8945F", "#C97B4A", "grid"),
  geoBg("geo-grid-dark", "Dark grid", "#23262E", "#41454F", "#C97B4A", "grid"),
  geoBg("geo-memphis-warm", "Memphis warm", "#F7F1E6", "#C97B4A", "#E4B48C", "memphis"),
  geoBg("geo-memphis-cool", "Memphis cool", "#E8EEF2", "#4A6A8A", "#7FA3B8", "memphis"),
  geoBg("geo-waves-warm", "Warm waves", "#F5E7D3", "#D8A24A", "#E8C9A0", "waves"),
  geoBg("geo-waves-cool", "Cool waves", "#E2E8F0", "#5B7A99", "#9BB4C9", "waves"),
  neonBg("neon-violet", "Neon violet", "#12101F", "#8A5BD6", "#D65B8A"),
  neonBg("neon-cyan", "Neon cyan", "#0E1B20", "#3BB8C9", "#3B6EC9"),
  neonBg("neon-ember", "Neon ember", "#1C1210", "#E8853B", "#D64B3B"),
  neonBg("neon-lime", "Neon lime", "#101810", "#8AC93B", "#3BC97F"),
  seasonalBg("season-festive", "Festive bokeh", "festive"),
  seasonalBg("season-spring", "Spring petals", "spring"),
  seasonalBg("season-autumn", "Autumn leaves", "autumn"),
  seasonalBg("season-winter", "Winter snow", "winter"),
  seasonalBg("season-summer", "Summer beach", "summer"),
  seasonalBg("season-party", "Party confetti", "party"),
];

export const ASSET_LIST: AssetDef[] = [...ASSET_BACKGROUNDS, ...ASSET_PRODUCTS];
