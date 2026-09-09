import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import App from "./App";
import { readSettings, defaults, foods, photoStore } from "./data";
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
      debugEnabled: false,
      level: 6,
      selected: ["strawberry", "apple"],
      craving: null,
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
      debugEnabled: false,
      level: 4,
      selected: ["apple"],
      craving: null,
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
  expect(document.querySelector(".camera-result .stomach-motion")).toHaveClass(
    "active",
  );
  expect(document.querySelector(".camera-result .stomach-motion")).toHaveStyle(
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

it("previews and saves an unhappy expression without tears", async () => {
  await mount();
  settings();
  fireEvent.click(screen.getByRole("tab", { name: "更多设置" }));
  fireEvent.click(screen.getByRole("button", { name: "🙁不高兴" }));
  const face = document.querySelector(
    '[aria-label="蠕动效果预览"] [data-expression="sad"]',
  );
  expect(face).toBeInTheDocument();
  expect(face?.querySelector('[fill="#80cff0"]')).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "保存设置" }));
  expect(readSettings().expression).toBe("sad");
});

describe("live configuration", () => {
  async function enterWithDebug() {
    await mount();
    settings();
    fireEvent.click(screen.getByRole("tab", { name: "更多设置" }));
    fireEvent.click(screen.getByRole("switch", { name: "调试模式" }));
    fireEvent.click(screen.getByRole("button", { name: "保存设置" }));
    fireEvent.click(screen.getByRole("button", { name: "开始" }));
  }

  it("hides the entry by default, including for legacy settings", async () => {
    expect(readSettings().debugEnabled).toBe(false);
    localStorage.setItem(
      "tummy-settings-v2",
      JSON.stringify({ debugEnabled: "true" }),
    );
    await mount();
    fireEvent.click(screen.getByRole("button", { name: "开始" }));
    expect(
      screen.queryByRole("button", { name: "打开即时配置" }),
    ).not.toBeInTheDocument();
  });

  it("updates the full-screen result immediately and persists all edited fields", async () => {
    await enterWithDebug();
    expect(readSettings().debugEnabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "打开即时配置" }));
    expect(screen.getByRole("dialog", { name: "即时配置" })).toHaveAttribute(
      "aria-modal",
      "false",
    );
    const stage = screen.getByLabelText("全屏胃部显示区域");
    const surface = within(stage).getByLabelText("拖动胃部调整位置，大小固定");
    expect(stage.parentElement).toHaveClass("scanner-card");
    expect(stage.closest(".radar-area")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "🙁不高兴" }));
    fireEvent.click(screen.getByRole("switch", { name: "胃部蠕动" }));
    fireEvent.change(screen.getByRole("slider", { name: "蠕动速度" }), {
      target: { value: "5" },
    });
    fireEvent.change(screen.getByRole("slider", { name: "蠕动幅度" }), {
      target: { value: "4" },
    });
    fireEvent.click(screen.getByRole("switch", { name: "扫描音效" }));
    fireEvent.click(screen.getByRole("tab", { name: "胃部大小" }));
    fireEvent.click(screen.getByRole("button", { name: /06.*大苹果/ }));
    fireEvent.click(screen.getByRole("tab", { name: "食物朋友" }));
    fireEvent.click(screen.getByRole("button", { name: "🍎苹果" }));
    expect(within(stage).getByRole("img")).toHaveAccessibleName(
      "6级胃部示意图，苹果",
    );
    expect(stage.querySelector("[data-expression='sad']")).toBeInTheDocument();
    expect(stage.querySelector(".stomach-motion")).toHaveClass("active");
    expect(stage.querySelector(".stomach-motion")).toHaveStyle(
      "--motion-duration: 1.2s",
    );
    expect(within(stage).getByLabelText("拖动胃部调整位置，大小固定")).toBe(
      surface,
    );
    expect(readSettings()).toMatchObject({
      debugEnabled: true,
      level: 6,
      selected: ["apple"],
      expression: "sad",
      sound: true,
      motion: true,
      motionSpeed: 5,
      motionAmplitude: 4,
    });
    fireEvent.click(screen.getByRole("button", { name: "完成" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(within(stage).getByRole("img")).toHaveAccessibleName(
      "6级胃部示意图，苹果",
    );
    fireEvent.click(screen.getByRole("button", { name: "打开即时配置" }));
    fireEvent.click(screen.getByRole("tab", { name: "胃部大小" }));
    expect(screen.getByRole("button", { name: /06.*大苹果/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("cancels scanning for live preview, handles Escape, and can disable debug in place", async () => {
    await enterWithDebug();
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "开始扫描" }));
    fireEvent.click(screen.getByRole("button", { name: "打开即时配置" }));
    expect(screen.getByLabelText("全屏胃部显示区域")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.querySelector(".camera-mode")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "再扫描一次" }));
    act(() => vi.advanceTimersByTime(3999));
    expect(screen.getByRole("button", { name: "扫描中…" })).toBeDisabled();
    act(() => vi.advanceTimersByTime(1));
    vi.useRealTimers();
    fireEvent.click(screen.getByRole("button", { name: "打开即时配置" }));
    fireEvent.click(screen.getByRole("switch", { name: "调试模式" }));
    expect(readSettings().debugEnabled).toBe(false);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "打开即时配置" }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("全屏胃部显示区域")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(document.querySelector(".camera-mode")).not.toBeInTheDocument();
  });

  it("keeps the live effect and reports storage failures without claiming it was saved", async () => {
    await enterWithDebug();
    fireEvent.click(screen.getByRole("button", { name: "打开即时配置" }));
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    fireEvent.click(screen.getByRole("button", { name: "😄大笑" }));
    expect(
      document.querySelector(".camera-result [data-expression='laugh']"),
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "配置已即时生效，但未能保存",
    );
    expect(readSettings().expression).toBe("smile");
  });
});

