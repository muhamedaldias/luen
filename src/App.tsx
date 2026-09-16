import { useState, useCallback, useEffect, useRef } from "react";
import { Panel, Group, Separator } from "react-resizable-panels";
import TopBar from "./components/TopBar";
import LeftToolbar from "./components/LeftToolbar";
import Canvas, { type FabricStageHandle } from "./components/Canvas";
import RightPanel from "./components/RightPanel";
import BottomBar from "./components/BottomBar";
import AgentDock from "./components/AgentDock";
import SettingsModal from "./components/SettingsModal";
import { themes, applyTheme } from "./themes";
import { uploadImage, runAndWait, resolveUrl } from "./lib/api";
import { createTextLayer, type TextLayer } from "./lib/textLayers";
import { exportFlattenedDataUrl } from "./lib/exportComposite";
import { toCleanDataUrlBestEffort } from "./lib/safeImage";
import { downloadProject, readProjectFile } from "./lib/projectFile";
import { applyLocalOp, getNaturalSize } from "./lib/localOps";
import MenuDialog, { type DialogKind } from "./components/MenuDialog";
import MaskEditor from "./components/MaskEditor";
import NewLayerDialog, { type NewLayerChoice } from "./components/NewLayerDialog";
import NewCanvasDialog, { type NewCanvasOpts } from "./components/NewCanvasDialog";
import BlendDialog from "./components/BlendDialog";
import { createImageLayer, createShapeLayer, createSolidLayer, type ImageLayer, type ShapeLayer, type SolidLayer } from "./lib/layers";
import {
  BG_ID,
  syncOrder,
  moveRef,
  dragReorder,
  alignPatches,
  distributePatches,
  createGroupId,
  toggleSelection,
  normBlend,
  type LayerRef,
  type AlignMode,
} from "./lib/layerSystem";
import {
  cloneLayers,
  emptyEntry,
  getMaxHistory,
  type CanvasImage,
  type HistoryEntry,
} from "./lib/history";

type ToolId =
  | "select"
  | "crop"
  | "brush"
  | "text"
  | "shape"
  | "smart-select"
  | "eraser"
  | "eyedropper"
  | "pan"
  | "zoom";

const toolLabels: Record<ToolId, string> = {
  select: "Select",
  crop: "Crop",
  brush: "Brush",
  text: "Text",
  shape: "Shape",
  "smart-select": "Smart Select",
  eraser: "Eraser",
  eyedropper: "Eyedropper",
  pan: "Pan",
  zoom: "Zoom",
};

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("FileReader failed"));
    reader.readAsDataURL(file);
  });
}

/** تكبير قناع المحرر (دقة العرض) إلى دقة الصورة الكاملة قبل Inpaint —
 *  يمنع التشوه والحواف الخشنة الناتجة عن قناع منخفض الدقة. */
async function upscaleMaskToImage(maskUrl: string, imageUrl: string): Promise<string> {
  const [maskImg, baseImg] = await Promise.all([
    new Promise<HTMLImageElement>((resolve, reject) => {
      const m = new Image();
      m.onload = () => resolve(m);
      m.onerror = () => reject(new Error("mask decode failed"));
      m.src = maskUrl;
    }),
    new Promise<HTMLImageElement>((resolve, reject) => {
      const b = new Image();
      b.onload = () => resolve(b);
      b.onerror = () => reject(new Error("base decode failed"));
      b.src = imageUrl;
    }),
  ]);
  const W = baseImg.naturalWidth || 1024;
  const H = baseImg.naturalHeight || 1024;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d");
  if (!ctx) return maskUrl;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(maskImg, 0, 0, W, H);
  return c.toDataURL("image/png");
}

