"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motionPose } from "./motion.mjs";

type Mode = "AUTO" | "P" | "S" | "A" | "M";
type FocusMode = "AF-S" | "AF-C" | "MF";
type ShutterType = "auto" | "mechanical" | "electronic";
type MeteringMode = "multi" | "center" | "spot" | "average" | "highlight";
type SceneKey = "landscape" | "bird" | "sports" | "portrait" | "group" | "street" | "night";
type MobileControl = "shutter" | "aperture" | "iso" | "focal";
type Scenario = { id: SceneKey; eyebrow: string; title: string; brief: string; lesson: string; sceneEv: number; speed: number; distance: number; focal: [number, number]; aperture: [number, number]; minShutter: number; accent: string };
type MotionPose = { x: number; y: number; rotate: number; scale: number };
type ShotEffect = { brightness: number; motionBlur: number; depthBlur: number; noise: number; focusOk: boolean; focal: number; panX: number; panY: number; subjectX: number; subjectY: number; subjectRotate: number; subjectScale: number };
type Photo = { id: number; scene: SceneKey; score: number; title: string; settings: string; shot: ShotEffect };
type Result = { score: number; title: string; notes: string[]; shot: ShotEffect; scene: SceneKey };

const SCENARIOS: Scenario[] = [
  { id: "landscape", eyebrow: "01 · 清晨風景", title: "山谷第一道光", brief: "保留天空層次，讓前後景都清楚。", lesson: "縮小光圈能增加景深；腳架可換取較慢快門。", sceneEv: 12.4, speed: 0, distance: 80, focal: [24, 50], aperture: [8, 16], minShutter: 1 / 40, accent: "#f1b45a" },
  { id: "bird", eyebrow: "02 · 飛鳥", title: "掠過濕地的飛鳥", brief: "凝結翅膀，並以長焦填滿畫面。", lesson: "高速移動主體需要更快快門，通常也要提高 ISO。", sceneEv: 13.2, speed: 9, distance: 26, focal: [200, 300], aperture: [4, 8], minShutter: 1 / 1000, accent: "#9bc9d8" },
  { id: "sports", eyebrow: "03 · 運動賽事", title: "終點前的衝刺", brief: "抓住運動員騰空的決定性瞬間。", lesson: "快門先決很適合節奏快速、光線會變的場合。", sceneEv: 11.8, speed: 7, distance: 18, focal: [85, 200], aperture: [2.8, 8], minShutter: 1 / 800, accent: "#ef755e" },
  { id: "portrait", eyebrow: "04 · 人像", title: "窗邊自然光", brief: "眼睛銳利，背景柔和，不要讓膚色過曝。", lesson: "大光圈與較長焦距能分離人物和背景。", sceneEv: 9.8, speed: .25, distance: 3, focal: [50, 100], aperture: [1.4, 3.2], minShutter: 1 / 125, accent: "#d9a48f" },
  { id: "group", eyebrow: "05 · 合影", title: "朋友們的紀念照", brief: "每一排人的臉都要在景深範圍內。", lesson: "多人合影不要一味開大光圈；稍微縮小更安全。", sceneEv: 12.8, speed: .3, distance: 5, focal: [35, 70], aperture: [5.6, 11], minShutter: 1 / 160, accent: "#c7b573" },
  { id: "street", eyebrow: "06 · 白天街拍", title: "轉角的一秒", brief: "快速反應，兼顧移動人物與環境敘事。", lesson: "程式自動曝光適合光線穩定、瞬間難預測的街頭。", sceneEv: 14.2, speed: 2.5, distance: 9, focal: [28, 50], aperture: [4, 11], minShutter: 1 / 320, accent: "#5d95d2" },
  { id: "night", eyebrow: "07 · 夜間", title: "霓虹雨夜", brief: "留住環境光，同時避免人物晃動。", lesson: "夜間是光圈、快門與 ISO 的三方取捨。", sceneEv: 5.8, speed: 1.2, distance: 7, focal: [35, 85], aperture: [1.4, 2.8], minShutter: 1 / 125, accent: "#a77cf3" },
];
const APERTURES = [1.2, 1.4, 1.6, 1.8, 2, 2.2, 2.5, 2.8, 3.2, 3.5, 4, 4.5, 5, 5.6, 6.3, 7.1, 8, 9, 10, 11, 13, 14, 16, 18, 20, 22];
const SHUTTERS = [1 / 32000, 1 / 25000, 1 / 20000, 1 / 16000, 1 / 12500, 1 / 10000, 1 / 8000, 1 / 6400, 1 / 5000, 1 / 4000, 1 / 3200, 1 / 2500, 1 / 2000, 1 / 1600, 1 / 1250, 1 / 1000, 1 / 800, 1 / 640, 1 / 500, 1 / 400, 1 / 320, 1 / 250, 1 / 200, 1 / 160, 1 / 125, 1 / 100, 1 / 80, 1 / 60, 1 / 50, 1 / 40, 1 / 30, 1 / 25, 1 / 20, 1 / 15, 1 / 13, 1 / 10, 1 / 8, 1 / 6, 1 / 5, 1 / 4, .3, .4, .5, .6, .8, 1, 1.3, 1.6, 2, 2.5, 3.2, 4, 5, 6, 8, 10, 13, 15, 20, 25, 30];
const ISOS = [50, 64, 80, 100, 125, 160, 200, 250, 320, 400, 500, 640, 800, 1000, 1250, 1600, 2000, 2500, 3200, 4000, 5000, 6400, 8000, 10000, 12800, 16000, 20000, 25600, 32000, 40000, 51200, 64000, 80000, 102400];
const AUTO_ISOS = ISOS.filter(value => value >= 100 && value <= 12800);
const LENSES = [
  { id: "standard", name: "FE 24–70 mm F2.8 GM II", focals: [24, 35, 50, 70], maxAperture: () => 2.8 },
  { id: "prime50", name: "FE 50 mm F1.2 GM", focals: [50], maxAperture: () => 1.2 },
  { id: "portrait", name: "FE 85 mm F1.4 GM II", focals: [85], maxAperture: () => 1.4 },
  { id: "tele", name: "FE 70–200 mm F2.8 GM II", focals: [70, 100, 135, 200], maxAperture: () => 2.8 },
  { id: "wildlife", name: "FE 200–600 mm F5.6–6.3 G OSS", focals: [200, 300, 400, 600], maxAperture: (focal: number) => focal >= 400 ? 6.3 : 5.6 },
];
const MODES: { key: Mode; label: string; name: string }[] = [
  { key: "AUTO", label: "AUTO", name: "全自動" }, { key: "P", label: "P", name: "程式自動曝光" }, { key: "S", label: "S", name: "快門先決" }, { key: "A", label: "A", name: "光圈先決" }, { key: "M", label: "M", name: "手動曝光" },
];
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const closest = (values: number[], target: number) => values.reduce((best, value) => Math.abs(value - target) < Math.abs(best - target) ? value : best);
const shutterLabel = (value: number) => value >= 1 ? `${value}″` : value >= .3 ? `${value.toFixed(1)}″` : `1/${Math.round(1 / value)}`;