describe("food thought bubble", () => {
  function openCravings() {
    fireEvent.click(screen.getByRole("tab", { name: "想吃什么" }));
  }

  it("selects only one craving independently of eaten foods and shows it after scanning", async () => {
    await mount();
    settings();
    openCravings();
    expect(screen.getByRole("button", { name: "不显示气泡" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(document.querySelector(".thought-bubble")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "想吃苹果" }));
    fireEvent.click(screen.getByRole("button", { name: "想吃草莓" }));
    expect(screen.getByRole("button", { name: "想吃苹果" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: "想吃草莓" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      within(screen.getByLabelText("想吃食物预览")).getByRole("img"),
    ).toHaveAccessibleName("4级胃部示意图，没有选择食物，想吃草莓");
    fireEvent.click(screen.getByRole("button", { name: "预览结果" }));
    expect(
      within(screen.getByLabelText("扫描结果预览")).getByRole("img"),
    ).toHaveAccessibleName("4级胃部示意图，没有选择食物，想吃草莓");
    fireEvent.click(screen.getByRole("button", { name: "收起预览" }));
    fireEvent.click(screen.getByRole("tab", { name: "食物朋友" }));
    fireEvent.click(screen.getByRole("button", { name: "🍎苹果" }));
    fireEvent.click(screen.getByRole("button", { name: "保存设置" }));
    expect(readSettings()).toMatchObject({
      craving: "strawberry",
      selected: ["apple"],
    });

    vi.useFakeTimers();
    try {
      fireEvent.click(screen.getByRole("button", { name: "开始" }));
      fireEvent.click(screen.getByRole("button", { name: "开始扫描" }));
      act(() => vi.advanceTimersByTime(4000));
      const stage = screen.getByLabelText("全屏胃部显示区域");
      expect(within(stage).getByRole("img")).toHaveAccessibleName(
        "4级胃部示意图，苹果，想吃草莓",
      );
      expect(stage.querySelectorAll(".thought-bubble")).toHaveLength(1);
      expect(stage.querySelector(".thought-bubble")).toHaveTextContent("🍓");
      expect(stage.querySelector(".stomach-motion")).not.toHaveTextContent(
        "🍓",
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("restores saved cravings, discards cancelled edits, and can disable or reset the bubble", async () => {
    localStorage.setItem(
      "tummy-settings-v2",
      JSON.stringify({ ...defaults, craving: "banana" }),
    );
    await mount();
    settings();
    openCravings();
    expect(screen.getByRole("button", { name: "想吃香蕉" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "想吃米饭" }));
    fireEvent.click(screen.getByRole("button", { name: "关闭家长设置" }));
    settings();
    expect(screen.getByRole("button", { name: "想吃香蕉" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "不显示气泡" }));
    expect(document.querySelector(".thought-bubble")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "保存设置" }));
    expect(readSettings().craving).toBeNull();
    settings();
    fireEvent.click(screen.getByRole("button", { name: "想吃苹果" }));
    fireEvent.click(screen.getByRole("tab", { name: "更多设置" }));
    expect(
      screen.getByLabelText("蠕动效果预览").querySelector(".thought-bubble"),
    ).toHaveAttribute("data-craving", "apple");
    fireEvent.click(
      screen.getByRole("button", { name: "恢复默认设置（保留照片）" }),
    );
    expect(document.querySelector(".thought-bubble")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "保存设置" }));
    expect(readSettings()).toEqual(defaults);
  });

  it("updates the live result without replacing the draggable stomach", async () => {
    localStorage.setItem(
      "tummy-settings-v2",
      JSON.stringify({ ...defaults, debugEnabled: true }),
    );
    await mount();
    fireEvent.click(screen.getByRole("button", { name: "开始" }));
    fireEvent.click(screen.getByRole("button", { name: "打开即时配置" }));
    const stage = screen.getByLabelText("全屏胃部显示区域");
    const position = stage.querySelector(".stomach-position");
    openCravings();
    fireEvent.click(screen.getByRole("button", { name: "想吃馒头" }));
    expect(stage.querySelector(".thought-bubble image")).toHaveAttribute(
      "href",
      foods.find((f) => f.id === "bun")!.image!,
    );
    expect(readSettings().craving).toBe("bun");
    expect(stage.querySelector(".stomach-position")).toBe(position);
    fireEvent.click(screen.getByRole("button", { name: "想吃面条" }));
    expect(stage.querySelector(".thought-bubble")).toHaveTextContent("🍜");
    expect(readSettings().craving).toBe("noodles");
    fireEvent.click(screen.getByRole("button", { name: "不显示气泡" }));
    expect(stage.querySelector(".thought-bubble")).toBeNull();
    expect(readSettings().craving).toBeNull();
    expect(stage.querySelector(".stomach-position")).toBe(position);
  });

  it.each([undefined, null, 123, true, [], {}, "", "  "])(
    "defaults missing or invalid stored cravings (%j) to disabled",
    (craving) => {
      localStorage.setItem("tummy-settings-v2", JSON.stringify({ craving }));
      expect(readSettings().craving).toBeNull();
    },
  );

  it("hides a craving whose food is no longer available", async () => {
    localStorage.setItem(
      "tummy-settings-v2",
      JSON.stringify({ ...defaults, craving: "missing-photo" }),
    );
    await mount();
    settings();
    openCravings();
    expect(document.querySelector(".thought-bubble")).toBeNull();
    expect(screen.getByRole("button", { name: "不显示气泡" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  const photo = {
    id: "photo-soup",
    name: "南瓜汤",
    image: "data:image/jpeg;base64,c291cA==",
  };

  it("supports custom photos and clears a deleted craving without saving unrelated drafts", async () => {
    vi.mocked(photoStore).mockResolvedValueOnce([photo]);
    localStorage.setItem(
      "tummy-settings-v2",
      JSON.stringify({ ...defaults, selected: ["apple"] }),
    );
    await mount();
    settings();
    openCravings();
    fireEvent.click(screen.getByRole("button", { name: "想吃南瓜汤" }));
    expect(document.querySelector(".thought-bubble image")).toHaveAttribute(
      "href",
      photo.image,
    );
    fireEvent.click(screen.getByRole("button", { name: "保存设置" }));
    expect(readSettings().craving).toBe(photo.id);
    settings();
    fireEvent.click(screen.getByRole("tab", { name: "胃部大小" }));
    fireEvent.click(screen.getByRole("button", { name: /01.*蓝莓/ }));
    expect(
      document.querySelector(".stomach-preview .thought-bubble"),
    ).toHaveAttribute("data-craving", photo.id);
    fireEvent.click(screen.getByRole("tab", { name: "食物朋友" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "删除南瓜汤" }));
    });
    expect(photoStore).toHaveBeenCalledWith("delete", photo);
    expect(readSettings()).toMatchObject({
      level: 4,
      selected: ["apple"],
      craving: null,
    });
    openCravings();
    expect(
      screen.queryByRole("button", { name: "想吃南瓜汤" }),
    ).not.toBeInTheDocument();
    expect(document.querySelector(".thought-bubble")).toBeNull();
  });

  it("keeps the craving when its photo cannot be deleted", async () => {
    vi.mocked(photoStore).mockResolvedValueOnce([photo]);
    localStorage.setItem(
      "tummy-settings-v2",
      JSON.stringify({ ...defaults, craving: photo.id }),
    );
    await mount();
    settings();
    fireEvent.click(screen.getByRole("tab", { name: "食物朋友" }));
    vi.mocked(photoStore).mockRejectedValueOnce(new Error("delete failed"));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "删除南瓜汤" }));
    });
    expect(screen.getByRole("alert")).toHaveTextContent("删除失败");
    openCravings();
    expect(document.querySelector(".thought-bubble")).toHaveAttribute(
      "data-craving",
      photo.id,
    );
    expect(readSettings().craving).toBe(photo.id);
  });
});
