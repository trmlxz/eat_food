export type FoodCategory =
  "fruit" | "staple" | "protein" | "vegetable" | "other";
export type Food = {
  id: string;
  name: string;
  category?: FoodCategory;
  emoji?: string;
  image?: string;
};
export const foodCategories: { key: FoodCategory; name: string }[] = [
  { key: "fruit", name: "水果" },
  { key: "staple", name: "主食" },
  { key: "protein", name: "肉与水产" },
  { key: "vegetable", name: "蔬菜" },
  { key: "other", name: "饮品与其他" },
];
export type Expression = "cry" | "sad" | "smile" | "laugh";
export type Settings = {
  debugEnabled: boolean;
  expression: Expression;
  level: number;
  selected: string[];
  craving: string | null;
  sound: boolean;
  motion: boolean;
  motionSpeed: number;
  motionAmplitude: number;
};
export const settingsKey = "tummy-settings-v3";
export const levels = [
  "蓝莓",
  "草莓",
  "小枣",
  "鸡蛋",
  "苹果",
  "中苹果",
  "大苹果",
];
export const levelIcons = ["🫐", "🍓", "🟤", "🥚", "🍎", "🍎", "🍎"];
export const foods: Food[] = [
  // 水果
  ["apple", "苹果", "🍎", "fruit"],
  ["banana", "香蕉", "🍌", "fruit"],
  ["strawberry", "草莓", "🍓", "fruit"],
  ["grape", "葡萄", "🍇", "fruit"],
  ["orange", "橙子", "🍊", "fruit"],
  ["watermelon", "西瓜", "🍉", "fruit"],
  ["pear", "梨", "🍐", "fruit"],
  ["peach", "桃子", "🍑", "fruit"],
  // 主食
  ["rice", "米饭", "🍚", "staple"],
  ["bun", "馒头", "🥟", "staple"],
  ["noodles", "面条", "🍜", "staple"],
  ["friedrice", "炒饭", "🍛", "staple"],
  ["dumpling", "饺子", "🥟", "staple"],
  ["baozi", "包子", "🫓", "staple"],
  ["bread", "面包", "🍞", "staple"],
  ["porridge", "粥", "🥣", "staple"],
  // 肉与水产
  ["ribs", "排骨", "🍖", "protein"],
  ["beef", "牛肉", "🥩", "protein"],
  ["pork", "猪肉", "🥓", "protein"],
  ["lamb", "羊肉", "🍢", "protein"],
  ["chicken", "鸡肉", "🍗", "protein"],
  ["fish", "鱼", "🐟", "protein"],
  ["shrimp", "虾", "🍤", "protein"],
  // 蔬菜
  ["broccoli", "西蓝花", "🥦", "vegetable"],
  ["greens", "青菜", "🥬", "vegetable"],
  ["corn", "玉米", "🌽", "vegetable"],
  ["carrot", "胡萝卜", "🥕", "vegetable"],
  ["tomato", "西红柿", "🍅", "vegetable"],
  ["potato", "土豆", "🥔", "vegetable"],
  ["cucumber", "黄瓜", "🥒", "vegetable"],
  ["mushroom", "蘑菇", "🍄", "vegetable"],
  // 饮品与其他
  ["milk", "牛奶", "🥛", "other"],
  ["soymilk", "豆浆", "🥤", "other"],
  ["peanut", "花生", "🥜", "other"],
].map(([id, name, emoji, category]) => ({
  id,
  name,
  emoji,
  category: category as FoodCategory,
  ...(id === "bun" ? { image: `${import.meta.env.BASE_URL}bun.svg` } : {}),
}));
export const foodGroups = foodCategories.map((c) => ({
  ...c,
  items: foods.filter((f) => f.category === c.key),
}));
export const defaults: Settings = {
  debugEnabled: false,
  expression: "smile",
  level: 4,
  selected: [],
  craving: null,
  sound: true,
  motion: false,
  motionSpeed: 3,
  motionAmplitude: 2,
};
export function readSettings(): Settings {
  try {
    const s = JSON.parse(localStorage.getItem(settingsKey) || "null");
    if (!s) return { ...defaults };
    return {
      debugEnabled: s.debugEnabled === true,
      level:
        Number.isInteger(s.level) && s.level >= 1 && s.level <= levels.length
          ? s.level
          : defaults.level,
      selected: Array.isArray(s.selected)
        ? s.selected.filter((v: unknown) => typeof v === "string")
        : defaults.selected,
      craving:
        typeof s.craving === "string" && s.craving.trim()
          ? s.craving
          : defaults.craving,
      expression: ["cry", "sad", "smile", "laugh"].includes(s.expression)
        ? s.expression
        : "smile",
      sound: typeof s.sound === "boolean" ? s.sound : defaults.sound,
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