function SceneArtwork({ scene, focal, blur, depthBlur, noise, exposure, focusOk, panX = 0, panY = 0, subjectX = 0, subjectY = 0, subjectRotate = 0, subjectScale = 1 }: { scene: SceneKey; focal: number; blur: number; depthBlur: number; noise: number; exposure: number; focusOk: boolean; panX?: number; panY?: number; subjectX?: number; subjectY?: number; subjectRotate?: number; subjectScale?: number }) {
  const visualZoom = 1 + Math.log2(Math.max(24, focal) / 24) * .42;
  return <div className={`scene-art scene-${scene}`} style={{ filter: `brightness(${exposure})`, "--zoom": visualZoom, "--motion": `${blur}px`, "--depth": `${depthBlur}px`, "--noise": noise, "--pan-x": `${panX}%`, "--pan-y": `${panY}%`, "--subject-x": `${subjectX}%`, "--subject-y": `${subjectY}%`, "--subject-rotate": `${subjectRotate}deg`, "--subject-scale": subjectScale } as React.CSSProperties}>
    <div className="bg-art-layer" style={{ filter: "blur(var(--depth))" }}>
      {scene === "landscape" && <img src="/scenes/landscape.jpg" alt="Q版風光" className="img-fill" />}
      {scene === "bird" && <img src="/scenes/bird_bg.jpg" alt="Q版濕地" className="img-fill" />}
      {scene === "sports" && <img src="/scenes/sports_bg_clean.png" alt="Q版田徑場" className="img-fill" />}
      {scene === "portrait" && <img src="/scenes/portrait_bg_clean.png" alt="Q版房間" className="img-fill" />}
      {scene === "group" && <img src="/scenes/group.jpg" alt="Q版合影" className="img-fill" />}
      {scene === "street" && <img src="/scenes/street_bg_clean.png" alt="Q版街拍" className="img-fill" />}
      {scene === "night" && <img src="/scenes/night_bg_clean.png" alt="Q版夜景" className="img-fill" />}
    </div>
    <div className="subject-art-layer" style={{ filter: `${focusOk ? "" : "blur(5px)"} blur(var(--motion))` }}>
      {scene === "bird" && <div className="q-subject q-bird-wrap"><img src="/scenes/bird_subject.png" alt="Q版飛鳥" className="q-img-subject" /></div>}
      {scene === "sports" && <div className="q-subject q-sports-wrap"><img src="/scenes/sports_subject.png" alt="Q版運動員" className="q-img-subject" /></div>}
      {scene === "portrait" && <div className="q-subject q-portrait-wrap"><img src="/scenes/portrait_subject.png" alt="Q版人像" className="q-img-subject" /></div>}
      {scene === "street" && <div className="q-subject q-street-wrap"><img src="/scenes/street_subject.png" alt="Q版街拍人物" className="q-img-subject" /></div>}
      {scene === "night" && <div className="q-subject q-night-wrap"><img src="/scenes/night_subject.png" alt="Q版雨夜人物" className="q-img-subject" /></div>}
    </div>
    <div className="noise" />
  </div>;
}

