import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Upload, Plus, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { Canvas as FabricCanvas, Textbox, Rect, Ellipse, Line, Image as FabricImage, PencilBrush, util, type FabricObject } from "fabric";
import { ACCENT, boxRectProps, layerToStage, normAngle, textboxProps, type StageBox } from "../lib/fabricText";
import type { TextLayer } from "../lib/textLayers";
import type { ImageLayer, ShapeLayer, SolidLayer } from "../lib/layers";

interface CanvasProps {
  hasImage?: boolean;
  imageUrl?: string | null;
  zoom?: number;
  busy?: string | null;
  error?: string | null;
  activeTool?: string;
  onZoomChange?: (zoom: number) => void;
  onImageDrop?: (file: File) => void;
  onImageError?: (message: string) => void;
  onEditCommit?: (newDataUrl: string) => void;
  textLayers?: TextLayer[];
  selectedTextId?: string | null;
  onSelectText?: (id: string | null) => void;
  onAddText?: (x: number, y: number) => void;
  onUpdateText?: (id: string, patch: Partial<TextLayer>) => void;
  onDeleteText?: (id: string) => void;
  onCommitHistory?: (label: string) => void;
  onSmartSelect?: () => void;
  imageLayers?: ImageLayer[];
  shapeLayers?: ShapeLayer[];
  solidLayers?: SolidLayer[];
  selectedLayer?: { kind: string; id: string } | null;
  onSelectLayer?: (sel: { kind: string; id: string } | null) => void;
  onUpdateImageLayer?: (id: string, patch: Partial<ImageLayer>) => void;
  onUpdateShapeLayer?: (id: string, patch: Partial<ShapeLayer>) => void;
  onUpdateSolidLayer?: (id: string, patch: Partial<SolidLayer>) => void;
  layerOrder?: { kind: string; id: string }[];
  selectedIds?: string[];
  onSelectMany?: (ids: string[]) => void;
}

export interface FabricStageHandle {
  /** دمج ضربات الفرشاة في الصورة — يعيد الرابط الجديد أو null إن لم يوجد شيء. */
  flushStrokes: () => Promise<string | null>;
  getStrokes: () => object[];
  setStrokes: (objs: object[]) => Promise<void>;
}

const ZOOM_STEPS = [10, 25, 33, 50, 67, 75, 100, 150, 200, 300, 400];

const TOOL_CURSORS: Record<string, string> = {
  select: "default",
  crop: "crosshair",
  brush: "crosshair",
  text: "text",
  shape: "crosshair",
  "smart-select": "crosshair",
  eraser: "cell",
  eyedropper: "copy",
  pan: "grab",
  zoom: "zoom-in",
};

const BRUSH_COLOR = "#C97B4A";
const BRUSH_SIZE = 4;
const BOARD_W = 900;
const BOARD_H = 600;

