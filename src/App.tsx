import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  AudioLines,
  Camera,
  Check,
  ChevronRight,
  Heart,
  ImagePlus,
  LockKeyhole,
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

export default function App() {
  const [camera, setCamera] = useState(false);
  const [settings, setSettings] = useState(readSettings);
  const [draft, setDraft] = useState<Settings>(settings);
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
  const all = [...foods, ...photos];
  const page = Math.min(
    photoPage,
    Math.max(0, Math.ceil(photos.length / 3) - 1),
  );
  const selected = all.filter((f) => settings.selected.includes(f.id));
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
  function leaveCamera() {
    if (scan.current) clearTimeout(scan.current);
    setPhase("ready");
    setCamera(false);
  }
  useEffect(() => {
    if (!camera) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") leaveCamera();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [camera]);
  function openSettings() {
    setDraft({ ...settings, selected: [...settings.selected] });
    setPreview(false);
    setFile(null);
    lastParentTap.current = null;
    dialog.current?.showModal();
  }
  function start() {
    if (phase === "scanning") return;
    setPhase("scanning");
    if (settings.sound) {
      try {
        const ctx = audio.current ?? new AudioContext();
        audio.current = ctx;
        void ctx.resume().catch(() => {});
        for (let i = 0; i < 3; i++) {
          const osc = ctx.createOscillator(),
            gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.value = 520 + i * 90;
          gain.gain.setValueAtTime(0, ctx.currentTime + i * 1.1);
          gain.gain.linearRampToValueAtTime(
            0.045,
            ctx.currentTime + i * 1.1 + 0.03,
          );
          gain.gain.exponentialRampToValueAtTime(
            0.001,
            ctx.currentTime + i * 1.1 + 0.3,
          );
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + i * 1.1);
          osc.stop(ctx.currentTime + i * 1.1 + 0.35);
        }
      } catch {
        /* Audio is optional. */
      }
    }
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    scan.current = setTimeout(() => setPhase("result"), reduced ? 600 : 4000);
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
    setDraft((d) => ({
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
      setDraft((d) => ({
        ...d,
        selected: d.selected.filter((id) => id !== food.id),
      }));
      setSettings((s) => ({
        ...s,
        selected: s.selected.filter((id) => id !== food.id),
      }));
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
                {phase === "result" ? (
                  <DraggableStomach
                    level={settings.level}
                    items={selected}
                    motion={settings}
                    expression={settings.expression}
                  />
                ) : (
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
        className="settings-dialog"
        onCancel={(e) => {
          if (file) {
            e.preventDefault();
            setFile(null);
          }
        }}
      >
        <div className="modal-header">
          <div>
            <span className="mini-label">PARENTS’ CORNER</span>
            <h2>定制小肚子的发现</h2>
          </div>
          <button
            className="icon-button"
            aria-label="关闭家长设置"
            onClick={() => dialog.current?.close()}
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
                这是趣味模拟，扫描结果由家长设置，不代表真实胃部状态。
              </p>
              <div className="tabs" role="tablist" aria-label="设置类别">
                {[
                  ["size", "胃部大小"],
                  ["food", "食物朋友"],
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
                            setDraft((d) => ({ ...d, level: i + 1 }))
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
                ) : (
                  <>
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
                            setDraft((d) => ({ ...d, expression: value }))
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
                          setDraft((d) => ({ ...d, motion: !d.motion }))
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
                            setDraft((d) => ({
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
                            setDraft((d) => ({
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
                          setDraft((d) => ({ ...d, sound: !d.sound }))
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
                        setDraft({
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
            <button className="secondary" onClick={() => setPreview((p) => !p)}>
              {preview ? "收起预览" : "预览结果"}
            </button>
            <button className="primary" onClick={save}>
              <Check size={18} />
              保存设置
            </button>
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
