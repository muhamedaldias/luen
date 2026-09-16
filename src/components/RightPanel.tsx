import { useState } from "react";
import {
  Layers,
  SlidersHorizontal,
  Clock,
  PenTool,
  Eye,
  EyeOff,
  Lock,
  Trash2,
  Plus,
  Copy,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Bold,
  Italic,
  Underline,
  RotateCcw,
  ChevronRight,
  Image as ImageIcon,
} from "lucide-react";
import { FONT_OPTIONS, WEIGHT_OPTIONS, gradientCss, type TextLayer } from "../lib/textLayers";
import type { ImageLayer, ShapeLayer, SolidLayer } from "../lib/layers";
import { BLEND_MODES, type LayerRef } from "../lib/layerSystem";

type TabId = "layers" | "design" | "adjustments" | "history";

const tabs: { id: TabId; icon: React.ReactNode; label: string }[] = [
  { id: "layers", icon: <Layers size={15} strokeWidth={1.75} />, label: "Layers" },
  { id: "design", icon: <PenTool size={15} strokeWidth={1.75} />, label: "Design" },
  { id: "adjustments", icon: <SlidersHorizontal size={15} strokeWidth={1.75} />, label: "Adjust" },
  { id: "history", icon: <Clock size={15} strokeWidth={1.75} />, label: "History" },
];

interface RightPanelProps {
  imageId?: string | null;
  hasImage?: boolean;
  onApplyOperation?: (op: string, params: Record<string, number | string>) => Promise<string | null>;
  textLayers?: TextLayer[];
  selectedTextId?: string | null;
  onSelectText?: (id: string | null) => void;
  onUpdateText?: (id: string, patch: Partial<TextLayer>) => void;
  onDeleteText?: (id: string) => void;
  onDuplicateText?: (id: string) => void;
  onAddText?: () => void;
  activeTab?: TabId;
  onTabChange?: (t: TabId) => void;
  historyStack?: string[];
  historyIdx?: number;
  onHistoryJump?: (idx: number) => void;
  imageLayers?: ImageLayer[];
  shapeLayers?: ShapeLayer[];
  solidLayers?: SolidLayer[];
  selectedLayer?: { kind: string; id: string } | null;
  onSelectLayer?: (sel: { kind: string; id: string } | null) => void;
  onUpdateImageLayer?: (id: string, patch: Partial<ImageLayer>) => void;
  onUpdateShapeLayer?: (id: string, patch: Partial<ShapeLayer>) => void;
  onUpdateSolidLayer?: (id: string, patch: Partial<SolidLayer>) => void;
  onDeleteGeneric?: (kind: string, id: string) => void;
  onDuplicateGeneric?: (kind: string, id: string) => void;
  onBlendOpen?: () => void;
  layerOrder?: LayerRef[];
  selectedIds?: string[];
  groupNames?: Record<string, string>;
  onSelectMany?: (ids: string[], additive?: boolean) => void;
  onReorder?: (dragId: string, targetId: string, after: boolean) => void;
  onMoveLayer?: (id: string, dir: "front" | "back" | "forward" | "backward") => void;
  onBlendChange?: (id: string, blend: string) => void;
  onGroup?: () => void;
  onUngroup?: (gid: string) => void;
  onAlign?: (mode: "left" | "centerX" | "right" | "top" | "centerY" | "bottom") => void;
  onDistribute?: (axis: "x" | "y") => void;
  onRename?: (id: string, name: string) => void;
  docWidth?: number;
  docHeight?: number;
  onOpenImage?: () => void;
  onNewCanvas?: () => void;
  onShapeTool?: () => void;
}

export default function RightPanel({
  imageId = null,
  hasImage = false,
  onApplyOperation,
  textLayers = [],
  selectedTextId = null,
  onSelectText,
  onUpdateText,
  onDeleteText,
  onDuplicateText,
  onAddText,
  activeTab = "layers",
  onTabChange,
  historyStack = [],
  historyIdx = 0,
  onHistoryJump,
  imageLayers = [],
  shapeLayers = [],
  solidLayers = [],
  selectedLayer = null,
  onSelectLayer,
  onUpdateImageLayer,
  onUpdateShapeLayer,
  onUpdateSolidLayer,
  onDeleteGeneric,
  onDuplicateGeneric,
  onBlendOpen,
  layerOrder = [],
  selectedIds = [],
  groupNames = {},
  onSelectMany,
  onReorder,
  onMoveLayer,
  onBlendChange,
  onGroup,
  onUngroup,
  onAlign,
  onDistribute,
  onRename,
  docWidth = 0,
  docHeight = 0,
  onOpenImage,
  onNewCanvas,
  onShapeTool,
}: RightPanelProps) {
  const selected = textLayers.find((t) => t.id === selectedTextId) ?? null;
  const selImg = imageLayers.find((l) => selectedLayer?.kind === "image" && l.id === selectedLayer.id) ?? null;
  const selShape = shapeLayers.find((l) => selectedLayer?.kind === "shape" && l.id === selectedLayer.id) ?? null;
  const selSolid = solidLayers.find((l) => selectedLayer?.kind === "solid" && l.id === selectedLayer.id) ?? null;

  return (
    <div
      className="flex flex-col h-full w-full overflow-hidden"
      style={{ background: "var(--card)", borderLeft: "1px solid var(--border)", minWidth: 0, overflowWrap: "break-word", containerType: "inline-size" }}
    >
      <style>{`@container (max-width: 320px) { .rp-tab-label { display: none; } }`}</style>
      <div
        className="flex items-center gap-0 px-1 pt-1 shrink-0 w-full"
        style={{ borderBottom: "1px solid var(--border)", minWidth: 0, overflowX: "auto" }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange?.(tab.id)}
            className="flex items-center justify-center gap-1.5 px-2 py-3 transition-colors duration-100 relative shrink-0"
            style={{
              color: activeTab === tab.id ? "var(--foreground)" : "var(--muted-foreground)",
              fontWeight: activeTab === tab.id ? 600 : 400,
              flex: 1,
              minWidth: 0,
              whiteSpace: "nowrap",
              fontSize: 13,
            }}
            title={tab.label}
          >
            {tab.icon}
            <span className="rp-tab-label" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{tab.label}</span>
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-2 right-2 h-px" style={{ background: "var(--accent)" }} />
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 w-full" style={{ minWidth: 0 }}>
        {activeTab === "layers" && (
          <LayersTab
            hasImage={hasImage}
            textLayers={textLayers}
            selectedTextId={selectedTextId}
            onSelectText={onSelectText}
            onUpdateText={onUpdateText}
            onDeleteText={onDeleteText}
            onAddText={onAddText}
            onTabChange={onTabChange}
            imageLayers={imageLayers}
            shapeLayers={shapeLayers}
            solidLayers={solidLayers}
            selectedLayer={selectedLayer}
            onSelectLayer={onSelectLayer}
            onUpdateImageLayer={onUpdateImageLayer}
            onUpdateShapeLayer={onUpdateShapeLayer}
            onUpdateSolidLayer={onUpdateSolidLayer}
            onDeleteGeneric={onDeleteGeneric}
            onDuplicateGeneric={onDuplicateGeneric}
            onDuplicateText={onDuplicateText}
            layerOrder={layerOrder}
            selectedIds={selectedIds}
            groupNames={groupNames}
            onSelectMany={onSelectMany}
            onReorder={onReorder}
            onMoveLayer={onMoveLayer}
            onBlendChange={onBlendChange}
            onGroup={onGroup}
            onUngroup={onUngroup}
            onAlign={onAlign}
            onDistribute={onDistribute}
            onRename={onRename}
          />
        )}
        {activeTab === "design" && (
          <DesignInspector
            selected={selected}
            selImg={selImg}
            selShape={selShape}
            selSolid={selSolid}
            multiCount={selectedIds.length > 1 ? selectedIds.length : 0}
            textLayers={textLayers}
            onUpdateText={onUpdateText}
            onDeleteText={onDeleteText}
            onDuplicateText={onDuplicateText}
            onAddText={onAddText}
            onSelectText={onSelectText}
            onUpdateImageLayer={onUpdateImageLayer}
            onUpdateShapeLayer={onUpdateShapeLayer}
            onUpdateSolidLayer={onUpdateSolidLayer}
            onDeleteGeneric={onDeleteGeneric}
            onDuplicateGeneric={onDuplicateGeneric}
            onMoveLayer={onMoveLayer}
            onBlendChange={onBlendChange}
            onRename={onRename}
            onAlign={onAlign}
            onDistribute={onDistribute}
            onGroup={onGroup}
            docWidth={docWidth}
            docHeight={docHeight}
            hasImage={hasImage}
            onOpenImage={onOpenImage}
            onNewCanvas={onNewCanvas}
            onShapeTool={onShapeTool}
          />
        )}
        {activeTab === "adjustments" && (
          <AdjustmentsTab imageId={imageId} hasImage={hasImage} onApplyOperation={onApplyOperation} onBlendOpen={onBlendOpen} />
        )}
        {activeTab === "history" && <HistoryTab stack={historyStack} idx={historyIdx} onJump={onHistoryJump} />}
      </div>

      <div className="shrink-0 px-3 py-2.5 w-full" style={{ borderTop: "1px solid var(--border)", minWidth: 0 }}>
        {selected && onUpdateText ? (
          <div style={{ minWidth: 0 }}>
            <div className="flex items-center justify-between mb-2" style={{ minWidth: 0 }}>
              <p className="text-xs font-medium truncate" style={{ color: "var(--foreground)", minWidth: 0 }}>
                {selected.name}
              </p>
              <span className="text-xs shrink-0 ml-2" style={{ color: "var(--accent)", fontSize: 10 }}>
                {Math.round(selected.x * 100)},{Math.round(selected.y * 100)} · {Math.round(selected.rotation)}°
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1.5" style={{ minWidth: 0 }}>
              <MiniNumber label="X%" value={Math.round(selected.x * 100)} onChange={(v) => onUpdateText(selected.id, { x: v / 100 })} />
              <MiniNumber label="Y%" value={Math.round(selected.y * 100)} onChange={(v) => onUpdateText(selected.id, { y: v / 100 })} />
              <MiniNumber label="W%" value={Math.round(selected.w * 100)} onChange={(v) => onUpdateText(selected.id, { w: Math.max(5, v) / 100 })} />
              <MiniNumber label="°" value={Math.round(selected.rotation)} onChange={(v) => onUpdateText(selected.id, { rotation: v })} />
            </div>
          </div>
        ) : selImg && onUpdateImageLayer ? (
          <FooterGeometry
            name={selImg.name}
            x={selImg.x} y={selImg.y} w={selImg.w} rotation={selImg.rotation}
            onPatch={(p) => onUpdateImageLayer(selImg.id, p as Partial<ImageLayer>)}
          />
        ) : selShape && onUpdateShapeLayer ? (
          <FooterGeometry
            name={selShape.name}
            x={selShape.x} y={selShape.y} w={selShape.w} rotation={selShape.rotation}
            onPatch={(p) => onUpdateShapeLayer(selShape.id, p as Partial<ShapeLayer>)}
          />
        ) : selSolid ? (
          <div className="flex items-center justify-between" style={{ minWidth: 0 }}>
            <p className="text-xs truncate" style={{ color: "var(--foreground)", minWidth: 0 }}>{selSolid.name}</p>
            <p className="text-xs shrink-0 ml-2" style={{ color: "var(--accent)", fontSize: 10 }}>Fill · {selSolid.opacity}%</p>
          </div>
        ) : selectedIds.length > 1 ? (
          <div className="flex items-center justify-between" style={{ minWidth: 0 }}>
            <p className="text-xs truncate" style={{ color: "var(--accent)", fontWeight: 600, minWidth: 0 }}>{selectedIds.length} layers selected</p>
          </div>
        ) : (
          <div className="flex items-center justify-between" style={{ minWidth: 0 }}>
            <p className="text-xs truncate" style={{ color: "var(--muted-foreground)", minWidth: 0 }}>
              {textLayers.length + imageLayers.length + shapeLayers.length + solidLayers.length === 0
                ? "Empty canvas — open an image or add a layer"
                : "Select any layer to edit its geometry here"}
            </p>
          </div>
        )}
      </div>

      <ComparisonStrip />
    </div>
  );
}

