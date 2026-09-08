import { useEffect, useRef, useState } from "react";
import { Check, Move, X } from "lucide-react";
import type { Food } from "./data";
export default function PhotoEditor({
  file,
  onSave,
  onClose,
}: {
  file: File;
  onSave: (food: Food) => Promise<void>;
  onClose: () => void;
}) {
  const [url] = useState(() => URL.createObjectURL(file));
  const [name, setName] = useState("");
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(
    null,
  );
  const crop = useRef<HTMLDivElement>(null);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  const aspect = natural.w / natural.h || 1;
  const width = aspect >= 1 ? 100 * aspect : 100;
  const height = aspect >= 1 ? 100 : 100 / aspect;
  function clamp(x: number, y: number, z = zoom) {
    return {
      x: Math.max(-(width * z - 100) / 2, Math.min((width * z - 100) / 2, x)),
      y: Math.max(-(height * z - 100) / 2, Math.min((height * z - 100) / 2, y)),
    };
  }
  async function save() {
    setBusy(true);
    setError("");
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 768;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw Error();
      const scale = Math.max(768 / img.width, 768 / img.height) * zoom;
      ctx.drawImage(
        img,
        (768 - img.width * scale) / 2 + offset.x * 7.68,
        (768 - img.height * scale) / 2 + offset.y * 7.68,
        img.width * scale,
        img.height * scale,
      );
      await onSave({
        id: crypto.randomUUID(),
        name: name.trim(),
        image: canvas.toDataURL("image/jpeg", 0.86),
      });
      onClose();
    } catch {
      setError("照片未能保存，请检查浏览器存储空间后重试。");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="editor">
      <div className="section-heading">
        <h3>添加自己的食物</h3>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="取消照片编辑"
          disabled={busy}
        >
          <X size={20} />
        </button>
      </div>
      <div
        className="crop"
        ref={crop}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = {
            x: e.clientX,
            y: e.clientY,
            ox: offset.x,
            oy: offset.y,
          };
        }}
        onPointerMove={(e) => {
          if (drag.current) {
            const ratio = 100 / crop.current!.clientWidth;
            setOffset(
              clamp(
                drag.current.ox + (e.clientX - drag.current.x) * ratio,
                drag.current.oy + (e.clientY - drag.current.y) * ratio,
              ),
            );
          }
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
      >
        <img
          src={url}
          alt="待裁剪的食物照片"
          draggable={false}
          onLoad={(e) =>
            setNatural({
              w: e.currentTarget.naturalWidth,
              h: e.currentTarget.naturalHeight,
            })
          }
          onError={() =>
            setError("无法读取这张照片，请转换为 JPG、PNG 或 WebP 后重试。")
          }
          style={{
            width: `${width * zoom}%`,
            height: `${height * zoom}%`,
            left: `${50 + offset.x}%`,
            top: `${50 + offset.y}%`,
          }}
        />
        <div className="crop-outline" />
      </div>
      <p className="muted center">
        <Move size={14} /> 拖动调整位置，边缘会柔和透明
      </p>
      <label className="range-label">
        缩放
        <input
          aria-label="照片缩放"
          type="range"
          min="1"
          max="3"
          step=".01"
          value={zoom}
          onChange={(e) => {
            const z = +e.target.value;
            setZoom(z);
            setOffset(clamp(offset.x, offset.y, z));
          }}
        />
      </label>
      <label className="field-label">
        食物名称
        <input
          maxLength={16}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例如：奶奶做的小馒头"
        />
      </label>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <button
        className="primary full"
        disabled={busy || !natural.w || !name.trim()}
        onClick={save}
      >
        <Check size={18} />
        {busy ? "正在保存…" : "保存到食物库"}
      </button>
    </div>
  );
}
