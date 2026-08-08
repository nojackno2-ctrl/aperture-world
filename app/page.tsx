"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { horizontalFieldOfView } from "./optics.mjs";
import Viewport3D, { type FocusReading, type LightReading, type ViewportHandle } from "./viewport";
import { Histogram } from "./histogram";
import { LOOK_LIMITS, WORLD, depthBlurPlan } from "./world.mjs";

type Mode = "AUTO" | "P" | "S" | "A" | "M";
type MeteringMode = "multi" | "center" | "spot" | "average" | "highlight";
type SceneKey = "landscape" | "bird" | "sports" | "portrait" | "group" | "street" | "night";
type MobileControl = "shutter" | "aperture" | "iso" | "exposure";
type Scenario = { id: SceneKey; eyebrow: string; title: string; brief: string; lesson: string; sceneEv: number; speed: number; focal: [number, number]; aperture: [number, number]; minShutter: number; accent: string };
type Look = { yaw: number; pitch: number };
type Aim = { x: number; y: number };
type PhotoParams = { mode: string; shutter: string; aperture: string; iso: string; focal: string; ev: string; lens: string; focus: string };
type Photo = { id: number; scene: SceneKey; score: number; title: string; settings: string; image: string; params: PhotoParams };
type Result = { score: number; title: string; notes: string[]; image: string; scene: SceneKey; params: PhotoParams };

const SCENARIOS: Scenario[] = [
  { id: "landscape", eyebrow: "01 · 清晨風景", title: "山谷第一道光", brief: "保留天空層次，讓前後景都清楚。", lesson: "縮小光圈能增加景深；腳架可換取較慢快門。", sceneEv: 12.4, speed: 0, focal: [24, 50], aperture: [8, 16], minShutter: 1 / 40, accent: "#f1b45a" },
  { id: "bird", eyebrow: "02 · 飛鳥", title: "掠過濕地的飛鳥", brief: "凝結翅膀，並以長焦填滿畫面。", lesson: "高速移動主體需要更快快門，通常也要提高 ISO。", sceneEv: 13.2, speed: 9, focal: [200, 300], aperture: [4, 8], minShutter: 1 / 1000, accent: "#9bc9d8" },
  { id: "sports", eyebrow: "03 · 運動賽事", title: "終點前的衝刺", brief: "抓住運動員騰空的決定性瞬間。", lesson: "快門先決很適合節奏快速、光線會變的場合。", sceneEv: 11.8, speed: 7, focal: [85, 200], aperture: [2.8, 8], minShutter: 1 / 800, accent: "#ef755e" },
  { id: "portrait", eyebrow: "04 · 人像", title: "窗邊自然光", brief: "眼睛銳利，背景柔和，不要讓膚色過曝。", lesson: "大光圈與較長焦距能分離人物和背景。", sceneEv: 9.8, speed: .25, focal: [50, 100], aperture: [1.4, 3.2], minShutter: 1 / 125, accent: "#d9a48f" },
  { id: "group", eyebrow: "05 · 合影", title: "朋友們的紀念照", brief: "每一排人的臉都要在景深範圍內。", lesson: "多人合影不要一味開大光圈；稍微縮小更安全。", sceneEv: 12.8, speed: .3, focal: [35, 70], aperture: [5.6, 11], minShutter: 1 / 160, accent: "#c7b573" },
  { id: "street", eyebrow: "06 · 白天街拍", title: "轉角的一秒", brief: "快速反應，兼顧移動人物與環境敘事。", lesson: "程式自動曝光適合光線穩定、瞬間難預測的街頭。", sceneEv: 14.2, speed: 2.5, focal: [28, 50], aperture: [4, 11], minShutter: 1 / 320, accent: "#5d95d2" },
  { id: "night", eyebrow: "07 · 夜間", title: "霓虹雨夜", brief: "留住環境光，同時避免人物晃動。", lesson: "夜間是光圈、快門與 ISO 的三方取捨。", sceneEv: 5.8, speed: 1.2, focal: [35, 85], aperture: [1.4, 2.8], minShutter: 1 / 125, accent: "#a77cf3" },
];
const APERTURES = [1.2, 1.4, 1.6, 1.8, 2, 2.2, 2.5, 2.8, 3.2, 3.5, 4, 4.5, 5, 5.6, 6.3, 7.1, 8, 9, 10, 11, 13, 14, 16, 18, 20, 22];
const SHUTTERS = [1 / 32000, 1 / 25000, 1 / 20000, 1 / 16000, 1 / 12500, 1 / 10000, 1 / 8000, 1 / 6400, 1 / 5000, 1 / 4000, 1 / 3200, 1 / 2500, 1 / 2000, 1 / 1600, 1 / 1250, 1 / 1000, 1 / 800, 1 / 640, 1 / 500, 1 / 400, 1 / 320, 1 / 250, 1 / 200, 1 / 160, 1 / 125, 1 / 100, 1 / 80, 1 / 60, 1 / 50, 1 / 40, 1 / 30, 1 / 25, 1 / 20, 1 / 15, 1 / 13, 1 / 10, 1 / 8, 1 / 6, 1 / 5, 1 / 4, .3, .4, .5, .6, .8, 1, 1.3, 1.6, 2, 2.5, 3.2, 4, 5, 6, 8, 10, 13, 15, 20, 25, 30];
const ISOS = [50, 64, 80, 100, 125, 160, 200, 250, 320, 400, 500, 640, 800, 1000, 1250, 1600, 2000, 2500, 3200, 4000, 5000, 6400, 8000, 10000, 12800, 16000, 20000, 25600, 32000, 40000, 51200, 64000, 80000, 102400];
const AUTO_ISOS = ISOS.filter(value => value >= 100 && value <= 12800);
const EXPOSURE_COMPENSATIONS = Array.from({ length: 31 }, (_, index) => -5 + index / 3);
const LENSES = [
  { id: "standard", name: "24–70 mm F2.8 標準變焦", focals: [24, 35, 50, 70], maxAperture: () => 2.8 },
  { id: "tele", name: "70–200 mm F2.8 遠攝變焦", focals: [70, 100, 135, 200], maxAperture: () => 2.8 },
  { id: "wildlife", name: "200–600 mm F5.6–6.3 超遠攝變焦", focals: [200, 300, 400, 600], maxAperture: (focal: number) => focal >= 400 ? 6.3 : 5.6 },
  { id: "supertele", name: "400–800 mm F6.3–8.0 超遠攝變焦", focals: [400, 500, 600, 800], maxAperture: (focal: number) => focal >= 600 ? 8.0 : 6.3 },
];
const MODES: { key: Mode; label: string; name: string }[] = [
  { key: "AUTO", label: "AUTO", name: "全自動" }, { key: "P", label: "P", name: "程式自動曝光" }, { key: "S", label: "S", name: "快門先決" }, { key: "A", label: "A", name: "光圈先決" }, { key: "M", label: "M", name: "手動曝光" },
];
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const closest = (values: number[], target: number) => values.reduce((best, value) => Math.abs(value - target) < Math.abs(best - target) ? value : best);
const autoIso = (aperture: number, shutter: number, targetEv: number) => closest(AUTO_ISOS, clamp(100 * Math.pow(2, Math.log2((aperture ** 2) / shutter) - targetEv), 100, 12800));
const shutterLabel = (value: number) => value >= 1 ? `${value}″` : value >= .3 ? `${value.toFixed(1)}″` : `1/${Math.round(1 / value)}`;
const focusLabel = (metres: number) => metres >= 1000 ? "∞" : metres >= 10 ? `${Math.round(metres)} m` : `${metres.toFixed(1)} m`;