function LayersTab({
  hasImage,
  textLayers,
  selectedTextId,
  onSelectText,
  onUpdateText,
  onDeleteText,
  onAddText,
  onTabChange,
  imageLayers = [],
  shapeLayers = [],
  solidLayers = [],
  selectedLayer = null,
  onSelectLayer,
  onUpdateImageLayer,
  onUpdateShapeLayer,
  onUpdateSolidLayer,
  onDeleteGeneric,
  onDuplicateGeneric,
  onDuplicateText,
  layerOrder = [],
  selectedIds = [],
  groupNames = {},
  onSelectMany,
  onReorder,
  onMoveLayer,
  onBlendChange,
  onGroup,
  onUngroup,
  onAlign,
  onDistribute,
  onRename,
}: {
  hasImage: boolean;
  textLayers: TextLayer[];
  selectedTextId: string | null;
  onSelectText?: (id: string | null) => void;
  onUpdateText?: (id: string, patch: Partial<TextLayer>) => void;
  onDeleteText?: (id: string) => void;
  onAddText?: () => void;
  onTabChange?: (t: TabId) => void;
  imageLayers?: ImageLayer[];
  shapeLayers?: ShapeLayer[];
  solidLayers?: SolidLayer[];
  selectedLayer?: { kind: string; id: string } | null;
  onSelectLayer?: (sel: { kind: string; id: string } | null) => void;
  onUpdateImageLayer?: (id: string, patch: Partial<ImageLayer>) => void;
  onUpdateShapeLayer?: (id: string, patch: Partial<ShapeLayer>) => void;
  onUpdateSolidLayer?: (id: string, patch: Partial<SolidLayer>) => void;
  onDeleteGeneric?: (kind: string, id: string) => void;
  onDuplicateGeneric?: (kind: string, id: string) => void;
  onDuplicateText?: (id: string) => void;
  layerOrder?: LayerRef[];
  selectedIds?: string[];
  groupNames?: Record<string, string>;
  onSelectMany?: (ids: string[], additive?: boolean) => void;
  onReorder?: (dragId: string, targetId: string, after: boolean) => void;
  onMoveLayer?: (id: string, dir: "front" | "back" | "forward" | "backward") => void;
  onBlendChange?: (id: string, blend: string) => void;
  onGroup?: () => void;
  onUngroup?: (gid: string) => void;
  onAlign?: (mode: "left" | "centerX" | "right" | "top" | "centerY" | "bottom") => void;
  onDistribute?: (axis: "x" | "y") => void;
  onRename?: (id: string, name: string) => void;
}) {
  const total = textLayers.length + imageLayers.length + shapeLayers.length + solidLayers.length + (hasImage ? 1 : 0);
  const tMap = new Map(textLayers.map((l) => [l.id, l]));
  const iMap = new Map(imageLayers.map((l) => [l.id, l]));
  const sMap = new Map(shapeLayers.map((l) => [l.id, l]));
  const fMap = new Map(solidLayers.map((l) => [l.id, l]));
  const useOrder = layerOrder.length > 0;
  const displayOrder = useOrder ? [...layerOrder].reverse() : [];
  const isSelId = (id: string) => selectedIds.includes(id) || selectedLayer?.id === id || selectedTextId === id;
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [showBlendFor, setShowBlendFor] = useState<string | null>(null);

  function metaFor(kind: string, id: string): { name: string; visible: boolean; locked: boolean; opacity: number; blend?: string; groupId?: string | null; thumb?: string; color?: string } | null {
    if (kind === "background") return { name: "Background image", visible: true, locked: true, opacity: 100 };
    if (kind === "text") {
      const l = tMap.get(id);
      if (!l) return null;
      return { name: l.name, visible: l.visible, locked: l.locked, opacity: l.opacity, blend: (l as { blendMode?: string }).blendMode, groupId: l.groupId };
    }
    if (kind === "image") {
      const l = iMap.get(id);
      if (!l) return null;
      return { name: l.name, visible: l.visible, locked: l.locked, opacity: l.opacity, blend: l.blendMode, groupId: l.groupId, thumb: l.url };
    }
    if (kind === "shape") {
      const l = sMap.get(id);
      if (!l) return null;
      return { name: l.name, visible: l.visible, locked: l.locked, opacity: l.opacity, blend: l.blendMode, groupId: l.groupId, color: l.color };
    }
    if (kind === "solid") {
      const l = fMap.get(id);
      if (!l) return null;
      return { name: l.name, visible: l.visible, locked: l.locked, opacity: l.opacity, blend: l.blendMode, groupId: l.groupId, color: l.color };
    }
    return null;
  }

  function selectRow(kind: string, id: string, e: React.MouseEvent) {
    const additive = e.ctrlKey || e.metaKey;
    if (kind === "background") {
      onSelectText?.(null);
      onSelectLayer?.(null);
      onSelectMany?.([], false);
      return;
    }
    if (additive && onSelectMany) {
      onSelectMany([id], true);
      return;
    }
    if (kind === "text") {
      onSelectText?.(id);
      onSelectLayer?.({ kind: "text", id });
    } else {
      onSelectText?.(null);
      onSelectLayer?.({ kind, id });
    }
    onSelectMany?.([id], false);
  }

  function toggleVisible(kind: string, id: string) {
    if (kind === "text") {
      const l = tMap.get(id);
      if (l) onUpdateText?.(id, { visible: !l.visible });
    } else if (kind === "image") {
      const l = iMap.get(id);
      if (l) onUpdateImageLayer?.(id, { visible: !l.visible });
    } else if (kind === "shape") {
      const l = sMap.get(id);
      if (l) onUpdateShapeLayer?.(id, { visible: !l.visible });
    } else if (kind === "solid") {
      const l = fMap.get(id);
      if (l) onUpdateSolidLayer?.(id, { visible: !l.visible });
    }
  }

  function iconFor(kind: string, id: string, m: { thumb?: string; color?: string }) {
    if (kind === "background") return <ImageIcon size={12} strokeWidth={1.75} style={{ color: "var(--muted-foreground)" }} />;
    if (kind === "text") return <Type size={12} strokeWidth={1.75} style={{ color: "var(--accent)" }} />;
    if (kind === "image") {
      if (m.thumb) return <img src={m.thumb} alt="" style={{ width: 28, height: 28, objectFit: "cover", borderRadius: 4 }} draggable={false} />;
      return <ImageIcon size={13} strokeWidth={1.75} style={{ color: "#7FB8FF" }} />;
    }
    if (kind === "shape") return <span style={{ fontSize: 12 }}>⬢</span>;
    if (kind === "solid") return <span style={{ width: 12, height: 12, borderRadius: 3, background: m.color ?? "#888", display: "inline-block" }} />;
    return <Layers size={12} />;
  }

  const multi = selectedIds.length > 1;
  const groupIds = Array.from(new Set([...textLayers.map((l) => l.groupId), ...imageLayers.map((l) => l.groupId), ...shapeLayers.map((l) => l.groupId), ...solidLayers.map((l) => l.groupId)].filter(Boolean))) as string[];

  return (
    <div className="py-1 w-full" style={{ minWidth: 0 }}>
      <div className="flex items-center justify-between px-3 py-1.5" style={{ borderBottom: "1px solid var(--border)", minWidth: 0 }}>
        <span className="text-xs font-medium truncate" style={{ color: "var(--muted-foreground)", minWidth: 0 }}>
          {total} layers · drag to reorder
        </span>
        <div className="flex items-center gap-0.5 shrink-0">
          <SmallIconBtn icon={<Plus size={13} strokeWidth={2} />} label="New layer (text/image/shape/solid)" onClick={() => { onAddText?.(); }} />
          <SmallIconBtn
            icon={<Copy size={13} strokeWidth={1.75} />}
            label="Duplicate selected"
            onClick={() => {
              const id = selectedIds[selectedIds.length - 1] ?? selectedTextId ?? selectedLayer?.id;
              if (!id) return;
              const k = layerOrder.find((r) => r.id === id)?.kind ?? selectedLayer?.kind ?? (tMap.has(id) ? "text" : "text");
              if (k === "text") {
                if (onDuplicateText) onDuplicateText(id);
                else if (onDuplicateGeneric) onDuplicateGeneric("text", id);
              } else if (onDuplicateGeneric) onDuplicateGeneric(k, id);
            }}
          />
          <SmallIconBtn
            icon={<Trash2 size={13} strokeWidth={1.75} />}
            label="Delete selected"
            onClick={() => {
              if (selectedTextId && onDeleteText) onDeleteText(selectedTextId);
              else if (selectedLayer && onDeleteGeneric) onDeleteGeneric(selectedLayer.kind, selectedLayer.id);
              else if (selectedIds.length && onDeleteGeneric) {
                const id = selectedIds[selectedIds.length - 1];
                const k = layerOrder.find((r) => r.id === id)?.kind ?? "text";
                onDeleteGeneric(k, id);
              }
            }}
          />
        </div>
      </div>

      {multi && (
        <div className="px-2 py-1.5 flex items-center gap-1" style={{ borderBottom: "1px solid var(--border)", flexWrap: "wrap" }}>
          <span className="text-xs" style={{ color: "var(--accent)", fontWeight: 600 }}>{selectedIds.length} selected</span>
          <button onClick={() => onAlign?.("left")} title="Align left" style={{ background: "var(--secondary)", border: "1px solid var(--border)", borderRadius: 4, color: "var(--foreground)", fontSize: 10, padding: "3px 6px", cursor: "pointer" }}>⇤</button>
          <button onClick={() => onAlign?.("centerX")} title="Align center" style={{ background: "var(--secondary)", border: "1px solid var(--border)", borderRadius: 4, color: "var(--foreground)", fontSize: 10, padding: "3px 6px", cursor: "pointer" }}>⇔</button>
          <button onClick={() => onAlign?.("right")} title="Align right" style={{ background: "var(--secondary)", border: "1px solid var(--border)", borderRadius: 4, color: "var(--foreground)", fontSize: 10, padding: "3px 6px", cursor: "pointer" }}>⇥</button>
          <button onClick={() => onAlign?.("top")} title="Align top" style={{ background: "var(--secondary)", border: "1px solid var(--border)", borderRadius: 4, color: "var(--foreground)", fontSize: 10, padding: "3px 6px", cursor: "pointer" }}>⤒</button>
          <button onClick={() => onAlign?.("centerY")} title="Align middle" style={{ background: "var(--secondary)", border: "1px solid var(--border)", borderRadius: 4, color: "var(--foreground)", fontSize: 10, padding: "3px 6px", cursor: "pointer" }}>⇕</button>
          <button onClick={() => onAlign?.("bottom")} title="Align bottom" style={{ background: "var(--secondary)", border: "1px solid var(--border)", borderRadius: 4, color: "var(--foreground)", fontSize: 10, padding: "3px 6px", cursor: "pointer" }}>⤓</button>
          <button onClick={() => onGroup?.()} title="Group selected (Ctrl+G)" style={{ background: "var(--accent)", border: "none", borderRadius: 4, color: "#fff", fontSize: 10, padding: "3px 8px", cursor: "pointer", fontWeight: 600 }}>Group</button>
        </div>
      )}

      {groupIds.length > 0 && (
        <div className="px-2 py-1 flex flex-wrap gap-1" style={{ borderBottom: "1px solid var(--border)" }}>
          {groupIds.map((gid) => (
            <span key={gid} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(201,123,74,0.12)", border: "1px solid rgba(201,123,74,0.35)", borderRadius: 999, padding: "2px 4px 2px 8px", fontSize: 10, color: "var(--foreground)" }}>
              ▦ {groupNames[gid] ?? gid.slice(0, 8)}
              <button onClick={() => onUngroup?.(gid)} title="Ungroup" style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--muted-foreground)", fontSize: 11, padding: "0 4px" }}>×</button>
            </span>
          ))}
        </div>
      )}

      {useOrder ? (
        displayOrder.map((ref) => {
          const m = metaFor(ref.kind, ref.id);
          if (!m && ref.id !== "__background__") return null;
          const mm = m ?? { name: "Background image", visible: true, locked: true, opacity: 100 };
          const active = isSelId(ref.id);
          const inGroup = mm.groupId;
          return (
            <div key={ref.id}>
              {overId === ref.id && dragId && (
                <div style={{ height: 2, background: "var(--accent)", margin: "0 8px", borderRadius: 2 }} />
              )}
              <div
                draggable={ref.id !== "__background__"}
                onDragStart={(e) => {
                  setDragId(ref.id);
                  try { e.dataTransfer.effectAllowed = "move"; } catch { /* noop */ }
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (ref.id !== dragId) setOverId(ref.id);
                }}
                onDragLeave={() => setOverId((v) => (v === ref.id ? null : v))}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragId && dragId !== ref.id && onReorder) {
                    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                    const after = (e.clientY - rect.top) > rect.height / 2;
                    onReorder(dragId, ref.id, !after);
                  }
                  setDragId(null);
                  setOverId(null);
                }}
                onDragEnd={() => { setDragId(null); setOverId(null); }}
                className="flex items-center gap-2 px-2 py-2 cursor-pointer transition-colors duration-75 w-full"
                style={{
                  background: active ? "var(--secondary)" : dragId === ref.id ? "rgba(201,123,74,0.08)" : "transparent",
                  borderLeft: `2px solid ${active ? "var(--accent)" : inGroup ? "rgba(201,123,74,0.5)" : "transparent"}`,
                  minWidth: 0,
                  opacity: dragId === ref.id ? 0.5 : 1,
                }}
                onClick={(e) => selectRow(ref.kind, ref.id, e)}
                onDoubleClick={() => {
                  if (ref.id === "__background__") return;
                  setEditingId(ref.id);
                  setEditName(mm.name);
                }}
                title={ref.kind === "background" ? "Background (locked bottom)" : `${ref.kind} · drag to reorder · Ctrl+click multi-select · double-click rename`}
              >
                <span style={{ color: "var(--muted-foreground)", fontSize: 10, cursor: ref.id === "__background__" ? "default" : "grab", flexShrink: 0 }}>⋮⋮</span>
                <div className="rounded shrink-0 flex items-center justify-center" style={{ width: 28, height: 28, background: "#2A2927", border: "1px solid var(--border)", overflow: "hidden" }}>
                  {iconFor(ref.kind, ref.id, mm)}
                </div>
                {editingId === ref.id ? (
                  <input
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={() => {
                      if (editName.trim() && onRename) onRename(ref.id, editName.trim());
                      setEditingId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        if (editName.trim() && onRename) onRename(ref.id, editName.trim());
                        setEditingId(null);
                      } else if (e.key === "Escape") setEditingId(null);
                      e.stopPropagation();
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 text-xs outline-none rounded"
                    style={{ background: "var(--background)", border: "1px solid var(--accent)", color: "var(--foreground)", padding: "2px 6px", minWidth: 0 }}
                  />
                ) : (
                  <span
                    className="flex-1 text-xs truncate"
                    style={{ color: mm.visible ? "var(--foreground)" : "var(--muted-foreground)", minWidth: 0, textDecoration: !mm.visible ? "line-through" : undefined }}
                  >
                    {mm.name}
                  </span>
                )}
                {mm.blend && mm.blend !== "source-over" && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowBlendFor((v) => (v === ref.id ? null : ref.id)); }}
                    title={`Blend: ${mm.blend} — click to change`}
                    style={{ background: "rgba(127,184,255,0.15)", border: "1px solid rgba(127,184,255,0.4)", borderRadius: 4, color: "#7FB8FF", fontSize: 8, padding: "1px 4px", cursor: "pointer", flexShrink: 0 }}
                  >
                    ◐
                  </button>
                )}
                <span className="text-xs shrink-0" style={{ color: "var(--muted-foreground)", fontSize: 9 }}>
                  {ref.kind === "background" ? "BG" : ref.kind === "text" ? "T" : ref.kind === "image" ? "Img" : ref.kind === "shape" ? "◆" : "Fill"}{mm.opacity < 100 ? ` ${mm.opacity}%` : ""}
                </span>
                <button onClick={(e) => { e.stopPropagation(); toggleVisible(ref.kind, ref.id); }} className="shrink-0" style={{ color: mm.visible ? "var(--muted-foreground)" : "#4A4845", background: "transparent", border: "none", cursor: "pointer", padding: 2 }} title={mm.visible ? "Hide layer" : "Show layer"}>
                  {mm.visible ? <Eye size={14} strokeWidth={1.75} /> : <EyeOff size={14} strokeWidth={1.75} />}
                </button>
                {mm.locked && <Lock size={11} strokeWidth={1.75} style={{ color: "var(--muted-foreground)", opacity: 0.5, flexShrink: 0 }} />}
              </div>
              {showBlendFor === ref.id && (
                <div className="px-8 py-1" style={{ background: "rgba(0,0,0,0.25)" }}>
                  <select
                    value={mm.blend ?? "source-over"}
                    onChange={(e) => { onBlendChange?.(ref.id, e.target.value); setShowBlendFor(null); }}
                    className="w-full h-7 rounded text-xs outline-none"
                    style={{ background: "var(--secondary)", border: "1px solid var(--border)", color: "var(--foreground)", padding: "0 6px" }}
                  >
                    {BLEND_MODES.map((b) => (
                      <option key={b.value} value={b.value}>{b.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          );
        })
      ) : (
        <div className="px-4 py-6 text-center" style={{ minWidth: 0 }}>
          <Type size={20} strokeWidth={1.5} style={{ color: "var(--muted-foreground)", margin: "0 auto 8px", opacity: 0.5 }} />
          <p className="text-xs" style={{ color: "var(--muted-foreground)", lineHeight: 1.6 }}>
            No layers yet.
            <br />
            Drop an image or use Layer → New Layer… to add text / image / shape / fill.
          </p>
        </div>
      )}
      <p className="px-3 py-1.5 text-xs" style={{ color: "var(--muted-foreground)", fontSize: 10, lineHeight: 1.6 }}>
        Top = front · drag ⋮⋮ to reorder · Ctrl+click = multi-select · double-click = rename · ◐ = blend mode
      </p>
    </div>
  );
}

