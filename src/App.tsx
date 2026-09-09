import { useEffect, useRef, useState, type SetStateAction } from "react";
import {
  ArrowRight,
  AudioLines,
  Camera,
  Check,
  ChevronRight,
  Heart,
  ImagePlus,
  LockKeyhole,
  MessageCircle,
  Radar,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import {
  defaults,
  foods,
  levelIcons,
  levels,
  photoStore,
  readSettings,
  type Food,
  type Settings,
} from "./data";
import Stomach from "./Stomach";
import DraggableStomach from "./DraggableStomach";
import PhotoEditor from "./PhotoEditor";

/** Scan audio runs through a compressor so it stays loud without clipping. */
function audioBus(ctx: AudioContext) {
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -10;
  comp.knee.value = 10;
  comp.ratio.value = 4;
  comp.attack.value = 0.003;
  comp.release.value = 0.12;
  const master = ctx.createGain();
  master.gain.value = 1;
  comp.connect(master);
  master.connect(ctx.destination);
  return comp;
}

/**
 * Rhythm of the scan: [start, length, hz] triples. Short 0.09s beeps read as
 * "滴", longer 0.28s ones as "嘟". Pitches come from a C major pentatonic
 * scale, so every combination stays consonant no matter how they overlap.
 * Beeps sit close together inside a burst and the bursts are spaced apart,
 * which keeps the pattern dense without turning into a flat stream.
 */
const scanBeeps: [number, number, number][] = [
  [0.0, 0.09, 523.25],
  [0.16, 0.09, 659.25],
  [0.32, 0.28, 783.99],
  [1.1, 0.09, 659.25],
  [1.26, 0.09, 783.99],
  [1.42, 0.28, 880.0],
  [2.2, 0.09, 783.99],
  [2.36, 0.09, 880.0],
  [2.52, 0.09, 1046.5],
  [2.68, 0.3, 1174.66],
  [3.05, 0.08, 1046.5],
  [3.22, 0.08, 1174.66],
];

/** Reduced-motion scans last 600ms, so they get a two-beep version. */
const quickBeeps: [number, number, number][] = [
  [0.0, 0.08, 783.99],
  [0.14, 0.18, 1046.5],
];

/** One beep: sine body plus a quiet octave for sparkle, softened by a lowpass. */
function beep(
  ctx: AudioContext,
  bus: AudioNode,
  at: number,
  len: number,
  freq: number,
) {
  const level = len > 0.15 ? 0.24 : 0.28;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 5000;
  filter.Q.value = 0.7;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.linearRampToValueAtTime(level, at + 0.008);
  gain.gain.setValueAtTime(level, at + Math.max(0.014, len - 0.05));
  gain.gain.exponentialRampToValueAtTime(0.0001, at + len);
  filter.connect(gain);
  gain.connect(bus);
  const voices: [OscillatorType, number, number][] = [
    ["sine", 1, 1],
    ["triangle", 2, 0.18],
  ];
  return voices.map(([type, multiple, mix]) => {
    const osc = ctx.createOscillator();
    const trim = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq * multiple;
    trim.gain.value = mix;
    osc.connect(trim);
    trim.connect(filter);
    osc.start(at);
    osc.stop(at + len + 0.02);
    return osc;
  });
}

/**
 * Completion chime. The pitch is 1320 Hz, but what makes it read as a crisp
 * "叮" rather than a soft tone is the attack: all partials strike within
 * 1.5ms, and the high ones (4.2x and above) decay in well under a fifth of a
 * second, leaving only the low partials ringing.
 */
function ding(ctx: AudioContext, bus: AudioNode, at: number) {
  const partials: [number, number, number][] = [
    [1, 0.26, 1.4],
    [2, 0.15, 0.85],
    [3.01, 0.13, 0.42],
    [4.2, 0.1, 0.2],
    [5.43, 0.08, 0.12],
    [6.8, 0.05, 0.06],
  ];
  return partials.map(([ratio, level, decay]) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 1320 * ratio;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.linearRampToValueAtTime(level, at + 0.0015);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + decay);
    osc.connect(gain);
    gain.connect(bus);
    osc.start(at);
    osc.stop(at + decay + 0.05);
    return osc;
  });
}

