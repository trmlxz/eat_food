import { act, fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import PhotoEditor from "./PhotoEditor";
function prepare(onSave = vi.fn(async () => {})) {
  vi.stubGlobal(
    "URL",
    Object.assign(URL, {
      createObjectURL: vi.fn(() => "blob:test"),
      revokeObjectURL: vi.fn(),
    }),
  );
  render(
    <PhotoEditor
      file={new File(["image"], "apple.jpg", { type: "image/jpeg" })}
      onSave={onSave}
      onClose={vi.fn()}
    />,
  );
  return onSave;
}
it("requires a loaded image and a name; shows decoding errors", () => {
  prepare();
  expect(screen.getByRole("button", { name: "保存到食物库" })).toBeDisabled();
  fireEvent.error(screen.getByAltText("待裁剪的食物照片"));
  expect(screen.getByRole("alert")).toHaveTextContent("无法读取");
});
it("keeps the editor and retry action available when saving fails", async () => {
  const save = prepare(
    vi.fn(async () => {
      throw Error("quota");
    }),
  );
  const preview = screen.getByAltText("待裁剪的食物照片");
  Object.defineProperties(preview, {
    naturalWidth: { value: 1200 },
    naturalHeight: { value: 800 },
  });
  fireEvent.load(preview);
  fireEvent.change(screen.getByPlaceholderText("例如：奶奶做的小馒头"), {
    target: { value: "小苹果" },
  });
  vi.spyOn(HTMLImageElement.prototype, "decode").mockResolvedValue();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(
    "data:image/jpeg;base64,test",
  );
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "保存到食物库" }));
  });
  expect(save).toHaveBeenCalled();
  expect(screen.getByRole("alert")).toHaveTextContent("照片未能保存");
  expect(screen.getByRole("button", { name: "保存到食物库" })).toBeEnabled();
});

it("saves on HTTP browsers without randomUUID", async () => {
  const save = prepare();
  const preview = screen.getByAltText("待裁剪的食物照片");
  Object.defineProperties(preview, {
    naturalWidth: { value: 1200 },
    naturalHeight: { value: 800 },
  });
  fireEvent.load(preview);
  fireEvent.change(screen.getByPlaceholderText("例如：奶奶做的小馒头"), {
    target: { value: "手机照片" },
  });
  vi.spyOn(HTMLImageElement.prototype, "decode").mockResolvedValue();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(
    "data:image/jpeg;base64,test",
  );
  const random = crypto.getRandomValues.bind(crypto);
  vi.stubGlobal("crypto", { getRandomValues: random });
  try {
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "保存到食物库" }));
    });
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.stringMatching(/^photo-[0-9a-f]{32}$/),
        name: "手机照片",
        image: "data:image/jpeg;base64,test",
      }),
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  } finally {
    vi.unstubAllGlobals();
  }
});