function LayerRow({ icon, name, badge, active, visible, locked, opacity, onSelect, onToggleVisible }: {
  icon: React.ReactNode; name: string; badge: string; active: boolean; visible: boolean; locked: boolean; opacity: number;
  onSelect: () => void; onToggleVisible: () => void;
}) {
  return (
    <div
      className="flex items-center gap-2 px-2 py-1.5 cursor-pointer transition-colors duration-75 w-full"
      style={{ background: active ? "var(--secondary)" : "transparent", borderLeft: `2px solid ${active ? "var(--accent)" : "transparent"}`, minWidth: 0 }}
      onClick={onSelect}
    >
      <div className="rounded shrink-0 flex items-center justify-center" style={{ width: 24, height: 24, background: "#2A2927", border: "1px solid var(--border)" }}>
        {icon}
      </div>
      <span className="flex-1 text-xs truncate" style={{ color: visible ? "var(--foreground)" : "var(--muted-foreground)", minWidth: 0, textDecoration: !visible ? "line-through" : undefined }}>
        {name}
      </span>
      <span className="text-xs shrink-0" style={{ color: "var(--muted-foreground)", fontSize: 9 }}>{badge}{opacity < 100 ? ` ${opacity}%` : ""}</span>
      <button onClick={(e) => { e.stopPropagation(); onToggleVisible(); }} className="shrink-0" style={{ color: visible ? "var(--muted-foreground)" : "#4A4845", background: "transparent", border: "none", cursor: "pointer", padding: 2 }} title={visible ? "Hide layer" : "Show layer"}>
        {visible ? <Eye size={13} strokeWidth={1.75} /> : <EyeOff size={13} strokeWidth={1.75} />}
      </button>
      {locked && <Lock size={11} strokeWidth={1.75} style={{ color: "var(--muted-foreground)", opacity: 0.5, flexShrink: 0 }} />}
    </div>
  );
}