const CAPTURE_REFERENCE_WIDTH = 1440;
const FOCUS_MISS_PX = 2;

export default function Home() {
  const [sceneIndex, setSceneIndex] = useState(0), [mode, setMode] = useState<Mode>("P"), [aperture, setAperture] = useState(5.6), [shutter, setShutter] = useState(1 / 125), [iso, setIso] = useState(200), [isoAuto, setIsoAuto] = useState(false), [focal, setFocal] = useState(50), [meteringMode, setMeteringMode] = useState<MeteringMode>("multi"), [exposureComp, setExposureComp] = useState(0), [captured, setCaptured] = useState(false), [lensId, setLensId] = useState("standard"), [look, setLook] = useState<Look>({ yaw: 0, pitch: 0 }), [mobileControl, setMobileControl] = useState<MobileControl>("shutter"), [isFullscreen, setIsFullscreen] = useState(false), [immersiveFallback, setImmersiveFallback] = useState(false), [hudVisible, setHudVisible] = useState(true), [deckOpen, setDeckOpen] = useState(false), [started, setStarted] = useState(false);
  const [aim, setAim] = useState<Aim>({ x: .5, y: .5 }), [aiming, setAiming] = useState(false), [focusRead, setFocusRead] = useState<FocusReading | null>(null);
  const [lightRead, setLightRead] = useState<LightReading>({ ev: 0 });
  const dragRef = useRef<{ startX: number; startY: number; yaw: number; pitch: number; moved: boolean } | null>(null);
  const lookFrameRef = useRef(0), lookDeltaRef = useRef({ x: 0, y: 0 });
  const viewportRef = useRef<ViewportHandle | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [activeControl, setActiveControl] = useState<MobileControl | null>(null);
  const [shots, setShots] = useState<Photo[]>([]);
  const scene = SCENARIOS[sceneIndex];
  const lens = LENSES.find(item => item.id === lensId) ?? LENSES[0];
  const shutterOptions = SHUTTERS;
  const lensMaxAperture = lens.maxAperture(focal);
  const apertureOptions = useMemo(() => APERTURES.filter(value => value >= lensMaxAperture), [lensMaxAperture]);
  const meteringAdjustment = meteringMode === "highlight" ? .7 : meteringMode === "spot" ? (scene.id === "night" ? -.6 : -.15) : meteringMode === "center" ? -.1 : meteringMode === "average" ? .15 : 0;
  const usingAutoIso = mode === "AUTO" || isoAuto;
  const sceneLightEv = scene.sceneEv + lightRead.ev;
  const targetEv = sceneLightEv + meteringAdjustment - (mode === "M" && !usingAutoIso ? 0 : exposureComp);
  const effective = useMemo(() => {
    let a = aperture, s = shutter, i = iso;
    const safeShutter = Math.min(scene.minShutter, 1 / focal);
    if (mode === "AUTO" || mode === "P") {
      const baseTargetAperture = scene.id === "portrait" || scene.id === "night"
        ? lensMaxAperture
        : scene.id === "landscape" || scene.id === "group"
          ? 8
          : scene.id === "sports" || scene.id === "bird"
            ? Math.max(lensMaxAperture, 4)
            : Math.max(lensMaxAperture, 5.6);

      const evIso100 = usingAutoIso ? targetEv : targetEv + Math.log2(i / 100);
      const reqAperture = Math.sqrt(safeShutter * Math.pow(2, evIso100));
      const targetAperture = reqAperture < baseTargetAperture
        ? clamp(reqAperture, lensMaxAperture, baseTargetAperture)
        : clamp(reqAperture, baseTargetAperture, 11);

      a = closest(apertureOptions, targetAperture);

      if (usingAutoIso) {
        const iso100Shutter = (a ** 2) / Math.pow(2, targetEv);
        if (iso100Shutter <= safeShutter) {
          s = closest(shutterOptions, iso100Shutter);
          i = 100;
        } else {
          s = closest(shutterOptions, safeShutter);
          i = autoIso(a, s, targetEv);
          if (i >= 12800) {
            const darkShutter = (a ** 2) / (Math.pow(2, targetEv) * (12800 / 100));
            s = closest(shutterOptions, darkShutter);
          }
        }
      } else {
        s = closest(shutterOptions, (a ** 2) / Math.pow(2, evIso100));
      }
    } else if (mode === "S") {
      const evIso100 = usingAutoIso ? targetEv : targetEv + Math.log2(i / 100);
      const reqAperture = Math.sqrt(s * Math.pow(2, evIso100));
      a = closest(apertureOptions, clamp(reqAperture, lensMaxAperture, 22));
      if (usingAutoIso) {
        i = autoIso(a, s, targetEv);
      }
    } else if (mode === "A") {
      if (usingAutoIso) {
        const iso100Shutter = (a ** 2) / Math.pow(2, targetEv);
        if (iso100Shutter <= safeShutter) {
          s = closest(shutterOptions, iso100Shutter);
          i = 100;
        } else {
          s = closest(shutterOptions, safeShutter);
          i = autoIso(a, s, targetEv);
          if (i >= 12800) {
            const darkShutter = (a ** 2) / (Math.pow(2, targetEv) * (12800 / 100));
            s = closest(shutterOptions, darkShutter);
          }
        }
      } else {
        s = closest(shutterOptions, (a ** 2) / Math.pow(2, targetEv + Math.log2(i / 100)));
      }
    } else if (usingAutoIso) {
      i = autoIso(a, s, targetEv);
    }
    return { aperture: a, shutter: s, iso: i };
  }, [aperture, apertureOptions, focal, iso, lensMaxAperture, mode, scene, shutter, targetEv, usingAutoIso]);
  const cameraEv = Math.log2((effective.aperture ** 2) / effective.shutter) - Math.log2(effective.iso / 100);
  const exposureDelta = sceneLightEv - cameraEv;
  const cameraBlur = Math.max(0, effective.shutter * focal - 1) * 1.25, subjectBlur = Math.max(0, scene.speed * effective.shutter * 16), motionBlur = clamp(cameraBlur + subjectBlur, 0, 12);
  const focusM = focusRead?.focusM || (WORLD[scene.id] ?? WORLD.landscape).focus;
  const blurPlan = depthBlurPlan(scene.id, { focalMm: focal, fNumber: effective.aperture, imageWidthPx: CAPTURE_REFERENCE_WIDTH, focusM, subjectM: focusRead?.subjectM });
  const focusBlur = blurPlan.subject;
  const noise = clamp((Math.log2(effective.iso / 100) / 6) * .42, 0, .48), brightness = clamp(Math.pow(2, exposureDelta), .02, 8);

  useEffect(() => { setResult(null); setFocusRead(null); setLightRead({ ev: 0 }); }, [scene]);
  useEffect(() => {
    const syncAim = () => { const locked = document.pointerLockElement === stageRef.current; setAiming(locked); if (locked) setAim({ x: .5, y: .5 }); };
    document.addEventListener("pointerlockchange", syncAim);
    return () => document.removeEventListener("pointerlockchange", syncAim);
  }, []);
  useEffect(() => { setShutter(current => closest(shutterOptions, current)); }, [shutterOptions]);
  useEffect(() => { setAperture(current => closest(apertureOptions, current)); }, [apertureOptions]);
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
    const shot = viewportRef.current?.capture({ focalMm: focal, fNumber: effective.aperture, shutterSeconds: effective.shutter, brightness, noise, shakePx: cameraBlur });
    if (!shot) return;
    const missPx = depthBlurPlan(scene.id, { focalMm: focal, fNumber: effective.aperture, imageWidthPx: CAPTURE_REFERENCE_WIDTH, focusM: shot.focusM, subjectM: shot.subjectM }).subject;
    const exposureScore = clamp(100 - Math.abs(exposureDelta) * 34, 0, 100), motionScore = clamp(100 - motionBlur * 13, 0, 100), focusScore = clamp(100 - missPx * 12, 0, 100), focalScore = focal >= scene.focal[0] && focal <= scene.focal[1] ? 100 : 55, apertureScore = effective.aperture >= scene.aperture[0] && effective.aperture <= scene.aperture[1] ? 100 : 62;
    const score = Math.round(exposureScore * .35 + motionScore * .25 + focusScore * .2 + apertureScore * .12 + focalScore * .08), notes: string[] = [];
    if (Math.abs(exposureDelta) > .65) notes.push(exposureDelta > 0 ? "畫面過亮：降低 ISO、縮小光圈或加快快門。" : "畫面偏暗：提高 ISO、開大光圈或放慢快門。");
    if (missPx > FOCUS_MISS_PX) notes.push(shot.focusM > shot.subjectM ? "對焦落在主體後方：把對焦框壓在主體上再按快門。" : "對焦落在主體前方：把對焦框壓在主體上再按快門。");
    if (motionBlur > 2) notes.push(cameraBlur > subjectBlur ? "有手震：快門至少要接近 1／焦距秒。" : "主體有拖影：用更快快門凝結動作。");
    if (!(effective.aperture >= scene.aperture[0] && effective.aperture <= scene.aperture[1])) notes.push(scene.id === "group" || scene.id === "landscape" ? "景深不足：縮小光圈讓更多距離清楚。" : "可以開大光圈，讓主體從背景中跳出來。");
    if (!(focal >= scene.focal[0] && focal <= scene.focal[1])) notes.push(`這個任務適合 ${scene.focal[0]}–${scene.focal[1]} mm。`);
    if (!notes.length) notes.push("曝光、對焦與景深都很到位。試著換模式再拍一次！");
    const title = score >= 90 ? "精彩捕捉" : score >= 75 ? "很接近了" : score >= 55 ? "值得再試一次" : "先讀讀教練提示";
    const params: PhotoParams = {
      mode: mode === "AUTO" ? "AUTO 全自動" : `${mode} 模式`,
      shutter: shutterLabel(effective.shutter),
      aperture: `F${effective.aperture}`,
      iso: usingAutoIso ? `AUTO ${effective.iso}` : `ISO ${effective.iso}`,
      focal: `${focal} mm`,
      ev: `${exposureComp > 0 ? "+" : ""}${exposureComp.toFixed(1)} EV`,
      lens: lens.name,
      focus: focusLabel(shot.focusM),
    };
    const settings = `${lens.name} · ${focal} mm · ${shutterLabel(effective.shutter)} · F${effective.aperture} · ISO ${effective.iso} · ${exposureComp > 0 ? "+" : ""}${exposureComp.toFixed(1)} EV · 對焦 ${focusLabel(shot.focusM)}`;
    setShots(current => [{ id: Date.now(), scene: scene.id, score, title, settings, image: shot.image, params }, ...current].slice(0, 12)); setCaptured(true); window.setTimeout(() => setCaptured(false), 180);
  }, [brightness, cameraBlur, effective.aperture, effective.iso, effective.shutter, exposureComp, exposureDelta, focal, lens.name, motionBlur, noise, scene, subjectBlur]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (!started) { if (e.code === "Space" || e.code === "Enter") { e.preventDefault(); setStarted(true); } return; }
      if (e.code === "Space") { e.preventDefault(); capture(); }
      else if (e.code === "KeyF") { e.preventDefault(); void toggleFullscreen(); }
      else if (e.code === "KeyH") { e.preventDefault(); setHudVisible(value => !value); }
      else if (e.code === "KeyP") { e.preventDefault(); setDeckOpen(value => !value); }
      else if (e.code === "KeyG") { e.preventDefault(); if (document.pointerLockElement) document.exitPointerLock(); setResult(null); setLibraryOpen(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [capture, started, toggleFullscreen]);
  useEffect(() => {
    if (!aiming) return;
    const onMove = (event: MouseEvent) => {
      lookDeltaRef.current.x += event.movementX;
      lookDeltaRef.current.y += event.movementY;
      if (lookFrameRef.current) return;
      lookFrameRef.current = window.requestAnimationFrame(() => {
        lookFrameRef.current = 0;
        const movement = lookDeltaRef.current;
        lookDeltaRef.current = { x: 0, y: 0 };
        const degreesPerPixel = horizontalFieldOfView(focal) / Math.max(1, stageRef.current?.clientWidth ?? window.innerWidth);
        const limits = LOOK_LIMITS[scene.id] ?? LOOK_LIMITS.landscape;
        setLook(current => ({ yaw: clamp(current.yaw - movement.x * degreesPerPixel, -limits.yaw, limits.yaw), pitch: clamp(current.pitch - movement.y * degreesPerPixel, -limits.pitchDown, limits.pitchUp) }));
      });
    };
    window.addEventListener("mousemove", onMove);
    return () => { window.removeEventListener("mousemove", onMove); if (lookFrameRef.current) window.cancelAnimationFrame(lookFrameRef.current); lookFrameRef.current = 0; lookDeltaRef.current = { x: 0, y: 0 }; };
  }, [aiming, focal, scene.id]);
  const requestAim = useCallback(() => {
    const stage = stageRef.current;
    if (typeof stage?.requestPointerLock !== "function") return false;
    try { (stage.requestPointerLock() as unknown as Promise<void> | undefined)?.catch?.(() => {}); } catch { return false; }
    return true;
  }, []);
  const startGame = useCallback((wantFullscreen: boolean) => { setStarted(true); if (wantFullscreen) void toggleFullscreen().finally(() => requestAim()); else requestAim(); }, [requestAim, toggleFullscreen]);
  const chooseScene = (index: number) => { setSceneIndex(index); setLook({ yaw: 0, pitch: 0 }); setResult(null); };
  const aimAt = (event: React.PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    setAim({ x: clamp((event.clientX - box.left) / box.width, 0, 1), y: clamp((event.clientY - box.top) / box.height, 0, 1) });
  };
  const startPan = (event: React.PointerEvent<HTMLDivElement>) => {
    if (result) return;
    if (aiming) return;
    aimAt(event);
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { startX: event.clientX, startY: event.clientY, yaw: look.yaw, pitch: look.pitch, moved: false };
  };
  const movePan = (event: React.PointerEvent<HTMLDivElement>) => {
    if (aiming) return;
    aimAt(event);
    const drag = dragRef.current;
    if (!drag) return;
    const dx = event.clientX - drag.startX, dy = event.clientY - drag.startY;
    if (Math.abs(dx) + Math.abs(dy) > 5) drag.moved = true;
    const degreesPerPixel = horizontalFieldOfView(focal) / Math.max(1, event.currentTarget.clientWidth);
    const limits = LOOK_LIMITS[scene.id] ?? LOOK_LIMITS.landscape;
    setLook({ yaw: clamp(drag.yaw + dx * degreesPerPixel, -limits.yaw, limits.yaw), pitch: clamp(drag.pitch + dy * degreesPerPixel, -limits.pitchDown, limits.pitchUp) });
  };
  const finishPan = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (drag?.moved) return;
    if (result) { setResult(null); return; }
    if (aiming || event.pointerType !== "mouse") capture();
    else if (!requestAim()) capture();
  };
  const mobileOptions = mobileControl === "shutter" ? shutterOptions : mobileControl === "aperture" ? apertureOptions : mobileControl === "iso" ? ISOS : EXPOSURE_COMPENSATIONS;
  const mobileRawValue = mobileControl === "shutter" ? shutter : mobileControl === "aperture" ? aperture : mobileControl === "iso" ? iso : exposureComp;
  const mobileValue = mobileControl === "shutter" ? shutterLabel(effective.shutter) : mobileControl === "aperture" ? `F${effective.aperture}` : mobileControl === "iso" ? usingAutoIso ? `AUTO ${effective.iso}` : `${effective.iso}` : `${exposureComp > 0 ? "+" : ""}${exposureComp.toFixed(1)} EV`;
  const mobileDisabled = mobileControl === "shutter" ? mode === "AUTO" || mode === "P" || mode === "A" : mobileControl === "aperture" ? mode === "AUTO" || mode === "P" || mode === "S" : mobileControl === "iso" ? usingAutoIso : mode === "M" && !usingAutoIso;
  const setMobileValue = (index: number) => {
    const value = mobileOptions[clamp(index, 0, mobileOptions.length - 1)];
    if (mobileControl === "shutter") setShutter(value); else if (mobileControl === "aperture") setAperture(value); else if (mobileControl === "iso") setIso(value); else setExposureComp(value);
  };
  const activateControl = (control: MobileControl) => {
    if (control === "shutter" && (mode === "AUTO" || mode === "P" || mode === "A")) setMode("S");
    if (control === "aperture" && (mode === "AUTO" || mode === "P" || mode === "S")) setMode("A");
    if (control === "iso") { if (mode === "AUTO") setMode("P"); setIsoAuto(false); }
    if (control === "exposure" && mode === "M" && !usingAutoIso) setMode("P");
    setMobileControl(control);
    setActiveControl(current => current === control ? null : control);
  };
  const activeOptions = activeControl === "shutter" ? shutterOptions : activeControl === "aperture" ? apertureOptions : activeControl === "iso" ? ISOS : EXPOSURE_COMPENSATIONS;
  const activeRawValue = activeControl === "shutter" ? shutter : activeControl === "aperture" ? aperture : activeControl === "iso" ? iso : exposureComp;
  const activeIndex = Math.max(0, activeOptions.indexOf(activeRawValue));
  const visibleScaleValues = Array.from({ length: 9 }, (_, offset) => ({ index: clamp(activeIndex + offset - 4, 0, activeOptions.length - 1), position: offset * 12.5 })).filter((item, offset, list) => list.findIndex(value => value.index === item.index) === offset);
  const activeLabel = activeControl === "shutter" ? "快門" : activeControl === "aperture" ? "光圈" : activeControl === "iso" ? "ISO" : "曝光值";
  const formatControlValue = (control: MobileControl | null, value: number) => control === "shutter" ? shutterLabel(value) : control === "aperture" ? `F${value}` : control === "iso" ? `${value}` : `${value > 0 ? "+" : ""}${value.toFixed(1)}`;
  const setActiveValue = (index: number) => {
    if (!activeControl) return;
    const value = activeOptions[clamp(index, 0, activeOptions.length - 1)];
    if (activeControl === "shutter") setShutter(value); else if (activeControl === "aperture") setAperture(value); else if (activeControl === "iso") setIso(value); else setExposureComp(value);
  };
  const fullscreenActive = isFullscreen || immersiveFallback;
  const focusSharp = focusBlur <= FOCUS_MISS_PX;
  return <main className={`game-shell ${immersiveFallback ? "immersive" : ""} ${captured ? "captured" : ""} ${hudVisible ? "" : "hud-off"} ${deckOpen ? "" : "deck-closed"} ${started ? "" : "not-started"}`} style={{ "--accent": scene.accent } as React.CSSProperties}>
    <div ref={stageRef} className={`live-stage ${aiming ? "aiming" : ""}`} role="button" tabIndex={0} aria-label="取景器，移動滑鼠轉動視角，對焦框跟著滑鼠，點擊拍攝，滾輪變焦" onPointerDown={startPan} onPointerMove={movePan} onPointerUp={finishPan} onPointerCancel={() => { dragRef.current = null; }} onWheel={event => { event.preventDefault(); const index = lens.focals.indexOf(focal); const next = clamp(index + (event.deltaY > 0 ? -1 : 1), 0, lens.focals.length - 1); setFocal(lens.focals[next]); }}>
      <Viewport3D ref={viewportRef} scene={scene.id} focal={focal} yaw={look.yaw} pitch={look.pitch} aimX={aim.x * 2 - 1} aimY={1 - aim.y * 2} frozen={Boolean(result) || libraryOpen} onFocus={setFocusRead} onLight={setLightRead} />
      <div className="viewfinder-shade" />
      <div className="grid-lines"><i /><i /><i /><i /></div>
      {started && !result && <div className={`af-frame ${focusSharp ? "sharp" : ""} ${aiming ? "aiming" : ""}`} style={{ left: `${aim.x * 100}%`, top: `${aim.y * 100}%` }} aria-hidden="true"><i /><i /><i /><i /><em>{focusLabel(focusM)}</em></div>}
      <div className="flash" />
    </div>

    <div className="hud">
      <header className="hud-top">
        <div className="scene-identity hud-fade"><p>{scene.eyebrow}</p><h1>{scene.title}</h1></div>
        <div className="hud-top-mid hud-fade">
          <div className="mode-strip glass" role="group" aria-label="拍攝模式">{MODES.map(item => <button key={item.key} type="button" onClick={() => setMode(item.key)} className={mode === item.key ? "active" : ""} aria-pressed={mode === item.key} title={item.name}><b>{item.label}</b><span>{item.name}</span></button>)}</div>
        </div>
        <div className="hud-top-right">
          <div className="hud-actions">
            <button className="icon-button" type="button" aria-label="返回主頁面" onClick={() => { if (document.pointerLockElement) document.exitPointerLock(); setResult(null); setLibraryOpen(false); setStarted(false); }}><span aria-hidden="true">⌂</span></button>
            <button className="icon-button" type="button" aria-label="鏡頭與測光設定" aria-pressed={deckOpen} onClick={() => setDeckOpen(value => !value)}><span aria-hidden="true">☰</span></button>
            <button className="icon-button fullscreen-button" type="button" aria-label={fullscreenActive ? "離開全螢幕" : "進入全螢幕"} aria-pressed={fullscreenActive} onClick={toggleFullscreen}><span aria-hidden="true">{fullscreenActive ? "↙" : "⛶"}</span></button>
          </div>
        </div>
      </header>


      <aside className="param-deck glass" aria-label="相機曝光設置">
        <div className="deck-head">
          <div className="deck-title-group">
            <span>鏡頭與測光</span>
          </div>
          <button type="button" className="deck-close-btn" aria-label="關閉面板 P" title="關閉曝光面板 (P)" onClick={() => setDeckOpen(false)}>✕</button>
        </div>
        <div className="deck-body">
          <div className="deck-grid compact-deck">
            <section className="lens-section"><label>鏡頭</label><select aria-label="更換鏡頭" value={lensId} onChange={event => { const next = LENSES.find(item => item.id === event.target.value) ?? LENSES[0]; setLensId(next.id); setFocal(next.focals[0]); }} >{LENSES.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></section>
            <section className="exposure-system"><div className="metering-row"><label>測光</label><select aria-label="測光模式" value={meteringMode} onChange={event => setMeteringMode(event.target.value as MeteringMode)}><option value="multi">多重</option><option value="center">中央偏重</option><option value="spot">定點</option><option value="average">全螢幕平均</option><option value="highlight">高光</option></select></div></section>
            <Control label="焦距" value={`${focal} mm`} index={Math.max(0, lens.focals.indexOf(focal))} max={lens.focals.length - 1} onChange={v => setFocal(lens.focals[v])} />
            <section className="iso-auto-row"><label>ISO AUTO</label><button type="button" aria-pressed={usingAutoIso} disabled={mode === "AUTO"} onClick={() => setIsoAuto(value => !value)}>{usingAutoIso ? "開" : "關"}</button></section>
          </div>
        </div>
      </aside>

      <footer className="hud-bottom hud-fade">
        {activeControl && <div className="exposure-scale" aria-label={`${activeLabel}刻度`} onPointerMove={event => {
          if (event.pointerType !== "mouse") return;
          const bounds = event.currentTarget.getBoundingClientRect();
          setActiveValue(Math.round(clamp((event.clientX - bounds.left) / bounds.width, 0, 1) * (activeOptions.length - 1)));
        }}>
          <div className="scale-heading"><span>{activeLabel}</span><b>{formatControlValue(activeControl, activeOptions[activeIndex])}</b></div>
          <div className="scale-track">
            {visibleScaleValues.map(item => <span key={item.index} className={item.index === activeIndex ? "active" : ""} style={{ left: `${item.position}%` }}><i />{formatControlValue(activeControl, activeOptions[item.index])}</span>)}
            <input aria-label={`調整${activeLabel}`} type="range" min="0" max={activeOptions.length - 1} step="1" value={activeIndex} onChange={event => setActiveValue(Number(event.target.value))} />
            <em />
          </div>
        </div>}
        <div className="camera-dock">
          <button className="shutter-button" type="button" aria-label="拍攝照片" onClick={capture}><i /></button>
          <div className="dock-readout" role="group" aria-label="曝光控制">
            <button type="button" className={activeControl === "shutter" ? "active" : ""} onClick={() => activateControl("shutter")}><small>快門</small><b>{shutterLabel(effective.shutter)}</b></button>
            <button type="button" className={activeControl === "aperture" ? "active" : ""} onClick={() => activateControl("aperture")}><small>光圈</small><b>F{effective.aperture}</b></button>
            <button type="button" className={activeControl === "iso" ? "active" : ""} onClick={() => activateControl("iso")}><small>ISO</small><b>{usingAutoIso ? `A ${effective.iso}` : effective.iso}</b></button>
            <button type="button" className={activeControl === "exposure" ? "active" : ""} onClick={() => activateControl("exposure")}><small>曝光值</small><b>{exposureComp > 0 ? "+" : ""}{exposureComp.toFixed(1)}</b></button>
          </div>
          <button className="library-button" type="button" aria-label={`開啟相片庫，${shots.length} 張照片`} onClick={() => { if (document.pointerLockElement) document.exitPointerLock(); setActiveControl(null); setResult(null); setLibraryOpen(true); }}><span className="photo-icon" aria-hidden="true" />{shots.length > 0 && <b>{shots.length}</b>}</button>
        </div>
      </footer>
    </div>

    {!started && <div className="start-screen">
      <div className="start-card">
        <p className="start-eyebrow">PRO CAMERA SIMULATOR · 互動攝影練習場</p>
        <h1 className="start-title">APERTURE<b>WORLD</b></h1>
        <p className="start-lead">七個場景，一台全片幅相機。選擇訓練場景、轉動曝光三要素，拍出動人照片。</p>

        <div className="start-scene-section">
          <div className="start-scene-header"><span>選擇訓練場景</span><b>0{sceneIndex + 1} / 07 · {scene.title}</b></div>
          <div className="start-scene-grid">
            {SCENARIOS.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className={`start-scene-card ${index === sceneIndex ? "active" : ""}`}
                onClick={() => chooseScene(index)}
                style={{ "--card-accent": item.accent } as React.CSSProperties}
              >
                <span className="card-num">0{index + 1}</span>
                <div className="card-info">
                  <p className="card-eyebrow">{item.eyebrow}</p>
                  <strong className="card-title">{item.title}</strong>
                  <small className="card-brief">{item.brief}</small>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="start-actions">
          <button className="start-play" type="button" onClick={() => startGame(true)}>進入拍攝 (全螢幕)<span aria-hidden="true">⛶</span></button>
          <button className="start-alt" type="button" onClick={() => startGame(false)}>直接遊玩</button>
        </div>
        <ul className="start-keys">
          <li><b>滑鼠</b>轉動視角</li><li><b>對焦框</b>跟著準心</li><li><b>滾輪</b>變焦</li><li><b>點擊 / 空白鍵</b>快門</li><li><b>ESC</b>放開滑鼠</li><li><b>P</b>參數面板</li><li><b>H</b>隱藏介面</li><li><b>F</b>全螢幕</li>
        </ul>
      </div>
    </div>}

    {libraryOpen && <section className="gallery" aria-label="相片庫">
      <header><div><p>PHOTO LIBRARY</p><h2>相片庫</h2></div><span>{shots.length} 張照片</span><button type="button" aria-label="關閉相片庫" onClick={() => setLibraryOpen(false)}>×</button></header>
      {shots.length === 0 ? <div className="gallery-empty"><span aria-hidden="true">▧</span><p>還沒有照片</p></div> : <div className="gallery-grid">{shots.filter(photo => photo.image).map((photo, index) => <button key={photo.id} type="button" onClick={() => { setLibraryOpen(false); setResult({ score: photo.score, title: "相片檢視", notes: [photo.settings], image: photo.image, scene: photo.scene, params: photo.params }); }}><img src={photo.image} alt={`${photo.title}，${photo.score} 分`} /><span><b>{photo.params.shutter}</b><b>{photo.params.aperture}</b><b>{photo.params.iso}</b><em>#{String(shots.length - index).padStart(2, "0")}</em></span></button>)}</div>}
    </section>}

    {result && <div className="playback">
      <img className="playback-photo" src={result.image} alt={`${result.title}，${result.score} 分`} />
      <div className="playback-top"><span>100-000{shots.length}</span><b>照片檢視</b><span>RAW</span></div>
      {result.params && <div className="playback-exif glass">
        <div className="exif-header">
          <span className="exif-title">📷 拍攝參數 (EXIF)</span>
          <span className="exif-mode">{result.params.mode}</span>
        </div>
        <div className="exif-grid">
          <div className="exif-item"><label>快門速度</label><b>{result.params.shutter}</b></div>
          <div className="exif-item"><label>光圈大小</label><b>{result.params.aperture}</b></div>
          <div className="exif-item"><label>ISO 感光度</label><b>{result.params.iso}</b></div>
          <div className="exif-item"><label>鏡頭焦距</label><b>{result.params.focal}</b></div>
          <div className="exif-item"><label>曝光補償</label><b>{result.params.ev}</b></div>
          <div className="exif-item"><label>對焦距離</label><b>{result.params.focus}</b></div>
        </div>
        <div className="exif-lens"><span>使用鏡頭：</span><b>{result.params.lens}</b></div>
      </div>}
      <Histogram image={result.image} />
      <button type="button" onClick={() => { setResult(null); setLibraryOpen(true); }}>返回相片庫</button>
    </div>}

    <section className="mobile-console" aria-label="手機相機操作台">
      <div className={`mobile-adjuster ${mobileDisabled ? "disabled" : ""}`}>
        <div><span>{mobileControl === "shutter" ? "快門" : mobileControl === "aperture" ? "光圈" : mobileControl === "iso" ? "ISO" : "曝光值"}</span><strong>{mobileValue}</strong>{mobileDisabled && <small>目前由相機自動設定</small>}</div>
        <input aria-label={`手機調整${mobileControl === "shutter" ? "快門" : mobileControl === "aperture" ? "光圈" : mobileControl === "iso" ? "ISO" : "曝光值"}`} type="range" min="0" max={mobileOptions.length - 1} step="1" value={Math.max(0, mobileOptions.indexOf(mobileRawValue))} disabled={mobileDisabled} onChange={event => setMobileValue(Number(event.target.value))} />
        {mobileControl === "iso" && <button className="mobile-iso-auto" type="button" aria-pressed={usingAutoIso} disabled={mode === "AUTO"} onClick={() => setIsoAuto(value => !value)}>AUTO {usingAutoIso ? "ON" : "OFF"}</button>}
      </div>
      <nav aria-label="手機快速控制">
        {(["shutter", "aperture", "iso", "exposure"] as MobileControl[]).map(item => <button type="button" key={item} className={mobileControl === item ? "active" : ""} aria-pressed={mobileControl === item} onClick={() => activateControl(item)}><span>{item === "shutter" ? "快門" : item === "aperture" ? "光圈" : item === "iso" ? "ISO" : "曝光值"}</span><b>{item === "shutter" ? shutterLabel(effective.shutter) : item === "aperture" ? `F${effective.aperture}` : item === "iso" ? usingAutoIso ? `A ${effective.iso}` : effective.iso : `${exposureComp > 0 ? "+" : ""}${exposureComp.toFixed(1)}`}</b></button>)}
        <button type="button" className="mobile-shutter" aria-label="拍攝照片" onClick={capture}><i /></button>
        <button type="button" className="mobile-library" aria-label={`開啟相片庫，${shots.length} 張照片`} onClick={() => { setActiveControl(null); setLibraryOpen(true); }}><span>相片庫</span><b><i className="photo-icon" aria-hidden="true" /></b></button>
      </nav>
    </section>
  </main>;
}

function Control({ label, value, helper, index, max, disabled = false, onChange }: { label: string; value: string; helper?: string; index: number; max: number; disabled?: boolean; onChange: (value: number) => void }) {
  return <section className={`control ${disabled ? "disabled" : ""}`}><div className="control-label"><label>{label}</label><strong>{value}</strong></div><input aria-label={label} type="range" min="0" max={max} step="1" value={Math.max(0, index)} disabled={disabled} onChange={e => onChange(Number(e.target.value))} /><div className="ticks"><i /><i /><i /><i /><i /></div>{helper && <small>{helper}</small>}</section>;
}
