export type Food = { id: string; name: string; emoji?: string; image?: string };
export type Expression = "cry" | "smile" | "laugh";
export type Settings = {
  expression: Expression;
  level: number;
  selected: string[];
  sound: boolean;
  motion: boolean;
  motionSpeed: number;
  motionAmplitude: number;
};
export const levels = ["蓝莓", "草莓", "小枣", "鸡蛋", "苹果", "大苹果"];
export const levelIcons = ["🫐", "🍓", "🟤", "🥚", "🍎", "🍎"];
export const foods: Food[] = [
  ["apple", "苹果", "🍎"],
  ["banana", "香蕉", "🍌"],
  ["strawberry", "草莓", "🍓"],
  ["grape", "葡萄", "🍇"],
  ["orange", "橙子", "🍊"],
  ["watermelon", "西瓜", "🍉"],
  ["rice", "米饭", "🍚"],
  ["bun", "馒头", "🥟"],
  ["noodles", "面条", "🍜"],
].map(([id, name, emoji]) => ({
  id,
  name,
  emoji,
  ...(id === "bun" ? { image: `${import.meta.env.BASE_URL}bun.svg` } : {}),
}));
export const defaults: Settings = {
  expression: "smile",
  level: 4,
  selected: [],
  sound: false,
  motion: false,
  motionSpeed: 3,
  motionAmplitude: 2,
};
export function readSettings(): Settings {
  try {
    const stored = localStorage.getItem("tummy-settings-v2");
    const s = JSON.parse(
      stored || localStorage.getItem("tummy-settings") || "null",
    );
    if (!s) return { ...defaults };
    return {
      level:
        Number.isInteger(s.level) && s.level >= 1 && s.level <= 6 ? s.level : 4,
      selected:
        stored && Array.isArray(s.selected)
          ? s.selected.filter((v: unknown) => typeof v === "string")
          : defaults.selected,
      expression: ["cry", "smile", "laugh"].includes(s.expression)
        ? s.expression
        : "smile",
      sound: s.sound === true,
      motion: s.motion === true,
      motionSpeed:
        Number.isInteger(s.motionSpeed) &&
        s.motionSpeed >= 1 &&
        s.motionSpeed <= 5
          ? s.motionSpeed
          : defaults.motionSpeed,
      motionAmplitude:
        Number.isInteger(s.motionAmplitude) &&
        s.motionAmplitude >= 1 &&
        s.motionAmplitude <= 5
          ? s.motionAmplitude
          : defaults.motionAmplitude,
    };
  } catch {
    return { ...defaults };
  }
}
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open("tummy-photos", 1);
    r.onupgradeneeded = () =>
      r.result.createObjectStore("foods", { keyPath: "id" });
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.onblocked = () => reject(new Error("数据库被占用"));
  });
}
export async function photoStore(
  action: "read" | "save" | "delete",
  food?: Food,
): Promise<Food[]> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(
      "foods",
      action === "read" ? "readonly" : "readwrite",
    );
    const store = tx.objectStore("foods");
    let result: Food[] = [];
    if (action === "save") store.put(food);
    if (action === "delete") store.delete(food!.id);
    if (action === "read") {
      const r = store.getAll();
      r.onsuccess = () => {
        result = r.result;
      };
    }
    tx.oncomplete = () => {
      db.close();
      resolve(result);
    };
    tx.onerror = tx.onabort = () => {
      db.close();
      reject(tx.error);
    };
  });
}