export default function App() {
  const [activeTool, setActiveTool] = useState<ToolId>("select");
  const [zoom, setZoom] = useState(100);
  const [busy, setBusy] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [agentCollapsed, setAgentCollapsed] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [currentTheme, setCurrentTheme] = useState("ember");
  const [textLayers, setTextLayers] = useState<TextLayer[]>([]);
  const [imageLayers, setImageLayers] = useState<ImageLayer[]>([]);
  const [shapeLayers, setShapeLayers] = useState<ShapeLayer[]>([]);
  const [solidLayers, setSolidLayers] = useState<SolidLayer[]>([]);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [selectedLayer, setSelectedLayer] = useState<{ kind: string; id: string } | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [layerOrder, setLayerOrder] = useState<LayerRef[]>([]);
  const [groupNames, setGroupNames] = useState<Record<string, string>>({});
  const [rightTab, setRightTab] = useState<"layers" | "design" | "adjustments" | "history">("layers");
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [menuDialog, setMenuDialog] = useState<DialogKind | null>(null);
  const [maskEditorOpen, setMaskEditorOpen] = useState(false);
  const [newLayerOpen, setNewLayerOpen] = useState(false);
  const [newCanvasOpen, setNewCanvasOpen] = useState(false);
  const [docSize, setDocSize] = useState({ w: 1200, h: 800 });
  const [blendOpen, setBlendOpen] = useState(false);
  const [shapeKind, setShapeKind] = useState<"rect" | "ellipse">("rect");
  const [showGrid, setShowGrid] = useState(false);
  const [showRulers, setShowRulers] = useState(true);

  // ── Undo/Redo: لقطات Memento بحد تكيّفي حسب حجم الصورة (انظر lib/history.ts) ──
  const [history, setHistory] = useState<HistoryEntry[]>([emptyEntry("Open")]);
  const [historyIdx, setHistoryIdx] = useState(0);
  const historyRef = useRef<HistoryEntry[]>([emptyEntry("Open")]);
  const historyIdxRef = useRef(0);
  const stageRef = useRef<FabricStageHandle | null>(null);
  const imageRef = useRef<CanvasImage | null>(null);
  const layersRef = useRef<TextLayer[]>([]);
  const imageLayersRef = useRef<ImageLayer[]>([]);
  const shapeLayersRef = useRef<ShapeLayer[]>([]);
  const solidLayersRef = useRef<SolidLayer[]>([]);
  const orderRef = useRef<LayerRef[]>([]);
  const groupsRef = useRef<Record<string, string>>({});
  const selectedTextIdRef = useRef<string | null>(null);
  const activeToolRef = useRef<ToolId>("select");
  const shapeKindRef = useRef<"rect" | "ellipse">("rect");
  const [canvasImage, setCanvasImage] = useState<CanvasImage | null>(null);

  useEffect(() => {
    imageRef.current = canvasImage;
  }, [canvasImage]);
  useEffect(() => {
    selectedTextIdRef.current = selectedTextId;
  }, [selectedTextId]);
  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);
  useEffect(() => {
    shapeKindRef.current = shapeKind;
  }, [shapeKind]);
  useEffect(() => {
    layersRef.current = textLayers;
  }, [textLayers]);
  useEffect(() => {
    imageLayersRef.current = imageLayers;
  }, [imageLayers]);
  useEffect(() => {
    shapeLayersRef.current = shapeLayers;
  }, [shapeLayers]);
  useEffect(() => {
    solidLayersRef.current = solidLayers;
  }, [solidLayers]);
  useEffect(() => {
    orderRef.current = layerOrder;
  }, [layerOrder]);
  useEffect(() => {
    groupsRef.current = groupNames;
  }, [groupNames]);

  // مزامنة الترتيب الموحد تلقائياً: يحافظ على ترتيب المستخدم ويضيف الجديد في الأعلى والخلفية في الأسفل
  useEffect(() => {
    setLayerOrder((prev) =>
      syncOrder(prev, {
        hasBackground: canvasImage !== null,
        texts: textLayers,
        images: imageLayers,
        shapes: shapeLayers,
        solids: solidLayers,
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasImage !== null, textLayers.length, imageLayers.length, shapeLayers.length, solidLayers.length]);

  useEffect(() => {
    const theme = themes.find((t) => t.id === currentTheme);
    if (theme) applyTheme(theme);
  }, [currentTheme]);

  const restoreIdx = useCallback(async (next: number) => {
    const h = historyRef.current;
    const clamped = Math.max(0, Math.min(h.length - 1, next));
    const entry = h[clamped];
    if (!entry) return;
    historyIdxRef.current = clamped;
    setHistoryIdx(clamped);
    setCanvasImage(entry.image ? { ...entry.image } : null);
    setTextLayers(cloneLayers(entry.layers ?? []));
    setImageLayers(cloneLayers(entry.imageLayers ?? []));
    setShapeLayers(cloneLayers(entry.shapeLayers ?? []));
    setSolidLayers(cloneLayers(entry.solidLayers ?? []));
    setLayerOrder(entry.order ? [...entry.order] : []);
    setGroupNames(entry.groups ? { ...entry.groups } : {});
    setSelectedTextId(null);
    setSelectedLayer(null);
    setSelectedIds([]);
    try {
      await stageRef.current?.setStrokes(entry.strokes ?? []);
    } catch {
      /* الاستعادة الجزئية مقبولة */
    }
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === "TEXTAREA" || target.tagName === "INPUT" || target.tagName === "SELECT") return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        void restoreIdx(historyIdxRef.current - 1);
        return;
      }
      if ((mod && e.key.toLowerCase() === "y") || (mod && e.key.toLowerCase() === "z" && e.shiftKey)) {
        e.preventDefault();
        void restoreIdx(historyIdxRef.current + 1);
        return;
      }
      if (mod) return;
      const k = e.key.toLowerCase();
      if (k === "v") setActiveTool("select");
      else if (k === "t") setActiveTool("text");
      else if (k === "b") setActiveTool("brush");
      else if (k === "e") setActiveTool("eraser");
      else if (k === "h") setActiveTool("pan");
      else if (k === "z") setActiveTool("zoom");
      else if (k === "u") {
        if (activeToolRef.current === "shape") {
          setShapeKind(shapeKindRef.current === "rect" ? "ellipse" : "rect");
        } else {
          setActiveTool("shape");
        }
      } else if (k === "g") {
        setShowGrid((v) => !v);
      } else if (k === "r") {
        setShowRulers((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [restoreIdx]);

  // دمج ضربات fabric المعلقة في الصورة قبل أي عملية raster (فلاتر/إزالة/تصدير).
  const bakeFlush = useCallback(async (): Promise<CanvasImage | null> => {
    try {
      const url = await stageRef.current?.flushStrokes();
      if (url && imageRef.current) {
        const next = { ...imageRef.current, url };
        setCanvasImage(next);
        imageRef.current = next;
      }
    } catch {
      /* لا ضربات أو فشل الدمج — نكمل */
    }
    return imageRef.current;
  }, []);

  const pushHistory = useCallback(
    (label: string, next?: { image?: CanvasImage | null; layers?: TextLayer[]; imageLayers?: ImageLayer[]; shapeLayers?: ShapeLayer[]; solidLayers?: SolidLayer[]; order?: LayerRef[]; groups?: Record<string, string> }) => {
      let strokes: object[] = [];
      try {
        const raw = stageRef.current?.getStrokes() ?? [];
        strokes = raw.length > 250 ? raw.slice(-250) : raw;
      } catch {
        strokes = [];
      }
      const imgNext = next && "image" in next ? next.image ?? null : imageRef.current ? { ...imageRef.current } : null;
      const tNext = next?.layers ?? layersRef.current;
      const iNext = next?.imageLayers ?? imageLayersRef.current;
      const sNext = next?.shapeLayers ?? shapeLayersRef.current;
      const fNext = next?.solidLayers ?? solidLayersRef.current;
      const freshOrder = next?.order
        ? [...next.order]
        : syncOrder(orderRef.current, { hasBackground: imgNext !== null, texts: tNext, images: iNext, shapes: sNext, solids: fNext });
      if (!next?.order) {
        orderRef.current = freshOrder;
        setLayerOrder(freshOrder);
      }
      const snapshot: HistoryEntry = {
        label,
        image: imgNext,
        layers: cloneLayers(tNext),
        imageLayers: cloneLayers(iNext),
        shapeLayers: cloneLayers(sNext),
        solidLayers: cloneLayers(fNext),
        strokes,
        order: freshOrder,
        groups: next?.groups ? { ...next.groups } : { ...groupsRef.current },
      };
      const h = historyRef.current;
      const idx = historyIdxRef.current;
      let entries = [...h.slice(0, idx + 1), snapshot];
      let nextIdx = idx + 1;
      const maxHist = getMaxHistory(imgNext);
      if (entries.length > maxHist) {
        const drop = entries.length - maxHist;
        entries = entries.slice(drop);
        nextIdx -= drop;
      }
      historyRef.current = entries;
      historyIdxRef.current = nextIdx;
      setHistory(entries);
      setHistoryIdx(nextIdx);
    },
    []
  );

  /* ── نظام الطبقات الموحد: ترتيب + دمج + مجموعات + محاذاة ── */
  const kindOfId = useCallback((id: string): string | null => {
    if (id === BG_ID) return "background";
    if (layersRef.current.some((l) => l.id === id)) return "text";
    if (imageLayersRef.current.some((l) => l.id === id)) return "image";
    if (shapeLayersRef.current.some((l) => l.id === id)) return "shape";
    if (solidLayersRef.current.some((l) => l.id === id)) return "solid";
    return null;
  }, []);

  const handleBlendChange = useCallback(
    (id: string, blend: string) => {
      const b = normBlend(blend);
      const kind = kindOfId(id);
      if (kind === "text") {
        const next = layersRef.current.map((l) => (l.id === id ? { ...l, blendMode: b } : l));
        setTextLayers(next);
        pushHistory("Blend mode", { layers: next });
      } else if (kind === "image") {
        const next = imageLayersRef.current.map((l) => (l.id === id ? { ...l, blendMode: b } : l));
        setImageLayers(next);
        pushHistory("Blend mode", { imageLayers: next });
      } else if (kind === "shape") {
        const next = shapeLayersRef.current.map((l) => (l.id === id ? { ...l, blendMode: b } : l));
        setShapeLayers(next);
        pushHistory("Blend mode", { shapeLayers: next });
      } else if (kind === "solid") {
        const next = solidLayersRef.current.map((l) => (l.id === id ? { ...l, blendMode: b } : l));
        setSolidLayers(next);
        pushHistory("Blend mode", { solidLayers: next });
      }
    },
    [kindOfId, pushHistory]
  );

  const handleMoveLayer = useCallback(
    (id: string, dir: "front" | "back" | "forward" | "backward") => {
      setLayerOrder((prev) => {
        const next = moveRef(prev, id, dir);
        orderRef.current = next;
        pushHistory(dir === "front" ? "Bring to front" : dir === "back" ? "Send to back" : dir === "forward" ? "Bring forward" : "Send backward", { order: next });
        return next;
      });
    },
    [pushHistory]
  );

  const handleDragReorder = useCallback(
    (dragId: string, targetId: string, after: boolean) => {
      setLayerOrder((prev) => {
        const next = dragReorder(prev, dragId, targetId, after);
        if (next === prev) return prev;
        orderRef.current = next;
        pushHistory("Reorder layers", { order: next });
        return next;
      });
    },
    [pushHistory]
  );

  const handleSelectMany = useCallback(
    (ids: string[], additive?: boolean) => {
      if (!additive) {
        setSelectedIds(ids);
        const last = ids[ids.length - 1] ?? null;
        if (!last || last === BG_ID) {
          setSelectedTextId(null);
          setSelectedLayer(null);
        } else {
          const k = kindOfId(last);
          if (k === "text") {
            setSelectedTextId(last);
            setSelectedLayer({ kind: "text", id: last });
          } else if (k) {
            setSelectedTextId(null);
            setSelectedLayer({ kind: k, id: last });
          }
        }
        return;
      }
      setSelectedIds((prev) => {
        let next = [...prev];
        for (const id of ids) next = toggleSelection(next, id, true);
        const last = next[next.length - 1] ?? null;
        if (!last || last === BG_ID) {
          setSelectedTextId(null);
          setSelectedLayer(null);
        } else {
          const k = kindOfId(last);
          if (k === "text") {
            setSelectedTextId(last);
            setSelectedLayer({ kind: "text", id: last });
          } else if (k) {
            setSelectedTextId(null);
            setSelectedLayer({ kind: k, id: last });
          }
        }
        return next;
      });
    },
    [kindOfId]
  );

  const handleGroupSelected = useCallback(() => {
    const ids = selectedIds.filter((id) => id !== BG_ID && kindOfId(id));
    if (ids.length < 2) return;
    const gid = createGroupId();
    const gname = `Group ${Object.keys(groupsRef.current).length + 1}`;
    const applyGroup = <T extends { id: string }>(arr: T[]): T[] =>
      arr.map((l) => (ids.includes(l.id) ? ({ ...l, groupId: gid } as T) : l));
    const tNext = applyGroup(layersRef.current);
    const iNext = applyGroup(imageLayersRef.current);
    const sNext = applyGroup(shapeLayersRef.current);
    const fNext = applyGroup(solidLayersRef.current);
    setTextLayers(tNext);
    setImageLayers(iNext);
    setShapeLayers(sNext);
    setSolidLayers(fNext);
    const gNext = { ...groupsRef.current, [gid]: gname };
    setGroupNames(gNext);
    pushHistory(`Group ${ids.length} layers`, { layers: tNext, imageLayers: iNext, shapeLayers: sNext, solidLayers: fNext, groups: gNext });
  }, [selectedIds, kindOfId, pushHistory]);

  const handleUngroup = useCallback(
    (gid: string) => {
      const clear = <T extends { id: string; groupId?: string | null }>(arr: T[]): T[] =>
        arr.map((l) => (l.groupId === gid ? ({ ...l, groupId: null } as T) : l));
      const tNext = clear(layersRef.current);
      const iNext = clear(imageLayersRef.current);
      const sNext = clear(shapeLayersRef.current);
      const fNext = clear(solidLayersRef.current);
      setTextLayers(tNext);
      setImageLayers(iNext);
      setShapeLayers(sNext);
      setSolidLayers(fNext);
      const gNext = { ...groupsRef.current };
      delete gNext[gid];
      setGroupNames(gNext);
      pushHistory("Ungroup", { layers: tNext, imageLayers: iNext, shapeLayers: sNext, solidLayers: fNext, groups: gNext });
    },
    [pushHistory]
  );

  const collectBoxes = useCallback(() => {
    const boxes: { id: string; x: number; y: number; w: number; h: number }[] = [];
    for (const l of layersRef.current) boxes.push({ id: l.id, x: l.x, y: l.y, w: l.w, h: 0.12 });
    for (const l of imageLayersRef.current) boxes.push({ id: l.id, x: l.x, y: l.y, w: l.w, h: l.h });
    for (const l of shapeLayersRef.current) boxes.push({ id: l.id, x: l.x, y: l.y, w: l.w, h: l.h });
    return boxes;
  }, []);

  const handleAlign = useCallback(
    (mode: AlignMode) => {
      const ids = selectedIds.filter((id) => kindOfId(id) && id !== BG_ID);
      if (ids.length < 2) return;
      const patches = alignPatches(collectBoxes(), ids, mode);
      if (!Object.keys(patches).length) return;
      const applyPatch = <T extends { id: string; x: number; y: number }>(arr: T[]): T[] =>
        arr.map((l) => (patches[l.id] ? ({ ...l, ...patches[l.id] } as T) : l));
      const tNext = applyPatch(layersRef.current);
      const iNext = applyPatch(imageLayersRef.current);
      const sNext = applyPatch(shapeLayersRef.current);
      setTextLayers(tNext);
      setImageLayers(iNext);
      setShapeLayers(sNext);
      pushHistory(`Align ${mode}`, { layers: tNext, imageLayers: iNext, shapeLayers: sNext });
    },
    [selectedIds, kindOfId, collectBoxes, pushHistory]
  );

  const handleDistribute = useCallback(
    (axis: "x" | "y") => {
      const ids = selectedIds.filter((id) => kindOfId(id) && id !== BG_ID);
      if (ids.length < 3) return;
      const patches = distributePatches(collectBoxes(), ids, axis);
      if (!Object.keys(patches).length) return;
      const applyPatch = <T extends { id: string; x: number; y: number }>(arr: T[]): T[] =>
        arr.map((l) => (patches[l.id] ? ({ ...l, ...patches[l.id] } as T) : l));
      const tNext = applyPatch(layersRef.current);
      const iNext = applyPatch(imageLayersRef.current);
      const sNext = applyPatch(shapeLayersRef.current);
      setTextLayers(tNext);
      setImageLayers(iNext);
      setShapeLayers(sNext);
      pushHistory("Distribute", { layers: tNext, imageLayers: iNext, shapeLayers: sNext });
    },
    [selectedIds, kindOfId, collectBoxes, pushHistory]
  );

  const handleRenameLayer = useCallback(
    (id: string, name: string) => {
      const clean = name.slice(0, 40) || "Layer";
      const kind = kindOfId(id);
      if (kind === "text") {
        const next = layersRef.current.map((l) => (l.id === id ? { ...l, name: clean } : l));
        setTextLayers(next);
        pushHistory("Rename layer", { layers: next });
      } else if (kind === "image") {
        const next = imageLayersRef.current.map((l) => (l.id === id ? { ...l, name: clean } : l));
        setImageLayers(next);
        pushHistory("Rename layer", { imageLayers: next });
      } else if (kind === "shape") {
        const next = shapeLayersRef.current.map((l) => (l.id === id ? { ...l, name: clean } : l));
        setShapeLayers(next);
        pushHistory("Rename layer", { shapeLayers: next });
      } else if (kind === "solid") {
        const next = solidLayersRef.current.map((l) => (l.id === id ? { ...l, name: clean } : l));
        setSolidLayers(next);
        pushHistory("Rename layer", { solidLayers: next });
      }
    },
    [kindOfId, pushHistory]
  );

  const handleAddText = useCallback(
    (x: number, y: number) => {
      const layer = createTextLayer({ x, y });
      const next = [...layersRef.current, layer];
      setTextLayers(next);
      setSelectedTextId(layer.id);
      setSelectedIds([layer.id]);
      setRightTab("design");
      setActiveTool("select");
      pushHistory("Add text", { layers: next });
    },
    [pushHistory]
  );

  const handleUpdateText = useCallback((id: string, patch: Partial<TextLayer>) => {
    setTextLayers((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }, []);

  const handleDeleteText = useCallback(
    (id: string) => {
      const next = layersRef.current.filter((l) => l.id !== id);
      setTextLayers(next);
      setSelectedTextId((s) => (s === id ? null : s));
      pushHistory("Delete text", { layers: next });
    },
    [pushHistory]
  );

  const handleDuplicateText = useCallback(
    (id: string) => {
      const src = layersRef.current.find((l) => l.id === id);
      if (!src) return;
      const copy = createTextLayer({ ...src, x: Math.min(0.8, src.x + 0.03), y: Math.min(0.8, src.y + 0.03), name: `${src.name} copy` });
      const next = [...layersRef.current, copy];
      setTextLayers(next);
      setSelectedTextId(copy.id);
      pushHistory("Duplicate text", { layers: next });
    },
    [pushHistory]
  );

  /* ── طبقات عامة: صورة / شكل / تعبئة ── */
  const handleNewLayerPick = useCallback(
    (choice: NewLayerChoice) => {
      setNewLayerOpen(false);
      if (choice.kind === "text") {
        handleAddText(0.3, 0.35);
        return;
      }
      if (choice.kind === "image") {
        const layer = createImageLayer({ url: choice.url, name: choice.name.slice(0, 24) || "Image layer" });
        const next = [...imageLayersRef.current, layer];
        setImageLayers(next);
        setSelectedLayer({ kind: "image", id: layer.id });
        setSelectedTextId(null);
        pushHistory("Add image layer", { imageLayers: next });
        return;
      }
      if (choice.kind === "shape") {
        const layer = createShapeLayer({ shape: choice.shape, name: `${choice.shape} shape` });
        const next = [...shapeLayersRef.current, layer];
        setShapeLayers(next);
        setSelectedLayer({ kind: "shape", id: layer.id });
        setSelectedTextId(null);
        pushHistory("Add shape", { shapeLayers: next });
        return;
      }
      const layer = createSolidLayer({ color: choice.color });
      const next = [...solidLayersRef.current, layer];
      setSolidLayers(next);
      setSelectedLayer({ kind: "solid", id: layer.id });
      setSelectedTextId(null);
      pushHistory("Add solid fill", { solidLayers: next });
    },
    [handleAddText, pushHistory]
  );

  const handleShapeDraw = useCallback(
    (shape: "rect" | "ellipse", geom: { x: number; y: number; w: number; h: number }) => {
      const layer = createShapeLayer({
        shape,
        x: geom.x,
        y: geom.y,
        w: geom.w,
        h: geom.h,
        name: shape === "ellipse" ? "Ellipse" : "Rectangle",
      });
      const next = [...shapeLayersRef.current, layer];
      setShapeLayers(next);
      setSelectedLayer({ kind: "shape", id: layer.id });
      setSelectedTextId(null);
      setSelectedIds([layer.id]);
      setRightTab("design");
      setActiveTool("select");
      pushHistory(shape === "ellipse" ? "Draw ellipse" : "Draw rectangle", { shapeLayers: next });
    },
    [pushHistory]
  );

  const handleDeleteGeneric = useCallback(
    (kind: string, id: string) => {
      const pruneOrder = (prev: LayerRef[]) => {
        const n = prev.filter((r) => r.id !== id);
        orderRef.current = n;
        return n;
      };
      if (kind === "text") {
        const next = layersRef.current.filter((l) => l.id !== id);
        setTextLayers(next);
        setSelectedTextId((s) => (s === id ? null : s));
        setSelectedIds((ss) => ss.filter((x) => x !== id));
        setLayerOrder(pruneOrder);
        pushHistory("Delete text", { layers: next, order: orderRef.current });
        return;
      }
      if (kind === "image") {
        const next = imageLayersRef.current.filter((l) => l.id !== id);
        setImageLayers(next);
        setLayerOrder(pruneOrder);
        pushHistory("Delete image layer", { imageLayers: next, order: orderRef.current });
      } else if (kind === "shape") {
        const next = shapeLayersRef.current.filter((l) => l.id !== id);
        setShapeLayers(next);
        setLayerOrder(pruneOrder);
        pushHistory("Delete shape", { shapeLayers: next, order: orderRef.current });
      } else if (kind === "solid") {
        const next = solidLayersRef.current.filter((l) => l.id !== id);
        setSolidLayers(next);
        setLayerOrder(pruneOrder);
        pushHistory("Delete solid fill", { solidLayers: next, order: orderRef.current });
      }
      setSelectedLayer(null);
      setSelectedIds((ss) => ss.filter((x) => x !== id));
    },
    [pushHistory]
  );

  const handleDuplicateGeneric = useCallback(
    (kind: string, id: string) => {
      if (kind === "text") {
        handleDuplicateText(id);
        return;
      }
      if (kind === "image") {
        const src = imageLayersRef.current.find((l) => l.id === id);
        if (!src) return;
        const copy = createImageLayer({ ...src, x: Math.min(0.7, src.x + 0.03), y: Math.min(0.7, src.y + 0.03), name: `${src.name} copy` });
        const next = [...imageLayersRef.current, copy];
        setImageLayers(next);
        setSelectedLayer({ kind: "image", id: copy.id });
        setSelectedIds([copy.id]);
        pushHistory("Duplicate image layer", { imageLayers: next });
      } else if (kind === "shape") {
        const src = shapeLayersRef.current.find((l) => l.id === id);
        if (!src) return;
        const copy = createShapeLayer({ ...src, x: Math.min(0.7, src.x + 0.03), y: Math.min(0.7, src.y + 0.03), name: `${src.name} copy` });
        const next = [...shapeLayersRef.current, copy];
        setShapeLayers(next);
        setSelectedLayer({ kind: "shape", id: copy.id });
        setSelectedIds([copy.id]);
        pushHistory("Duplicate shape", { shapeLayers: next });
      } else if (kind === "solid") {
        const src = solidLayersRef.current.find((l) => l.id === id);
        if (!src) return;
        const copy = createSolidLayer({ ...src, name: `${src.name} copy` });
        const next = [...solidLayersRef.current, copy];
        setSolidLayers(next);
        setSelectedLayer({ kind: "solid", id: copy.id });
        setSelectedIds([copy.id]);
        pushHistory("Duplicate solid fill", { solidLayers: next });
      }
    },
    [pushHistory]
  );

  const handleImageDrop = useCallback(async (file: File) => {
    setBusy(`Loading ${file.name}…`);
    setLoadError(null);

    let dataUrl: string | null = null;
    let uploaded: Awaited<ReturnType<typeof uploadImage>> | null = null;

    try {
      dataUrl = await fileToDataUrl(file);
    } catch {
      dataUrl = null;
    }

    try {
      uploaded = await uploadImage(file);
    } catch {
      uploaded = null;
    }

    if (dataUrl) {
      // الأبعاد الحقيقية من الملف نفسه — تعمل حتى بلا باكند.
      let natural = { width: 0, height: 0 };
      try {
        natural = await getNaturalSize(dataUrl);
      } catch {
        natural = { width: 0, height: 0 };
      }
      const newImage = {
        url: dataUrl,
        imageId: uploaded?.image_id ?? null,
        width: uploaded?.width ?? natural.width,
        height: uploaded?.height ?? natural.height,
      };
      setCanvasImage(newImage);
      pushHistory(`Open ${file.name}${uploaded ? "" : " (local)"}`, { image: newImage });
    } else if (uploaded) {
      const newImage = {
        url: uploaded.url,
        imageId: uploaded.image_id,
        width: uploaded.width,
        height: uploaded.height,
      };
      setCanvasImage(newImage);
      pushHistory(`Open ${file.name}`, { image: newImage });
    } else {
      setLoadError("Could not load this image at all");
    }

    setBusy(null);
  }, [pushHistory]);

  async function handleApply(opName: string, params: Record<string, number | string>): Promise<string | null> {
    await bakeFlush();
    const current = imageRef.current;
    if (!current) {
      setLoadError("Open an image first");
      return null;
    }
    // بلا imageId (الباكند غير متصل): معالجة محلية داخل المتصفح — تعمل دائماً.
    if (!current.imageId) {
      setBusy("Processing…");
      setLoadError(null);
      try {
        const r = await applyLocalOp(current.url, opName, params);
        const next = { ...current, url: r.url, width: r.width, height: r.height };
        setCanvasImage(next);
        pushHistory(opName, { image: next });
        return r.url;
      } catch (err) {
        setLoadError(err instanceof Error && err.message ? err.message : "Operation failed");
        return null;
      } finally {
        setBusy(null);
      }
    }
    setBusy("Processing…");
    setLoadError(null);
    try {
      const resultUrl = await runAndWait(opName, current.imageId, params);
      // تحويل نتيجة السيرفر إلى dataURL نظيفة فوراً: الكانفس يبقى origin-clean
      // فلا يظهر خطأ tainted canvas أبداً عند الحفظ/التصدير لاحقاً.
      const cleanUrl = await toCleanDataUrlBestEffort(resolveUrl(resultUrl));
      const next = { ...current, url: cleanUrl };
      try {
        const nat = await getNaturalSize(cleanUrl);
        if (nat.width > 0) {
          next.width = nat.width;
          next.height = nat.height;
        }
      } catch {
        /* أبعاد قديمة مقبولة */
      }
      setCanvasImage(next);
      pushHistory(opName, { image: next });
      return cleanUrl;
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : "Operation failed";
      setLoadError(message);
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function handleRemoveBackground() {
    if (!imageRef.current) {
      setLoadError("Open an image first — then remove background");
      return;
    }
    await handleApply("remove_background", {});
  }

  function requireImage(): boolean {
    if (!imageRef.current) {
      setLoadError("Open an image first — then use this action");
      return false;
    }
    return true;
  }

  async function handleFlatten() {
    await bakeFlush();
    const current = imageRef.current;
    const hasAny = current || layersRef.current.length > 0 || imageLayersRef.current.length > 0 || shapeLayersRef.current.length > 0 || solidLayersRef.current.length > 0;
    if (!hasAny) {
      setLoadError("Nothing to flatten — open an image first");
      return;
    }
    setBusy("Flattening…");
    try {
      const dataUrl = await exportFlattenedDataUrl({
        imageUrl: current?.url ?? null,
        width: current?.width ?? docSize.w,
        height: current?.height ?? docSize.h,
        textLayers: layersRef.current,
        imageLayers: imageLayersRef.current,
        shapeLayers: shapeLayersRef.current,
        solidLayers: solidLayersRef.current,
        order: orderRef.current,
      });
      const next = current ? { ...current, url: dataUrl } : null;
      if (next) {
        const img = new Image();
        await new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = dataUrl;
        });
        next.width = img.naturalWidth || next.width;
        next.height = img.naturalHeight || next.height;
      }
      setCanvasImage(next);
      setTextLayers([]);
      setImageLayers([]);
      setShapeLayers([]);
      setSolidLayers([]);
      setSelectedTextId(null);
      setSelectedLayer(null);
      setSelectedIds([]);
      pushHistory("Flatten image", { image: next, layers: [], imageLayers: [], shapeLayers: [], solidLayers: [] });
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Flatten failed");
    } finally {
      setBusy(null);
    }
  }

  async function handleMergeDown() {
    await bakeFlush();
    const layers = layersRef.current;
    const target = layers.find((l) => l.id === selectedTextIdRef.current) ?? layers[layers.length - 1];
    // دمج طبقة عامة (صورة/شكل) إن كانت هي المحددة بدل النص
    const selGen = selectedLayer;
    const current = imageRef.current;
    setBusy("Merging down…");
    try {
      if (selGen && selGen.kind !== "text") {
        const dataUrl = await exportFlattenedDataUrl({
          imageUrl: current?.url ?? null,
          width: current?.width ?? 0,
          height: current?.height ?? 0,
          textLayers: [],
          imageLayers: selGen.kind === "image" ? imageLayersRef.current.filter((l) => l.id === selGen.id) : [],
          shapeLayers: selGen.kind === "shape" ? shapeLayersRef.current.filter((l) => l.id === selGen.id) : [],
          solidLayers: selGen.kind === "solid" ? solidLayersRef.current.filter((l) => l.id === selGen.id) : [],
        });
        const next: CanvasImage | null = current ? { ...current, url: dataUrl } : null;
        if (selGen.kind === "image") {
          const rest = imageLayersRef.current.filter((l) => l.id !== selGen.id);
          setImageLayers(rest);
          pushHistory("Merge down", { image: next, imageLayers: rest });
        } else if (selGen.kind === "shape") {
          const rest = shapeLayersRef.current.filter((l) => l.id !== selGen.id);
          setShapeLayers(rest);
          pushHistory("Merge down", { image: next, shapeLayers: rest });
        } else {
          const rest = solidLayersRef.current.filter((l) => l.id !== selGen.id);
          setSolidLayers(rest);
          pushHistory("Merge down", { image: next, solidLayers: rest });
        }
        setCanvasImage(next);
        setSelectedLayer(null);
        return;
      }
      if (!target) {
        setLoadError("No layer to merge — add a layer first");
        return;
      }
      const dataUrl = await exportFlattenedDataUrl({
        imageUrl: current?.url ?? null,
        width: current?.width ?? 0,
        height: current?.height ?? 0,
        textLayers: [target],
      });
      const next = current ? { ...current, url: dataUrl } : null;
      const rest = layers.filter((l) => l.id !== target.id);
      setCanvasImage(next);
      setTextLayers(rest);
      setSelectedTextId(null);
      pushHistory("Merge down", { image: next, layers: rest });
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Merge failed");
    } finally {
      setBusy(null);
    }
  }

  async function copySelectedText(cut: boolean) {
    const sel = layersRef.current.find((l) => l.id === selectedTextIdRef.current);
    if (!sel) {
      setLoadError("Select a text layer first");
      return;
    }
    try {
      await navigator.clipboard.writeText(sel.text);
    } catch {
      setLoadError("Clipboard blocked by browser — select text manually");
      return;
    }
    if (cut) {
      const next = layersRef.current.filter((l) => l.id !== sel.id);
      setTextLayers(next);
      setSelectedTextId(null);
      pushHistory("Cut text", { layers: next });
    }
  }

  async function pasteText() {
    let text = "";
    try {
      text = await navigator.clipboard.readText();
    } catch {
      setLoadError("Clipboard blocked by browser — press T and click to add text");
      return;
    }
    if (!text.trim()) {
      setLoadError("Clipboard is empty");
      return;
    }
    const layer = createTextLayer({ x: 0.3, y: 0.35, text: text.slice(0, 500), name: text.slice(0, 24) || "Pasted text" });
    const next = [...layersRef.current, layer];
    setTextLayers(next);
    setSelectedTextId(layer.id);
    setRightTab("design");
    pushHistory("Paste text", { layers: next });
  }

  function handleMenuAction(item: string) {
    switch (item) {
      // — Image —
      case "Resize Canvas…":
        if (!requireImage()) return;
        setMenuDialog("resize-canvas");
        break;
      case "Crop to Selection":
        if (!requireImage()) return;
        setActiveTool("crop");
        break;
      case "Rotate 90° CW":
        if (!requireImage()) return;
        void handleApply("rotate", { angle: 270 });
        break;
      case "Rotate 90° CCW":
        if (!requireImage()) return;
        void handleApply("rotate", { angle: 90 });
        break;
      case "Flip Horizontal":
        if (!requireImage()) return;
        void handleApply("flip", { axis: "horizontal" });
        break;
      case "Flip Vertical":
        if (!requireImage()) return;
        void handleApply("flip", { axis: "vertical" });
        break;
      case "Image Size…":
        if (!requireImage()) return;
        setMenuDialog("image-size");
        break;
      // — Layer —
      case "New Layer":
      case "New Text Layer":
        setNewLayerOpen(true);
        break;
      case "New Image Layer…":
        setNewLayerOpen(true);
        break;
      case "New Shape…":
        setNewLayerOpen(true);
        break;
      case "New Solid Fill…":
        setNewLayerOpen(true);
        break;
      case "Duplicate Layer":
        if (selectedTextIdRef.current) {
          handleDuplicateText(selectedTextIdRef.current);
        } else if (selectedLayer) {
          handleDuplicateGeneric(selectedLayer.kind, selectedLayer.id);
        } else {
          setLoadError("Select a layer first");
          return;
        }
        break;
      case "Delete Layer":
        if (selectedTextIdRef.current) {
          handleDeleteText(selectedTextIdRef.current);
        } else if (selectedLayer) {
          handleDeleteGeneric(selectedLayer.kind, selectedLayer.id);
        } else {
          setLoadError("Select a layer first");
          return;
        }
        break;
      case "Merge Down":
        void handleMergeDown();
        break;
      case "Flatten Image":
        void handleFlatten();
        break;
      case "Bring Forward": {
        const id = selectedTextIdRef.current ?? selectedLayer?.id;
        if (!id) {
          setLoadError("Select a layer first");
          return;
        }
        handleMoveLayer(id, "forward");
        break;
      }
      case "Send Backward": {
        const id = selectedTextIdRef.current ?? selectedLayer?.id;
        if (!id) {
          setLoadError("Select a layer first");
          return;
        }
        handleMoveLayer(id, "backward");
        break;
      }
      case "Bring to Front": {
        const id = selectedTextIdRef.current ?? selectedLayer?.id;
        if (!id) {
          setLoadError("Select a layer first");
          return;
        }
        handleMoveLayer(id, "front");
        break;
      }
      case "Send to Back": {
        const id = selectedTextIdRef.current ?? selectedLayer?.id;
        if (!id) {
          setLoadError("Select a layer first");
          return;
        }
        handleMoveLayer(id, "back");
        break;
      }
      case "Group Selected":
        handleGroupSelected();
        break;
      case "Align Left":
        handleAlign("left");
        break;
      case "Align Center":
        handleAlign("centerX");
        break;
      case "Align Right":
        handleAlign("right");
        break;
      case "Align Top":
        handleAlign("top");
        break;
      case "Align Middle":
        handleAlign("centerY");
        break;
      case "Align Bottom":
        handleAlign("bottom");
        break;
      // — Edit —
      case "Cut":
        void copySelectedText(true);
        break;
      case "Copy":
        void copySelectedText(false);
        break;
      case "Paste":
        void pasteText();
        break;
      // — Filter —
      case "Blur…":
        if (!requireImage()) return;
        setMenuDialog("blur");
        break;
      case "Sharpen…":
        if (!requireImage()) return;
        setMenuDialog("sharpen");
        break;
      case "Brightness / Contrast…":
        if (!requireImage()) return;
        setMenuDialog("brightness-contrast");
        break;
      case "Hue / Saturation…":
        if (!requireImage()) return;
        setMenuDialog("hue-saturation");
        break;
      case "Grayscale":
        if (!requireImage()) return;
        void handleApply("grayscale", {});
        break;
      case "Sepia":
        if (!requireImage()) return;
        void handleApply("sepia", {});
        break;
      case "Vignette…":
        if (!requireImage()) return;
        setMenuDialog("vignette");
        break;
      case "Auto Enhance":
        if (!requireImage()) return;
        void handleApply("auto_enhance", {});
        break;
      case "Pro Enhance ✨":
        if (!requireImage()) return;
        void handleApply("pro_enhance", { strength: 70 });
        break;
      case "Blend Two Images…":
        if (!requireImage()) return;
        setBlendOpen(true);
        break;
      case "Remove Object…":
        if (!requireImage()) return;
        void (async () => {
          await bakeFlush();
          setMaskEditorOpen(true);
        })();
        break;
      case "AI Upscale…":
        if (!requireImage()) return;
        setMenuDialog("upscale");
        break;
      default:
        break;
    }
  }

  function handleDialogConfirm(params: Record<string, number | string>) {
    const kind = menuDialog;
    setMenuDialog(null);
    if (!kind || !imageRef.current) return;
    const opMap: Record<DialogKind, string> = {
      "resize-canvas": "resize_canvas",
      "image-size": "resize",
      blur: "blur",
      sharpen: "sharpen",
      "brightness-contrast": "brightness_contrast",
      "hue-saturation": "hue_saturation",
      vignette: "vignette",
      upscale: "upscale",
    };
    void handleApply(opMap[kind], params);
  }

  async function handleMaskApply(maskDataUrl: string) {
    await bakeFlush();
    const current = imageRef.current;
    if (!current) return;
    setBusy("Removing object…");
    setLoadError(null);
    try {
      let resultUrl: string;
      let w = current.width;
      let h = current.height;
      if (current.imageId) {
        // توسيع القناع لدقة الصورة الكاملة قبل الإرسال (بدل دقة العرض) + خوارزمية محسّنة.
        const fullMask = await upscaleMaskToImage(maskDataUrl, current.url).catch(() => maskDataUrl);
        const raw = await runAndWait("remove_object", current.imageId, { mask: fullMask, method: "ns", dilate: 5, radius: 7, feather: 2 });
        resultUrl = await toCleanDataUrlBestEffort(resolveUrl(raw));
        try {
          const nat = await getNaturalSize(resultUrl);
          if (nat.width > 0) {
            w = nat.width;
            h = nat.height;
          }
        } catch {
          /* تجاهل */
        }
      } else {
        const fullMask = await upscaleMaskToImage(maskDataUrl, current.url).catch(() => maskDataUrl);
        const r = await applyLocalOp(current.url, "remove_object", { mask: fullMask });
        resultUrl = r.url;
        w = r.width;
        h = r.height;
      }
      const next = { ...current, url: resultUrl, width: w, height: h };
      setCanvasImage(next);
      pushHistory("Remove object", { image: next });
      setMaskEditorOpen(false);
    } catch (err) {
      setLoadError(err instanceof Error && err.message ? err.message : "Remove object failed");
    } finally {
      setBusy(null);
    }
  }

  const canUndo = historyIdx > 0;
  const canRedo = historyIdx < history.length - 1;
  const saveState = busy ? "saving" : historyIdx > 0 ? "unsaved" : "saved";

  async function handleBlendConfirm(p: { foregroundUrl: string; foregroundId: string | null; mode: string; scale: number; x: number; y: number; feather: number; colorMatch: boolean }) {
    await bakeFlush();
    const current = imageRef.current;
    if (!current) {
      setLoadError("Open an image first");
      return;
    }
    setBusy("Blending…");
    setLoadError(null);
    try {
      const params: Record<string, number | string> = { mode: p.mode, scale: p.scale, x: p.x, y: p.y, feather: p.feather, color_match: p.colorMatch ? 1 : 0 };
      let cleanUrl: string;
      let w = current.width;
      let h = current.height;
      if (current.imageId && p.foregroundId) {
        params.foreground_id = p.foregroundId;
        const raw = await runAndWait("blend", current.imageId, params);
        cleanUrl = await toCleanDataUrlBestEffort(resolveUrl(raw));
      } else if (current.imageId) {
        params.foreground = p.foregroundUrl;
        const raw = await runAndWait("blend", current.imageId, params);
        cleanUrl = await toCleanDataUrlBestEffort(resolveUrl(raw));
      } else {
        const r = await applyLocalOp(current.url, "blend", { foreground: p.foregroundUrl, mode: p.mode, scale: p.scale, x: p.x, y: p.y, feather: p.feather });
        cleanUrl = r.url;
        w = r.width;
        h = r.height;
      }
      try {
        const nat = await getNaturalSize(cleanUrl);
        if (nat.width > 0) {
          w = nat.width;
          h = nat.height;
        }
      } catch {
        /* تجاهل */
      }
      const next = { ...current, url: cleanUrl, width: w, height: h };
      setCanvasImage(next);
      pushHistory(`Blend (${p.mode})`, { image: next });
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Blend failed");
    } finally {
      setBusy(null);
    }
  }

  async function downloadCurrentImage(filename: string) {
    await bakeFlush();
    const hasAny = imageRef.current || layersRef.current.length > 0 || imageLayersRef.current.length > 0 || shapeLayersRef.current.length > 0 || solidLayersRef.current.length > 0;
    if (!hasAny) {
      setLoadError("No image to save — open an image first");
      return;
    }
    setBusy("Exporting…");
    try {
      const fresh = imageRef.current;
      const dataUrl = await exportFlattenedDataUrl({
        imageUrl: fresh?.url ?? null,
        width: fresh?.width ?? docSize.w,
        height: fresh?.height ?? docSize.h,
        textLayers: layersRef.current,
        imageLayers: imageLayersRef.current,
        shapeLayers: shapeLayersRef.current,
        solidLayers: solidLayersRef.current,
        order: orderRef.current,
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // التصدير ليس تعديلاً على اللوحة — لا يدخل سجل Undo.
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Export failed";
      setLoadError(msg);
    } finally {
      setBusy(null);
    }
  }

  function handleSave() {
    void downloadCurrentImage("lumen-image.png");
  }

  function handleSaveProject() {
    try {
      downloadProject({
        docSize,
        image: imageRef.current ? { ...imageRef.current } : null,
        textLayers: cloneLayers(layersRef.current),
        imageLayers: cloneLayers(imageLayersRef.current),
        shapeLayers: cloneLayers(shapeLayersRef.current),
        solidLayers: cloneLayers(solidLayersRef.current),
        order: [...orderRef.current],
        groups: { ...groupsRef.current },
      });
    } catch {
      setLoadError("Could not save project file");
    }
  }

  function handleOpenProject() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".lumen,application/json";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      void (async () => {
        setBusy(`Opening ${file.name}…`);
        setLoadError(null);
        try {
          const p = await readProjectFile(file);
          setCanvasImage(p.image ? { ...p.image } : null);
          setTextLayers(cloneLayers(p.textLayers));
          setImageLayers(cloneLayers(p.imageLayers));
          setShapeLayers(cloneLayers(p.shapeLayers));
          setSolidLayers(cloneLayers(p.solidLayers));
          setLayerOrder([...p.order]);
          setGroupNames({ ...p.groups });
          setDocSize({ ...p.docSize });
          setSelectedTextId(null);
          setSelectedLayer(null);
          setSelectedIds([]);
          setRightTab("layers");
          setZoom(100);
          await stageRef.current?.setStrokes([]).catch(() => undefined);
          pushHistory(`Open ${file.name}`, {
            image: p.image ? { ...p.image } : null,
            layers: cloneLayers(p.textLayers),
            imageLayers: cloneLayers(p.imageLayers),
            shapeLayers: cloneLayers(p.shapeLayers),
            solidLayers: cloneLayers(p.solidLayers),
            order: [...p.order],
            groups: { ...p.groups },
          });
        } catch (e) {
          setLoadError(e instanceof Error ? e.message : "Could not open project");
        } finally {
          setBusy(null);
        }
      })();
    };
    input.click();
  }

  function handleExport() {
    void downloadCurrentImage("export.png");
  }

  function handleOpen() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) void handleImageDrop(file);
    };
    input.click();
  }

  function handleNew() {
    setCanvasImage(null);
    setTextLayers([]);
    setImageLayers([]);
    setShapeLayers([]);
    setSolidLayers([]);
    setSelectedTextId(null);
    setSelectedLayer(null);
    setSelectedIds([]);
    setLayerOrder([]);
    setGroupNames({});
    setLoadError(null);
    setZoom(100);
    void stageRef.current?.setStrokes([]).catch(() => undefined);
    pushHistory("New canvas", { image: null, layers: [], imageLayers: [], shapeLayers: [], solidLayers: [], order: [], groups: {} });
  }

  function handleNewCanvasConfirm(opts: NewCanvasOpts) {
    setNewCanvasOpen(false);
    setCanvasImage(null);
    setTextLayers([]);
    setImageLayers([]);
    setShapeLayers([]);
    const bg = opts.background ? [createSolidLayer({ color: opts.background, name: "Background" })] : [];
    setSolidLayers(bg);
    setSelectedTextId(null);
    setSelectedLayer(bg.length ? { kind: "solid", id: bg[0].id } : null);
    setSelectedIds(bg.length ? [bg[0].id] : []);
    setLayerOrder([]);
    setGroupNames({});
    setLoadError(null);
    setZoom(100);
    setDocSize({ w: opts.width, h: opts.height });
    void stageRef.current?.setStrokes([]).catch(() => undefined);
    pushHistory("New canvas", { image: null, layers: [], imageLayers: [], shapeLayers: [], solidLayers: bg, order: [], groups: {} });
  }

  const handleEditCommit = useCallback(
    (newDataUrl: string) => {
      const prev = imageRef.current;
      if (!prev) return;
      const next = { ...prev, url: newDataUrl };
      setCanvasImage(next);
      const img = new Image();
      img.onload = () => {
        const sized = { ...next, width: img.naturalWidth, height: img.naturalHeight };
        setCanvasImage(sized);
        imageRef.current = sized;
        // حدّث لقطة الـhistory بالأبعاد الصحيحة بدل لقطة بأبعاد قديمة
        const h = historyRef.current;
        const last = h[h.length - 1];
        if (last && last.label === "Edit") {
          historyRef.current = [...h.slice(0, -1), { ...last, image: { ...sized } }];
          setHistory(historyRef.current);
        }
      };
      img.src = newDataUrl;
      pushHistory("Edit", { image: next });
    },
    [pushHistory]
  );

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: "var(--background)" }}>
      <TopBar
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={() => void restoreIdx(historyIdxRef.current - 1)}
        onRedo={() => void restoreIdx(historyIdxRef.current + 1)}
        saveState={saveState}
        onSettingsOpen={() => setSettingsOpen(true)}
        onSave={handleSave}
        onExport={handleExport}
        onOpen={handleOpen}
        onNew={() => setNewCanvasOpen(true)}
        onSaveProject={handleSaveProject}
        onOpenProject={handleOpenProject}
        onRemoveBackground={() => void handleRemoveBackground()}
        onMenuAction={handleMenuAction}
      />

      <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden relative">
        <LeftToolbar activeTool={activeTool} onToolChange={setActiveTool} />

        {activeTool === "shape" && (
          <div
            style={{
              position: "absolute",
              left: 64,
              bottom: 48,
              zIndex: 50,
              display: "flex",
              gap: 4,
              padding: 4,
              borderRadius: 8,
              background: "var(--card)",
              border: "1px solid var(--border)",
              boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
            }}
          >
            {(["rect", "ellipse"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setShapeKind(k)}
                title={k === "rect" ? "Rectangle (U)" : "Ellipse (U, or hold Shift while dragging)"}
                style={{
                  height: 30,
                  padding: "0 14px",
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  border: "none",
                  background: shapeKind === k ? "var(--accent)" : "transparent",
                  color: shapeKind === k ? "var(--accent-foreground)" : "var(--muted-foreground)",
                }}
              >
                {k === "rect" ? "Rect" : "Ellipse"}
              </button>
            ))}
          </div>
        )}

        <Group orientation="horizontal" className="flex-1 min-w-0 min-h-0">
          <Panel defaultSize={rightCollapsed ? 100 : 66} minSize={20} style={{ minWidth: 0, overflow: "hidden" }}>
            <Canvas
              ref={stageRef}
              hasImage={canvasImage !== null}
              imageUrl={canvasImage?.url}
              zoom={zoom}
              busy={busy}
              error={loadError}
              activeTool={activeTool}
              onZoomChange={setZoom}
              onImageDrop={handleImageDrop}
              onImageError={(message) => setLoadError(message)}
              onEditCommit={handleEditCommit}
              textLayers={textLayers}
              selectedTextId={selectedTextId}
              onSelectText={(id) => {
                setSelectedTextId(id);
                if (id) {
                  setSelectedLayer({ kind: "text", id });
                  setSelectedIds([id]);
                  setRightTab("design");
                } else {
                  setSelectedLayer(null);
                  setSelectedIds([]);
                }
              }}
              onAddText={handleAddText}
              onUpdateText={handleUpdateText}
              onDeleteText={handleDeleteText}
              onCommitHistory={pushHistory}
              onSmartSelect={() => void handleRemoveBackground()}
              shapeKind={shapeKind}
              onShapeDraw={handleShapeDraw}
              showGrid={showGrid}
              showRulers={showRulers}
              imageLayers={imageLayers}
              shapeLayers={shapeLayers}
              solidLayers={solidLayers}
              selectedLayer={selectedLayer}
              layerOrder={layerOrder}
              onSelectLayer={(sel) => {
                setSelectedLayer(sel);
                setSelectedTextId(sel && sel.kind === "text" ? sel.id : null);
                setSelectedIds(sel ? [sel.id] : []);
                if (sel) setRightTab("design");
              }}
              onUpdateImageLayer={(id, patch) => setImageLayers((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)))}
              onUpdateShapeLayer={(id, patch) => setShapeLayers((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)))}
              onUpdateSolidLayer={(id, patch) => setSolidLayers((ls) => ls.map((l) => l.id === id ? { ...l, ...patch } : l))}
            />
          </Panel>

          {!rightCollapsed && (
            <>
              <Separator
                style={{
                  position: "relative",
                  flexShrink: 0,
                  width: 9,
                  cursor: "col-resize",
                  background: "transparent",
                  display: "flex",
                  alignItems: "stretch",
                  zIndex: 40,
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    bottom: 0,
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: 1,
                    background: "var(--border)",
                    transition: "background 150ms ease, width 150ms ease",
                  }}
                  className="separator-line"
                />
              </Separator>

              <Panel defaultSize={34} minSize={22} maxSize={55} style={{ minWidth: 0, overflow: "hidden" }}>
                <RightPanel
                  imageId={canvasImage?.imageId}
                  hasImage={canvasImage !== null}
                  onApplyOperation={handleApply}
                  textLayers={textLayers}
                  selectedTextId={selectedTextId}
                  onSelectText={(id) => {
                    setSelectedTextId(id);
                    setSelectedLayer(id ? { kind: "text", id } : null);
                    setSelectedIds(id ? [id] : []);
                  }}
                  onUpdateText={handleUpdateText}
                  onDeleteText={handleDeleteText}
                  onDuplicateText={handleDuplicateText}
                  onAddText={() => setNewLayerOpen(true)}
                  activeTab={rightTab}
                  onTabChange={setRightTab}
                  historyStack={history.map((h) => h.label)}
                  historyIdx={historyIdx}
                  onHistoryJump={restoreIdx}
                  imageLayers={imageLayers}
                  shapeLayers={shapeLayers}
                  solidLayers={solidLayers}
                  selectedLayer={selectedLayer}
                  onSelectLayer={(sel) => {
                    setSelectedLayer(sel);
                    setSelectedTextId(sel && sel.kind === "text" ? sel.id : null);
                    setSelectedIds(sel ? [sel.id] : []);
                  }}
                  onUpdateImageLayer={(id, patch) => setImageLayers((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)))}
                  onUpdateShapeLayer={(id, patch) => setShapeLayers((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)))}
                  onUpdateSolidLayer={(id, patch) => setSolidLayers((ls) => ls.map((l) => l.id === id ? { ...l, ...patch } : l))}
                  onDeleteGeneric={handleDeleteGeneric}
                  onDuplicateGeneric={handleDuplicateGeneric}
                  onBlendOpen={() => setBlendOpen(true)}
                  layerOrder={layerOrder}
                  selectedIds={selectedIds}
                  groupNames={groupNames}
                  onSelectMany={handleSelectMany}
                  onReorder={handleDragReorder}
                  onMoveLayer={handleMoveLayer}
                  onBlendChange={handleBlendChange}
                  onGroup={handleGroupSelected}
                  onUngroup={handleUngroup}
                  onAlign={handleAlign}
                  onDistribute={handleDistribute}
                  onRename={handleRenameLayer}
                  docWidth={canvasImage?.width ?? 0}
                  docHeight={canvasImage?.height ?? 0}
                  onOpenImage={handleOpen}
                  onNewCanvas={() => setNewCanvasOpen(true)}
                  onShapeTool={() => setActiveTool("shape")}
                />
              </Panel>
            </>
          )}
        </Group>

        <button
          onClick={() => setRightCollapsed((v) => !v)}
          title={rightCollapsed ? "إظهار اللوحة الجانبية" : "إخفاء اللوحة الجانبية"}
          style={{
            position: "absolute",
            top: 10,
            right: rightCollapsed ? 40 : 12,
            zIndex: 45,
            display: "flex",
            alignItems: "center",
            gap: 6,
            height: 30,
            padding: "0 10px 0 8px",
            borderRadius: 999,
            cursor: "pointer",
            border: "1px solid rgba(201,123,74,0.35)",
            background: rightCollapsed
              ? "linear-gradient(135deg, #C97B4A 0%, #B86A3A 100%)"
              : "rgba(28,27,26,0.92)",
            color: rightCollapsed ? "#fff" : "var(--foreground)",
            boxShadow: rightCollapsed
              ? "0 4px 20px rgba(201,123,74,0.45), 0 1px 0 rgba(255,255,255,0.15) inset"
              : "0 2px 12px rgba(0,0,0,0.4), 0 1px 0 rgba(255,255,255,0.06) inset",
            backdropFilter: "blur(12px)",
            transition: "all 260ms cubic-bezier(0.34,1.56,0.64,1)",
            transform: rightCollapsed ? "scale(1.03)" : "scale(1)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.06)";
            e.currentTarget.style.boxShadow = rightCollapsed
              ? "0 6px 28px rgba(201,123,74,0.6), 0 1px 0 rgba(255,255,255,0.2) inset"
              : "0 4px 16px rgba(0,0,0,0.5)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = rightCollapsed ? "scale(1.03)" : "scale(1)";
            e.currentTarget.style.boxShadow = rightCollapsed
              ? "0 4px 20px rgba(201,123,74,0.45), 0 1px 0 rgba(255,255,255,0.15) inset"
              : "0 2px 12px rgba(0,0,0,0.4)";
          }}
        >
          <span
            style={{
              width: 20,
              height: 20,
              borderRadius: "50%",
              background: rightCollapsed ? "rgba(255,255,255,0.22)" : "var(--accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              flexShrink: 0,
            }}
          >
            {rightCollapsed ? "◀" : "▶"}
          </span>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.02em", whiteSpace: "nowrap" }}>
            {rightCollapsed ? "اللوحة" : "إخفاء"}
          </span>
          {rightCollapsed && (
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#fff",
                boxShadow: "0 0 8px rgba(255,255,255,0.9)",
                animation: "pulseDot 1.6s ease-in-out infinite",
                flexShrink: 0,
              }}
            />
          )}
        </button>

        {rightCollapsed && (
          <div
            onClick={() => setRightCollapsed(false)}
            title="اضغط لإظهار اللوحة"
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              right: 28,
              width: 14,
              zIndex: 30,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(90deg, transparent, rgba(201,123,74,0.08))",
              borderLeft: "1px dashed rgba(201,123,74,0.2)",
              transition: "all 200ms ease",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.background = "linear-gradient(90deg, transparent, rgba(201,123,74,0.16))";
              (e.currentTarget as HTMLDivElement).style.width = "18px";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.background = "linear-gradient(90deg, transparent, rgba(201,123,74,0.08))";
              (e.currentTarget as HTMLDivElement).style.width = "14px";
            }}
          >
            <div style={{ width: 2, height: 32, borderRadius: 999, background: "rgba(201,123,74,0.35)" }} />
          </div>
        )}

        <AgentDock collapsed={agentCollapsed} onToggle={() => setAgentCollapsed((c) => !c)} />
      </div>

      <BottomBar
        zoom={zoom}
        width={canvasImage?.width ?? docSize.w}
        height={canvasImage?.height ?? docSize.h}
        showGrid={showGrid}
        showRulers={showRulers}
        onToggleGrid={() => setShowGrid((v) => !v)}
        onToggleRulers={() => setShowRulers((v) => !v)}
        saveState={saveState}
        activeTool={toolLabels[activeTool]}
      />

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        currentTheme={currentTheme}
        onThemeChange={(id) => setCurrentTheme(id)}
      />

      {menuDialog && imageRef.current && (
        <MenuDialog
          kind={menuDialog}
          imageWidth={imageRef.current.width}
          imageHeight={imageRef.current.height}
          busy={busy !== null}
          onClose={() => setMenuDialog(null)}
          onConfirm={handleDialogConfirm}
        />
      )}

      {maskEditorOpen && imageRef.current && (
        <MaskEditor
          imageUrl={imageRef.current.url}
          busy={busy !== null}
          onClose={() => setMaskEditorOpen(false)}
          onApply={(mask) => void handleMaskApply(mask)}
        />
      )}

      {newLayerOpen && (
        <NewLayerDialog onClose={() => setNewLayerOpen(false)} onPick={handleNewLayerPick} />
      )}

      {newCanvasOpen && (
        <NewCanvasDialog onClose={() => setNewCanvasOpen(false)} onConfirm={handleNewCanvasConfirm} />
      )}

      {blendOpen && (
        <BlendDialog
          busy={busy !== null}
          hasBackend={!!imageRef.current?.imageId}
          onClose={() => setBlendOpen(false)}
          onConfirm={async (p) => {
            setBlendOpen(false);
            await handleBlendConfirm(p);
          }}
        />
      )}
    </div>
  );
}
