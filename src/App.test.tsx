import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import App from "./App";
import { readSettings, defaults } from "./data";
vi.mock("./data", async (importOriginal) => {
  const original = await importOriginal<typeof import("./data")>();
  return { ...original, photoStore: vi.fn(async () => []) };
});
async function mount() {
  await act(async () => {
    render(<App />);
  });
}
function settings() {
  fireEvent.keyDown(
    screen.getByRole("button", { name: "家长设置，长按或按回车打开" }),
    { key: "Enter" },
  );
}
describe("scan experience", () => {
  it("completes the scan once and supports scanning again", async () => {
    vi.useFakeTimers();
    await mount();
    fireEvent.click(screen.getByRole("button", { name: "开始扫描" }));
    expect(screen.getByRole("button", { name: "扫描中…" })).toBeDisabled();
    act(() => vi.advanceTimersByTime(3999));
    expect(
      screen.queryByRole("button", { name: "再扫描一次" }),
    ).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(
      screen.getByRole("img", { name: /4级胃部示意图/ }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "再扫描一次" }));
    expect(screen.getByRole("button", { name: "扫描中…" })).toBeDisabled();
    vi.useRealTimers();
  });
  it("saves size and multiple food selections, then shows them in the scan", async () => {
    await mount();
    settings();
    fireEvent.click(screen.getByRole("button", { name: /06.*大苹果/ }));
    fireEvent.click(screen.getByRole("tab", { name: "食物朋友" }));
    fireEvent.click(screen.getByRole("button", { name: "🍓草莓" }));
    fireEvent.click(screen.getByRole("button", { name: "🍎苹果" }));
    fireEvent.click(screen.getByRole("button", { name: "保存设置" }));
    expect(readSettings()).toEqual({
      level: 6,
      selected: ["rice", "banana", "strawberry"],
      sound: false,
    });
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "开始扫描" }));
    act(() => vi.advanceTimersByTime(4000));
    const img = screen.getByRole("img", { name: /6级胃部示意图/ });
    expect(img).toHaveAccessibleName("6级胃部示意图，香蕉、草莓、米饭");
    vi.useRealTimers();
  });
  it("does not apply cancelled settings and offers a preview", async () => {
    await mount();
    settings();
    fireEvent.click(screen.getByRole("button", { name: /01.*蓝莓/ }));
    fireEvent.click(screen.getByRole("button", { name: "预览结果" }));
    expect(
      within(document.querySelector('[aria-label="扫描结果预览"]')!).getByRole(
        "img",
      ),
    ).toHaveAccessibleName(/1级/);
    fireEvent.click(screen.getByRole("button", { name: "关闭家长设置" }));
    settings();
    expect(screen.getByRole("button", { name: /04.*李子/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
  it("recovers safely from corrupt stored settings", () => {
    localStorage.setItem("tummy-settings", "{bad");
    expect(readSettings()).toEqual(defaults);
    localStorage.setItem(
      "tummy-settings",
      JSON.stringify({
        level: 99,
        selected: [null, "apple", 3],
        sound: "true",
      }),
    );
    expect(readSettings()).toEqual({
      level: 4,
      selected: ["apple"],
      sound: false,
    });
  });
  it("keeps the menu open when settings cannot be persisted", async () => {
    await mount();
    settings();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    fireEvent.click(screen.getByRole("button", { name: "保存设置" }));
    expect(screen.getByRole("dialog")).toHaveAttribute("open");
    expect(screen.getByRole("alert")).toHaveTextContent("设置未保存");
  });
});