export default function Home() {
  const [sceneIndex, setSceneIndex] = useState(0), [mode, setMode] = useState<Mode>("A"), [aperture, setAperture] = useState(5.6), [shutter, setShutter] = useState(1 / 125), [iso, setIso] = useState(200), [focal, setFocal] = useState(50), [focus, setFocus] = useState(10), [focusMode, setFocusMode] = useState<FocusMode>("AF-S"), [shutterType, setShutterType] = useState<ShutterType>("auto"), [meteringMode, setMeteringMode] = useState<MeteringMode>("multi"), [exposureComp, setExposureComp] = useState(0), [captured, setCaptured] = useState(false), [lensId, setLensId] = useState("standard"), [pan, setPan] = useState({ x: 0, y: 0 }), [subjectPose, setSubjectPose] = useState<MotionPose>(() => motionPose("landscape", 0)), [mobileControl, setMobileControl] = useState<MobileControl>("shutter"), [isFullscreen, setIsFullscreen] = useState(false), [immersiveFallback, setImmersiveFallback] = useState(false), [hudVisible, setHudVisible] = useState(true), [deckOpen, setDeckOpen] = useState(true), [started, setStarted] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; panX: number; panY: number; moved: boolean } | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [shots, setShots] = useState<Photo[]>([]);
  const scene = SCENARIOS[sceneIndex];
  const lens = LENSES.find(item => item.id === lensId) ?? LENSES[0];
  const shutterOptions = useMemo(() => SHUTTERS.filter(value => shutterType !== "mechanical" || value >= 1 / 8000), [shutterType]);
  const lensMaxAperture = lens.maxAperture(focal);
  const apertureOptions = useMemo(() => APERTURES.filter(value => value >= lensMaxAperture), [lensMaxAperture]);
  const meteringAdjustment = meteringMode === "highlight" ? .7 : meteringMode === "spot" ? (scene.id === "night" ? -.6 : -.15) : meteringMode === "center" ? -.1 : meteringMode === "average" ? .15 : 0;
  const targetEv = scene.sceneEv + meteringAdjustment - (mode === "M" ? 0 : exposureComp);
  const effective = useMemo(() => {
    let a = aperture, s = shutter, i = iso;
    if (mode === "AUTO") { a = closest(apertureOptions, scene.id === "landscape" || scene.id === "group" ? 8 : scene.id === "portrait" || scene.id === "night" ? lensMaxAperture : 4); s = closest(shutterOptions, scene.minShutter); i = closest(AUTO_ISOS, clamp(100 * Math.pow(2, Math.log2((a ** 2) / s) - targetEv), 100, 12800)); }
    else if (mode === "P") { a = closest(apertureOptions, scene.id === "landscape" ? 8 : 5.6); s = closest(shutterOptions, (a ** 2) / Math.pow(2, targetEv + Math.log2(i / 100))); }
    else if (mode === "S") a = closest(apertureOptions, clamp(Math.sqrt(s * Math.pow(2, targetEv + Math.log2(i / 100))), lensMaxAperture, 22));
    else if (mode === "A") s = closest(shutterOptions, (a ** 2) / Math.pow(2, targetEv + Math.log2(i / 100)));
    return { aperture: a, shutter: s, iso: i };
  }, [aperture, apertureOptions, iso, lensMaxAperture, mode, scene, shutter, shutterOptions, targetEv]);
  const exposureDelta = scene.sceneEv - (Math.log2((effective.aperture ** 2) / effective.shutter) - Math.log2(effective.iso / 100));
  const cameraBlur = Math.max(0, effective.shutter * focal - 1) * 1.25, subjectBlur = Math.max(0, scene.speed * effective.shutter * 16), motionBlur = clamp(cameraBlur + subjectBlur, 0, 12);
  const actualFocus = focusMode === "MF" ? focus : scene.distance;
  const focusTolerance = Math.max(.7, (effective.aperture / 4) * (50 / focal) * scene.distance * .26), focusOk = Math.abs(actualFocus - scene.distance) <= focusTolerance;
  const depthBlur = clamp((4 / effective.aperture) * (focal / 50) * 2.2, 0, 9), noise = clamp((Math.log2(effective.iso / 100) / 6) * .42, 0, .48), brightness = clamp(Math.pow(2, exposureDelta * .42), .32, 2.1);

  useEffect(() => { setFocus(scene.distance); setResult(null); }, [scene]);
  useEffect(() => { setShutter(current => closest(shutterOptions, current)); }, [shutterOptions]);
  useEffect(() => { setAperture(current => closest(apertureOptions, current)); }, [apertureOptions]);
  useEffect(() => {
    const start = performance.now();
    let frame = 0, lastPaint = 0;
    const animate = (now: number) => {
      if (now - lastPaint >= 33) { setSubjectPose(motionPose(scene.id, (now - start) / 1000)); lastPaint = now; }
      frame = window.requestAnimationFrame(animate);
    };
    setSubjectPose(motionPose(scene.id, 0));
    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, [scene.id]);
  useEffect(() => {
    const syncFullscreen = () => { setIsFullscreen(Boolean(document.fullscreenElement)); if (document.fullscreenElement) setImmersiveFallback(false); };
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);
  useEffect(() => { if (window.matchMedia("(max-width:900px)").matches) setDeckOpen(false); }, []);
  const toggleFullscreen = useCallback(async () => {
    if (immersiveFallback) { setImmersiveFallback(false); return; }
    if (document.fullscreenElement) { await document.exitFullscreen(); return; }
    try { await document.documentElement.requestFullscreen({ navigationUI: "hide" }); }
    catch { setImmersiveFallback(true); window.scrollTo({ top: 0, behavior: "smooth" }); }
  }, [immersiveFallback]);
  const capture = useCallback(() => {
    const exposureScore = clamp(100 - Math.abs(exposureDelta) * 34, 0, 100), motionScore = clamp(100 - motionBlur * 13, 0, 100), focusScore = focusOk ? 100 : clamp(70 - Math.abs(actualFocus - scene.distance) * 14, 0, 70), focalScore = focal >= scene.focal[0] && focal <= scene.focal[1] ? 100 : 55, apertureScore = effective.aperture >= scene.aperture[0] && effective.aperture <= scene.aperture[1] ? 100 : 62;
    const score = Math.round(exposureScore * .3 + motionScore * .25 + focusScore * .25 + focalScore * .1 + apertureScore * .1), notes: string[] = [];
    if (Math.abs(exposureDelta) > .65) notes.push(exposureDelta > 0 ? "畫面過亮：降低 ISO、縮小光圈或加快快門。" : "畫面偏暗：提高 ISO、開大光圈或放慢快門。");
    if (motionBlur > 2) notes.push(cameraBlur > subjectBlur ? "有手震：快門至少要接近 1／焦距秒。" : "主體有拖影：用更快快門凝結動作。");
    if (!focusOk) notes.push(`焦點沒有落在主體；嘗試對焦在約 ${scene.distance} 公尺。`);
    if (scene.speed > 2 && focusMode === "AF-S") notes.push("移動主體建議使用 AF-C 連續自動對焦。");
    if (!(effective.aperture >= scene.aperture[0] && effective.aperture <= scene.aperture[1])) notes.push(scene.id === "group" || scene.id === "landscape" ? "景深不足：縮小光圈讓更多距離清楚。" : "可以開大光圈，讓主體從背景中跳出來。");
    if (!(focal >= scene.focal[0] && focal <= scene.focal[1])) notes.push(`這個任務適合 ${scene.focal[0]}–${scene.focal[1]} mm。`);
    if (!notes.length) notes.push("曝光、清晰度與景深都很到位。試著換模式再拍一次！");
    const title = score >= 90 ? "精彩捕捉" : score >= 75 ? "很接近了" : score >= 55 ? "值得再試一次" : "先讀讀教練提示";
    const shot = { brightness, motionBlur, depthBlur, noise, focusOk, focal, panX: pan.x, panY: pan.y, subjectX: subjectPose.x, subjectY: subjectPose.y, subjectRotate: subjectPose.rotate, subjectScale: subjectPose.scale };
    const settings = `${lens.name} · ${focal} mm · ${shutterLabel(effective.shutter)} · F${effective.aperture} · ISO ${effective.iso} · ${exposureComp > 0 ? "+" : ""}${exposureComp.toFixed(1)} EV`;
    setResult({ score, title, notes: notes.slice(0, 2), shot, scene: scene.id }); setShots(current => [{ id: Date.now(), scene: scene.id, score, title, settings, shot }, ...current].slice(0, 12)); setCaptured(true); window.setTimeout(() => setCaptured(false), 180);
  }, [actualFocus, brightness, cameraBlur, depthBlur, effective.aperture, effective.iso, effective.shutter, exposureComp, exposureDelta, focal, focusMode, focusOk, lens.name, motionBlur, noise, pan.x, pan.y, scene, subjectBlur, subjectPose]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (!started) { if (e.code === "Space" || e.code === "Enter") { e.preventDefault(); setStarted(true); } return; }
      if (e.code === "Space") { e.preventDefault(); capture(); }
      else if (e.code === "KeyF") { e.preventDefault(); void toggleFullscreen(); }
      else if (e.code === "KeyH") { e.preventDefault(); setHudVisible(value => !value); }
      else if (e.code === "KeyP") { e.preventDefault(); setDeckOpen(value => !value); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [capture, started, toggleFullscreen]);
  const startGame = useCallback((wantFullscreen: boolean) => { setStarted(true); if (wantFullscreen) void toggleFullscreen(); }, [toggleFullscreen]);
  const chooseScene = (index: number) => { setSceneIndex(index); setPan({ x: 0, y: 0 }); setResult(null); };
  const startPan = (event: React.PointerEvent<HTMLDivElement>) => { if (result) return; event.currentTarget.setPointerCapture(event.pointerId); dragRef.current = { startX: event.clientX, startY: event.clientY, panX: pan.x, panY: pan.y, moved: false }; };
  const movePan = (event: React.PointerEvent<HTMLDivElement>) => { const drag = dragRef.current; if (!drag) return; const dx = event.clientX - drag.startX, dy = event.clientY - drag.startY; if (Math.abs(dx) + Math.abs(dy) > 5) drag.moved = true; const zoomSteps = Math.max(0, Math.log2(Math.max(24, focal) / 24)), limitX = Math.min(18, 8 + zoomSteps * 4), limitY = Math.min(12, 5 + zoomSteps * 2.5); setPan({ x: clamp(drag.panX + dx / 12, -limitX, limitX), y: clamp(drag.panY + dy / 12, -limitY, limitY) }); };
  const finishPan = () => { const drag = dragRef.current; dragRef.current = null; if (!drag?.moved) result ? setResult(null) : capture(); };
  const mobileOptions = mobileControl === "shutter" ? shutterOptions : mobileControl === "aperture" ? apertureOptions : mobileControl === "iso" ? ISOS : lens.focals;
  const mobileRawValue = mobileControl === "shutter" ? shutter : mobileControl === "aperture" ? aperture : mobileControl === "iso" ? iso : focal;
  const mobileValue = mobileControl === "shutter" ? shutterLabel(effective.shutter) : mobileControl === "aperture" ? `F${effective.aperture}` : mobileControl === "iso" ? `${effective.iso}` : `${focal} mm`;
  const mobileDisabled = mobileControl === "shutter" ? mode === "AUTO" || mode === "P" || mode === "A" : mobileControl === "aperture" ? mode === "AUTO" || mode === "P" || mode === "S" : mobileControl === "iso" ? mode === "AUTO" : false;
  const setMobileValue = (index: number) => {
    const value = mobileOptions[clamp(index, 0, mobileOptions.length - 1)];
    if (mobileControl === "shutter") setShutter(value); else if (mobileControl === "aperture") setAperture(value); else if (mobileControl === "iso") setIso(value); else setFocal(value);
  };
  const fullscreenActive = isFullscreen || immersiveFallback;
  const shutterTypeLabel = shutterType === "mechanical" ? "MECH" : shutterType === "electronic" ? "ELEC" : "AUTO";
  const exposureOk = Math.abs(exposureDelta) <= .65;
  const bestScore = shots.reduce((best, photo) => Math.max(best, photo.score), 0);

  return <main className={`game-shell ${immersiveFallback ? "immersive" : ""} ${captured ? "captured" : ""} ${hudVisible ? "" : "hud-off"} ${deckOpen ? "" : "deck-closed"} ${started ? "" : "not-started"}`} style={{ "--accent": scene.accent } as React.CSSProperties}>
    <div className="live-stage" role="button" tabIndex={0} aria-label="取景器，拖曳移動鏡頭，點擊拍攝，滾輪變焦" onPointerDown={startPan} onPointerMove={movePan} onPointerUp={finishPan} onPointerCancel={() => { dragRef.current = null; }} onWheel={event => { event.preventDefault(); const index = lens.focals.indexOf(focal); const next = clamp(index + (event.deltaY > 0 ? -1 : 1), 0, lens.focals.length - 1); setFocal(lens.focals[next]); }}>
      <SceneArtwork scene={scene.id} focal={focal} blur={0} depthBlur={0} noise={0} exposure={1} focusOk={true} panX={pan.x} panY={pan.y} subjectX={subjectPose.x} subjectY={subjectPose.y} subjectRotate={subjectPose.rotate} subjectScale={subjectPose.scale} />
      <div className="viewfinder-shade" />
      <div className="grid-lines"><i /><i /><i /><i /></div>
      <div className={`focus-box ${focusOk ? "locked" : ""}`}><i /><i /><i /><i /></div>
      <div className="wheel-hint">拖曳取景 · 滾輪變焦 · 點擊畫面或空白鍵拍攝</div>
      <div className="flash" />
    </div>

    <div className="hud">
      <header className="hud-top">
        <div className="hud-top-left hud-fade">
          <div className="brand glass"><span className="brand-mark">AW</span><span><b>APERTURE WORLD</b><small>互動攝影學院</small></span></div>
          <div className="mission-copy glass"><p className="eyebrow">{scene.eyebrow}</p><h1>{scene.title}</h1><p className="brief-line">{scene.brief}</p></div>
        </div>
        <div className="hud-top-mid hud-fade">
          <div className="mode-strip glass" role="group" aria-label="拍攝模式">{MODES.map(item => <button key={item.key} type="button" onClick={() => setMode(item.key)} className={mode === item.key ? "active" : ""} aria-pressed={mode === item.key} title={item.name}><b>{item.label}</b><span>{item.name}</span></button>)}</div>
          <div className="evf-line"><span>RAW　X.FINE</span><span><b>{focusMode}</b></span><span><b>{focal}</b> mm</span><span>{shutterTypeLabel}</span><span>▮▮▮　{shots.length ? `${shots.length}` : "—"}</span></div>
        </div>
        <div className="hud-top-right">
          <div className="progress-wrap glass hud-fade" aria-label={`課程進度 ${sceneIndex + 1} / ${SCENARIOS.length}`}><span>訓練路線</span><div className="progress-track"><i style={{ width: `${((sceneIndex + 1) / SCENARIOS.length) * 100}%` }} /></div><b>{String(sceneIndex + 1).padStart(2, "0")} / 07</b><em>最佳 {bestScore || "—"} · 已拍 {shots.length}</em></div>
          <div className="hud-actions">
            <button className="hud-chip" type="button" aria-label={hudVisible ? "隱藏介面" : "顯示介面"} aria-pressed={!hudVisible} onClick={() => setHudVisible(value => !value)}><span aria-hidden="true">◍</span><em>{hudVisible ? "隱藏介面 H" : "顯示介面 H"}</em></button>
            <button className="hud-chip" type="button" aria-label="參數面板" aria-pressed={deckOpen} onClick={() => setDeckOpen(value => !value)}><span aria-hidden="true">▤</span><em>參數 P</em></button>
            <button className="hud-chip fullscreen-button" type="button" aria-label={fullscreenActive ? "離開全螢幕" : "進入全螢幕"} aria-pressed={fullscreenActive} onClick={toggleFullscreen}><span aria-hidden="true">{fullscreenActive ? "↙" : "⛶"}</span><em>{fullscreenActive ? "離開全螢幕 F" : "全螢幕 F"}</em></button>
          </div>
        </div>
      </header>

      <aside className="scene-rail glass hud-fade" aria-label="拍攝場景">
        <nav>{SCENARIOS.map((item, index) => <button key={item.id} type="button" onClick={() => chooseScene(index)} className={index === sceneIndex ? "active" : ""} aria-label={item.title} aria-pressed={index === sceneIndex} title={item.title}><span>{String(index + 1).padStart(2, "0")}</span><i className={`scene-icon icon-${item.id}`} /></button>)}</nav>
      </aside>

      <aside className="param-deck glass" aria-label="α1 曝光設置">
        <div className="deck-head"><span>α1 曝光設置</span><b>LIVE VIEW</b></div>
        <div className="deck-body">
          <div className="camera-reference"><strong>ILCE-1</strong><span>50.1 MP · FULL FRAME</span></div>
          <section className="lens-section"><div><label>鏡頭</label><small>E 接環</small></div><select aria-label="更換鏡頭" value={lensId} onChange={event => { const next = LENSES.find(item => item.id === event.target.value) ?? LENSES[0]; setLensId(next.id); setFocal(next.focals[0]); }} >{LENSES.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><p>{lens.focals[0]}–{lens.focals[lens.focals.length - 1]} mm · 於畫面滾輪縮放</p></section>
          <section className="focus-mode-section"><div><label>對焦模式</label><small>{focusMode === "AF-C" ? "持續追蹤移動主體" : focusMode === "AF-S" ? "半按快門鎖定主體" : "手動指定對焦距離"}</small></div><div>{(["AF-S", "AF-C", "MF"] as FocusMode[]).map(item => <button key={item} type="button" className={focusMode === item ? "active" : ""} onClick={() => setFocusMode(item)}>{item}</button>)}</div></section>
          <section className="exposure-system"><div><label>快門類型</label><small>{shutterType === "mechanical" ? "最高 1/8000" : "最高 1/32000"}</small></div><div className="shutter-type-buttons">{(["auto", "mechanical", "electronic"] as ShutterType[]).map(item => <button key={item} type="button" className={shutterType === item ? "active" : ""} onClick={() => setShutterType(item)}>{item === "auto" ? "自動" : item === "mechanical" ? "機械" : "電子"}</button>)}</div><div className="metering-row"><label>測光模式</label><select aria-label="測光模式" value={meteringMode} onChange={event => setMeteringMode(event.target.value as MeteringMode)}><option value="multi">多重測光</option><option value="center">中央偏重</option><option value="spot">定點測光</option><option value="average">全螢幕平均</option><option value="highlight">高光測光</option></select></div></section>
          <Control label="快門速度" value={shutterLabel(effective.shutter)} helper={mode === "AUTO" || mode === "P" || mode === "A" ? "由 α1 自動曝光計算" : shutterType === "mechanical" ? "機械快門 1/8000–30 秒" : "電子快門 1/32000–30 秒"} disabled={mode === "AUTO" || mode === "P" || mode === "A"} index={shutterOptions.indexOf(shutter)} max={shutterOptions.length - 1} onChange={v => setShutter(shutterOptions[v])} />
          <Control label="光圈" value={`F${effective.aperture}`} helper={mode === "AUTO" || mode === "P" || mode === "S" ? "由 α1 自動曝光計算" : `鏡頭最大光圈 F${lensMaxAperture}`} disabled={mode === "AUTO" || mode === "P" || mode === "S"} index={apertureOptions.indexOf(aperture)} max={apertureOptions.length - 1} onChange={v => setAperture(apertureOptions[v])} />
          <Control label="ISO 感光度" value={`${effective.iso}`} helper={effective.iso < 100 || effective.iso > 32000 ? "α1 擴展 ISO 範圍" : effective.iso >= 3200 ? "高感光度會增加雜訊" : mode === "AUTO" ? "AUTO ISO 100–12800" : "標準範圍 ISO 100–32000"} disabled={mode === "AUTO"} index={ISOS.indexOf(iso)} max={ISOS.length - 1} onChange={v => setIso(ISOS[v])} />
          <Control label="曝光補償" value={`${exposureComp > 0 ? "+" : ""}${exposureComp.toFixed(1)} EV`} helper={mode === "M" ? "M 模式請直接調整曝光三角" : "α1 選單範圍 ±5 EV（1/3 級）"} disabled={mode === "M"} index={Math.round((exposureComp + 5) * 3)} max={30} onChange={v => setExposureComp(-5 + v / 3)} />
          <Control label="焦距" value={`${focal} mm`} helper="改變視角與壓縮感" index={lens.focals.indexOf(focal)} max={lens.focals.length - 1} onChange={v => setFocal(lens.focals[v])} />
          <Control label="對焦距離" value={focusMode === "MF" ? (focus >= 80 ? "∞" : `${focus.toFixed(1)} m`) : `${scene.distance} m`} helper={focusMode === "MF" ? `主體約 ${scene.distance} m` : "自動對焦已鎖定主體"} disabled={focusMode !== "MF"} index={Math.round(clamp((Math.log10(focus + 1) / Math.log10(101)) * 100, 0, 100))} max={100} onChange={v => setFocus(Math.pow(101, v / 100) - 1)} />
          <div className="exposure-triangle"><div><span style={{ opacity: clamp(.25 + effective.shutter * 5, .25, 1) }}>◒</span><small>時間</small></div><div><span style={{ transform: `scale(${clamp(1.25 - effective.aperture / 20, .45, 1.15)})` }}>◉</span><small>景深</small></div><div><span style={{ opacity: clamp(.25 + noise, .25, 1) }}>░</span><small>雜訊</small></div></div>
          <section className="photo-library"><div className="library-heading"><label>圖片庫</label><span>{shots.length} / 12</span></div>{shots.length === 0 ? <p>拍下第一張照片後，作品會保存在這裡。</p> : <div className="photo-strip">{shots.filter(photo => photo.shot).map(photo => <button key={photo.id} type="button" title={photo.settings} onClick={() => setResult({ score: photo.score, title: "圖片庫回放", notes: [photo.settings], shot: photo.shot, scene: photo.scene })}><span className="photo-thumb"><SceneArtwork scene={photo.scene} {...photo.shot} blur={photo.shot.motionBlur} exposure={photo.shot.brightness} /></span><b>{photo.score}</b></button>)}</div>}</section>
          <p className="deck-lesson"><span>教練筆記</span>{scene.lesson}</p>
        </div>
      </aside>

      <footer className="hud-bottom hud-fade">
        <div className="status-readout glass"><span className={exposureOk ? "good" : "warn"}>{exposureOk ? "曝光合適" : exposureDelta > 0 ? `過曝 +${exposureDelta.toFixed(1)} EV` : `欠曝 ${exposureDelta.toFixed(1)} EV`}</span><span className={motionBlur < 2 ? "good" : "warn"}>{motionBlur < 2 ? "動態清晰" : "偵測到動態模糊"}</span><span className={focusOk ? "good" : "warn"}>{focusOk ? "焦點鎖定" : "主體失焦"}</span></div>
        <div className="exposure-dock glass">
          <div className="dock-readout">
            <span><small>快門</small><b>{shutterLabel(effective.shutter)}</b></span>
            <span><small>光圈</small><b>F{effective.aperture}</b></span>
            <span><small>ISO</small><b>{effective.iso}</b></span>
            <span><small>補償</small><b>{exposureComp > 0 ? "+" : ""}{exposureComp.toFixed(1)}</b></span>
            <div className="meter"><small>−5　−3　0　+3　+5</small><i style={{ left: `${clamp((exposureDelta + 5) / 10, 0, 1) * 100}%` }} /></div>
          </div>
          <button className="shutter-button" type="button" onClick={capture}><i /><span>按下快門</span><small>SPACE</small></button>
        </div>
        <div className="dock-side glass"><span>{lens.name}</span><small>{scene.focal[0]}–{scene.focal[1]} mm · F{scene.aperture[0]}–F{scene.aperture[1]} 建議</small></div>
      </footer>
    </div>

    {!started && <div className="start-screen">
      <div className="start-card">
        <p className="start-eyebrow">SONY α1 TRAINER · 互動攝影練習場</p>
        <h1 className="start-title">APERTURE<b>WORLD</b></h1>
        <p className="start-lead">七個場景，一台全片幅相機。轉動光圈、快門與 ISO，按下快門，看看你拍出什麼。</p>
        <div className="start-actions">
          <button className="start-play" type="button" onClick={() => startGame(true)}>全螢幕開始<span aria-hidden="true">⛶</span></button>
          <button className="start-alt" type="button" onClick={() => startGame(false)}>直接遊玩</button>
        </div>
        <ul className="start-keys">
          <li><b>拖曳</b>移動取景</li><li><b>滾輪</b>變焦</li><li><b>點擊 / 空白鍵</b>快門</li><li><b>P</b>參數面板</li><li><b>H</b>隱藏介面</li><li><b>F</b>全螢幕</li>
        </ul>
      </div>
    </div>}

    {result && <div className="playback">
      <SceneArtwork scene={result.scene} {...result.shot} blur={result.shot.motionBlur} exposure={result.shot.brightness} />
      <div className="playback-top"><span>100-000{shots.length}</span><b>照片檢視</b><span>RAW</span></div>
      <button type="button" onClick={() => setResult(null)}>返回即時取景</button>
    </div>}

    <section className="mobile-console" aria-label="手機相機操作台">
      <div className={`mobile-adjuster ${mobileDisabled ? "disabled" : ""}`}>
        <div><span>{mobileControl === "shutter" ? "快門速度" : mobileControl === "aperture" ? "光圈" : mobileControl === "iso" ? "ISO" : "焦距"}</span><strong>{mobileValue}</strong>{mobileDisabled && <small>目前模式由相機自動設定</small>}</div>
        <input aria-label={`手機調整${mobileControl === "shutter" ? "快門速度" : mobileControl === "aperture" ? "光圈" : mobileControl === "iso" ? "ISO" : "焦距"}`} type="range" min="0" max={mobileOptions.length - 1} step="1" value={Math.max(0, mobileOptions.indexOf(mobileRawValue))} disabled={mobileDisabled} onChange={event => setMobileValue(Number(event.target.value))} />
      </div>
      <nav aria-label="手機快速控制">
        {(["shutter", "aperture", "iso", "focal"] as MobileControl[]).map(item => <button type="button" key={item} className={mobileControl === item ? "active" : ""} aria-pressed={mobileControl === item} onClick={() => setMobileControl(item)}><span>{item === "shutter" ? "快門" : item === "aperture" ? "光圈" : item === "iso" ? "ISO" : "焦距"}</span><b>{item === "shutter" ? shutterLabel(effective.shutter) : item === "aperture" ? `F${effective.aperture}` : item === "iso" ? effective.iso : `${focal}mm`}</b></button>)}
        <button type="button" className="mobile-shutter" aria-label="拍攝照片" onClick={capture}><i /></button>
        <button type="button" className="mobile-fullscreen" aria-label={fullscreenActive ? "離開全螢幕" : "進入全螢幕"} aria-pressed={fullscreenActive} onClick={toggleFullscreen}><span>{fullscreenActive ? "退出" : "全螢幕"}</span><b>{fullscreenActive ? "↙" : "⛶"}</b></button>
      </nav>
    </section>
    <section className={`result-drawer ${result ? "open" : ""}`} aria-live="polite">{result && <><div className="score-ring" style={{ "--score": `${result.score * 3.6}deg` } as React.CSSProperties}><span>{result.score}</span><small>分</small></div><div><p>{result.title}</p><h2>{SCENARIOS.find(item => item.id === result.scene)?.title}</h2><ul>{result.notes.map(note => <li key={note}>{note}</li>)}</ul></div><button onClick={() => setResult(null)}>繼續調整 ×</button><button className="next-button" onClick={() => chooseScene((sceneIndex + 1) % SCENARIOS.length)}>下一個場景 →</button></>}</section>
  </main>;
}

function Control({ label, value, helper, index, max, disabled = false, onChange }: { label: string; value: string; helper: string; index: number; max: number; disabled?: boolean; onChange: (value: number) => void }) {
  return <section className={`control ${disabled ? "disabled" : ""}`}><div className="control-label"><label>{label}</label><strong>{value}</strong></div><input aria-label={label} type="range" min="0" max={max} step="1" value={Math.max(0, index)} disabled={disabled} onChange={e => onChange(Number(e.target.value))} /><div className="ticks"><i /><i /><i /><i /><i /></div><small>{helper}</small></section>;
}
