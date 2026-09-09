import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import DraggableStomach from "./DraggableStomach";
import { foods } from "./data";

it("moves without changing size, ignores a second pointer, and stops after cancellation", () => {
  class TestPointerEvent extends MouseEvent {
    pointerId: number;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
    }
  }
  vi.stubGlobal("PointerEvent", TestPointerEvent);
  try {
    const { rerender } = render(<DraggableStomach level={4} items={[]} />);
    const surface = screen.getByLabelText("拖动胃部调整位置，大小固定");
    Object.defineProperty(surface, "setPointerCapture", { value: vi.fn() });
    vi.spyOn(surface, "getBoundingClientRect").mockReturnValue({
      width: 400,
      height: 600,
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 400,
      bottom: 600,
      toJSON() {},
    });
    const svg = screen.getByRole("img");
    const original = svg.innerHTML;
    fireEvent.pointerDown(surface, {
      pointerId: 1,
      button: 0,
      clientX: 100,
      clientY: 100,
    });
    fireEvent.pointerMove(surface, {
      pointerId: 1,
      clientX: 140,
      clientY: 160,
    });
    const position = surface.firstElementChild!;
    expect(position).toHaveStyle("transform: translate(10%, 10%)");
    expect(svg.innerHTML).toBe(original);
    fireEvent.pointerDown(surface, {
      pointerId: 2,
      button: 0,
      clientX: 200,
      clientY: 200,
    });
    fireEvent.pointerMove(surface, {
      pointerId: 2,
      clientX: 300,
      clientY: 300,
    });
    expect(position).toHaveStyle("transform: translate(10%, 10%)");
    fireEvent.pointerMove(surface, {
      pointerId: 1,
      clientX: 10000,
      clientY: -10000,
    });
    expect(position).toHaveStyle("transform: translate(45%, -45%)");
    fireEvent.pointerCancel(surface, { pointerId: 1 });
    fireEvent.pointerMove(surface, {
      pointerId: 1,
      clientX: 100,
      clientY: 100,
    });
    expect(position).toHaveStyle("transform: translate(45%, -45%)");
    expect(surface).not.toHaveClass("dragging");
    expect(svg.innerHTML).toBe(original);
    rerender(<DraggableStomach level={6} items={[]} expression="laugh" />);
    expect(position).toHaveStyle("transform: translate(45%, -45%)");
    expect(screen.getByRole("img")).toHaveAccessibleName(
      "6级胃部示意图，没有选择食物",
    );
    expect(svg.querySelector("[data-expression='laugh']")).toBeInTheDocument();
    rerender(
      <DraggableStomach
        level={6}
        items={[]}
        expression="laugh"
        craving={foods[0]}
      />,
    );
    expect(position).toHaveStyle("transform: translate(45%, -45%)");
    const bubble = svg.querySelector(".thought-bubble")!;
    expect(bubble.closest(".stomach-position")).toBe(position);
    expect(bubble).toHaveTextContent("🍎");
    expect(screen.getByRole("img")).toHaveAccessibleName(
      "6级胃部示意图，没有选择食物，想吃苹果",
    );
  } finally {
    vi.unstubAllGlobals();
  }
});