function GenericDesign({ title, children, onDelete, onDuplicate }: { title: string; children: React.ReactNode; onDelete?: () => void; onDuplicate?: () => void }) {
  return (
    <div className="py-2 px-3 flex flex-col gap-0 w-full" style={{ minWidth: 0 }}>
      <Section title={title}>
        <div className="flex flex-col gap-1.5">{children}</div>
        <div className="flex gap-1.5 mt-2">
          {onDuplicate && (
            <button onClick={onDuplicate} className="flex-1 h-9 rounded text-xs font-medium" style={{ background: "var(--secondary)", color: "var(--foreground)", border: "1px solid var(--border)", cursor: "pointer" }}>
              Duplicate
            </button>
          )}
          {onDelete && (
            <button onClick={onDelete} className="flex-1 h-9 rounded text-xs font-medium" style={{ background: "transparent", color: "var(--danger)", border: "1px solid var(--border)", cursor: "pointer" }}>
              Delete
            </button>
          )}
        </div>
      </Section>
    </div>
  );
}

function InspectorHeader({ icon, typeLabel, name, onRename }: {
  icon: React.ReactNode;
  typeLabel: string;
  name: string;
  onRename?: (name: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 px-3 pt-3 pb-2 w-full" style={{ minWidth: 0, borderBottom: "1px solid var(--border)" }}>
      <div className="rounded shrink-0 flex items-center justify-center" style={{ width: 30, height: 30, background: "var(--secondary)", border: "1px solid var(--border)" }}>
        {icon}
      </div>
      <div className="flex-1" style={{ minWidth: 0 }}>
        <input
          value={name}
          onChange={(e) => onRename?.(e.target.value.slice(0, 40) || "Layer")}
          spellCheck={false}
          className="w-full bg-transparent outline-none truncate"
          style={{ color: "var(--foreground)", fontSize: 13, fontWeight: 600, minWidth: 0 }}
        />
        <p style={{ color: "var(--muted-foreground)", fontSize: 11, margin: "1px 0 0" }}>{typeLabel}</p>
      </div>
    </div>
  );
}

function GeometrySection({ x, y, w, h, rotation, onChange }: {
  x: number; y: number; w: number; h: number; rotation: number;
  onChange: (patch: { x?: number; y?: number; w?: number; h?: number; rotation?: number }) => void;
}) {
  return (
    <Section title="Position & Size">
      <div className="grid grid-cols-2 gap-1.5" style={{ minWidth: 0 }}>
        <MiniNumber label="X%" value={Math.round(x * 100)} onChange={(v) => onChange({ x: v / 100 })} />
        <MiniNumber label="Y%" value={Math.round(y * 100)} onChange={(v) => onChange({ y: v / 100 })} />
        <MiniNumber label="W%" value={Math.round(w * 100)} onChange={(v) => onChange({ w: Math.max(2, v) / 100 })} />
        <MiniNumber label="H%" value={Math.round(h * 100)} onChange={(v) => onChange({ h: Math.max(2, v) / 100 })} />
      </div>
      <SliderRow label="Rotation" value={Math.round(rotation)} min={-180} max={180} onChange={(v) => onChange({ rotation: Math.max(-180, Math.min(180, Math.round(v))) })} suffix="°" />
    </Section>
  );
}

function MultiSelectPanel({ count, onAlign, onDistribute, onGroup }: {
  count: number;
  onAlign?: (mode: "left" | "centerX" | "right" | "top" | "centerY" | "bottom") => void;
  onDistribute?: (axis: "x" | "y") => void;
  onGroup?: () => void;
}) {
  const btn: React.CSSProperties = { flex: 1, height: 30, borderRadius: 4, fontSize: 11, cursor: "pointer", background: "var(--secondary)", color: "var(--foreground)", border: "1px solid var(--border)", minWidth: 0 };
  return (
    <div className="py-2 px-3 flex flex-col gap-0 w-full" style={{ minWidth: 0 }}>
      <Section title={`${count} layers selected`}>
        <div className="flex gap-1 w-full" style={{ minWidth: 0, flexWrap: "wrap" }}>
          <button style={btn} title="Align left" onClick={() => onAlign?.("left")}>⇤</button>
          <button style={btn} title="Align center" onClick={() => onAlign?.("centerX")}>⇔</button>
          <button style={btn} title="Align right" onClick={() => onAlign?.("right")}>⇥</button>
          <button style={btn} title="Align top" onClick={() => onAlign?.("top")}>⤒</button>
          <button style={btn} title="Align middle" onClick={() => onAlign?.("centerY")}>⇕</button>
          <button style={btn} title="Align bottom" onClick={() => onAlign?.("bottom")}>⤓</button>
        </div>
        <div className="flex gap-1.5 w-full" style={{ minWidth: 0 }}>
          <button onClick={() => onDistribute?.("x")} className="flex-1 h-8 rounded text-xs" style={{ background: "var(--secondary)", color: "var(--foreground)", border: "1px solid var(--border)", cursor: "pointer", minWidth: 0 }}>Distribute ↔</button>
          <button onClick={() => onDistribute?.("y")} className="flex-1 h-8 rounded text-xs" style={{ background: "var(--secondary)", color: "var(--foreground)", border: "1px solid var(--border)", cursor: "pointer", minWidth: 0 }}>Distribute ↕</button>
          <button onClick={() => onGroup?.()} className="flex-1 h-8 rounded text-xs" style={{ background: "var(--accent)", color: "var(--accent-foreground)", border: "none", cursor: "pointer", fontWeight: 600, minWidth: 0 }}>Group</button>
        </div>
      </Section>
    </div>
  );
}

function DocumentPanel({ docWidth, docHeight, hasImage, onOpenImage, onNewCanvas, onAddText, onShapeTool }: {
  docWidth: number; docHeight: number; hasImage: boolean;
  onOpenImage?: () => void; onNewCanvas?: () => void; onAddText?: () => void; onShapeTool?: () => void;
}) {
  const action: React.CSSProperties = { height: 36, borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "1px solid var(--border)", minWidth: 0 };
  return (
    <div className="py-2 px-3 flex flex-col gap-0 w-full" style={{ minWidth: 0 }}>
      <div className="flex items-center gap-2 px-0 pt-1 pb-2 w-full" style={{ minWidth: 0, borderBottom: "1px solid var(--border)" }}>
        <div className="rounded shrink-0 flex items-center justify-center" style={{ width: 30, height: 30, background: "var(--secondary)", border: "1px solid var(--border)" }}>
          <ImageIcon size={15} strokeWidth={1.75} style={{ color: "var(--accent)" }} />
        </div>
        <div className="flex-1" style={{ minWidth: 0 }}>
          <p className="truncate" style={{ color: "var(--foreground)", fontSize: 13, fontWeight: 600, margin: 0 }}>Canvas</p>
          <p style={{ color: "var(--muted-foreground)", fontSize: 11, margin: "1px 0 0" }}>
            {hasImage && docWidth > 0 ? `${docWidth} × ${docHeight} px` : "Empty — nothing selected"}
          </p>
        </div>
      </div>
      <Section title="Document">
        <div className="grid grid-cols-2 gap-1.5" style={{ minWidth: 0 }}>
          <div className="rounded px-2 py-1.5" style={{ background: "var(--secondary)", border: "1px solid var(--border)", minWidth: 0 }}>
            <p style={{ color: "var(--muted-foreground)", fontSize: 10, margin: 0 }}>Width</p>
            <p className="tabular-nums" style={{ color: "var(--foreground)", fontSize: 13, margin: "2px 0 0" }}>{hasImage ? `${docWidth}px` : "—"}</p>
          </div>
          <div className="rounded px-2 py-1.5" style={{ background: "var(--secondary)", border: "1px solid var(--border)", minWidth: 0 }}>
            <p style={{ color: "var(--muted-foreground)", fontSize: 10, margin: 0 }}>Height</p>
            <p className="tabular-nums" style={{ color: "var(--foreground)", fontSize: 13, margin: "2px 0 0" }}>{hasImage ? `${docHeight}px` : "—"}</p>
          </div>
        </div>
      </Section>
      <Section title="Insert">
        <div className="flex flex-col gap-1.5" style={{ minWidth: 0 }}>
          <button onClick={onOpenImage} style={{ ...action, background: "var(--primary)", color: "var(--primary-foreground)", border: "none" }}>Open image…</button>
          <div className="flex gap-1.5" style={{ minWidth: 0 }}>
            <button onClick={onAddText} style={{ ...action, flex: 1, background: "var(--secondary)", color: "var(--foreground)" }}>Text (T)</button>
            <button onClick={onShapeTool} style={{ ...action, flex: 1, background: "var(--secondary)", color: "var(--foreground)" }}>Shape (U)</button>
          </div>
          <button onClick={onNewCanvas} style={{ ...action, background: "transparent", color: "var(--muted-foreground)" }}>New empty canvas</button>
        </div>
      </Section>
      <Section title="Tips">
        <p className="text-xs" style={{ color: "var(--muted-foreground)", lineHeight: 1.7, fontSize: 11, margin: 0 }}>
          Click any object on the canvas or a row in Layers — its full properties appear here, Figma-style.
        </p>
      </Section>
    </div>
  );
}

function DesignInspector(props: {
  selected: TextLayer | null;
  selImg: ImageLayer | null;
  selShape: ShapeLayer | null;
  selSolid: SolidLayer | null;
  multiCount: number;
  textLayers: TextLayer[];
  onUpdateText?: (id: string, patch: Partial<TextLayer>) => void;
  onDeleteText?: (id: string) => void;
  onDuplicateText?: (id: string) => void;
  onAddText?: () => void;
  onSelectText?: (id: string | null) => void;
  onUpdateImageLayer?: (id: string, patch: Partial<ImageLayer>) => void;
  onUpdateShapeLayer?: (id: string, patch: Partial<ShapeLayer>) => void;
  onUpdateSolidLayer?: (id: string, patch: Partial<SolidLayer>) => void;
  onDeleteGeneric?: (kind: string, id: string) => void;
  onDuplicateGeneric?: (kind: string, id: string) => void;
  onMoveLayer?: (id: string, dir: "front" | "back" | "forward" | "backward") => void;
  onBlendChange?: (id: string, blend: string) => void;
  onRename?: (id: string, name: string) => void;
  onAlign?: (mode: "left" | "centerX" | "right" | "top" | "centerY" | "bottom") => void;
  onDistribute?: (axis: "x" | "y") => void;
  onGroup?: () => void;
  docWidth: number;
  docHeight: number;
  hasImage: boolean;
  onOpenImage?: () => void;
  onNewCanvas?: () => void;
  onShapeTool?: () => void;
}) {
  const { selected, selImg, selShape, selSolid, multiCount } = props;
  if (multiCount > 1) {
    return <MultiSelectPanel count={multiCount} onAlign={props.onAlign} onDistribute={props.onDistribute} onGroup={props.onGroup} />;
  }
  if (selImg && props.onUpdateImageLayer) {
    const up = (patch: Partial<ImageLayer>) => props.onUpdateImageLayer!(selImg.id, patch);
    return (
      <div className="w-full" style={{ minWidth: 0 }}>
        <InspectorHeader
          icon={<ImageIcon size={15} strokeWidth={1.75} style={{ color: "#7FB8FF" }} />}
          typeLabel="Image layer"
          name={selImg.name}
          onRename={(n) => props.onRename?.(selImg.id, n)}
        />
        <div className="py-2 px-3 w-full" style={{ minWidth: 0 }}>
          <GeometrySection
            x={selImg.x} y={selImg.y} w={selImg.w} h={selImg.h} rotation={selImg.rotation}
            onChange={(p) => up({
              ...(p.x !== undefined ? { x: p.x } : {}),
              ...(p.y !== undefined ? { y: p.y } : {}),
              ...(p.w !== undefined ? { w: p.w } : {}),
              ...(p.h !== undefined ? { h: p.h } : {}),
              ...(p.rotation !== undefined ? { rotation: p.rotation } : {}),
            })}
          />
          <Section title="Appearance">
            <SliderRow label="Opacity" value={selImg.opacity} min={0} max={100} onChange={(v) => up({ opacity: Math.round(v) })} suffix="%" />
            <BlendRow value={selImg.blendMode ?? "source-over"} onChange={(v) => props.onBlendChange?.(selImg.id, v)} />
          </Section>
          <Section title="Layer">
            <ArrangeRow onMove={(d) => props.onMoveLayer?.(selImg.id, d)} />
            <div className="flex gap-1.5 mt-1.5">
              <div className="flex-1"><ToggleLine label="Visible" value={selImg.visible} onChange={(v) => up({ visible: v })} /></div>
              <div className="flex-1"><ToggleLine label="Locked" value={selImg.locked} onChange={(v) => up({ locked: v })} /></div>
            </div>
            <div className="flex gap-1.5 mt-2">
              <button onClick={() => props.onDuplicateGeneric?.("image", selImg.id)} className="flex-1 h-9 rounded text-xs font-medium" style={{ background: "var(--secondary)", color: "var(--foreground)", border: "1px solid var(--border)", cursor: "pointer" }}>Duplicate</button>
              <button onClick={() => props.onDeleteGeneric?.("image", selImg.id)} className="flex-1 h-9 rounded text-xs font-medium" style={{ background: "transparent", color: "var(--danger)", border: "1px solid var(--border)", cursor: "pointer" }}>Delete</button>
            </div>
          </Section>
        </div>
      </div>
    );
  }
  if (selShape && props.onUpdateShapeLayer) {
    const up = (patch: Partial<ShapeLayer>) => props.onUpdateShapeLayer!(selShape.id, patch);
    const kinds = [
      { k: "rect", label: "Rect" },
      { k: "ellipse", label: "Ellipse" },
      { k: "line", label: "Line" },
      { k: "arrow", label: "Arrow" },
    ] as const;
    return (
      <div className="w-full" style={{ minWidth: 0 }}>
        <InspectorHeader
          icon={<span style={{ fontSize: 14 }}>⬢</span>}
          typeLabel={`${selShape.shape === "rect" ? "Rectangle" : selShape.shape === "ellipse" ? "Ellipse" : selShape.shape === "line" ? "Line" : "Arrow"} shape`}
          name={selShape.name}
          onRename={(n) => props.onRename?.(selShape.id, n)}
        />
        <div className="py-2 px-3 w-full" style={{ minWidth: 0 }}>
          <Section title="Shape">
            <div className="flex gap-1 w-full" style={{ minWidth: 0 }}>
              {kinds.map((s) => (
                <button
                  key={s.k}
                  onClick={() => up({ shape: s.k })}
                  className="flex-1 h-8 rounded text-xs"
                  style={{
                    background: selShape.shape === s.k ? "var(--accent)" : "var(--secondary)",
                    color: selShape.shape === s.k ? "var(--accent-foreground)" : "var(--muted-foreground)",
                    border: "1px solid var(--border)",
                    cursor: "pointer",
                    fontWeight: selShape.shape === s.k ? 600 : 400,
                    minWidth: 0,
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </Section>
          <GeometrySection
            x={selShape.x} y={selShape.y} w={selShape.w} h={selShape.h} rotation={selShape.rotation}
            onChange={(p) => up({
              ...(p.x !== undefined ? { x: p.x } : {}),
              ...(p.y !== undefined ? { y: p.y } : {}),
              ...(p.w !== undefined ? { w: p.w } : {}),
              ...(p.h !== undefined ? { h: p.h } : {}),
              ...(p.rotation !== undefined ? { rotation: p.rotation } : {}),
            })}
          />
          <Section title="Fill & Stroke">
            <ColorRow label="Fill" value={selShape.color} onChange={(v) => up({ color: v })} />
            <ToggleLine label="Fill on" value={selShape.fillEnabled} onChange={(v) => up({ fillEnabled: v })} />
            <ColorRow label="Stroke" value={selShape.strokeColor} onChange={(v) => up({ strokeColor: v })} />
            <SliderRow label="Stroke width" value={selShape.strokeWidth} min={0} max={24} onChange={(v) => up({ strokeWidth: Math.round(v) })} suffix="px" />
          </Section>
          <Section title="Appearance">
            <SliderRow label="Opacity" value={selShape.opacity} min={0} max={100} onChange={(v) => up({ opacity: Math.round(v) })} suffix="%" />
            <BlendRow value={selShape.blendMode ?? "source-over"} onChange={(v) => props.onBlendChange?.(selShape.id, v)} />
          </Section>
          <Section title="Layer">
            <ArrangeRow onMove={(d) => props.onMoveLayer?.(selShape.id, d)} />
            <div className="flex gap-1.5 mt-1.5">
              <div className="flex-1"><ToggleLine label="Visible" value={selShape.visible} onChange={(v) => up({ visible: v })} /></div>
              <div className="flex-1"><ToggleLine label="Locked" value={selShape.locked} onChange={(v) => up({ locked: v })} /></div>
            </div>
            <div className="flex gap-1.5 mt-2">
              <button onClick={() => props.onDuplicateGeneric?.("shape", selShape.id)} className="flex-1 h-9 rounded text-xs font-medium" style={{ background: "var(--secondary)", color: "var(--foreground)", border: "1px solid var(--border)", cursor: "pointer" }}>Duplicate</button>
              <button onClick={() => props.onDeleteGeneric?.("shape", selShape.id)} className="flex-1 h-9 rounded text-xs font-medium" style={{ background: "transparent", color: "var(--danger)", border: "1px solid var(--border)", cursor: "pointer" }}>Delete</button>
            </div>
          </Section>
        </div>
      </div>
    );
  }
  if (selSolid && props.onUpdateSolidLayer) {
    const up = (patch: Partial<SolidLayer>) => props.onUpdateSolidLayer!(selSolid.id, patch);
    return (
      <div className="w-full" style={{ minWidth: 0 }}>
        <InspectorHeader
          icon={<span style={{ width: 14, height: 14, borderRadius: 4, background: selSolid.color, display: "inline-block" }} />}
          typeLabel="Solid fill"
          name={selSolid.name}
          onRename={(n) => props.onRename?.(selSolid.id, n)}
        />
        <div className="py-2 px-3 w-full" style={{ minWidth: 0 }}>
          <Section title="Fill">
            <ColorRow label="Color" value={selSolid.color} onChange={(v) => up({ color: v })} />
            <SliderRow label="Opacity" value={selSolid.opacity} min={0} max={100} onChange={(v) => up({ opacity: Math.round(v) })} suffix="%" />
            <BlendRow value={selSolid.blendMode ?? "source-over"} onChange={(v) => props.onBlendChange?.(selSolid.id, v)} />
          </Section>
          <Section title="Layer">
            <ArrangeRow onMove={(d) => props.onMoveLayer?.(selSolid.id, d)} />
            <div className="flex gap-1.5 mt-1.5">
              <div className="flex-1"><ToggleLine label="Visible" value={selSolid.visible} onChange={(v) => up({ visible: v })} /></div>
              <div className="flex-1"><ToggleLine label="Locked" value={selSolid.locked} onChange={(v) => up({ locked: v })} /></div>
            </div>
            <div className="flex gap-1.5 mt-2">
              <button onClick={() => props.onDuplicateGeneric?.("solid", selSolid.id)} className="flex-1 h-9 rounded text-xs font-medium" style={{ background: "var(--secondary)", color: "var(--foreground)", border: "1px solid var(--border)", cursor: "pointer" }}>Duplicate</button>
              <button onClick={() => props.onDeleteGeneric?.("solid", selSolid.id)} className="flex-1 h-9 rounded text-xs font-medium" style={{ background: "transparent", color: "var(--danger)", border: "1px solid var(--border)", cursor: "pointer" }}>Delete</button>
            </div>
          </Section>
        </div>
      </div>
    );
  }
  if (selected && props.onUpdateText) {
    return (
      <div className="w-full" style={{ minWidth: 0 }}>
        <InspectorHeader
          icon={<Type size={15} strokeWidth={1.75} style={{ color: "var(--accent)" }} />}
          typeLabel="Text layer"
          name={selected.name}
          onRename={(n) => props.onRename?.(selected.id, n)}
        />
        <DesignTab
          layer={selected}
          onUpdateText={props.onUpdateText}
          onDeleteText={props.onDeleteText}
          onDuplicateText={props.onDuplicateText}
          onAddText={props.onAddText}
          hasAnyText={props.textLayers.length > 0}
          onSelectText={props.onSelectText}
          blendValue={(selected as { blendMode?: string } | null)?.blendMode ?? "source-over"}
          onBlendChange={(v) => props.onBlendChange?.(selected.id, v)}
          arrange={props.onMoveLayer ? (d) => props.onMoveLayer!(selected.id, d) : undefined}
        />
      </div>
    );
  }
  return (
    <DocumentPanel
      docWidth={props.docWidth}
      docHeight={props.docHeight}
      hasImage={props.hasImage}
      onOpenImage={props.onOpenImage}
      onNewCanvas={props.onNewCanvas}
      onAddText={props.onAddText}
      onShapeTool={props.onShapeTool}
    />
  );
}

function DesignTab({
  layer,
  onUpdateText,
  onDeleteText,
  onDuplicateText,
  onAddText,
  hasAnyText,
  onSelectText,
  blendValue,
  onBlendChange,
  arrange,
}: {
  layer: TextLayer | null;
  onUpdateText?: (id: string, patch: Partial<TextLayer>) => void;
  onDeleteText?: (id: string) => void;
  onDuplicateText?: (id: string) => void;
  onAddText?: () => void;
  hasAnyText: boolean;
  onSelectText?: (id: string | null) => void;
  blendValue?: string;
  onBlendChange?: (v: string) => void;
  arrange?: (d: "front" | "back" | "forward" | "backward") => void;
}) {
  if (!layer || !onUpdateText) {
    return (
      <div className="px-3 py-4 flex flex-col gap-3 w-full" style={{ minWidth: 0 }}>
        <p className="text-xs" style={{ color: "var(--muted-foreground)", lineHeight: 1.7 }}>
          {hasAnyText ? "Select a text layer on the canvas or in Layers to edit its full properties here — exactly like Figma." : "No text selected. Add a text box to unlock typography, fill, box and effect controls."}
        </p>
        <button
          onClick={() => onAddText?.()}
          className="h-8 rounded text-xs font-medium w-full"
          style={{ background: "var(--primary)", color: "var(--primary-foreground)", border: "none", cursor: "pointer" }}
        >
          + Add text box (T)
        </button>
        <div className="rounded p-3 w-full" style={{ background: "var(--secondary)", border: "1px solid var(--border)", minWidth: 0 }}>
          <p className="text-xs font-medium mb-1.5" style={{ color: "var(--foreground)" }}>How text works</p>
          <p className="text-xs" style={{ color: "var(--muted-foreground)", lineHeight: 1.7, fontSize: 11 }}>
            Click canvas to place · drag box to move precisely · side handles resize width · ⟳ handle rotates (Shift snaps 15°) · double-click edits · arrow keys nudge · Del deletes.
          </p>
        </div>
      </div>
    );
  }

  const up = (patch: Partial<TextLayer>) => onUpdateText(layer.id, patch);

  return (
    <div className="py-2 px-3 flex flex-col gap-0 w-full" style={{ minWidth: 0 }}>
      <Section title="Content">
        <textarea
          value={layer.text}
          onChange={(e) => up({ text: e.target.value, name: e.target.value.slice(0, 24) || "Text layer" })}
          rows={2}
          className="w-full rounded text-xs outline-none resize-none"
          style={{ background: "var(--secondary)", border: "1px solid var(--border)", color: "var(--foreground)", padding: "8px 10px", lineHeight: 1.5, minWidth: 0 }}
        />
      </Section>

      <Section title="Position & Size">
        <div className="grid grid-cols-2 gap-1.5" style={{ minWidth: 0 }}>
          <MiniNumber label="X%" value={Math.round(layer.x * 100)} onChange={(v) => up({ x: v / 100 })} />
          <MiniNumber label="Y%" value={Math.round(layer.y * 100)} onChange={(v) => up({ y: v / 100 })} />
          <MiniNumber label="W%" value={Math.round(layer.w * 100)} onChange={(v) => up({ w: Math.max(5, v) / 100 })} />
          <MiniNumber label="↻°" value={Math.round(layer.rotation)} onChange={(v) => up({ rotation: Math.max(-180, Math.min(180, v)) })} />
        </div>
        <SliderRow label="Rotation" value={layer.rotation} min={-180} max={180} onChange={(v) => up({ rotation: Math.round(v) })} suffix="°" />
      </Section>

      <Section title="Typography">
        <label className="text-xs block mb-1" style={{ color: "var(--muted-foreground)" }}>Font family</label>
        <select
          value={layer.fontFamily}
          onChange={(e) => up({ fontFamily: e.target.value })}
          className="w-full h-9 rounded text-xs outline-none"
          style={{ background: "var(--secondary)", border: "1px solid var(--border)", color: "var(--foreground)", padding: "0 8px", minWidth: 0 }}
        >
          {FONT_OPTIONS.map((f) => (
            <option key={f.label} value={f.value}>{f.label}</option>
          ))}
        </select>
        <SliderRow label="Size" value={layer.fontSize} min={8} max={120} onChange={(v) => up({ fontSize: Math.round(v) })} suffix="px" />
        <label className="text-xs block mt-1 mb-1" style={{ color: "var(--muted-foreground)" }}>Weight</label>
        <div className="flex gap-1 w-full" style={{ minWidth: 0 }}>
          {WEIGHT_OPTIONS.map((w) => (
            <button
              key={w.value}
              onClick={() => up({ fontWeight: w.value })}
              className="flex-1 h-8 rounded text-xs truncate"
              style={{
                background: layer.fontWeight === w.value ? "var(--accent)" : "var(--secondary)",
                color: layer.fontWeight === w.value ? "var(--accent-foreground)" : "var(--muted-foreground)",
                border: "1px solid var(--border)",
                cursor: "pointer",
                fontWeight: w.value,
                minWidth: 0,
                fontSize: 11,
              }}
            >
              {w.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 mt-1.5">
          <ToggleBtn active={layer.fontWeight >= 700} onClick={() => up({ fontWeight: layer.fontWeight >= 700 ? 400 : 700 })} label="Bold">
            <Bold size={13} strokeWidth={2} />
          </ToggleBtn>
          <ToggleBtn active={layer.italic} onClick={() => up({ italic: !layer.italic })} label="Italic">
            <Italic size={13} strokeWidth={2} />
          </ToggleBtn>
          <ToggleBtn active={layer.underline} onClick={() => up({ underline: !layer.underline })} label="Underline">
            <Underline size={13} strokeWidth={2} />
          </ToggleBtn>
          <div style={{ width: 1, background: "var(--border)", margin: "2px 2px" }} />
          <ToggleBtn active={layer.align === "left"} onClick={() => up({ align: "left" })} label="Align left">
            <AlignLeft size={13} strokeWidth={2} />
          </ToggleBtn>
          <ToggleBtn active={layer.align === "center"} onClick={() => up({ align: "center" })} label="Align center">
            <AlignCenter size={13} strokeWidth={2} />
          </ToggleBtn>
          <ToggleBtn active={layer.align === "right"} onClick={() => up({ align: "right" })} label="Align right">
            <AlignRight size={13} strokeWidth={2} />
          </ToggleBtn>
          <ToggleBtn active={layer.align === "justify"} onClick={() => up({ align: "justify" })} label="Justify">
            <AlignJustify size={13} strokeWidth={2} />
          </ToggleBtn>
        </div>
        <SliderRow label="Line height" value={layer.lineHeight} min={0.8} max={2.5} step={0.05} onChange={(v) => up({ lineHeight: Math.round(v * 100) / 100 })} suffix="×" />
        <SliderRow label="Spacing" value={layer.letterSpacing} min={-2} max={20} step={0.5} onChange={(v) => up({ letterSpacing: Math.round(v * 10) / 10 })} suffix="px" />
      </Section>

      <Section title="Text fill">
        <div className="flex rounded overflow-hidden mb-2 w-full" style={{ border: "1px solid var(--border)", minWidth: 0 }}>
          {(["solid", "gradient"] as const).map((t) => (
            <button
              key={t}
              onClick={() => up({ fillType: t })}
              className="flex-1 h-7 text-xs"
              style={{
                background: layer.fillType === t ? "var(--secondary)" : "transparent",
                color: layer.fillType === t ? "var(--foreground)" : "var(--muted-foreground)",
                fontWeight: layer.fillType === t ? 600 : 400,
                border: "none",
                cursor: "pointer",
                textTransform: "capitalize",
              }}
            >
              {t}
            </button>
          ))}
        </div>
        {layer.fillType === "solid" ? (
          <ColorRow label="Color" value={layer.color} onChange={(v) => up({ color: v })} />
        ) : (
          <div className="flex flex-col gap-1.5" style={{ minWidth: 0 }}>
            <ColorRow label="From" value={layer.gradientFrom} onChange={(v) => up({ gradientFrom: v })} />
            <ColorRow label="To" value={layer.gradientTo} onChange={(v) => up({ gradientTo: v })} />
            <SliderRow label="Angle" value={layer.gradientAngle} min={0} max={360} onChange={(v) => up({ gradientAngle: Math.round(v) })} suffix="°" />
            <div className="rounded h-6 w-full" style={{ background: gradientCss(layer), border: "1px solid var(--border)" }} />
          </div>
        )}
      </Section>

      <Section title="Box">
        <ToggleLine label="Background" value={layer.boxEnabled} onChange={(v) => up({ boxEnabled: v })} />
        {layer.boxEnabled && (
          <div className="flex flex-col gap-1.5 mt-1" style={{ minWidth: 0 }}>
            <ColorRow label="Fill" value={layer.boxColor} onChange={(v) => up({ boxColor: v })} />
            <SliderRow label="Fill opacity" value={layer.boxOpacity} min={0} max={100} onChange={(v) => up({ boxOpacity: Math.round(v) })} suffix="%" />
            <SliderRow label="Padding" value={layer.padding} min={0} max={48} onChange={(v) => up({ padding: Math.round(v) })} suffix="px" />
            <SliderRow label="Radius" value={layer.borderRadius} min={0} max={48} onChange={(v) => up({ borderRadius: Math.round(v) })} suffix="px" />
          </div>
        )}
        <div className="mt-1">
          <ToggleLine label="Border" value={layer.borderEnabled} onChange={(v) => up({ borderEnabled: v })} />
        </div>
        {layer.borderEnabled && (
          <div className="flex flex-col gap-1.5 mt-1" style={{ minWidth: 0 }}>
            <ColorRow label="Border" value={layer.borderColor} onChange={(v) => up({ borderColor: v })} />
            <SliderRow label="Width" value={layer.borderWidth} min={1} max={12} onChange={(v) => up({ borderWidth: Math.round(v) })} suffix="px" />
          </div>
        )}
      </Section>

      <Section title="Effects">
        <SliderRow label="Opacity" value={layer.opacity} min={0} max={100} onChange={(v) => up({ opacity: Math.round(v) })} suffix="%" />
        {onBlendChange && <BlendRow value={blendValue ?? "source-over"} onChange={onBlendChange} />}
        {arrange && <ArrangeRow onMove={arrange} />}
        <SliderRow label="Blur" value={layer.blur} min={0} max={20} step={0.5} onChange={(v) => up({ blur: Math.round(v * 10) / 10 })} suffix="px" />
        <ToggleLine label="Shadow" value={layer.shadowEnabled} onChange={(v) => up({ shadowEnabled: v })} />
        {layer.shadowEnabled && (
          <div className="flex flex-col gap-1.5 mt-1" style={{ minWidth: 0 }}>
            <ColorRow label="Shadow" value={layer.shadowColor} onChange={(v) => up({ shadowColor: v })} />
            <SliderRow label="X" value={layer.shadowX} min={-40} max={40} onChange={(v) => up({ shadowX: Math.round(v) })} suffix="px" />
            <SliderRow label="Y" value={layer.shadowY} min={-40} max={40} onChange={(v) => up({ shadowY: Math.round(v) })} suffix="px" />
            <SliderRow label="Blur" value={layer.shadowBlur} min={0} max={60} onChange={(v) => up({ shadowBlur: Math.round(v) })} suffix="px" />
          </div>
        )}
      </Section>

      <Section title="Layer">
        <div className="flex gap-1.5 w-full" style={{ minWidth: 0 }}>
          <button
            onClick={() => onDuplicateText?.(layer.id)}
            className="flex-1 h-9 rounded text-xs font-medium flex items-center justify-center gap-1.5"
            style={{ background: "var(--secondary)", color: "var(--foreground)", border: "1px solid var(--border)", cursor: "pointer", minWidth: 0 }}
          >
            <Copy size={13} strokeWidth={2} /> Duplicate
          </button>
          <button
            onClick={() => { onDeleteText?.(layer.id); onSelectText?.(null); }}
            className="flex-1 h-9 rounded text-xs font-medium flex items-center justify-center gap-1.5"
            style={{ background: "transparent", color: "var(--danger)", border: "1px solid var(--border)", cursor: "pointer", minWidth: 0 }}
          >
            <Trash2 size={13} strokeWidth={2} /> Delete
          </button>
        </div>
        <div className="flex gap-1.5 mt-1.5">
          <ToggleLine label="Visible" value={layer.visible} onChange={(v) => up({ visible: v })} />
          <ToggleLine label="Locked" value={layer.locked} onChange={(v) => up({ locked: v })} />
        </div>
      </Section>
    </div>
  );
}

interface Adjustment {
  key: string;
  label: string;
  value: number;
  min: number;
  max: number;
  default: number;
}

const adjustments: Adjustment[] = [
  { key: "brightness", label: "Brightness", value: 0, min: -100, max: 100, default: 0 },
  { key: "contrast", label: "Contrast", value: 0, min: -100, max: 100, default: 0 },
  { key: "saturation", label: "Saturation", value: 0, min: -100, max: 100, default: 0 },
  { key: "sharpness", label: "Sharpness", value: 0, min: 0, max: 100, default: 0 },
  { key: "blur", label: "Blur", value: 0, min: 0, max: 40, default: 0 },
  { key: "highlights", label: "Highlights", value: 0, min: -100, max: 100, default: 0 },
  { key: "shadows", label: "Shadows", value: 0, min: -100, max: 100, default: 0 },
  { key: "temperature", label: "Temperature", value: 0, min: -100, max: 100, default: 0 },
];

function AdjustmentsTab({
  imageId,
  hasImage = false,
  onApplyOperation,
  onBlendOpen,
}: {
  imageId?: string | null;
  hasImage?: boolean;
  onApplyOperation?: (op: string, params: Record<string, number | string>) => Promise<string | null>;
  onBlendOpen?: () => void;
}) {
  const [values, setValues] = useState<Record<string, number>>(
    Object.fromEntries(adjustments.map((a) => [a.key, a.value]))
  );
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState<string | null>(null);

  function reset(key: string) {
    setValues((v) => ({ ...v, [key]: adjustments.find((a) => a.key === key)!.default }));
  }

  async function apply() {
    if (applying || !hasImage || !onApplyOperation) return;
    setApplying(true);
    setApplied(null);
    const params = {
      brightness: values.brightness,
      contrast: values.contrast,
      saturation: values.saturation,
      sharpness: values.sharpness,
    };
    const result = await onApplyOperation("adjust", params);
    setApplying(false);
    setApplied(result !== null ? "Applied" : "Failed — see error below");
  }

  const [bgBusy, setBgBusy] = useState(false);

  async function quickFilter(op: string, params: Record<string, number | string>) {
    if (applying || bgBusy || !onApplyOperation) return;
    if (!hasImage) return;
    setApplying(true);
    setApplied(null);
    const result = await onApplyOperation(op, params);
    setApplying(false);
    setApplied(result !== null ? "Applied" : "Failed — see error below");
  }

  async function proEnhance() {
    if (applying || bgBusy || !onApplyOperation || !hasImage) return;
    setApplying(true);
    setApplied(null);
    const result = await onApplyOperation("pro_enhance", { strength: 70 });
    setApplying(false);
    setApplied(result !== null ? "Pro enhanced ✨" : "Failed — see error below");
  }

  async function removeBackground() {
    if (bgBusy || !hasImage || !onApplyOperation) return;
    setBgBusy(true);
    setApplied(null);
    const result = await onApplyOperation("remove_background", {});
    setBgBusy(false);
    setApplied(result !== null ? "Background removed" : "Failed — see error below");
  }

  return (
    <div className="py-2 px-3 flex flex-col gap-0.5 w-full" style={{ minWidth: 0 }}>
      <button
        disabled={applying || bgBusy || !hasImage}
        onClick={() => void proEnhance()}
        className="h-9 rounded text-xs font-medium w-full mb-1 transition-colors duration-100"
        style={{
          background: applying || bgBusy || !hasImage ? "var(--secondary)" : "linear-gradient(135deg,#C97B4A,#E8A87C)",
          color: applying || bgBusy || !hasImage ? "var(--muted-foreground)" : "#fff",
          cursor: applying || bgBusy || !hasImage ? "not-allowed" : "pointer",
          border: "none",
          opacity: applying ? 0.7 : 1,
          fontWeight: 700,
        }}
        title="تحسين احترافي بزر واحد: إزالة ضجيج + توازن أبيض + CLAHE + حيوية + حدة — يعمل محلياً وبدقة أعلى مع الباكند"
      >
        {applying ? "Enhancing…" : "✨ Pro Enhance — تحسين بزر واحد"}
      </button>
      <button
        disabled={!hasImage}
        onClick={() => onBlendOpen?.()}
        className="h-9 rounded text-xs font-medium w-full mb-1 transition-colors duration-100"
        style={{ background: "var(--secondary)", color: "var(--foreground)", cursor: !hasImage ? "not-allowed" : "pointer", border: "1px solid var(--border)", opacity: !hasImage ? 0.5 : 1 }}
        title="دمج صورتين بخوارزميات OpenCV عالية الجودة (Poisson/Laplacian/Feather)"
      >
        🖼️ Blend Two Images… — دمج صورتين
      </button>
      <button
        disabled={bgBusy || !hasImage}
        onClick={removeBackground}
        className="h-9 rounded text-xs font-medium w-full mb-1 transition-colors duration-100"
        style={{
          background: bgBusy || !hasImage ? "var(--secondary)" : "var(--accent)",
          color: bgBusy || !hasImage ? "var(--muted-foreground)" : "var(--accent-foreground)",
          cursor: bgBusy || !hasImage ? "not-allowed" : "pointer",
          border: "none",
          opacity: bgBusy ? 0.7 : 1,
        }}
        title={!hasImage ? "Open an image first" : "Background removal (OpenCV GrabCut, rembg when installed)"}
      >
        {bgBusy ? "Removing background…" : "✨ Remove Background"}
      </button>
      {!hasImage && (
        <p className="text-xs mb-1" style={{ color: "var(--muted-foreground)", fontSize: 11 }}>
          Open an image to enable filters — all work offline, higher quality with backend.
        </p>
      )}
      <div className="w-full mb-1" style={{ minWidth: 0 }}>
        <p className="text-xs font-semibold mb-1.5 tracking-wide" style={{ color: "var(--muted-foreground)", fontSize: 10, letterSpacing: "0.08em" }}>
          QUICK FILTERS
        </p>
        <div className="grid grid-cols-3 gap-1.5" style={{ minWidth: 0 }}>
          {(
            [
              { label: "B&W", op: "grayscale", params: {} },
              { label: "Sepia", op: "sepia", params: {} },
              { label: "Vignette", op: "vignette", params: { strength: 45 } },
              { label: "Enhance", op: "auto_enhance", params: {} },
              { label: "Upscale 2×", op: "upscale", params: { scale: 2 } },
              { label: "Blur", op: "blur", params: { radius: 3 } },
            ] as { label: string; op: string; params: Record<string, number | string> }[]
          ).map((f) => (
            <button
              key={f.label}
              disabled={applying || bgBusy || !hasImage}
              onClick={() => void quickFilter(f.op, f.params)}
              className="h-9 rounded text-xs font-medium truncate"
              style={{
                background: "var(--secondary)",
                color: "var(--foreground)",
                border: "1px solid var(--border)",
                cursor: applying || bgBusy || !hasImage ? "not-allowed" : "pointer",
                opacity: applying || bgBusy || !hasImage ? 0.5 : 1,
                minWidth: 0,
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      {adjustments.map((adj) => (
        <div key={adj.key} className="py-2 w-full" style={{ borderBottom: "1px solid var(--border)", minWidth: 0 }}>
          <div className="flex items-center justify-between mb-1.5" style={{ minWidth: 0 }}>
            <span className="text-xs truncate" style={{ color: "var(--muted-foreground)", minWidth: 0 }}>
              {adj.label}
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              <span
                className="text-xs tabular-nums"
                style={{
                  color: values[adj.key] !== adj.default ? "var(--accent)" : "var(--muted-foreground)",
                  fontWeight: values[adj.key] !== adj.default ? 600 : 400,
                }}
              >
                {values[adj.key] > 0 ? `+${values[adj.key]}` : values[adj.key]}
              </span>
              {values[adj.key] !== adj.default && (
                <button
                  onClick={() => reset(adj.key)}
                  className="transition-colors duration-75"
                  style={{ color: "var(--muted-foreground)", background: "transparent", border: "none", cursor: "pointer", padding: 2 }}
                  title="Reset"
                >
                  <RotateCcw size={11} strokeWidth={2} />
                </button>
              )}
            </div>
          </div>
          <Slider
            min={adj.min}
            max={adj.max}
            value={values[adj.key]}
            onChange={(v) => setValues((vs) => ({ ...vs, [adj.key]: v }))}
          />
        </div>
      ))}

      <div className="pt-3 flex gap-2 w-full" style={{ minWidth: 0 }}>
        <button
          disabled={applying || !hasImage}
          onClick={apply}
          className="flex-1 h-9 rounded text-xs font-medium transition-colors duration-100"
          style={{
            background: "var(--primary)",
            color: "var(--primary-foreground)",
            opacity: applying ? 0.6 : 1,
            cursor: applying || !hasImage ? "not-allowed" : "pointer",
            border: "none",
            minWidth: 0,
          }}
        >
          {applying ? "Applying…" : "Apply"}
        </button>
        <button
          className="h-9 px-3 rounded text-xs transition-colors duration-100 shrink-0"
          style={{
            background: "var(--secondary)",
            color: "var(--foreground)",
            border: "1px solid var(--border)",
            cursor: "pointer",
          }}
        >
          Reset all
        </button>
      </div>
      {applied && (
        <p className="text-xs mt-1.5" style={{ color: applied === "Applied" ? "var(--success)" : "var(--warning)" }}>
          {applied}
        </p>
      )}
    </div>
  );
}

function HistoryTab({ stack, idx, onJump }: { stack: string[]; idx: number; onJump?: (i: number) => void }) {
  if (stack.length === 0) {
    return (
      <div className="px-4 py-6 text-center">
        <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>No history yet.</p>
      </div>
    );
  }
  const items = stack.map((label, i) => ({ id: `h${i}`, label, i }));
  return (
    <div className="py-1 w-full" style={{ minWidth: 0 }}>
      <p className="px-3 py-1 text-xs" style={{ color: "var(--muted-foreground)", fontSize: 10 }}>
        Click any step to jump (real undo — up to 30 steps)
      </p>
      {items.slice().reverse().map((item) => (
        <div
          key={item.id}
          onClick={() => onJump?.(item.i)}
          className="flex items-center gap-2.5 px-3 py-2 w-full"
          style={{
            background: item.i === idx ? "var(--secondary)" : "transparent",
            opacity: item.i > idx ? 0.45 : 1,
            minWidth: 0,
            cursor: onJump ? "pointer" : "default",
          }}
        >
          <div
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ background: item.i === idx ? "var(--accent)" : "var(--border)" }}
          />
          <span className="flex-1 text-xs truncate" style={{ color: "var(--foreground)", minWidth: 0 }}>
            {item.label}
          </span>
          <span className="text-xs shrink-0 tabular-nums" style={{ color: "var(--muted-foreground)" }}>
            #{item.i}
          </span>
        </div>
      ))}
    </div>
  );
}

function ComparisonStrip() {
  const [expanded, setExpanded] = useState(false);

  const results = [
    { id: "r1", label: "OpenCV Inpaint", ready: true },
    { id: "r2", label: "LaMa AI", ready: false },
  ];

  return (
    <div className="shrink-0 w-full" style={{ borderTop: "1px solid var(--border)", minWidth: 0 }}>
      <button
        className="w-full flex items-center justify-between px-3 py-2 transition-colors duration-75"
        style={{ color: "var(--muted-foreground)", background: "transparent", border: "none", cursor: "pointer", minWidth: 0 }}
        onClick={() => setExpanded((e) => !e)}
      >
        <span className="text-xs font-medium truncate" style={{ color: "var(--foreground)", minWidth: 0 }}>
          Compare results
        </span>
        <ChevronRight
          size={13}
          strokeWidth={2}
          style={{ transform: expanded ? "rotate(90deg)" : "rotate(0)", transition: "transform 200ms ease", flexShrink: 0 }}
        />
      </button>

      {expanded && (
        <div className="px-3 pb-3 flex gap-2 w-full" style={{ minWidth: 0 }}>
          {results.map((r) => (
            <div key={r.id} className="flex-1 rounded overflow-hidden" style={{ border: "1px solid var(--border)", minWidth: 0 }}>
              <div className="flex items-center justify-center" style={{ height: 64, background: r.ready ? "#2A2927" : "#1C1B1A" }}>
                {!r.ready ? (
                  <div className="flex gap-0.5">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="w-1 h-1 rounded-full" style={{ background: "var(--muted-foreground)", animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                    ))}
                  </div>
                ) : (
                  <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>Result</span>
                )}
              </div>
              <div className="px-2 py-1.5 flex items-center justify-between" style={{ background: "var(--secondary)", minWidth: 0 }}>
                <span className="text-xs truncate" style={{ color: "var(--muted-foreground)", minWidth: 0 }}>{r.label}</span>
                {r.ready && (
                  <button className="text-xs font-medium ml-1 shrink-0" style={{ color: "var(--accent)", background: "transparent", border: "none", cursor: "pointer" }}>
                    Use
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="py-2.5 w-full" style={{ borderBottom: "1px solid var(--border)", minWidth: 0 }}>
      <p className="font-semibold mb-2 tracking-wide" style={{ color: "var(--muted-foreground)", fontSize: 11, letterSpacing: "0.08em" }}>
        {title.toUpperCase()}
      </p>
      <div className="flex flex-col gap-1.5 w-full" style={{ minWidth: 0 }}>{children}</div>
    </div>
  );
}

function BlendRow({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="w-full" style={{ minWidth: 0 }}>
      <div className="flex items-center justify-between mb-1" style={{ minWidth: 0 }}>
        <span className="text-xs truncate" style={{ color: "var(--muted-foreground)", minWidth: 0 }}>Blend mode</span>
        <span className="text-xs shrink-0 ml-2" style={{ color: value !== "source-over" ? "#7FB8FF" : "var(--foreground)" }}>
          {BLEND_MODES.find((b) => b.value === value)?.label ?? "Normal"}
        </span>
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-9 rounded text-xs outline-none"
        style={{ background: "var(--secondary)", border: "1px solid var(--border)", color: "var(--foreground)", padding: "0 8px", minWidth: 0 }}
      >
        {BLEND_MODES.map((b) => (
          <option key={b.value} value={b.value}>{b.label}</option>
        ))}
      </select>
    </div>
  );
}

function ArrangeRow({ onMove }: { onMove: (d: "front" | "back" | "forward" | "backward") => void }) {
  const btn: React.CSSProperties = { flex: 1, height: 30, borderRadius: 4, fontSize: 11, cursor: "pointer", background: "var(--secondary)", color: "var(--foreground)", border: "1px solid var(--border)", minWidth: 0 };
  return (
    <div className="w-full" style={{ minWidth: 0 }}>
      <div className="mb-1"><span className="text-xs" style={{ color: "var(--muted-foreground)" }}>Arrange</span></div>
      <div className="flex gap-1 w-full" style={{ minWidth: 0 }}>
        <button style={btn} title="Bring to front" onClick={() => onMove("front")}>⤢ Front</button>
        <button style={btn} title="Bring forward" onClick={() => onMove("forward")}>↑ Fwd</button>
        <button style={btn} title="Send backward" onClick={() => onMove("backward")}>↓ Back</button>
        <button style={btn} title="Send to back" onClick={() => onMove("back")}>⤡ Back</button>
      </div>
    </div>
  );
}

function SliderRow({ label, value, min, max, step = 1, onChange, suffix }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; suffix?: string }) {
  return (
    <div className="w-full" style={{ minWidth: 0 }}>
      <div className="flex items-center justify-between mb-1" style={{ minWidth: 0 }}>
        <span className="text-xs truncate" style={{ color: "var(--muted-foreground)", minWidth: 0 }}>{label}</span>
        <span className="text-xs tabular-nums shrink-0 ml-2" style={{ color: "var(--foreground)" }}>
          {value}{suffix ?? ""}
        </span>
      </div>
      <Slider min={min} max={max} step={step} value={value} onChange={onChange} />
    </div>
  );
}

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2 w-full" style={{ minWidth: 0 }}>
      <span className="text-xs shrink-0" style={{ color: "var(--muted-foreground)", width: 56 }}>{label}</span>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="shrink-0 rounded cursor-pointer"
        style={{ width: 34, height: 28, padding: 0, background: "transparent", border: "1px solid var(--border)" }}
      />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        className="flex-1 h-8 px-2 rounded text-xs outline-none"
        style={{ background: "var(--secondary)", border: "1px solid var(--border)", color: "var(--foreground)", fontFamily: "monospace", minWidth: 0 }}
      />
    </div>
  );
}

function ToggleLine({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between w-full" style={{ minWidth: 0 }}>
      <span className="text-xs truncate" style={{ color: "var(--foreground)", minWidth: 0 }}>{label}</span>
      <button
        onClick={() => onChange(!value)}
        className="relative rounded-full transition-colors duration-200 shrink-0"
        style={{ width: 36, height: 20, background: value ? "var(--accent)" : "var(--secondary)", border: "1px solid var(--border)", cursor: "pointer", padding: 0 }}
      >
        <div
          className="absolute top-0.5 rounded-full transition-transform duration-200"
          style={{
            width: 14,
            height: 14,
            background: value ? "var(--primary-foreground)" : "var(--muted-foreground)",
            transform: value ? "translateX(18px)" : "translateX(2px)",
          }}
        />
      </button>
    </div>
  );
}

function ToggleBtn({ active, onClick, label, children }: { active: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={label}
      className="flex items-center justify-center rounded shrink-0"
      style={{
        width: 30,
        height: 30,
        background: active ? "var(--accent)" : "var(--secondary)",
        color: active ? "var(--accent-foreground)" : "var(--muted-foreground)",
        border: "1px solid var(--border)",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function MiniNumber({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1" style={{ minWidth: 0 }}>
      <span className="shrink-0 text-center" style={{ color: "var(--muted-foreground)", width: 28, fontSize: 11 }}>{label}</span>
      <div className="flex flex-1 items-center rounded" style={{ background: "var(--secondary)", border: "1px solid var(--border)", height: 30, paddingLeft: 8, paddingRight: 8, minWidth: 0 }}>
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 bg-transparent outline-none text-xs tabular-nums"
          style={{ color: "var(--foreground)", minWidth: 0, width: "100%" }}
        />
      </div>
    </div>
  );
}

function Slider({ min, max, value, step = 1, onChange }: { min: number; max: number; value: number; step?: number; onChange: (v: number) => void }) {
  const range = max - min;
  const pct = range === 0 ? 0 : ((value - min) / range) * 100;

  return (
    <div className="relative h-4 flex items-center w-full" style={{ minWidth: 0 }}>
      <div className="absolute w-full h-0.5 rounded-full" style={{ background: "var(--secondary)" }} />
      <div className="absolute h-0.5 rounded-full" style={{ background: "var(--accent)", width: `${Math.max(0, Math.min(100, pct))}%`, left: 0 }} />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="absolute w-full h-4 appearance-none bg-transparent cursor-pointer"
        style={{ minWidth: 0 }}
      />
      <style>{`
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: var(--accent);
          border: 2px solid var(--card);
          cursor: pointer;
          box-shadow: 0 0 0 1px var(--border);
        }
        input[type=range]::-webkit-slider-runnable-track {
          background: transparent;
        }
      `}</style>
    </div>
  );
}

function FooterGeometry({ name, x, y, w, rotation, onPatch }: {
  name: string; x: number; y: number; w: number; rotation: number;
  onPatch: (p: { x?: number; y?: number; w?: number; rotation?: number }) => void;
}) {
  return (
    <div style={{ minWidth: 0 }}>
      <div className="flex items-center justify-between mb-2" style={{ minWidth: 0 }}>
        <p className="text-xs font-medium truncate" style={{ color: "var(--foreground)", minWidth: 0 }}>{name}</p>
        <span className="text-xs shrink-0 ml-2" style={{ color: "var(--accent)", fontSize: 10 }}>
          {Math.round(x * 100)},{Math.round(y * 100)} · {Math.round(rotation)}°
        </span>
      </div>
      <div className="grid grid-cols-4 gap-1.5" style={{ minWidth: 0 }}>
        <MiniNumber label="X%" value={Math.round(x * 100)} onChange={(v) => onPatch({ x: v / 100 })} />
        <MiniNumber label="Y%" value={Math.round(y * 100)} onChange={(v) => onPatch({ y: v / 100 })} />
        <MiniNumber label="W%" value={Math.round(w * 100)} onChange={(v) => onPatch({ w: Math.max(2, v) / 100 })} />
        <MiniNumber label="°" value={Math.round(rotation)} onChange={(v) => onPatch({ rotation: Math.max(-180, Math.min(180, Math.round(v))) })} />
      </div>
    </div>
  );
}

function SmallIconBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <button
      className="flex items-center justify-center w-7 h-7 rounded transition-colors duration-75"
      style={{ color: "var(--muted-foreground)", background: "transparent", border: "none", cursor: "pointer" }}
      title={label}
      onClick={onClick}
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
