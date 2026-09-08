import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import { photoStore } from "./data";
it("persists photos across connections and deletes only the requested food", async () => {
  const a = {
      id: "photo-a",
      name: "小馒头",
      image: "data:image/jpeg;base64,a",
    },
    b = { id: "photo-b", name: "苹果", image: "data:image/jpeg;base64,b" };
  await photoStore("save", a);
  await photoStore("save", b);
  expect(await photoStore("read")).toEqual([a, b]);
  await photoStore("delete", a);
  expect(await photoStore("read")).toEqual([b]);
  await photoStore("delete", b);
  expect(await photoStore("read")).toEqual([]);
});
