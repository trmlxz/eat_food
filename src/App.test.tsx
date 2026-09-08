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
    screen.getByRole("button", { name: "家长设置，双击或按回车打开" }),
    { key: "Enter" },
  );
}
describe("scan experience", () => {
  it("completes the scan once and supports scanning again", async () => {
    vi.useFakeTimers();
    await mount();
    fireEvent.click(screen.getByRole("button", { name: "开始" }));
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
      selected: ["strawberry", "apple"],
      expression: "smile",
      sound: false,
      motion: false,
      motionSpeed: 3,
      motionAmplitude: 2,
    });
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "开始" }));
    fireEvent.click(screen.getByRole("button", { name: "开始扫描" }));
    act(() => vi.advanceTimersByTime(4000));
    const img = screen.getByRole("img", { name: /6级胃部示意图/ });
    expect(img).toHaveAccessibleName("6级胃部示意图，苹果、草莓");
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
    expect(screen.getByRole("button", { name: /04.*鸡蛋/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
  it("recovers safely from corrupt stored settings", () => {
    localStorage.setItem("tummy-settings-v2", "{bad");
    expect(readSettings()).toEqual(defaults);
    localStorage.setItem(
      "tummy-settings-v2",
      JSON.stringify({
        level: 99,
        selected: [null, "apple", 3],
        sound: "true",
      }),
    );
    expect(readSettings()).toEqual({
      level: 4,
      selected: ["apple"],
      expression: "smile",
      sound: false,
      motion: false,
      motionSpeed: 3,
      motionAmplitude: 2,
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

it("previews motion, persists its levels, and can disable it", async () => {
  await mount();
  settings();
  fireEvent.click(screen.getByRole("tab", { name: "更多设置" }));
  expect(screen.getByRole("slider", { name: "蠕动速度" })).toBeDisabled();
  fireEvent.click(screen.getByRole("switch", { name: "胃部蠕动" }));
  fireEvent.change(screen.getByRole("slider", { name: "蠕动速度" }), {
    target: { value: "5" },
  });
  fireEvent.change(screen.getByRole("slider", { name: "蠕动幅度" }), {
    target: { value: "4" },
  });
  expect(
    document.querySelector('[aria-label="蠕动效果预览"] .stomach-motion'),
  ).toHaveClass("active");
  fireEvent.click(screen.getByRole("button", { name: "保存设置" }));
  expect(readSettings()).toMatchObject({
    motion: true,
    motionSpeed: 5,
    motionAmplitude: 4,
  });
  vi.useFakeTimers();
  fireEvent.click(screen.getByRole("button", { name: "开始" }));
  fireEvent.click(screen.getByRole("button", { name: "开始扫描" }));
  act(() => vi.advanceTimersByTime(4000));
  expect(document.querySelector(".radar-disc .stomach-motion")).toHaveClass(
    "active",
  );
  expect(document.querySelector(".radar-disc .stomach-motion")).toHaveStyle(
    "--motion-duration: 1.2s",
  );
  vi.useRealTimers();
  fireEvent.click(screen.getByRole("button", { name: "退出全屏扫描" }));
  settings();
  expect(screen.getByRole("slider", { name: "蠕动幅度" })).toHaveValue("4");
  fireEvent.click(screen.getByRole("switch", { name: "胃部蠕动" }));
  expect(
    document.querySelector('[aria-label="蠕动效果预览"] .stomach-motion'),
  ).not.toHaveClass("active");
  fireEvent.click(screen.getByRole("button", { name: "保存设置" }));
  expect(readSettings()).toMatchObject({
    motion: false,
    motionSpeed: 5,
    motionAmplitude: 4,
  });
});
it("migrates old settings and rejects invalid motion levels", () => {
  localStorage.setItem(
    "tummy-settings-v2",
    JSON.stringify({ level: 4, selected: ["apple"], sound: true }),
  );
  expect(readSettings()).toMatchObject({
    level: 4,
    sound: true,
    motion: false,
    motionSpeed: 3,
    motionAmplitude: 2,
  });
  localStorage.setItem(
    "tummy-settings-v2",
    JSON.stringify({ motion: "true", motionSpeed: 0, motionAmplitude: 6 }),
  );
  expect(readSettings()).toMatchObject({
    motion: false,
    motionSpeed: 3,
    motionAmplitude: 2,
  });
});

it("starts with an empty stomach and cancels an active scan when leaving camera mode", async () => {
  await mount();
  expect(readSettings().selected).toEqual([]);
  fireEvent.click(screen.getByRole("button", { name: "开始" }));
  expect(document.querySelector(".camera-mode")).toBeInTheDocument();
  expect(
    screen.queryByRole("img", { name: /级胃部示意图/ }),
  ).not.toBeInTheDocument();
  vi.useFakeTimers();
  fireEvent.click(screen.getByRole("button", { name: "开始扫描" }));
  act(() => vi.advanceTimersByTime(4000));
  expect(
    screen.getByRole("img", { name: "4级胃部示意图，没有选择食物" }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "再扫描一次" }));
  fireEvent.click(screen.getByRole("button", { name: "退出全屏扫描" }));
  act(() => vi.advanceTimersByTime(4000));
  expect(document.querySelector(".camera-mode")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "开始" })).toBeInTheDocument();
  expect(document.body.style.overflow).not.toBe("hidden");
  vi.useRealTimers();
});
it("clears legacy automatic foods while preserving the other settings", () => {
  localStorage.setItem(
    "tummy-settings",
    JSON.stringify({
      level: 6,
      selected: ["apple", "rice", "banana"],
      motion: true,
      motionSpeed: 5,
    }),
  );
  expect(readSettings()).toMatchObject({
    level: 6,
    selected: [],
    motion: true,
    motionSpeed: 5,
  });
});

it("opens parent settings with two taps and persists the selected expression", async () => {
  await mount();
  const entry = screen.getByRole("button", {
    name: "家长设置，双击或按回车打开",
  });
  fireEvent.click(entry);
  expect(document.querySelector("dialog")).not.toHaveAttribute("open");
  fireEvent.click(entry);
  expect(screen.getByRole("dialog")).toHaveAttribute("open");
  fireEvent.click(screen.getByRole("tab", { name: "更多设置" }));
  fireEvent.click(screen.getByRole("button", { name: "😭哭泣" }));
  expect(
    document.querySelector(
      '[aria-label="蠕动效果预览"] [data-expression="cry"]',
    ),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "保存设置" }));
  expect(readSettings().expression).toBe("cry");
  fireEvent.doubleClick(entry);
  fireEvent.click(screen.getByRole("button", { name: "😄大笑" }));
  expect(
    document.querySelector(
      '[aria-label="蠕动效果预览"] [data-expression="laugh"]',
    ),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "关闭家长设置" }));
  expect(readSettings().expression).toBe("cry");
});