const Canvas = forwardRef<FabricStageHandle, CanvasProps>(function Canvas(props, ref) {
  const {
    hasImage = false,
    imageUrl = null,
    zoom = 100,
    busy = null,
    error = null,
    activeTool = "select",
    onZoomChange,
    onImageDrop,
    onImageError,
    onEditCommit,
    textLayers = [],
    selectedTextId = null,
    onSelectText,
    onAddText,
    onUpdateText,
    onDeleteText,
    onCommitHistory,
    onSmartSelect,
    imageLayers = [],
    shapeLayers = [],
    solidLayers = [],
    selectedLayer = null,
    onSelectLayer,
    onUpdateImageLayer,
    onUpdateShapeLayer,
    layerOrder,
  } = props;

  const [draggingOver, setDraggingOver] = useState(false);
  const [imgError, setImgError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const elRef = useRef<HTMLCanvasElement>(null);
  const fRef = useRef<FabricCanvas | null>(null);
  const bgRef = useRef<FabricImage | null>(null);
  const viewRef = useRef<{ box: StageBox; natW: number; natH: number }>({
    box: { x: 0, y: 0, w: 100, h: 100 },
    natW: 0,
    natH: 0,
  });
  const tbMap = useRef(new Map<string, Textbox>());
  const rectMap = useRef(new Map<string, Rect>());
  const imgLayerMap = useRef(new Map<string, FabricImage>());
  const shapeMap = useRef(new Map<string, FabricObject>());
  const solidMap = useRef(new Map<string, Rect>());
  const knownIds = useRef(new Set<string>());
  const transformSkip = useRef(new Set<string>());
  const editingSkip = useRef(new Set<string>());
  const pendingEdit = useRef(false);
  const gesture = useRef<{ mode: "pan" | "shape" | "crop" | null; startX: number; startY: number; lastX: number; lastY: number; temp: Rect | null }>({
    mode: null,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    temp: null,
  });
  const erasing = useRef({ active: false, dirty: false });
  const lastCommitted = useRef<string | null>(null);
  const toolRef = useRef(activeTool);
  const zoomRef = useRef(zoom);
  toolRef.current = activeTool;
  zoomRef.current = zoom;

  const handlersRef = useRef({ onSelectText, onAddText, onUpdateText, onDeleteText, onCommitHistory, onZoomChange, onImageError, onEditCommit, onSmartSelect, onImageDrop, onSelectLayer, onUpdateImageLayer, onUpdateShapeLayer });
  handlersRef.current = { onSelectText, onAddText, onUpdateText, onDeleteText, onCommitHistory, onZoomChange, onImageError, onEditCommit, onSmartSelect, onImageDrop, onSelectLayer, onUpdateImageLayer, onUpdateShapeLayer };
  const layersRef = useRef(textLayers);
  layersRef.current = textLayers;
  const imageLayersRef = useRef(imageLayers);
  imageLayersRef.current = imageLayers;
  const shapeLayersRef = useRef(shapeLayers);
  shapeLayersRef.current = shapeLayers;
  const solidLayersRef = useRef(solidLayers);
  solidLayersRef.current = solidLayers;
  const hasImageRef = useRef(hasImage);
  hasImageRef.current = hasImage;
  const orderRef = useRef<{ kind: string; id: string }[] | undefined>(layerOrder);
  orderRef.current = layerOrder;

  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  }

  /* ---------- إحداثيات ---------- */

  const toStage = useCallback((clientX: number, clientY: number): { x: number; y: number } => {
    const fc = fRef.current;
    const el = elRef.current;
    if (!fc || !el) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    const v = fc.viewportTransform ?? [1, 0, 0, 1, 0, 0];
    return { x: (clientX - r.left - v[4]) / v[0], y: (clientY - r.top - v[5]) / v[3] };
  }, []);

  const applyViewport = useCallback(() => {
    const fc = fRef.current;
    const el = elRef.current;
    if (!fc || !el) return;
    const r = el.getBoundingClientRect();
    if (r.width < 10) return;
    const z = Math.max(0.05, zoomRef.current / 100);
    const box = viewRef.current.box;
    const tx = r.width / 2 - (box.x + box.w / 2) * z;
    const ty = r.height / 2 - (box.y + box.h / 2) * z;
    fc.setViewportTransform([z, 0, 0, z, tx, ty]);
    fc.requestRenderAll();
  }, []);

  const relayout = useCallback(() => {
    const fc = fRef.current;
    const el = elRef.current;
    const container = containerRef.current;
    if (!fc || !el || !container) return;
    const r = container.getBoundingClientRect();
    if (r.width < 10 || r.height < 10) return;
    fc.setWidth(r.width);
    fc.setHeight(r.height);
    fc.calcOffset();
    const v = viewRef.current;
    const pad = 28;
    let bw = BOARD_W;
    let bh = BOARD_H;
    if (bgRef.current && v.natW > 0 && v.natH > 0) {
      bw = v.natW;
      bh = v.natH;
    }
    const fit = Math.min((r.width - pad * 2) / bw, (r.height - pad * 2) / bh);
    const s = Math.max(0.01, fit);
    const dw = bw * s;
    const dh = bh * s;
    v.box = { x: (r.width - dw) / 2, y: (r.height - dh) / 2, w: dw, h: dh };
    if (bgRef.current && v.natW > 0) {
      bgRef.current.set({ left: v.box.x, top: v.box.y, scaleX: v.box.w / v.natW, scaleY: v.box.h / v.natH });
      bgRef.current.setCoords();
    }
    syncTexts();
    try {
      (syncGenericLayers as unknown as () => void)?.();
    } catch { /* تجاهل */ }
    applyViewport();
  }, [applyViewport]);

  /* ---------- مزامنة طبقات النص ---------- */

  /** تحديث مستطيل الصندوق من هندسة الكائن الحالية (دون قراءة state قديمة). */
  const refreshRect = useCallback((id: string, tb: Textbox) => {
    const fc = fRef.current;
    if (!fc) return;
    const layer = layersRef.current.find((l) => l.id === id);
    if (!layer) return;
    try {
      tb.setCoords();
      const c = tb.getCenterPoint();
      const rp = boxRectProps(layer, { cx: c.x, cy: c.y, w: tb.getScaledWidth(), h: tb.getScaledHeight() });
      let rc = rectMap.current.get(id);
      if (!rp) {
        if (rc) {
          if (fc.getActiveObject() === rc) fc.discardActiveObject();
          fc.remove(rc);
          rectMap.current.delete(id);
        }
      } else if (!rc) {
        rc = new Rect({ ...(rp as object), globalCompositeOperation: (layer as { blendMode?: string }).blendMode || "source-over" } as never);
        (rc as unknown as Record<string, unknown>).layerId = id;
        (rc as unknown as Record<string, unknown>).isBoxRect = true;
        rectMap.current.set(id, rc);
        const idx = fc.getObjects().indexOf(tb);
        fc.insertAt(idx >= 0 ? idx : 1, rc);
      } else {
        rc.set({ ...(rp as object), globalCompositeOperation: (layer as { blendMode?: string }).blendMode || "source-over" } as never);
        rc.setCoords();
      }
    } catch {
      /* تجاهل */
    }
  }, []);

  const syncTexts = useCallback(() => {
    const fc = fRef.current;
    if (!fc) return;
    const box = viewRef.current.box;
    const layers = layersRef.current;
    const seen = new Set<string>();
    const prevKnown = new Set(knownIds.current);

    for (const l of layers) {
      seen.add(l.id);
      const st = layerToStage(l, box);
      let tb = tbMap.current.get(l.id);
      if (!tb) {
        try {
          tb = new Textbox(l.text || "", textboxProps(l, st) as never);
        } catch {
          tb = new Textbox(l.text || "", { left: st.left, top: st.top, width: st.width } as never);
        }
        (tb as unknown as Record<string, unknown>).layerId = l.id;
        const id = l.id;
        tb.on("editing:entered", () => editingSkip.current.add(id));
        tb.on("editing:exited", () => commitTextEdit(id));
        tbMap.current.set(l.id, tb);
        fc.add(tb);
        if (pendingEdit.current && !prevKnown.has(l.id)) {
          pendingEdit.current = false;
          try {
            fc.setActiveObject(tb);
            tb.enterEditing();
            fc.requestRenderAll();
          } catch {
            /* تجاهل — التحرير اليدوي متاح بالنقر المزدوج */
          }
        }
      } else if (!transformSkip.current.has(l.id) && !editingSkip.current.has(l.id)) {
        try {
          tb.set(textboxProps(l, st) as never);
          tb.set({ scaleX: 1, scaleY: 1 });
          try {
            tb.initDimensions();
          } catch {
            /* giữ */
          }
          tb.setCoords();
        } catch {
          /* طبقة تالفة — تُتجاهل بصمت */
        }
      }
      try {
        (tb as unknown as { set: (o: object) => void }).set({
          globalCompositeOperation: (l as { blendMode?: string }).blendMode || "source-over",
        });
      } catch { /* تجاهل */ }
      // مستطيل الصندوق الخلفي
      refreshRect(l.id, tb);
    }

    for (const id of Array.from(tbMap.current.keys())) {
      if (!seen.has(id)) {
        const tb = tbMap.current.get(id);
        const rc = rectMap.current.get(id);
        if (tb && fc.getActiveObject() === tb) fc.discardActiveObject();
        if (tb) fc.remove(tb);
        if (rc) fc.remove(rc);
        tbMap.current.delete(id);
        rectMap.current.delete(id);
        transformSkip.current.delete(id);
        editingSkip.current.delete(id);
      }
    }
    knownIds.current = seen;

    // الخلفية دائماً في القاع
    const bg = bgRef.current;
    if (bg) {
      const objs = fc.getObjects();
      if (objs[0] !== bg) {
        fc.remove(bg);
        fc.insertAt(0, bg);
      }
    }
    fc.requestRenderAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshRect]);

  const commitTextEdit = useCallback((id: string) => {
    editingSkip.current.delete(id);
    const tb = tbMap.current.get(id);
    if (!tb) return;
    const h = handlersRef.current;
    const text = tb.text ?? "";
    const layer = layersRef.current.find((l) => l.id === id);
    if (layer && text !== layer.text) {
      h.onUpdateText?.(id, { text, name: (text || "Text").slice(0, 24) });
      h.onCommitHistory?.("Edit text");
    }
  }, []);

  /* ---------- طبقات عامة (صورة/شكل/تعبئة) ---------- */

  const syncGenericLayers = useCallback(() => {
    const fc = fRef.current;
    if (!fc) return;
    const box = viewRef.current.box;
    // تعبئات: مستطيل يغطي الصندوق كاملاً (فوق الخلفية مباشرة)
    {
      const seen = new Set<string>();
      for (const s of solidLayersRef.current) {
        seen.add(s.id);
        let rc = solidMap.current.get(s.id);
        if (!rc) {
          rc = new Rect({ left: box.x, top: box.y, width: Math.max(1, box.w), height: Math.max(1, box.h), fill: s.color, selectable: false, evented: false });
          (rc as unknown as Record<string, unknown>).layerKind = "solid";
          (rc as unknown as Record<string, unknown>).layerId = s.id;
          solidMap.current.set(s.id, rc);
          fc.add(rc);
        }
        try {
          rc.set({ left: box.x, top: box.y, width: Math.max(1, box.w), height: Math.max(1, box.h), fill: s.color, opacity: Math.max(0, Math.min(1, s.opacity / 100)), visible: s.visible !== false, globalCompositeOperation: (s as { blendMode?: string }).blendMode || "source-over" } as never);
          rc.setCoords();
        } catch { /* تجاهل */ }
      }
      for (const id of Array.from(solidMap.current.keys())) {
        if (!seen.has(id)) {
          const o = solidMap.current.get(id);
          if (o) fc.remove(o);
          solidMap.current.delete(id);
        }
      }
    }
    // أشكال
    {
      const seen = new Set<string>();
      for (const s of shapeLayersRef.current) {
        seen.add(s.id);
        const left = box.x + s.x * box.w;
        const top = box.y + s.y * box.h;
        const wpx = Math.max(4, s.w * box.w);
        const hpx = Math.max(4, s.h * box.h);
        let obj = shapeMap.current.get(s.id);
        if (!obj) {
          try {
            if (s.shape === "ellipse") obj = new Ellipse({ left, top, rx: wpx / 2, ry: hpx / 2 });
            else if (s.shape === "line") obj = new Line([0, 0, wpx, 0], { left, top });
            else if (s.shape === "arrow") obj = new Line([0, 0, wpx, 0], { left, top, strokeWidth: 4 });
            else obj = new Rect({ left, top, width: wpx, height: hpx });
          } catch { continue; }
          (obj as unknown as Record<string, unknown>).layerKind = "shape";
          (obj as unknown as Record<string, unknown>).layerId = s.id;
          shapeMap.current.set(s.id, obj);
          fc.add(obj);
        }
        try {
          const common = { left, top, angle: s.rotation || 0, opacity: Math.max(0, Math.min(1, s.opacity / 100)), visible: s.visible !== false, selectable: !s.locked, evented: !s.locked, lockMovementX: !!s.locked, lockMovementY: !!s.locked, globalCompositeOperation: (s as { blendMode?: string }).blendMode || "source-over" } as never;
          obj.set(common);
          if (obj instanceof Rect || obj instanceof Ellipse) {
            if (s.shape === "ellipse" && obj instanceof Ellipse) {
              obj.set({ rx: wpx / 2, ry: hpx / 2 } as never);
            } else if (obj instanceof Rect) {
              obj.set({ width: wpx, height: hpx } as never);
            }
            obj.set({ fill: s.fillEnabled ? s.color : "transparent", stroke: s.strokeWidth > 0 ? s.strokeColor : "transparent", strokeWidth: s.strokeWidth || 0 } as never);
          } else if (obj instanceof Line) {
            const pts = s.shape === "arrow" ? [0, 0, wpx, 0] : [0, 0, wpx, 0];
            obj.set({ x1: pts[0], y1: pts[1], x2: pts[2], y2: pts[3], stroke: s.strokeWidth > 0 ? s.strokeColor : s.color, strokeWidth: Math.max(2, s.strokeWidth || 4) } as never);
          }
          obj.setCoords();
        } catch { /* تجاهل */ }
      }
      for (const id of Array.from(shapeMap.current.keys())) {
        if (!seen.has(id)) {
          const o = shapeMap.current.get(id);
          if (o) {
            if (fc.getActiveObject() === o) fc.discardActiveObject();
            fc.remove(o);
          }
          shapeMap.current.delete(id);
        }
      }
    }
    // صور: تحميل كسول — تُنشأ عند وصول الصورة
    {
      const seen = new Set<string>();
      for (const l of imageLayersRef.current) {
        seen.add(l.id);
        const left = box.x + l.x * box.w;
        const top = box.y + l.y * box.h;
        const wpx = Math.max(8, l.w * box.w);
        const hpx = Math.max(8, l.h * box.h);
        const existing = imgLayerMap.current.get(l.id);
        if (existing) {
          try {
            const iw = existing.width || 1;
            const ih = existing.height || 1;
            existing.set({ left, top, scaleX: wpx / iw, scaleY: hpx / ih, angle: l.rotation || 0, opacity: Math.max(0, Math.min(1, l.opacity / 100)), visible: l.visible !== false, selectable: !l.locked, evented: !l.locked, globalCompositeOperation: (l as { blendMode?: string }).blendMode || "source-over" } as never);
            existing.setCoords();
          } catch { /* تجاهل */ }
          continue;
        }
        const url = l.url;
        const isRemote = /^https?:\/\//i.test(url);
        FabricImage.fromURL(url, isRemote ? { crossOrigin: "anonymous" } : {})
          .then((img) => {
            if (!imageLayersRef.current.some((x) => x.id === l.id)) return;
            const fc2 = fRef.current;
            if (!fc2) return;
            const cur = imageLayersRef.current.find((x) => x.id === l.id);
            const b = viewRef.current.box;
            const lw = Math.max(8, (cur?.w ?? l.w) * b.w);
            const lh = Math.max(8, (cur?.h ?? l.h) * b.h);
            img.set({ left: b.x + (cur?.x ?? l.x) * b.w, top: b.y + (cur?.y ?? l.y) * b.h, scaleX: lw / (img.width || 1), scaleY: lh / (img.height || 1), angle: cur?.rotation || 0, opacity: Math.max(0, Math.min(1, (cur?.opacity ?? 100) / 100)), visible: (cur?.visible ?? true) !== false, globalCompositeOperation: ((cur as { blendMode?: string } | undefined)?.blendMode || (l as { blendMode?: string }).blendMode || "source-over") } as never);
            (img as unknown as Record<string, unknown>).layerKind = "image";
            (img as unknown as Record<string, unknown>).layerId = l.id;
            imgLayerMap.current.set(l.id, img);
            fc2.add(img);
            // ترتيب: خلفية ثم تعبئات ثم صور ثم أشكال ثم نصوص
            try {
              fc2.remove(img);
              const idx = 1 + solidMap.current.size;
              fc2.insertAt(Math.max(1, idx), img);
            } catch { try { fc2.add(img); } catch { /* تجاهل */ } }
            fc2.requestRenderAll();
          })
          .catch(() => { /* فشل تحميل طبقة — تُتجاهل بصمت */ });
      }
      for (const id of Array.from(imgLayerMap.current.keys())) {
        if (!seen.has(id)) {
          const o = imgLayerMap.current.get(id);
          if (o) {
            if (fc.getActiveObject() === o) fc.discardActiveObject();
            fc.remove(o);
          }
          imgLayerMap.current.delete(id);
        }
      }
    }
    // ترتيب: إن وُجد layerOrder موحد نطبقه، وإلا الخلفية أولاً (توافق قديم)
    try {
      const order = orderRef.current;
      const bg = bgRef.current;
      if (order && order.length) {
        const objFor = (kind: string, id: string): FabricObject[] => {
          if (kind === "text") {
            const tb = tbMap.current.get(id);
            const rc = rectMap.current.get(id);
            const out: FabricObject[] = [];
            if (rc) out.push(rc as unknown as FabricObject);
            if (tb) out.push(tb as unknown as FabricObject);
            return out;
          }
          if (kind === "image") {
            const o = imgLayerMap.current.get(id);
            return o ? [o] : [];
          }
          if (kind === "shape") {
            const o = shapeMap.current.get(id);
            return o ? [o] : [];
          }
          if (kind === "solid") {
            const o = solidMap.current.get(id);
            return o ? [o] : [];
          }
          return [];
        };
        for (const ref of order) {
          if (ref.id === "__background__") continue;
          const objs = objFor(ref.kind, ref.id);
          for (const o of objs) {
            try {
              const f = fRef.current;
              if (f && (f.getObjects() as unknown[]).includes(o)) f.bringObjectToFront(o);
            } catch { /* تجاهل */ }
          }
        }
        try {
          const strokes = fc.getObjects().filter((o) => (o as unknown as Record<string, unknown>).isStroke);
          for (const s of strokes) fc.bringObjectToFront(s);
        } catch { /* تجاهل */ }
      }
      if (bg) {
        try {
          const f = fRef.current;
          if (f && (f.getObjects() as unknown[]).includes(bg as unknown)) f.sendObjectToBack(bg);
        } catch {
          const objs = fc.getObjects();
          if (objs[0] !== bg) {
            fc.remove(bg);
            fc.insertAt(0, bg);
          }
        }
      }
    } catch { /* تجاهل */ }
    fc.requestRenderAll();
  }, []);

  function readback(tb: Textbox, id: string) {
    const box = viewRef.current.box;
    const wFrac = Math.min(1.2, Math.max(0.05, (tb.width * (tb.scaleX || 1)) / Math.max(1, box.w)));
    handlersRef.current.onUpdateText?.(id, {
      x: Math.min(0.95, Math.max(-0.2, (tb.left - box.x) / Math.max(1, box.w))),
      y: Math.min(0.95, Math.max(-0.2, (tb.top - box.y) / Math.max(1, box.h))),
      w: Math.round(wFrac * 1000) / 1000,
      rotation: normAngle(tb.angle || 0),
    });
  }

  /* ---------- الدمج (raster commit) ---------- */

  const commitRaster = useCallback(async (region?: StageBox | null, includeTemp?: Rect | null): Promise<string | null> => {
    const fc = fRef.current;
    if (!fc || !bgRef.current) return null;
    const box = viewRef.current.box;
    const natW = viewRef.current.natW;
    if (natW < 2) return null;
    const hidden: { o: { visible: boolean }; }[] = [];
    const hide = (o: { visible: boolean }) => {
      if (o.visible) {
        o.visible = false;
        hidden.push({ o });
      }
    };
    tbMap.current.forEach((tb) => hide(tb as unknown as { visible: boolean }));
    rectMap.current.forEach((rc) => hide(rc as unknown as { visible: boolean }));
    imgLayerMap.current.forEach((o) => hide(o as unknown as { visible: boolean }));
    shapeMap.current.forEach((o) => hide(o as unknown as { visible: boolean }));
    solidMap.current.forEach((o) => hide(o as unknown as { visible: boolean }));
    const g = gesture.current;
    if (g.temp && g.temp !== includeTemp) hide(g.temp as unknown as { visible: boolean });
    fc.requestRenderAll();

    let rx = box.x;
    let ry = box.y;
    let rw = box.w;
    let rh = box.h;
    if (region) {
      rx = Math.max(box.x, region.x);
      ry = Math.max(box.y, region.y);
      rw = Math.min(box.x + box.w, region.x + region.w) - rx;
      rh = Math.min(box.y + box.h, region.y + region.h) - ry;
    }
    if (rw < 2 || rh < 2) {
      hidden.forEach(({ o }) => {
        o.visible = true;
      });
      fc.requestRenderAll();
      return null;
    }
    const mult = natW / box.w;
    let url: string | null = null;
    try {
      url = fc.toDataURL({ format: "png", left: rx, top: ry, width: rw, height: rh, multiplier: mult });
    } catch {
      url = null;
    }
    hidden.forEach(({ o }) => {
      o.visible = true;
    });
    fc.requestRenderAll();
    if (!url) {
      // السبب الشائع: صورة خلفية من origin آخر بلا CORS لوّثت الكانفس.
      // الحل: أعد فتح الصورة كـ dataURL (نظيفة) من الملف الأصلي.
      showToast("Export blocked — image is tainted (CORS). Re-open the image from file to fix.");
      handlersRef.current.onImageError?.(
        "Save blocked: the canvas is tainted by a cross-origin image without CORS. " +
          "Re-open the image from your disk (it loads as a clean dataURL), or ensure the server sends Access-Control-Allow-Origin."
      );
      return null;
    }
    try {
      // dataURL ناتجة من نفس الكانفس: لا تحتاج crossOrigin إطلاقاً.
      const img = await FabricImage.fromURL(url);
      img.set({ selectable: false, evented: false });
      const old = bgRef.current;
      if (old) fc.remove(old);
      bgRef.current = img;
      fc.insertAt(0, img);
      viewRef.current.natW = img.width;
      viewRef.current.natH = img.height;
      // إزالة الضربات المدمجة + المؤقت
      const strokes = fc.getObjects().filter((o) => (o as unknown as Record<string, unknown>).isStroke);
      if (strokes.length) fc.remove(...strokes);
      if (g.temp) {
        fc.remove(g.temp);
        g.temp = null;
      }
      g.mode = null;
      lastCommitted.current = url;
      relayout();
      return url;
    } catch {
      showToast("Could not apply to image");
      return null;
    }
  }, [relayout]);

  const commitStrokes = useCallback(async () => {
    const url = await commitRaster();
    if (url) handlersRef.current.onEditCommit?.(url);
  }, [commitRaster]);

  function eraseAt(clientX: number, clientY: number): boolean {
    const fc = fRef.current;
    if (!fc) return false;
    const p = toStage(clientX, clientY);
    const pad = 14;
    let removed = false;
    const strokes = fc.getObjects().filter((o) => (o as unknown as Record<string, unknown>).isStroke);
    for (const s of strokes) {
      try {
        const r = s.getBoundingRect();
        if (p.x >= r.left - pad && p.x <= r.left + r.width + pad && p.y >= r.top - pad && p.y <= r.top + r.height + pad) {
          fc.remove(s);
          removed = true;
        }
      } catch {
        /* تجاهل */
      }
    }
    if (removed) fc.requestRenderAll();
    return removed;
  }

  function pickColor(clientX: number, clientY: number) {
    const bg = bgRef.current;
    const box = viewRef.current.box;
    if (!bg) {
      showToast("Open an image first");
      return;
    }
    const p = toStage(clientX, clientY);
    const fx = (p.x - box.x) / Math.max(1, box.w);
    const fy = (p.y - box.y) / Math.max(1, box.h);
    if (fx < 0 || fx > 1 || fy < 0 || fy > 1) {
      showToast("Click inside the image");
      return;
    }
    try {
      const el = bg.getElement() as unknown as HTMLImageElement;
      const c = document.createElement("canvas");
      c.width = 1;
      c.height = 1;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(el, Math.floor(fx * (el.naturalWidth || el.width)), Math.floor(fy * (el.naturalHeight || el.height)), 1, 1, 0, 0, 1, 1);
      const d = ctx.getImageData(0, 0, 1, 1).data;
      const hex = "#" + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, "0")).join("");
      showToast("Picked " + hex);
    } catch {
      showToast("Could not sample color");
    }
  }

  /* ---------- واجهة imperative ---------- */

  useImperativeHandle(ref, () => ({
    flushStrokes: async () => {
      const fc = fRef.current;
      if (!fc) return null;
      const has = fc.getObjects().some((o) => (o as unknown as Record<string, unknown>).isStroke);
      if (!has) return null;
      return commitRaster();
    },
    getStrokes: () => {
      const fc = fRef.current;
      if (!fc) return [];
      try {
        return fc
          .getObjects()
          .filter((o) => (o as unknown as Record<string, unknown>).isStroke)
          .map((o) => o.toObject() as object);
      } catch {
        return [];
      }
    },
    setStrokes: async (objs: object[]) => {
      const fc = fRef.current;
      if (!fc) return;
      const old = fc.getObjects().filter((o) => (o as unknown as Record<string, unknown>).isStroke);
      if (old.length) fc.remove(...old);
      if (!objs.length) {
        fc.requestRenderAll();
        return;
      }
      try {
        const enlivened = await util.enlivenObjects<FabricObject>(objs);
        for (const o of enlivened) {
          try {
            o.set({ selectable: false, evented: false });
            (o as unknown as Record<string, unknown>).isStroke = true;
            fc.add(o);
          } catch {
            /* تجاهل الكائن التالف */
          }
        }
        fc.requestRenderAll();
      } catch {
        /* فشل الاستعادة — تُتجاهل الضربات */
      }
    },
  }), [commitRaster]);

  /* ---------- التهيئة ---------- */

  useEffect(() => {
    const el = elRef.current;
    const container = containerRef.current;
    if (!el || !container) return;
    tbMap.current.clear();
    rectMap.current.clear();
    imgLayerMap.current.clear();
    shapeMap.current.clear();
    solidMap.current.clear();
    knownIds.current.clear();
    transformSkip.current.clear();
    editingSkip.current.clear();
    bgRef.current = null;
    gesture.current = { mode: null, startX: 0, startY: 0, lastX: 0, lastY: 0, temp: null };

    const fc = new FabricCanvas(el, {
      preserveObjectStacking: true,
      selection: toolRef.current === "select",
      stopContextMenu: true,
      fireRightClick: true,
    });
    try {
      fc.selectionColor = "rgba(201,123,74,0.12)";
      fc.selectionBorderColor = ACCENT;
      fc.selectionLineWidth = 1.5;
    } catch {
      /* تجاهل */
    }
    fRef.current = fc;

    const onDown = (opt: unknown) => {
      const o = opt as { e: PointerEvent; target?: object | null };
      const tool = toolRef.current;
      const e = o.e;
      if (e.button === 2 && tool !== "zoom") return;
      if (tool === "pan") {
        gesture.current = { mode: "pan", startX: e.clientX, startY: e.clientY, lastX: e.clientX, lastY: e.clientY, temp: gesture.current.temp };
        return;
      }
      if (tool === "zoom") {
        const h = handlersRef.current;
        const z = zoomRef.current;
        if (e.button === 2 || (e as PointerEvent & { altKey?: boolean }).altKey) {
          h.onZoomChange?.([...ZOOM_STEPS].reverse().find((s) => s < z) ?? z);
        } else {
          h.onZoomChange?.(ZOOM_STEPS.find((s) => s > z) ?? z);
        }
        return;
      }
      if (tool === "eyedropper") {
        pickColor(e.clientX, e.clientY);
        return;
      }
      if (tool === "smart-select") {
        if (hasImageRef.current) {
          showToast("Removing background…");
          handlersRef.current.onSmartSelect?.();
        } else {
          showToast("Open an image first — then Smart Select removes its background");
        }
        return;
      }
      if (tool === "text") {
        if (o.target) return;
        const box = viewRef.current.box;
        const fc2 = fRef.current;
        if (!fc2) return;
        const r = el.getBoundingClientRect();
        const v = fc2.viewportTransform ?? [1, 0, 0, 1, 0, 0];
        const px = (e.clientX - r.left - v[4]) / v[0];
        const py = (e.clientY - r.top - v[5]) / v[3];
        const fx = (px - box.x) / Math.max(1, box.w);
        const fy = (py - box.y) / Math.max(1, box.h);
        if (fx < -0.2 || fx > 1.2 || fy < -0.2 || fy > 1.2) return;
        pendingEdit.current = true;
        handlersRef.current.onAddText?.(
          Math.min(0.85, Math.max(0, fx - 0.12)),
          Math.min(0.85, Math.max(0, fy - 0.03))
        );
        return;
      }
      if (tool === "select") return;
      if (!hasImageRef.current) return;
      if (tool === "shape" || tool === "crop") {
        const p = (function () {
          const r = el.getBoundingClientRect();
          const v = fc.viewportTransform ?? [1, 0, 0, 1, 0, 0];
          return { x: (e.clientX - r.left - v[4]) / v[0], y: (e.clientY - r.top - v[5]) / v[3] };
        })();
        const temp = new Rect({
          left: p.x,
          top: p.y,
          width: 1,
          height: 1,
          fill: "transparent",
          stroke: tool === "crop" ? "#ffffff" : ACCENT,
          strokeWidth: tool === "crop" ? 1.5 : 2,
          strokeDashArray: tool === "crop" ? [8, 6] : undefined,
          selectable: false,
          evented: false,
        });
        (temp as unknown as Record<string, unknown>).isTemp = true;
        gesture.current = { mode: tool, startX: p.x, startY: p.y, lastX: p.x, lastY: p.y, temp };
        fc.add(temp);
        return;
      }
      if (tool === "eraser") {
        erasing.current = { active: true, dirty: false };
        if (eraseAt(e.clientX, e.clientY)) erasing.current.dirty = true;
      }
    };

    const onMove = (opt: unknown) => {
      const o = opt as { e: PointerEvent };
      const e = o.e;
      const g = gesture.current;
      if (g.mode === "pan") {
        const fc2 = fRef.current;
        if (!fc2) return;
        const v = [...(fc2.viewportTransform ?? [1, 0, 0, 1, 0, 0])] as [number, number, number, number, number, number];
        v[4] += e.clientX - g.lastX;
        v[5] += e.clientY - g.lastY;
        fc2.setViewportTransform(v);
        fc2.requestRenderAll();
        g.lastX = e.clientX;
        g.lastY = e.clientY;
        return;
      }
      if ((g.mode === "shape" || g.mode === "crop") && g.temp) {
        const fc2 = fRef.current;
        if (!fc2) return;
        const r = el.getBoundingClientRect();
        const v = fc2.viewportTransform ?? [1, 0, 0, 1, 0, 0];
        const px = (e.clientX - r.left - v[4]) / v[0];
        const py = (e.clientY - r.top - v[5]) / v[3];
        g.temp.set({
          left: Math.min(g.startX, px),
          top: Math.min(g.startY, py),
          width: Math.max(1, Math.abs(px - g.startX)),
          height: Math.max(1, Math.abs(py - g.startY)),
        });
        g.temp.setCoords();
        fc2.requestRenderAll();
        return;
      }
      if (erasing.current.active && toolRef.current === "eraser") {
        if (eraseAt(e.clientX, e.clientY)) erasing.current.dirty = true;
      }
    };

    const onUp = () => {
      const g = gesture.current;
      transformSkip.current.clear();
      if (g.mode === "pan") {
        g.mode = null;
        return;
      }
      if ((g.mode === "shape" || g.mode === "crop") && g.temp) {
        const t = g.temp;
        const w = t.width * (t.scaleX || 1);
        const h = t.height * (t.scaleY || 1);
        const isCrop = g.mode === "crop";
        const need = isCrop ? 12 : 4;
        g.mode = null;
        if (w > need && h > need) {
          const region = { x: t.left, y: t.top, w, h };
          if (isCrop) {
            void (async () => {
              const url = await commitRaster(region, null);
              if (url) {
                showToast("Cropped");
                handlersRef.current.onEditCommit?.(url);
              } else {
                const fc2 = fRef.current;
                if (fc2) {
                  fc2.remove(t);
                  fc2.requestRenderAll();
                }
                gesture.current.temp = null;
              }
            })();
          } else {
            try {
              t.set({ strokeDashArray: undefined });
            } catch {
              /* تجاهل */
            }
            void (async () => {
              const url = await commitRaster(null, t);
              if (url) handlersRef.current.onEditCommit?.(url);
            })();
          }
        } else {
          const fc2 = fRef.current;
          if (fc2) {
            fc2.remove(t);
            fc2.requestRenderAll();
          }
          g.temp = null;
        }
        return;
      }
      if (erasing.current.active) {
        const dirty = erasing.current.dirty;
        erasing.current = { active: false, dirty: false };
        if (dirty) void commitStrokes();
      }
    };

    fc.on("mouse:down", onDown as never);
    fc.on("mouse:move", onMove as never);
    fc.on("mouse:up", onUp as never);
    fc.on("path:created", ((opt: unknown) => {
      const p = (opt as { path?: object }).path;
      if (!p) return;
      try {
        (p as { set: (o: object) => void }).set({ selectable: false, evented: false });
        ((p as unknown as Record<string, unknown>).isStroke = true);
      } catch {
        /* تجاهل */
      }
      void commitStrokes();
    }) as never);
    const singleSelect = (opt: unknown) => {
      const sel = (opt as { selected?: object[] }).selected;
      if (!sel || sel.length !== 1) {
        try {
          fc.discardActiveObject();
          fc.requestRenderAll();
        } catch {
          /* تجاهل */
        }
        return;
      }
      const t = sel[0] as unknown as Record<string, unknown> | undefined;
      const id = t?.layerId;
      const kind = (t?.layerKind as string) || (t?.isBoxRect ? undefined : "text");
      if (typeof id === "string") {
        if (kind === "image" || kind === "shape") {
          handlersRef.current.onSelectLayer?.({ kind, id });
          handlersRef.current.onSelectText?.(null);
        } else {
          handlersRef.current.onSelectText?.(id);
          handlersRef.current.onSelectLayer?.({ kind: "text", id });
        }
      } else {
        try {
          fc.discardActiveObject();
          fc.requestRenderAll();
        } catch {
          /* تجاهل */
        }
      }
    };
    fc.on("selection:created", singleSelect as never);
    fc.on("selection:updated", singleSelect as never);
    fc.on("selection:cleared", (() => {
      handlersRef.current.onSelectText?.(null);
      handlersRef.current.onSelectLayer?.(null);
    }) as never);
    const liveback = (opt: unknown) => {
      const t = (opt as { target?: Textbox }).target;
      if (!t) return;
      const id = (t as unknown as Record<string, unknown>).layerId;
      if (typeof id !== "string") return;
      transformSkip.current.add(id);
      readback(t, id);
    };
    fc.on("object:moving", liveback as never);
    fc.on("object:scaling", liveback as never);
    fc.on("object:rotating", liveback as never);
    fc.on("object:modified", ((opt: unknown) => {
      const t = (opt as { target?: FabricObject; transform?: { action?: string } }).target as unknown as (Textbox & Record<string, unknown>);
      if (!t) return;
      const id = t?.layerId;
      if (typeof id !== "string") return;
      const kind = (t?.layerKind as string) || "text";
      // طبقة عامة: تحديث x/y/w/h/rotation نسبياً
      if (kind === "image" || kind === "shape") {
        try {
          const box = viewRef.current.box;
          const rect = (t as unknown as FabricObject).getBoundingRect?.() ?? null;
          void rect;
          const wPx = Math.abs(((t as unknown as { getScaledWidth?: () => number }).getScaledWidth?.() ?? (t as unknown as { width?: number }).width ?? 50));
          const hPx = Math.abs(((t as unknown as { getScaledHeight?: () => number }).getScaledHeight?.() ?? (t as unknown as { height?: number }).height ?? 50));
          const rot = normAngle(((t as unknown as { angle?: number }).angle || 0));
          const nx = Math.min(0.95, Math.max(-0.2, (((t as unknown as { left?: number }).left ?? 0) - box.x) / Math.max(1, box.w)));
          const ny = Math.min(0.95, Math.max(-0.2, (((t as unknown as { top?: number }).top ?? 0) - box.y) / Math.max(1, box.h)));
          // للخطوط: العرض من المسافة بين النقطتين
          let wFrac = Math.min(1.2, Math.max(0.02, wPx / Math.max(1, box.w)));
          let hFrac = Math.min(1.2, Math.max(0.02, hPx / Math.max(1, box.h)));
          if (kind === "image") {
            handlersRef.current.onUpdateImageLayer?.(id as string, { x: nx, y: ny, w: Math.round(wFrac * 1000) / 1000, h: Math.round(hFrac * 1000) / 1000, rotation: rot });
          } else {
            handlersRef.current.onUpdateShapeLayer?.(id as string, { x: nx, y: ny, w: Math.round(wFrac * 1000) / 1000, h: Math.round(hFrac * 1000) / 1000, rotation: rot });
          }
          handlersRef.current.onCommitHistory?.(kind === "image" ? "Move image layer" : "Move shape");
          fRef.current?.requestRenderAll();
        } catch { /* تجاهل */ }
        return;
      }
      transformSkip.current.delete(id as string);
      // تطبيع القياس مباشرة من الكائن (لا قراءة state قديمة): العرض إلى width وإعادة scale إلى 1
      const box = viewRef.current.box;
      const wFrac = Math.min(1.2, Math.max(0.05, (t.width * (t.scaleX || 1)) / Math.max(1, box.w)));
      const rot = normAngle(t.angle || 0);
      try {
        t.set({ width: wFrac * box.w, scaleX: 1, scaleY: 1, angle: rot });
        try {
          t.initDimensions();
        } catch {
          /* تجاهل */
        }
        t.setCoords();
      } catch {
        /* تجاهل */
      }
      handlersRef.current.onUpdateText?.(id, {
        x: Math.min(0.95, Math.max(-0.2, (t.left - box.x) / Math.max(1, box.w))),
        y: Math.min(0.95, Math.max(-0.2, (t.top - box.y) / Math.max(1, box.h))),
        w: Math.round(wFrac * 1000) / 1000,
        rotation: rot,
      });
      const action = opt && (opt as { transform?: { action?: string } }).transform?.action;
      const label = action === "rotate" ? "Rotate text" : action === "scale" ? "Resize text box" : action === "scaleX" || action === "scaleY" ? "Resize text box" : "Move text";
      refreshRect(id, t);
      fRef.current?.requestRenderAll();
      handlersRef.current.onCommitHistory?.(label);
    }) as never);

    const ro = new ResizeObserver(() => relayout());
    ro.observe(container);
    relayout();

    return () => {
      ro.disconnect();
      fc.dispose();
      fRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- تحميل الخلفية ---------- */

  useEffect(() => {
    const fc = fRef.current;
    if (!hasImage || !imageUrl) {
      if (fc && bgRef.current) {
        fc.remove(bgRef.current);
        bgRef.current = null;
        fc.requestRenderAll();
      }
      viewRef.current.natW = 0;
      viewRef.current.natH = 0;
      setImgError(null);
      relayout();
      return;
    }
    if (imageUrl === lastCommitted.current) {
      lastCommitted.current = null;
      return;
    }
    setImgError(null);
    let cancelled = false;
    // data:/blob:/relative = نفس الـorigin → نظيفة بلا crossOrigin.
    // http(s) بعيدة فقط تحتاج anonymous (وتتطلب ACAO من السيرفر وإلا فشلت بوضوح).
    const isRemote = /^https?:\/\//i.test(imageUrl);
    FabricImage.fromURL(imageUrl, isRemote ? { crossOrigin: "anonymous" } : {})
      .then((img) => {
        if (cancelled) return;
        const fc2 = fRef.current;
        if (!fc2) return;
        img.set({ selectable: false, evented: false });
        if (bgRef.current) fc2.remove(bgRef.current);
        bgRef.current = img;
        fc2.insertAt(0, img);
        viewRef.current.natW = img.width || 1;
        viewRef.current.natH = img.height || 1;
        // إسقاط الضربات القديمة عند تبديل الصورة جذرياً
        const strokes = fc2.getObjects().filter((o) => (o as unknown as Record<string, unknown>).isStroke);
        if (strokes.length) fc2.remove(...strokes);
        relayout();
        setImgError(null);
      })
      .catch(() => {
        if (cancelled) return;
        const msg = "Image failed to load";
        setImgError(msg);
        handlersRef.current.onImageError?.(msg);
      });
    return () => {
      cancelled = true;
    };
  }, [hasImage, imageUrl, relayout]);

  /* ---------- الطبقات/التحديد/الأداة/الزوم ---------- */

  useEffect(() => {
    syncTexts();
  }, [textLayers, syncTexts]);

  useEffect(() => {
    syncGenericLayers();
  }, [imageLayers, shapeLayers, solidLayers, syncGenericLayers]);

  useEffect(() => {
    if (!layerOrder || !layerOrder.length) return;
    const fc = fRef.current;
    if (!fc) return;
    try {
      const objFor = (kind: string, id: string): FabricObject[] => {
        if (kind === "text") {
          const tb = tbMap.current.get(id);
          const rc = rectMap.current.get(id);
          const out: FabricObject[] = [];
          if (rc) out.push(rc as unknown as FabricObject);
          if (tb) out.push(tb as unknown as FabricObject);
          return out;
        }
        if (kind === "image") {
          const o = imgLayerMap.current.get(id);
          return o ? [o] : [];
        }
        if (kind === "shape") {
          const o = shapeMap.current.get(id);
          return o ? [o] : [];
        }
        if (kind === "solid") {
          const o = solidMap.current.get(id);
          return o ? [o] : [];
        }
        return [];
      };
      for (const ref of layerOrder) {
        if (ref.id === "__background__") continue;
        for (const o of objFor(ref.kind, ref.id)) {
          try {
            if ((fc.getObjects() as unknown[]).includes(o)) fc.bringObjectToFront(o);
          } catch { /* تجاهل */ }
        }
      }
      const bg = bgRef.current;
      if (bg) {
        try {
          if ((fc.getObjects() as unknown[]).includes(bg as unknown)) fc.sendObjectToBack(bg);
        } catch { /* تجاهل */ }
      }
      fc.requestRenderAll();
    } catch { /* تجاهل */ }
  }, [layerOrder]);

  useEffect(() => {
    const fc = fRef.current;
    if (!fc) return;
    if (!selectedTextId && !selectedLayer) {
      if (fc.getActiveObject()) {
        fc.discardActiveObject();
        fc.requestRenderAll();
      }
      return;
    }
    if (selectedTextId) {
      const tb = tbMap.current.get(selectedTextId);
      if (tb && fc.getActiveObject() !== tb) {
        try {
          fc.setActiveObject(tb);
          fc.requestRenderAll();
        } catch {
          /* تجاهل */
        }
      }
      return;
    }
    if (selectedLayer && selectedLayer.kind !== "text") {
      const obj = selectedLayer.kind === "image" ? imgLayerMap.current.get(selectedLayer.id) : shapeMap.current.get(selectedLayer.id);
      if (obj && fc.getActiveObject() !== obj) {
        try {
          fc.setActiveObject(obj);
          fc.requestRenderAll();
        } catch {
          /* تجاهل */
        }
      }
    }
  }, [selectedTextId, selectedLayer]);

  useEffect(() => {
    const fc = fRef.current;
    if (!fc) return;
    const drawing = activeTool === "brush" && hasImage;
    fc.isDrawingMode = drawing;
    if (drawing) {
      try {
        const brush = new PencilBrush(fc);
        brush.color = BRUSH_COLOR;
        brush.width = BRUSH_SIZE;
        fc.freeDrawingBrush = brush;
      } catch {
        /* تجاهل */
      }
    } else if (fc.freeDrawingBrush) {
      try {
        fc.freeDrawingBrush = undefined as never;
      } catch {
        /* تجاهل */
      }
    }
    try {
      fc.selection = activeTool === "select";
      fc.defaultCursor = TOOL_CURSORS[activeTool] ?? "default";
      fc.freeDrawingCursor = "crosshair";
    } catch {
      /* تجاهل */
    }
    fc.requestRenderAll();
  }, [activeTool, hasImage]);

  useEffect(() => {
    relayout();
  }, [zoom, relayout]);

  /* ---------- أسهم التحريك والحذف ---------- */

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!selectedTextId) return;
      const target = e.target as HTMLElement;
      if (target.tagName === "TEXTAREA" || target.tagName === "INPUT") return;
      const H = handlersRef.current;
      const layer = layersRef.current.find((t) => t.id === selectedTextId);
      if (!layer || layer.locked) return;
      const box = viewRef.current.box;
      const stepX = (e.shiftKey ? 10 : 1) / Math.max(1, box.w);
      const stepY = (e.shiftKey ? 10 : 1) / Math.max(1, box.h);
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        H.onUpdateText?.(layer.id, { x: layer.x - stepX });
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        H.onUpdateText?.(layer.id, { x: layer.x + stepX });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        H.onUpdateText?.(layer.id, { y: layer.y - stepY });
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        H.onUpdateText?.(layer.id, { y: layer.y + stepY });
      } else if ((e.key === "Delete" || e.key === "Backspace") && H.onDeleteText) {
        e.preventDefault();
        H.onDeleteText(layer.id);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedTextId]);

  /* ---------- إدخال/سحب الملفات ---------- */

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDraggingOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDraggingOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDraggingOver(false);
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith("image/")) handlersRef.current.onImageDrop?.(file);
    },
    []
  );

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handlersRef.current.onImageDrop?.(file);
    e.target.value = "";
  }, []);

  function zoomIn() {
    const next = ZOOM_STEPS.find((z) => z > zoom) ?? zoom;
    onZoomChange?.(next);
  }
  function zoomOut() {
    const prev = [...ZOOM_STEPS].reverse().find((z) => z < zoom) ?? zoom;
    onZoomChange?.(prev);
  }
  function resetZoom() {
    onZoomChange?.(100);
  }

  const status = busy || error || toast || imgError;
  const cursor = TOOL_CURSORS[activeTool] ?? "default";
  const showEmptyBoard = !hasImage;

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{ background: "var(--background)", cursor, minHeight: 0, minWidth: 0 }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onContextMenu={(e) => e.preventDefault()}
    >
      {!hasImage && textLayers.length === 0 && <GridTexture />}

      <div ref={containerRef} style={{ position: "absolute", inset: 0, overflow: "hidden", touchAction: "none" }}>
        <canvas ref={elRef} style={{ display: "block" }} />
      </div>

      {showEmptyBoard && textLayers.length === 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
              padding: 48,
              border: `1.5px dashed ${draggingOver ? "var(--accent)" : "var(--border)"}`,
              borderRadius: 8,
              background: draggingOver ? "rgba(201,123,74,0.04)" : "transparent",
              minWidth: 360,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 40,
                height: 40,
                borderRadius: 8,
                background: "var(--secondary)",
              }}
            >
              <Upload size={18} strokeWidth={1.5} style={{ color: "var(--muted-foreground)" }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <p style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)", margin: 0 }}>
                Drop an image here
              </p>
              <p style={{ fontSize: 11, color: "var(--muted-foreground)", margin: 0 }}>
                PNG, JPG, WEBP, GIF, SVG — up to 15 MB · or press T and click to add text
              </p>
            </div>
            <label
              style={{
                padding: "6px 12px",
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 500,
                cursor: "pointer",
                background: "var(--secondary)",
                color: "var(--foreground)",
                border: "1px solid var(--border)",
                pointerEvents: "auto",
              }}
            >
              Browse files
              <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileInput} />
            </label>
          </div>
        </div>
      )}

      {hasImage && (
        <button
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 32,
            height: 32,
            borderRadius: "50%",
            zIndex: 20,
            background: "var(--secondary)",
            color: "var(--foreground)",
            border: "1px solid var(--border)",
            cursor: "pointer",
          }}
          onClick={() => fileInputRef.current?.click()}
          title="Open another image"
        >
          <Plus size={15} strokeWidth={2} />
        </button>
      )}
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileInput} />

      {status && (
        <div
          style={{
            position: "absolute",
            bottom: 64,
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 16px",
            borderRadius: 8,
            zIndex: 30,
            background: error ? "var(--danger)" : toast && !busy && !error ? "var(--card)" : "var(--card)",
            border: "1px solid var(--border)",
            boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
            color: error ? "#fff" : "var(--foreground)",
            pointerEvents: "none",
          }}
        >
          {busy && !error && <ProgressDots />}
          <span style={{ fontSize: 12, color: error ? "#fff" : "var(--foreground)" }}>{status}</span>
        </div>
      )}

      {(hasImage || textLayers.length > 0) && (
        <div
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            zIndex: 20,
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 10px",
            borderRadius: 999,
            background: "var(--card)",
            border: "1px solid var(--border)",
            fontSize: 11,
            color: "var(--muted-foreground)",
            pointerEvents: "none",
          }}
        >
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--accent)", display: "inline-block" }} />
          {activeTool} · fabric engine {activeTool === "text" ? "— click canvas to add text · drag to move · double-click to edit" : activeTool === "brush" ? "— drag to paint" : activeTool === "eraser" ? "— drag over strokes to erase" : activeTool === "select" ? "— click text to select · arrows nudge · Del deletes" : ""}
        </div>
      )}

      <div
        style={{
          position: "absolute",
          bottom: 16,
          right: 16,
          display: "flex",
          alignItems: "center",
          gap: 2,
          borderRadius: 8,
          padding: "2px 4px",
          transition: "opacity 150ms",
          opacity: 0.85,
          zIndex: 20,
          background: "var(--card)",
          border: "1px solid var(--border)",
        }}
      >
        <ZoomControlBtn icon={<ZoomOut size={13} strokeWidth={2} />} onClick={zoomOut} label="Zoom out" />
        <button
          style={{
            padding: "0 8px",
            height: 28,
            fontSize: 12,
            fontWeight: 500,
            fontVariantNumeric: "tabular-nums",
            color: "var(--muted-foreground)",
            minWidth: 48,
            textAlign: "center",
            background: "transparent",
            border: "none",
            cursor: "pointer",
          }}
          onClick={resetZoom}
          title="Reset zoom"
        >
          {zoom}%
        </button>
        <ZoomControlBtn icon={<ZoomIn size={13} strokeWidth={2} />} onClick={zoomIn} label="Zoom in" />
        <div style={{ width: 1, height: 16, margin: "0 2px", background: "var(--border)" }} />
        <ZoomControlBtn icon={<Maximize2 size={12} strokeWidth={2} />} onClick={resetZoom} label="Fit to screen" />
      </div>
    </div>
  );
});

function ZoomControlBtn({ icon, onClick, label }: { icon: React.ReactNode; onClick: () => void; label: string }) {
  return (
    <button
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 28,
        height: 28,
        borderRadius: 4,
        color: "var(--muted-foreground)",
        background: "transparent",
        border: "none",
        cursor: "pointer",
      }}
      onClick={onClick}
      title={label}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = "var(--foreground)";
        e.currentTarget.style.background = "var(--secondary)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = "var(--muted-foreground)";
        e.currentTarget.style.background = "transparent";
      }}
    >
      {icon}
    </button>
  );
}

function GridTexture() {
  return (
    <svg
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", opacity: 0.18 }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
          <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#2A2927" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />
    </svg>
  );
}

function ProgressDots() {
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            width: 4,
            height: 4,
            borderRadius: "50%",
            background: "var(--accent)",
            animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes pulse {
          0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

export default Canvas;
