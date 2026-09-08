import { useRef, useState, type ComponentProps } from "react";
import Stomach from "./Stomach";

/** Translation is separate from the SVG's fixed level scale and motion. */
export default function DraggableStomach(
  props: ComponentProps<typeof Stomach>,
) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{
    id: number;
    x: number;
    y: number;
    ox: number;
    oy: number;
    width: number;
    height: number;
  } | null>(null);
  function finish(id: number) {
    if (drag.current?.id !== id) return;
    drag.current = null;
    setDragging(false);
  }
  return (
    <div
      className={`stomach-drag-surface ${dragging ? "dragging" : ""}`}
      aria-label="拖动胃部调整位置，大小固定"
      onPointerDown={(event) => {
        if (event.button !== 0 || drag.current) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = {
          id: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          ox: position.x,
          oy: position.y,
          width: rect.width,
          height: rect.height,
        };
        setDragging(true);
      }}
      onPointerMove={(event) => {
        const active = drag.current;
        if (!active || active.id !== event.pointerId) return;
        // Keep the stomach reachable and retain the same relative position on rotation.
        setPosition({
          x: Math.max(
            -45,
            Math.min(
              45,
              active.ox + ((event.clientX - active.x) / active.width) * 100,
            ),
          ),
          y: Math.max(
            -45,
            Math.min(
              45,
              active.oy + ((event.clientY - active.y) / active.height) * 100,
            ),
          ),
        });
      }}
      onPointerUp={(event) => finish(event.pointerId)}
      onPointerCancel={(event) => finish(event.pointerId)}
      onLostPointerCapture={(event) => finish(event.pointerId)}
      onDragStart={(event) => event.preventDefault()}
    >
      <div
        className="stomach-position"
        style={{ transform: `translate(${position.x}%, ${position.y}%)` }}
      >
        <Stomach {...props} />
      </div>
    </div>
  );
}