export default function App() {
  const [camera, setCamera] = useState(false);
  const [settings, setSettings] = useState(readSettings);
  const [draft, setDraft] = useState<Settings>(settings);
  const [liveSettings, setLiveSettings] = useState(false);
  const [photoPage, setPhotoPage] = useState(0);
  const [photos, setPhotos] = useState<Food[]>([]);
  const [phase, setPhase] = useState<"ready" | "scanning" | "result">("ready");
  const [tab, setTab] = useState("size");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [hint, setHint] = useState(false);
  const [preview, setPreview] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const lastParentTap = useRef<number | null>(null);
  const scan = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const bus = useRef<AudioNode | null>(null);
  const tones = useRef<OscillatorNode[]>([]);
  const all = [...foods, ...photos];
  const page = Math.min(
    photoPage,
    Math.max(0, Math.ceil(photos.length / 3) - 1),
  );
  const selected = all.filter((f) => settings.selected.includes(f.id));
  const craving = all.find((f) => f.id === settings.craving);
  const draftCraving = all.find((f) => f.id === draft.craving);
  useEffect(() => {
    let live = true;
    photoStore("read")
      .then((p) => {
        if (live) setPhotos(p);
      })
      .catch(() => {
        if (live) setError("照片库暂时无法读取，内置食物仍可使用。");
      });
    return () => {
      live = false;
      if (scan.current) clearTimeout(scan.current);
      void audio.current?.close();
    };
  }, []);
  function silence() {
    for (const osc of tones.current) {
      try {
        osc.stop();
      } catch {
        /* Already finished. */
      }
    }
    tones.current = [];
  }
  function leaveCamera() {
    if (scan.current) clearTimeout(scan.current);
    silence();
    closeSettings();
    setPhase("ready");
    setCamera(false);
  }
  useEffect(() => {
    if (!camera) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (dialog.current?.open) {
        event.preventDefault();
        if (file) setFile(null);
        else closeSettings();
      } else leaveCamera();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [camera, file]);
  function openSettings() {
    setLiveSettings(false);
    setDraft({ ...settings, selected: [...settings.selected] });
    setPreview(false);
    setFile(null);
    lastParentTap.current = null;
    dialog.current?.showModal();
  }
  function closeSettings() {
    dialog.current?.close();
    setLiveSettings(false);
    setFile(null);
  }
  function openLiveSettings() {
    if (!settings.debugEnabled) return;
    if (scan.current) clearTimeout(scan.current);
    silence();
    setPhase("result");
    setDraft({ ...settings, selected: [...settings.selected] });
    setPreview(false);
    setFile(null);
    setError("");
    setLiveSettings(true);
    // A non-modal panel leaves the stomach visible and draggable behind it.
    dialog.current?.show();
  }
  function changeDraft(update: SetStateAction<Settings>) {
    const next = typeof update === "function" ? update(draft) : update;
    setDraft(next);
    if (!liveSettings) return;
    setSettings(next);
    try {
      localStorage.setItem("tummy-settings-v2", JSON.stringify(next));
      setError("");
    } catch {
      setError("配置已即时生效，但未能保存；请检查浏览器存储空间。");
    }
    if (!next.debugEnabled) closeSettings();
  }
  function start() {
    if (phase === "scanning") return;
    setPhase("scanning");
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const duration = reduced ? 600 : 4000;
    if (settings.sound) {
      try {
        const ctx = audio.current ?? new AudioContext();
        audio.current = ctx;
        bus.current ??= audioBus(ctx);
        void ctx.resume().catch(() => {});
        silence();
        const at = ctx.currentTime + 0.02;
        for (const [offset, len, freq] of reduced ? quickBeeps : scanBeeps) {
          tones.current.push(...beep(ctx, bus.current, at + offset, len, freq));
        }
        tones.current.push(...ding(ctx, bus.current, at + duration / 1000));
      } catch {
        /* Audio is optional. */
      }
    }
    scan.current = setTimeout(() => setPhase("result"), duration);
  }
  function save() {
    try {
      localStorage.setItem("tummy-settings-v2", JSON.stringify(draft));
      setSettings(draft);
      setPhase("ready");
      dialog.current?.close();
    } catch {
      setError("设置未保存，浏览器存储可能已满。请释放空间后重试。");
    }
  }
  function toggle(id: string) {
    changeDraft((d) => ({
      ...d,
      selected: d.selected.includes(id)
        ? d.selected.filter((v) => v !== id)
        : [...d.selected, id],
    }));
  }
  async function addPhoto(food: Food) {
    await photoStore("save", food);
    setPhotos((p) => [...p, food]);
    setPhotoPage(Math.floor(photos.length / 3));
  }
  async function deletePhoto(food: Food) {
    setDeleting(food.id);
    try {
      await photoStore("delete", food);
      setPhotos((p) => p.filter((f) => f.id !== food.id));
      const removeFood = (s: Settings): Settings => ({
        ...s,
        selected: s.selected.filter((id) => id !== food.id),
        craving: s.craving === food.id ? null : s.craving,
      });
      changeDraft(removeFood);
      if (!liveSettings) {
        const next = removeFood(settings);
        setSettings(next);
        if (
          settings.craving === food.id ||
          settings.selected.includes(food.id)
        ) {
          try {
            localStorage.setItem("tummy-settings-v2", JSON.stringify(next));
          } catch {
            setError("照片已删除，但未能保存设置；请检查浏览器存储空间。");
          }
        }
      }
    } catch {
      setError("删除失败，请重试。");
    } finally {
      setDeleting(null);
    }
  }
  function chooseFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) {
      if (f.size > 25 * 1024 * 1024) setError("请选择 25 MB 以内的照片。");
      else setFile(f);
    }
    e.target.value = "";
  }
  return (
    <div className={`app-shell ${camera ? "camera-mode" : ""}`}>
      <header className="topbar">
        <a className="brand" href="./" aria-label="小肚子雷达首页">
          <span className="brand-icon">
            <Radar size={25} />
          </span>
          <span>
            小肚子雷达<small>LITTLE TUMMY LAB</small>
          </span>
        </a>
        <button
          className="parent-entry"
          aria-label="家长设置，双击或按回车打开"
          title="双击打开，或按回车打开"
          onContextMenu={(e) => e.preventDefault()}
          onClick={() => {
            const now = performance.now();
            if (
              lastParentTap.current !== null &&
              now - lastParentTap.current < 400
            )
              openSettings();
            else {
              lastParentTap.current = now;
              setHint(true);
            }
          }}
          onDoubleClick={() => {
            if (!dialog.current?.open) openSettings();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openSettings();
            }
          }}
        >
          <Settings2 size={17} />
          <span>家长设置</span>
          <LockKeyhole size={12} />
        </button>
      </header>
      <main>
        <div className="intro">
          <span className="eyebrow">
            <span /> 好奇心准备就绪
          </span>
          <h1>
            小肚子里，
            <span>
              有什么？
              <svg viewBox="0 0 210 14" aria-hidden="true">
                <path d="M3 9Q100 0 207 8" />
              </svg>
            </span>
          </h1>
          <p>开启一场奇妙的食物探险，发现每一口的小秘密。</p>
        </div>
        <section className={`scanner-card ${phase}`} aria-label="小肚子扫描仪">
          {camera && (
            <button
              className="camera-back"
              onClick={leaveCamera}
              aria-label="退出全屏扫描"
            >
              <X size={23} />
            </button>
          )}
          {camera && settings.debugEnabled && (
            <button
              className="camera-options"
              aria-label="打开即时配置"
              aria-expanded={liveSettings}
              aria-controls="settings-panel"
              onClick={() =>
                liveSettings ? closeSettings() : openLiveSettings()
              }
            >
              <Settings2 size={18} />
              选项
            </button>
          )}
          {camera && phase === "result" && (
            <div className="camera-result" aria-label="全屏胃部显示区域">
              <DraggableStomach
                level={settings.level}
                items={selected}
                motion={settings}
                expression={settings.expression}
                craving={craving}
              />
            </div>
          )}
          <div className="card-top">
            <span>
              <span className="status-dot" />
              {phase === "scanning"
                ? "探索进行中"
                : phase === "result"
                  ? "探索完成"
                  : "小肚子探索仪"}
            </span>
            <span className="serial">
              TUMMY–01 <AudioLines size={16} />
            </span>
          </div>
          <div className="scanner-layout">
            <div className="radar-area">
              <span className="coordinate top">N · 00°</span>
              <span className="coordinate bottom">小小身体 · 大大宇宙</span>
              <div
                className={`radar-disc ${phase === "scanning" ? "spinning" : ""}`}
              >
                <div className="radar-grid" />
                <div className="radar-axis horizontal" />
                <div className="radar-axis vertical" />
                <div className="radar-ring one" />
                <div className="radar-ring two" />
                <div className="radar-ring three" />
                {phase !== "result" && <div className="radar-sweep" />}
                {phase !== "result" && (
                  <>
                    <div className="radar-blip b1" />
                    <div className="radar-blip b2" />
                    <div className="radar-blip b3" />
                    <div className="radar-mascot">
                      <span className="mascot-leaf" />
                      <span className="eye left" />
                      <span className="eye right" />
                      <span className="cheek left" />
                      <span className="cheek right" />
                      <span className="smile" />
                    </div>
                  </>
                )}
                <span className="radar-center" />
              </div>
              <span className="orbit-star s1">✦</span>
              <span className="orbit-star s2">✧</span>
              <span className="floating-food f1">🥦</span>
              <span className="floating-food f2">🍊</span>
            </div>
            <div className="scan-copy" aria-live="polite">
              <div className="mini-label">
                {phase === "result" ? "DISCOVERY COMPLETE" : "LET’S EXPLORE"}
              </div>
              <h2>
                {phase === "ready"
                  ? "你好呀，小小探险家！"
                  : phase === "scanning"
                    ? "正在探索小肚子…"
                    : "叮！发现小肚子的秘密"}
              </h2>
              <p>
                {phase === "ready"
                  ? "准备好了吗？轻轻点一下，\n一起看看小肚子里的奇妙世界。"
                  : phase === "scanning"
                    ? "雷达转呀转，\n食物朋友们在哪里呢？"
                    : `今天的小肚子是「${levels[settings.level - 1]}」大小，\n和食物朋友们打个招呼吧！`}
              </p>
              {phase === "result" && (
                <div className="result-foods">
                  {selected.length ? (
                    selected.map((f) => (
                      <span key={f.id}>
                        {f.image ? <img src={f.image} alt="" /> : f.emoji}{" "}
                        {f.name}
                      </span>
                    ))
                  ) : (
                    <span>安静的小肚子，等你来探索</span>
                  )}
                </div>
              )}
              <button
                className="primary scan-button"
                onClick={
                  camera
                    ? start
                    : () => {
                        setPhase("ready");
                        setCamera(true);
                      }
                }
                disabled={phase === "scanning"}
              >
                {phase === "result" ? (
                  <RotateCcw size={21} />
                ) : (
                  <Radar size={22} />
                )}
                <span>
                  {!camera
                    ? "开始"
                    : phase === "ready"
                      ? "开始扫描"
                      : phase === "scanning"
                        ? "扫描中…"
                        : "再扫描一次"}
                </span>
                {phase !== "scanning" && <ArrowRight size={19} />}
              </button>
              <div className="scan-note">
                {phase === "scanning" ? (
                  <>
                    <span className="progress-track">
                      <span />
                    </span>
                    正在寻找食物朋友
                  </>
                ) : (
                  <>
                    <ShieldCheck size={14} />
                    趣味模拟 · 让发现更有趣
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="card-footer">
            <span>
              <Sparkles size={15} /> 每一口，都有小发现
            </span>
            <span>
              <span className="tiny-dot" />{" "}
              {phase === "scanning"
                ? "SCANNING"
                : phase === "result"
                  ? "COMPLETE"
                  : "READY TO EXPLORE"}
            </span>
          </div>
        </section>
        <div className="steps">
          <div className="step">
            <span className="step-icon peach">
              <Heart size={21} />
            </span>
            <div>
              <h3>准备好小肚子</h3>
              <p>找个舒服的姿势，放轻松</p>
            </div>
            <span className="step-number">01</span>
          </div>
          <ChevronRight className="step-chevron" size={18} />
          <div className="step">
            <span className="step-icon green">
              <Radar size={22} />
            </span>
            <div>
              <h3>点一下，开始探索</h3>
              <p>让小雷达转一转</p>
            </div>
            <span className="step-number">02</span>
          </div>
          <ChevronRight className="step-chevron" size={18} />
          <div className="step">
            <span className="step-icon yellow">
              <Sparkles size={21} />
            </span>
            <div>
              <h3>认识食物好朋友</h3>
              <p>聊聊今天吃了什么吧</p>
            </div>
            <span className="step-number">03</span>
          </div>
        </div>
        <div className="parent-tip">
          <span>
            <LockKeyhole size={15} /> 给爸爸妈妈的小提示
          </span>
          <p>双击右上角「家长设置」，定制这一次的小发现。</p>
        </div>
        {hint && (
          <p role="status" className="hint">
            双击「家长设置」即可打开，键盘可按回车。
          </p>
        )}
      </main>
      <footer className="site-footer">
        <span>用好奇心，陪伴每一口成长</span>
        <Heart size={12} />
        <span>LITTLE TUMMY LAB</span>
      </footer>
      <dialog
        ref={dialog}
        id="settings-panel"
        aria-label={liveSettings ? "即时配置" : "家长设置"}
        aria-modal={!liveSettings}
        className={`settings-dialog ${liveSettings ? "live-settings" : ""}`}
        onCancel={(e) => {
          if (file) {
            e.preventDefault();
            setFile(null);
          }
        }}
      >
        <div className="modal-header">
          <div>
            <span className="mini-label">
              {liveSettings ? "LIVE CONTROLS" : "PARENTS’ CORNER"}
            </span>
            <h2>{liveSettings ? "即时配置" : "定制小肚子的发现"}</h2>
          </div>
          <button
            className="icon-button"
            aria-label={liveSettings ? "关闭即时配置" : "关闭家长设置"}
            onClick={closeSettings}
          >
            <X />
          </button>
        </div>
        <div className={`modal-body ${preview && !file ? "previewing" : ""}`}>
          {file ? (
            <PhotoEditor
              file={file}
              onSave={addPhoto}
              onClose={() => setFile(null)}
            />
          ) : (
            <>
              <p className="notice">
                <ShieldCheck size={18} />
                {liveSettings
                  ? "修改即时生效并自动保存，可拖动背景中的胃部查看效果。"
                  : "这是趣味模拟，扫描结果由家长设置，不代表真实胃部状态。"}
              </p>
              <div className="tabs" role="tablist" aria-label="设置类别">
                {[
                  ["size", "胃部大小"],
                  ["food", "食物朋友"],
                  ["craving", "想吃什么"],
                  ["options", "更多设置"],
                ].map(([id, label]) => (
                  <button
                    role="tab"
                    id={`tab-${id}`}
                    aria-controls={`panel-${id}`}
                    aria-selected={tab === id}
                    key={id}
                    onClick={() => {
                      setTab(id);
                      setPreview(false);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <section
                role="tabpanel"
                id={`panel-${tab}`}
                aria-labelledby={`tab-${tab}`}
              >
                {tab === "size" ? (
                  <>
                    <div className="section-heading">
                      <h3>这次，是多大的小肚子？</h3>
                      <span>6 个探索等级</span>
                    </div>
                    <div className="level-grid">
                      {levels.map((name, i) => (
                        <button
                          className={`level-option ${draft.level === i + 1 ? "selected" : ""}`}
                          key={name}
                          aria-pressed={draft.level === i + 1}
                          onClick={() =>
                            changeDraft((d) => ({ ...d, level: i + 1 }))
                          }
                        >
                          <span className="level-number">0{i + 1}</span>
                          <span
                            className="level-fruit"
                            style={{ fontSize: 25 + i * 4 }}
                          >
                            {levelIcons[i]}
                          </span>
                          <strong>{name}</strong>
                          {draft.level === i + 1 && (
                            <Check className="selected-check" size={15} />
                          )}
                        </button>
                      ))}
                    </div>
                    <div className="stomach-preview">
                      <Stomach
                        level={draft.level}
                        motion={draft}
                        expression={draft.expression}
                        craving={draftCraving}
                        items={all.filter((f) => draft.selected.includes(f.id))}
                      />
                      <span>
                        {levels[draft.level - 1]}大小 · 第 {draft.level} 级
                      </span>
                    </div>
                    <p className="muted">
                      水果名称仅用于区分等级，不对应真实胃容量。
                    </p>
                  </>
                ) : tab === "food" ? (
                  <>
                    <div className="section-heading">
                      <h3>今天有哪些食物朋友？</h3>
                      <span>
                        可多选 · 已选{" "}
                        {
                          all.filter((f) => draft.selected.includes(f.id))
                            .length
                        }{" "}
                        种
                      </span>
                    </div>
                    <div className="food-grid">
                      {foods.map((f) => (
                        <button
                          key={f.id}
                          className={`food-option ${draft.selected.includes(f.id) ? "selected" : ""}`}
                          aria-pressed={draft.selected.includes(f.id)}
                          onClick={() => toggle(f.id)}
                        >
                          <span>
                            {f.image ? (
                              <img
                                className="builtin-image"
                                src={f.image}
                                alt=""
                              />
                            ) : (
                              f.emoji
                            )}
                          </span>
                          {f.name}
                          {draft.selected.includes(f.id) && (
                            <Check className="selected-check" size={14} />
                          )}
                        </button>
                      ))}
                    </div>
                    <div className="section-heading">
                      <h3>自己的食物库</h3>
                      <span>照片仅保存在本机</span>
                    </div>
                    <div className="upload-actions">
                      <label>
                        <Camera size={19} />
                        拍照添加
                        <input
                          aria-label="拍照添加"
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={chooseFile}
                        />
                      </label>
                      <label>
                        <ImagePlus size={19} />
                        从图库选择
                        <input
                          aria-label="从图库选择"
                          type="file"
                          accept="image/*"
                          onChange={chooseFile}
                        />
                      </label>
                    </div>
                    {photos.length ? (
                      <div className="food-grid custom-foods">
                        {photos.slice(page * 3, page * 3 + 3).map((f) => (
                          <div className="custom-food" key={f.id}>
                            <button
                              className={`food-option ${draft.selected.includes(f.id) ? "selected" : ""}`}
                              aria-pressed={draft.selected.includes(f.id)}
                              onClick={() => toggle(f.id)}
                            >
                              <img src={f.image} alt="" />
                              {f.name}
                              {draft.selected.includes(f.id) && (
                                <Check className="selected-check" size={14} />
                              )}
                            </button>
                            <button
                              className="delete-food"
                              aria-label={`删除${f.name}`}
                              disabled={deleting === f.id}
                              onClick={() => void deletePhoto(f)}
                            >
                              <Trash2 size={13} />
                              删除
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="empty-state">
                        把熟悉的家常菜，也变成探索里的小惊喜。
                      </p>
                    )}
                    {photos.length > 3 && (
                      <nav
                        className="photo-pagination"
                        aria-label="食物照片分页"
                      >
                        <button
                          className="secondary"
                          disabled={page === 0}
                          onClick={() => setPhotoPage(page - 1)}
                        >
                          上一页
                        </button>
                        <span>
                          {page + 1} / {Math.ceil(photos.length / 3)}
                        </span>
                        <button
                          className="secondary"
                          disabled={(page + 1) * 3 >= photos.length}
                          onClick={() => setPhotoPage(page + 1)}
                        >
                          下一页
                        </button>
                      </nav>
                    )}
                    <p className="muted">
                      清理浏览器网站数据会删除照片。取消选中仅隐藏食物；删除会移出素材库。
                    </p>
                  </>
                ) : tab === "craving" ? (
                  <>
                    <div className="section-heading">
                      <h3>小肚子现在想吃什么？</h3>
                      <span>单选 · 不影响胃内食物</span>
                    </div>
                    <p className="muted">
                      在胃部右上角，用一个思考气泡说出小肚子的愿望。
                    </p>
                    <div
                      className="food-grid craving-grid"
                      aria-label="想吃的食物"
                    >
                      <button
                        className={`food-option ${!draftCraving ? "selected" : ""}`}
                        aria-pressed={!draftCraving}
                        onClick={() =>
                          changeDraft((d) => ({ ...d, craving: null }))
                        }
                      >
                        <span aria-hidden="true">
                          <MessageCircle size={24} />
                        </span>
                        不显示气泡
                        {!draftCraving && (
                          <Check className="selected-check" size={14} />
                        )}
                      </button>
                      {all.map((f) => (
                        <button
                          key={f.id}
                          className={`food-option ${draft.craving === f.id ? "selected" : ""}`}
                          aria-label={`想吃${f.name}`}
                          aria-pressed={draft.craving === f.id}
                          onClick={() =>
                            changeDraft((d) => ({ ...d, craving: f.id }))
                          }
                        >
                          {f.image ? (
                            <img src={f.image} alt="" />
                          ) : (
                            <span aria-hidden="true">{f.emoji}</span>
                          )}
                          {f.name}
                          {draft.craving === f.id && (
                            <Check className="selected-check" size={14} />
                          )}
                        </button>
                      ))}
                    </div>
                    <div className="stomach-preview" aria-label="想吃食物预览">
                      <Stomach
                        level={draft.level}
                        items={all.filter((f) => draft.selected.includes(f.id))}
                        motion={draft}
                        expression={draft.expression}
                        craving={draftCraving}
                      />
                      <span>
                        {draftCraving
                          ? `想吃${draftCraving.name}…`
                          : "思考气泡已关闭"}
                      </span>
                    </div>
                    <p className="muted">
                      想用自己的食物照片？先到“食物朋友”中添加，再来这里选择。
                    </p>
                  </>
                ) : (
                  <>
                    <div className="option-row">
                      <div>
                        <h3>调试模式</h3>
                        <p>在雷达页显示“选项”，实时调整效果</p>
                      </div>
                      <button
                        role="switch"
                        aria-label="调试模式"
                        aria-checked={draft.debugEnabled}
                        className={`switch ${draft.debugEnabled ? "on" : ""}`}
                        onClick={() =>
                          changeDraft((d) => ({
                            ...d,
                            debugEnabled: !d.debugEnabled,
                          }))
                        }
                      >
                        <span />
                      </button>
                    </div>
                    <div className="section-heading">
                      <h3>小肚子的表情</h3>
                    </div>
                    <div className="expression-options">
                      {(
                        [
                          ["cry", "😭", "哭泣"],
                          ["sad", "🙁", "不高兴"],
                          ["smile", "🙂", "微笑"],
                          ["laugh", "😄", "大笑"],
                        ] as const
                      ).map(([value, emoji, label]) => (
                        <button
                          key={value}
                          aria-pressed={draft.expression === value}
                          className={`food-option ${draft.expression === value ? "selected" : ""}`}
                          onClick={() =>
                            changeDraft((d) => ({ ...d, expression: value }))
                          }
                        >
                          <span>{emoji}</span>
                          {label}
                        </button>
                      ))}
                    </div>
                    <div className="option-row">
                      <div>
                        <h3>胃部蠕动</h3>
                        <p>让小肚子轻轻收缩、舒展</p>
                      </div>
                      <button
                        role="switch"
                        aria-label="胃部蠕动"
                        aria-checked={draft.motion}
                        className={`switch ${draft.motion ? "on" : ""}`}
                        onClick={() =>
                          changeDraft((d) => ({ ...d, motion: !d.motion }))
                        }
                      >
                        <span />
                      </button>
                    </div>
                    <fieldset
                      className="motion-controls"
                      disabled={!draft.motion}
                    >
                      <legend>蠕动等级</legend>
                      <label className="range-label">
                        速度
                        <input
                          aria-label="蠕动速度"
                          type="range"
                          min="1"
                          max="5"
                          step="1"
                          value={draft.motionSpeed}
                          onChange={(e) =>
                            changeDraft((d) => ({
                              ...d,
                              motionSpeed: Number(e.target.value),
                            }))
                          }
                        />
                        <output>{draft.motionSpeed} 级</output>
                      </label>
                      <p className="muted">1 级慢悠悠 · 5 级最快</p>
                      <label className="range-label">
                        幅度
                        <input
                          aria-label="蠕动幅度"
                          type="range"
                          min="1"
                          max="5"
                          step="1"
                          value={draft.motionAmplitude}
                          onChange={(e) =>
                            changeDraft((d) => ({
                              ...d,
                              motionAmplitude: Number(e.target.value),
                            }))
                          }
                        />
                        <output>{draft.motionAmplitude} 级</output>
                      </label>
                      <p className="muted">1 级轻微 · 5 级明显</p>
                    </fieldset>
                    <div className="stomach-preview" aria-label="蠕动效果预览">
                      <Stomach
                        level={draft.level}
                        items={all.filter((f) => draft.selected.includes(f.id))}
                        motion={draft}
                        expression={draft.expression}
                        craving={draftCraving}
                      />
                      <span>
                        {draft.motion ? "蠕动效果实时预览" : "蠕动已关闭"}
                      </span>
                    </div>
                    <p className="muted">系统开启“减少动态效果”时暂停蠕动。</p>
                    <div className="option-row">
                      <div>
                        <h3>轻柔扫描音效</h3>
                        <p>让小雷达发出轻轻的声音</p>
                      </div>
                      <button
                        role="switch"
                        aria-checked={draft.sound}
                        aria-label="扫描音效"
                        className={`switch ${draft.sound ? "on" : ""}`}
                        onClick={() =>
                          changeDraft((d) => ({ ...d, sound: !d.sound }))
                        }
                      >
                        {draft.sound ? (
                          <Volume2 size={17} />
                        ) : (
                          <VolumeX size={17} />
                        )}
                        <span />
                      </button>
                    </div>
                    <button
                      className="text-button"
                      onClick={() =>
                        changeDraft({
                          ...defaults,
                          selected: [...defaults.selected],
                        })
                      }
                    >
                      恢复默认设置（保留照片）
                    </button>
                  </>
                )}
              </section>
              {preview && (
                <div className="stomach-preview" aria-label="扫描结果预览">
                  <Stomach
                    level={draft.level}
                    motion={draft}
                    expression={draft.expression}
                    craving={draftCraving}
                    items={all.filter((f) => draft.selected.includes(f.id))}
                  />
                  <span>{levels[draft.level - 1]}大小 · 结果预览</span>
                </div>
              )}
            </>
          )}
          {error && (
            <p role="alert" className="error">
              {error}
              <button onClick={() => setError("")} aria-label="关闭错误提示">
                <X size={14} />
              </button>
            </p>
          )}
        </div>
        {!file && (
          <div className="modal-footer">
            {liveSettings ? (
              <>
                <span className="muted">关闭浮层后可继续扫描</span>
                <button className="primary" onClick={closeSettings}>
                  完成
                </button>
              </>
            ) : (
              <>
                <button
                  className="secondary"
                  onClick={() => setPreview((p) => !p)}
                >
                  {preview ? "收起预览" : "预览结果"}
                </button>
                <button className="primary" onClick={save}>
                  <Check size={18} />
                  保存设置
                </button>
              </>
            )}
          </div>
        )}
      </dialog>
      {error && !dialog.current?.open && (
        <div role="alert" className="toast">
          {error}
          <button
            className="icon-button"
            onClick={() => setError("")}
            aria-label="关闭提示"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
