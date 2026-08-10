"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { horizontalFieldOfView, trajectoryDistance } from "./optics.mjs";
import { type Photo } from "./photo-library";
import { type FocusReading, type LightReading, type ViewportHandle } from "./viewport";

const Viewport3D = dynamic(() => import("./viewport"), {
  ssr: false,
  loading: () => <div className="viewport-stage" />
});

const loadCameraStyles = () => import("./camera-styles");
const CameraStyles = dynamic(() => loadCameraStyles(), { ssr: false });

const loadPhotoLibrary = () => import("./photo-library");
const PhotoLibrary = dynamic(() => loadPhotoLibrary().then(module => module.PhotoLibrary), {
  ssr: false,
  loading: () => <div className="gallery-loading" role="status"><span>相片庫載入中…</span></div>,
});

// Keep the 3D stack off the start-screen path. Intent events warm the two large
// renderer dependencies before activation, while the module registry dedupes
// them with the viewport's own imports when play actually begins.
let rendererWarmPromise: Promise<unknown> | null = null;
function warmRenderer() {
  rendererWarmPromise ??= Promise.all([
    import("./three-runtime"),
    import("three/addons/utils/BufferGeometryUtils.js"),
  ]).then(
    () => undefined,
    () => { rendererWarmPromise = null; },
  );
  return rendererWarmPromise;
}

function warmCameraExperience() {
  void warmRenderer();
  return loadCameraStyles();
}
import { LOOK_LIMITS, WORLD, depthBlurPlan } from "./world.mjs";

type Mode = "AUTO" | "P" | "S" | "A" | "M";
type DriveMode = "single" | "burst_hi" | "burst_mid" | "burst_lo";
type MeteringMode = "multi" | "center" | "spot" | "average" | "highlight";
type AfFrameSize = "small" | "medium" | "large";
type SceneKey = keyof typeof WORLD;
type MobileControl = "shutter" | "aperture" | "exposure" | "iso";
type Scenario = { id: SceneKey; eyebrow: string; title: string; brief: string; lesson: string; sceneEv: number; speed: number; focal: [number, number]; aperture: [number, number]; minShutter: number; accent: string };
type Look = { yaw: number; pitch: number };
type ExposureState = { startTime: number; durationSeconds: number; remainingSeconds: number; progress: number; trajectory: Look[] };

type DriveOption = {
  key: DriveMode;
  label: string;
  tag: string;
  title: string;
  fps: number;
  interval: number;
  desc: string;
};

const DRIVE_MODES: DriveOption[] = [
  { key: "single", label: "單張", tag: "SINGLE", title: "單張拍攝", fps: 1, interval: 0, desc: "每按一次快門拍攝一張照片" },
  { key: "burst_hi", label: "連拍·快", tag: "Hi+ 30fps", title: "高速連拍 (Hi+ 30fps)", fps: 30, interval: 33, desc: "最高 30 張/秒極速連拍，凝結極限瞬間" },
  { key: "burst_mid", label: "連拍·中", tag: "Mid 15fps", title: "中速連拍 (Mid 15fps)", fps: 15, interval: 66, desc: "15 張/秒中速連拍，兼顧節奏與動態追蹤" },
  { key: "burst_lo", label: "連拍·慢", tag: "Lo 5fps", title: "低速連拍 (Lo 5fps)", fps: 5, interval: 200, desc: "5 張/秒低速連拍，穩定持續跟焦拍攝" },
];

const MAX_BUFFER = 300;
/** Card write speed: one frame leaves the buffer every this many ms (10 fps). */
const BUFFER_WRITE_MS = 100;
const BUFFER_SEGMENTS = 12;
const BUFFER_SEGMENT_INDICES = Array.from({ length: BUFFER_SEGMENTS }, (_, index) => index);
/** Frames the memory card holds. Shooting stops when it fills, like a real body. */
const CARD_CAPACITY = 2000;
const SCENARIOS: Scenario[] = [
  { id: "landscape", eyebrow: "01 · 清晨風景", title: "山谷第一道光", brief: "保留天空層次，讓前後景都清楚。", lesson: "縮小光圈能增加景深；腳架可換取較慢快門。", sceneEv: 12.4, speed: 0, focal: [24, 50], aperture: [8, 16], minShutter: 1 / 40, accent: "#f1b45a" },
  { id: "bird", eyebrow: "02 · 飛鳥", title: "掠過濕地的飛鳥", brief: "凝結翅膀，並以長焦填滿畫面。", lesson: "高速移動主體需要更快快門，通常也要提高 ISO。", sceneEv: 13.2, speed: 9, focal: [200, 300], aperture: [4, 8], minShutter: 1 / 1000, accent: "#9bc9d8" },
  { id: "sports", eyebrow: "03 · 運動賽事", title: "終點前的衝刺", brief: "抓住運動員騰空的決定性瞬間。", lesson: "快門先決很適合節奏快速、光線會變的場合。", sceneEv: 11.8, speed: 7, focal: [85, 200], aperture: [2.8, 8], minShutter: 1 / 800, accent: "#ef755e" },
  { id: "portrait", eyebrow: "04 · 人像", title: "窗邊自然光", brief: "眼睛銳利，背景柔和，不要讓膚色過曝。", lesson: "大光圈與較長焦距能分離人物和背景。", sceneEv: 9.8, speed: .25, focal: [50, 100], aperture: [1.4, 3.2], minShutter: 1 / 125, accent: "#d9a48f" },
  { id: "group", eyebrow: "05 · 合影", title: "朋友們的紀念照", brief: "每一排人的臉都要在景深範圍內。", lesson: "多人合影不要一味開大光圈；稍微縮小更安全。", sceneEv: 12.8, speed: .3, focal: [35, 70], aperture: [5.6, 11], minShutter: 1 / 160, accent: "#c7b573" },
  { id: "street", eyebrow: "06 · 白天街拍", title: "轉角的一秒", brief: "快速反應，兼顧移動人物與環境敘事。", lesson: "程式自動曝光適合光線穩定、瞬間難預測的街頭。", sceneEv: 14.2, speed: 2.5, focal: [28, 50], aperture: [4, 11], minShutter: 1 / 320, accent: "#5d95d2" },
  { id: "night", eyebrow: "07 · 夜間", title: "霓虹雨夜", brief: "留住環境光，同時避免人物晃動。", lesson: "夜間是光圈、快門與 ISO 的三方取捨。", sceneEv: 5.8, speed: 1.2, focal: [35, 85], aperture: [1.4, 2.8], minShutter: 1 / 125, accent: "#a77cf3" },
  { id: "starry", eyebrow: "08 · 山上星空夜景", title: "銀河與高山星夜", brief: "極致漆黑的山巔，用長曝光與大光圈捕捉繁星與銀河。", lesson: "星空極暗需要長達 10–30 秒長曝光、最大光圈與高 ISO，並鎖定無限遠對焦。", sceneEv: -4.5, speed: 0.01, focal: [24, 35], aperture: [1.4, 2.8], minShutter: 10, accent: "#818cf8" },
  { id: "city_night", eyebrow: "09 · 山上城市夜景", title: "山頂俯瞰璀璨城景", brief: "在遠山高處捕捉遠方繁華都會的萬家燈火與車流光軌。", lesson: "遠距俯瞰夜景，縮小光圈可獲得清晰銳利光芒與星芒效果，搭配長曝光展現夜景層次。", sceneEv: 3.8, speed: 0.5, focal: [70, 200], aperture: [5.6, 11], minShutter: 2, accent: "#38bdf8" },
  { id: "airport", eyebrow: "10 · 機場飛機起降", title: "跑道上的鋼鐵巨鳥", brief: "在機場遠處以超長焦鎖定客機高速起降與拉起瞬間。", lesson: "高速運動的大型飛機需要 1/1000 秒以上高速快門凝結機身與氣流，搭配超遠攝鏡頭追焦。", sceneEv: 13.6, speed: 18, focal: [200, 600], aperture: [5.6, 8], minShutter: 1 / 1000, accent: "#fb923c" },
  { id: "outdoor_portrait", eyebrow: "11 · 室外人像", title: "陽光花園戶外人像", brief: "在戶外自然光與樹蔭花景中，拍出柔美背景虛化的人像特寫。", lesson: "戶外人像善用大光圈分離人物與繁雜背景，注意臉部受光與曝光補償避免逆光暗臉。", sceneEv: 12.2, speed: 0.2, focal: [50, 85], aperture: [1.4, 2.8], minShutter: 1 / 250, accent: "#ec4899" },
];
const APERTURES = [1.2, 1.4, 1.6, 1.8, 2, 2.2, 2.5, 2.8, 3.2, 3.5, 4, 4.5, 5, 5.6, 6.3, 7.1, 8, 9, 10, 11, 13, 14, 16, 18, 20, 22, 25, 29, 32];
const SHUTTERS = [1 / 32000, 1 / 25000, 1 / 20000, 1 / 16000, 1 / 12500, 1 / 10000, 1 / 8000, 1 / 6400, 1 / 5000, 1 / 4000, 1 / 3200, 1 / 2500, 1 / 2000, 1 / 1600, 1 / 1250, 1 / 1000, 1 / 800, 1 / 640, 1 / 500, 1 / 400, 1 / 320, 1 / 250, 1 / 200, 1 / 160, 1 / 125, 1 / 100, 1 / 80, 1 / 60, 1 / 50, 1 / 40, 1 / 30, 1 / 25, 1 / 20, 1 / 15, 1 / 13, 1 / 10, 1 / 8, 1 / 6, 1 / 5, 1 / 4, .3, .4, .5, .6, .8, 1, 1.3, 1.6, 2, 2.5, 3.2, 4, 5, 6, 8, 10, 13, 15, 20, 25, 30];
const SHUTTER_SCALE_OPTIONS = [...SHUTTERS].reverse();
const ISOS = [50, 64, 80, 100, 125, 160, 200, 250, 320, 400, 500, 640, 800, 1000, 1250, 1600, 2000, 2500, 3200, 4000, 5000, 6400, 8000, 10000, 12800, 16000, 20000, 25600, 32000, 40000, 51200, 64000, 80000, 102400];
const ISO_AUTO_SCALE_VALUE = 999999;
const ISO_SCALE_OPTIONS = [ISO_AUTO_SCALE_VALUE, ...ISOS];
const EXPOSURE_COMPENSATIONS = [-3, -2.7, -2.3, -2, -1.7, -1.3, -1, -0.7, -0.3, 0, 0.3, 0.7, 1, 1.3, 1.7, 2, 2.3, 2.7, 3];

export type LensCategory = "zoom" | "prime";
export interface LensSpec {
  id: string;
  name: string;
  category: LensCategory;
  focals: number[];
  maxAperture: (focal: number) => number;
  minAperture: number;
  filter: string;
  weight: string;
  tag: string;
  desc: string;
}

const LENSES: LensSpec[] = [
  // ── 變焦鏡頭群 (ZOOM LENSES) ──
  {
    id: "zoom_12_24_f28",
    name: "12–24 mm F2.8 旗艦超廣角變焦",
    category: "zoom",
    focals: [12, 14, 16, 18, 20, 24],
    maxAperture: () => 2.8,
    minAperture: 22,
    filter: "後置濾鏡",
    weight: "847 g",
    tag: "旗艦超廣角大三元",
    desc: "12mm 極致視角與恆定 F2.8 大光圈，壯闊大景與星空銀河首選。",
  },
  {
    id: "zoom_16_35_f28_ii",
    name: "16–35 mm F2.8 II 旗艦廣角變焦",
    category: "zoom",
    focals: [16, 20, 24, 28, 35],
    maxAperture: () => 2.8,
    minAperture: 22,
    filter: "82 mm",
    weight: "547 g",
    tag: "二代廣角大三元",
    desc: "二代輕量化廣角大三元，邊角解析度極致銳利，適合風景、建築與街拍。",
  },
  {
    id: "standard",
    name: "24–70 mm F2.8 II 旗艦標準變焦",
    category: "zoom",
    focals: [24, 28, 35, 50, 70],
    maxAperture: () => 2.8,
    minAperture: 22,
    filter: "82 mm",
    weight: "695 g",
    tag: "二代標準鏡皇",
    desc: "全能標準鏡皇二代，解像力極高、近拍優異且散景柔美，全方位拍攝首選。",
  },
  {
    id: "zoom_28_70_f2",
    name: "28–70 mm F2.0 旗艦大光圈標準變焦",
    category: "zoom",
    focals: [28, 35, 40, 50, 70],
    maxAperture: () => 2.0,
    minAperture: 22,
    filter: "86 mm",
    weight: "918 g",
    tag: "F2 恆定超大光圈變焦",
    desc: "劃時代 F2.0 恆定超大光圈變焦，兼具多支頂級定焦鏡的畫質與迷人散景。",
  },
  {
    id: "portrait",
    name: "70–200 mm F2.8 II 防手震遠攝變焦",
    category: "zoom",
    focals: [70, 85, 100, 135, 200],
    maxAperture: () => 2.8,
    minAperture: 22,
    filter: "77 mm",
    weight: "1045 g",
    tag: "二代望遠鏡皇",
    desc: "大幅減重 29% 的望遠鏡皇二代，疾速追焦與內建光學防手震，人像與運動利器。",
  },
  {
    id: "zoom_100_400_f45_56",
    name: "100–400 mm F4.5–5.6 防手震超遠攝變焦",
    category: "zoom",
    focals: [100, 135, 200, 300, 400],
    maxAperture: (f: number) => f <= 100 ? 4.5 : f <= 200 ? 5.0 : 5.6,
    minAperture: 32,
    filter: "77 mm",
    weight: "1395 g",
    tag: "超遠攝防手震變焦",
    desc: "專業超遠攝變焦鏡頭，具備光學防手震與高速精準對焦，運動賽事與飛羽首選。",
  },

  // ── 定焦鏡頭群 (PRIME LENSES) ──
  {
    id: "prime_14_f18",
    name: "14 mm F1.8 超廣角星空定焦",
    category: "prime",
    focals: [14],
    maxAperture: () => 1.8,
    minAperture: 16,
    filter: "後置濾鏡",
    weight: "460 g",
    tag: "超廣角星空神器",
    desc: "14mm 超廣角與 F1.8 大光圈，極致抑制彗形像差，星空銀河與壯闊夜景首選。",
  },
  {
    id: "prime_24_f14",
    name: "24 mm F1.4 廣角大光圈風景定焦",
    category: "prime",
    focals: [24],
    maxAperture: () => 1.4,
    minAperture: 16,
    filter: "67 mm",
    weight: "445 g",
    tag: "廣角大光圈定焦",
    desc: "輕巧緊湊的高畫質廣角定焦，F1.4 大光圈與柔美散景，風景與夜景創作利器。",
  },
  {
    id: "prime_35_f14",
    name: "35 mm F1.4 人文紀實街拍定焦",
    category: "prime",
    focals: [35],
    maxAperture: () => 1.4,
    minAperture: 16,
    filter: "67 mm",
    weight: "524 g",
    tag: "人文街拍之王",
    desc: "攝影師最喜愛的人文黃金焦段，邊角極致解像力與純淨散景，街拍紀實首選。",
  },
  {
    id: "prime_50_f12",
    name: "50 mm F1.2 頂級旗艦大光圈定焦",
    category: "prime",
    focals: [50],
    maxAperture: () => 1.2,
    minAperture: 16,
    filter: "72 mm",
    weight: "778 g",
    tag: "F1.2 夢幻散景定焦",
    desc: "頂級 F1.2 超大光圈，極淺景深營造出如奶油般融化的極致夢幻散景。",
  },
  {
    id: "prime_50_f14",
    name: "50 mm F1.4 高解像標準定焦",
    category: "prime",
    focals: [50],
    maxAperture: () => 1.4,
    minAperture: 16,
    filter: "67 mm",
    weight: "516 g",
    tag: "高解像標準定焦",
    desc: "新世代高解析 F1.4 標準鏡頭，鏡身小巧輕盈，提供飛快而安靜的精準對焦。",
  },
  {
    id: "prime_85_f14_ii",
    name: "85 mm F1.4 II 專業人像鏡皇",
    category: "prime",
    focals: [85],
    maxAperture: () => 1.4,
    minAperture: 16,
    filter: "77 mm",
    weight: "642 g",
    tag: "二代人像鏡皇",
    desc: "新一代專業人像鏡皇，畫質與散景全面進化，減重 20%，追焦反應躍升 3 倍。",
  },
  {
    id: "prime_100_f28_apd",
    name: "100 mm F2.8 APD 柔焦人像定焦",
    category: "prime",
    focals: [100],
    maxAperture: () => 2.8,
    minAperture: 20,
    filter: "72 mm",
    weight: "700 g",
    tag: "APD 柔焦人像定焦",
    desc: "搭載 APD 變跡濾鏡的特殊散景鏡頭 (T5.6 光度)，消弭二線性，呈現絲滑柔焦。",
  },
  {
    id: "prime_135_f18",
    name: "135 mm F1.8 空氣切割機人像定焦",
    category: "prime",
    focals: [135],
    maxAperture: () => 1.8,
    minAperture: 22,
    filter: "82 mm",
    weight: "950 g",
    tag: "空氣切割機定焦",
    desc: "頂級人像「空氣切割機」，強烈空間壓縮感與刀鋒般的全開光圈極致銳度。",
  },
  {
    id: "prime_300_f28",
    name: "300 mm F2.8 輕量遠攝大砲",
    category: "prime",
    focals: [300],
    maxAperture: () => 2.8,
    minAperture: 22,
    filter: "40.5 mm 插入式",
    weight: "1470 g",
    tag: "最輕量遠攝大砲",
    desc: "同級最輕 300mm F2.8 遠攝大光圈巨砲，重心優異，室內運動與生態機動首選。",
  },
  {
    id: "prime_400_f28",
    name: "400 mm F2.8 體育賽事旗艦大砲",
    category: "prime",
    focals: [400],
    maxAperture: () => 2.8,
    minAperture: 22,
    filter: "40.5 mm 插入式",
    weight: "2895 g",
    tag: "體育賽事旗艦大砲",
    desc: "體育賽事與生態攝影旗艦大砲，F2.8 超大通光量瞬間凝結高速動作。",
  },
  {
    id: "prime_600_f4",
    name: "600 mm F4.0 飛羽生態終極巨砲",
    category: "prime",
    focals: [600],
    maxAperture: () => 4.0,
    minAperture: 22,
    filter: "40.5 mm 插入式",
    weight: "3040 g",
    tag: "飛羽生態終極巨砲",
    desc: "頂級野生飛羽與航空攝影終極巨砲，超長焦距呈現羽毛與機身毫釐細節。",
  },
];
const MODES: { key: Mode; label: string; name: string }[] = [
  { key: "AUTO", label: "AUTO", name: "全自動" },
  { key: "P", label: "P", name: "程式自動" },
  { key: "S", label: "S", name: "快門先決" },
  { key: "A", label: "A", name: "光圈先決" },
  { key: "M", label: "M", name: "全手動" },
];

function shutterLabel(value: number) {
  if (value >= 1) return `${value.toFixed(value % 1 === 0 ? 0 : 1)}"`;
  return `1/${Math.round(1 / value)}`;
}

function formatFocusDistance(meters: number) {
  if (meters >= 100) return "∞ 無限遠";
  if (meters >= 10) return `${meters.toFixed(0)} m`;
  if (meters >= 1) return `${meters.toFixed(1)} m`;
  return `${Math.round(meters * 100)} cm`;
}

function clamp(v: number, min: number, max: number) { return Math.min(max, Math.max(min, v)); }
function closest(values: number[], target: number) { return values.reduce((best, value) => Math.abs(value - target) < Math.abs(best - target) ? value : best); }
function closestSafeShutter(values: number[], target: number, safeShutter: number) {
  const allowed = values.filter(value => value <= safeShutter);
  return closest(allowed.length > 0 ? allowed : values, Math.min(target, safeShutter));
}

const CAPTURE_REFERENCE_WIDTH = 1920;
const FOCUS_MISS_PX = 1.35;

function DriveIcon({ drive }: { drive: DriveMode }) {
  switch (drive) {
    case "single":
      return (
        <svg viewBox="0 0 24 24" className="drive-svg-icon" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="16" rx="2.5" strokeWidth="1.8" />
          <circle cx="12" cy="12" r="4" strokeWidth="1.5" opacity="0.85" />
          <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
        </svg>
      );
    case "burst_hi":
      return (
        <svg viewBox="0 0 24 24" className="drive-svg-icon" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="3" width="12" height="12" rx="1.5" opacity="0.45" strokeWidth="1.3" />
          <rect x="6" y="6" width="12" height="12" rx="1.5" opacity="0.7" strokeWidth="1.5" />
          <rect x="3" y="9" width="12" height="12" rx="1.5" strokeWidth="2" />
          <path d="M15 18l3-3-3-3M19 15h-4" stroke="var(--accent)" strokeWidth="1.8" />
        </svg>
      );
    case "burst_mid":
      return (
        <svg viewBox="0 0 24 24" className="drive-svg-icon" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="8" y="4" width="12" height="12" rx="1.5" opacity="0.55" strokeWidth="1.4" />
          <rect x="5" y="7" width="12" height="12" rx="1.5" opacity="0.8" strokeWidth="1.6" />
          <rect x="2" y="10" width="12" height="12" rx="1.5" strokeWidth="2" />
          <path d="M16 17l2.5-2.5-2.5-2.5" stroke="currentColor" strokeWidth="1.7" />
        </svg>
      );
    case "burst_lo":
      return (
        <svg viewBox="0 0 24 24" className="drive-svg-icon" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="7" y="5" width="13" height="13" rx="2" opacity="0.65" strokeWidth="1.5" />
          <rect x="3" y="8" width="13" height="13" rx="2" strokeWidth="2" />
        </svg>
      );
    default:
      return null;
  }
}

function Control({ label, value, helper, index, max, disabled = false, onChange }: { label: string; value: string; helper?: string; index: number; max: number; disabled?: boolean; onChange: (value: number) => void }) {
  return <section className={`control ${disabled ? "disabled" : ""}`}><div className="control-label"><label>{label}</label><strong>{value}</strong></div><input aria-label={label} type="range" min="0" max={max} step="1" value={Math.max(0, index)} disabled={disabled} onChange={e => onChange(Number(e.target.value))} /><div className="ticks"><i /><i /><i /><i /><i /></div>{helper && <small>{helper}</small>}</section>;
}

export default function Home() {
  const [sceneIndex, setSceneIndex] = useState(0), [mode, setMode] = useState<Mode>("P"), [driveMode, setDriveMode] = useState<DriveMode>("single"), [aperture, setAperture] = useState(5.6), [shutter, setShutter] = useState(1 / 125), [iso, setIso] = useState(200), [isoAuto, setIsoAuto] = useState(true), [focal, setFocal] = useState(50), [meteringMode, setMeteringMode] = useState<MeteringMode>("multi"), [exposureComp, setExposureComp] = useState(0), [captured, setCaptured] = useState(false), [lensId, setLensId] = useState("standard"), [mobileControl, setMobileControl] = useState<MobileControl>("shutter"), [isFullscreen, setIsFullscreen] = useState(false), [fullscreenError, setFullscreenError] = useState<string | null>(null), [hudVisible, setHudVisible] = useState(true), [deckOpen, setDeckOpen] = useState(false), [started, setStarted] = useState(false), [launching, setLaunching] = useState(false);
  const [modeMenuOpen, setModeMenuOpen] = useState(false), [driveMenuOpen, setDriveMenuOpen] = useState(false);
  const [exposureState, setExposureState] = useState<ExposureState | null>(null);
  const [aiming, setAiming] = useState(false), [focusRead, setFocusRead] = useState<FocusReading | null>(null), [afFrameSize, setAfFrameSize] = useState<AfFrameSize>("small");
  // The meter is stored as the bare number it is. A fresh `{ ev }` object every
  // reading defeats React's own bail-out, so an unchanged stop still re-rendered.
  const [lightEv, setLightEv] = useState(0);
  const onLightReading = useCallback((reading: LightReading) => setLightEv(reading.ev), []);
  const [bufferCount, setBufferCount] = useState(0);
  const [isBursting, setIsBursting] = useState(false);
  // The real write-out queue: fully-formed Photos waiting to land in `shots`.
  // `bufferCount` includes both encoding and ready-to-write frames.
  const pendingRef = useRef<Photo[]>([]);
  const encodingCountRef = useRef(0);
  const reservedFramesRef = useRef(0);
  const captureGenerationRef = useRef(0);
  const nextPhotoIdRef = useRef(0);
  const bufferTimerRef = useRef<number | null>(null);
  const bufferDecayRef = useRef(0);
  const isBurstTriggerActiveRef = useRef(false);
  const burstTimerRef = useRef<number | null>(null);
  const exposureTimerRef = useRef<number | null>(null);
  const exposureStateRef = useRef<ExposureState | null>(null);
  // View movement is renderer state, not HUD state. Keeping it in a ref avoids
  // reconciling the complete camera interface on every 120 Hz pointer frame.
  const lookRef = useRef<Look>({ yaw: 0, pitch: 0 });
  const lookFrameRef = useRef<number | null>(null);
  const pointerDragRef = useRef<{ startX: number; startY: number; yaw: number; pitch: number; moved: boolean } | null>(null);
  const confirmingControlRef = useRef(false);
  const lookDeltaRef = useRef({ x: 0, y: 0 });
  const stageRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<ViewportHandle | null>(null);
  const applyLook = useCallback((nextLook: Look) => {
    const exposure = exposureStateRef.current;
    if (exposure && exposure.trajectory.length < 300) {
      // Repeated points preserve the time spent holding a pan at its limit.
      exposure.trajectory.push({ yaw: nextLook.yaw, pitch: nextLook.pitch });
    }
    const previous = lookRef.current;
    if (previous.yaw === nextLook.yaw && previous.pitch === nextLook.pitch) return;
    lookRef.current = nextLook;
    viewportRef.current?.setLook(nextLook);
  }, []);
  const [libraryOpen, setLibraryOpen] = useState(false), [activeControl, setActiveControl] = useState<MobileControl | null>(null);
  const [shots, setShots] = useState<Photo[]>([]);
  // The card holds both what's already written (shots) and what's still queued to write.
  const cardRemaining = CARD_CAPACITY - shots.length - bufferCount;
  const cardFull = cardRemaining <= 0;
  const scene = SCENARIOS[sceneIndex];
  const lens = LENSES.find(item => item.id === lensId) ?? LENSES[0];
  const shutterOptions = SHUTTERS;
  const lensMaxAperture = lens.maxAperture(focal);
  const lensMinAperture = lens.minAperture ?? 22;
  const apertureOptions = useMemo(() => APERTURES.filter(value => value >= lensMaxAperture && value <= lensMinAperture), [lensMaxAperture, lensMinAperture]);
  const meteringBias = meteringMode === "highlight" ? .70 : meteringMode === "spot" ? (scene.id === "night" || scene.id === "starry" || scene.id === "city_night" ? -.60 : -.15) : meteringMode === "center" ? -.10 : meteringMode === "average" ? .15 : 0;
  const usingAutoIso = mode === "AUTO" || isoAuto;

  const controlAvailability = useMemo<Record<MobileControl, boolean>>(() => ({
    shutter: mode === "S" || mode === "M",
    aperture: mode === "A" || mode === "M",
    exposure: mode !== "AUTO" && (mode !== "M" || usingAutoIso),
    iso: mode !== "AUTO",
  }), [mode, usingAutoIso]);

  const sceneLightEv = scene.sceneEv + lightEv;
  const targetEv = sceneLightEv + meteringBias - (mode === "M" && !usingAutoIso ? 0 : exposureComp);

  const effective = useMemo(() => {
    let a = closest(apertureOptions, aperture);
    let s = shutter;
    let i = iso;
    const safeShutter = Math.min(scene.minShutter, 1 / focal);

    if (mode === "AUTO" || mode === "P") {
      const baseTarget = (scene.id === "portrait" || scene.id === "night" || scene.id === "starry" || scene.id === "outdoor_portrait")
        ? lensMaxAperture
        : (scene.id === "landscape" || scene.id === "group" || scene.id === "city_night")
          ? 8.0
          : (scene.id === "sports" || scene.id === "bird" || scene.id === "airport")
            ? Math.max(lensMaxAperture, 5.6)
            : 4.0;
      const evIso100 = usingAutoIso ? targetEv : targetEv + Math.log2(i / 100);
      const reqAperture = Math.sqrt(safeShutter * Math.pow(2, evIso100));
      a = closest(apertureOptions, reqAperture < baseTarget
        ? clamp(reqAperture, lensMaxAperture, baseTarget)
        : clamp(reqAperture, baseTarget, 11));

      if (usingAutoIso) {
        const reqShutterIso100 = (a ** 2) / Math.pow(2, targetEv);
        if (reqShutterIso100 <= safeShutter) {
          s = closestSafeShutter(shutterOptions, reqShutterIso100, safeShutter);
          i = 100;
        } else {
          s = closestSafeShutter(shutterOptions, safeShutter, safeShutter);
          i = closest(ISOS, clamp(100 * Math.pow(2, Math.log2((a ** 2) / s) - targetEv), 100, 12800));
        }
      } else {
        s = closestSafeShutter(shutterOptions, (a ** 2) / Math.pow(2, evIso100), safeShutter);
      }
    } else if (mode === "S") {
      const evIso100 = usingAutoIso ? targetEv : targetEv + Math.log2(i / 100);
      a = closest(apertureOptions, clamp(Math.sqrt(s * Math.pow(2, evIso100)), lensMaxAperture, 22));
      if (usingAutoIso) {
        i = closest(ISOS, clamp(100 * Math.pow(2, Math.log2((a ** 2) / s) - targetEv), 100, 12800));
      }
    } else if (mode === "A") {
      if (usingAutoIso) {
        const reqShutterIso100 = (a ** 2) / Math.pow(2, targetEv);
        if (reqShutterIso100 <= safeShutter) {
          s = closestSafeShutter(shutterOptions, reqShutterIso100, safeShutter);
          i = 100;
        } else {
          s = closestSafeShutter(shutterOptions, safeShutter, safeShutter);
          i = closest(ISOS, clamp(100 * Math.pow(2, Math.log2((a ** 2) / s) - targetEv), 100, 12800));
        }
      } else {
        s = closestSafeShutter(shutterOptions, (a ** 2) / Math.pow(2, targetEv + Math.log2(i / 100)), safeShutter);
      }
    } else {
      if (usingAutoIso) {
        i = closest(ISOS, clamp(100 * Math.pow(2, Math.log2((a ** 2) / s) - targetEv), 100, 12800));
      }
    }

    return { aperture: a, shutter: s, iso: i };
  }, [aperture, apertureOptions, focal, iso, lensMaxAperture, mode, scene, shutter, shutterOptions, targetEv, usingAutoIso]);

  const cameraEv = Math.log2((effective.aperture ** 2) / effective.shutter) - Math.log2(effective.iso / 100);
  const exposureDelta = sceneLightEv - cameraEv;
  const cameraBlur = Math.max(0, effective.shutter * focal - 1) * 1.25, subjectBlur = Math.max(0, scene.speed * effective.shutter * 16), motionBlur = clamp(cameraBlur + subjectBlur, 0, 12);
  const focusM = focusRead?.focusM || (WORLD[scene.id] ?? WORLD.landscape).focus;
  const blurPlan = depthBlurPlan(scene.id, { focalMm: focal, fNumber: effective.aperture, imageWidthPx: CAPTURE_REFERENCE_WIDTH, focusM, subjectM: focusRead?.subjectM });
  const focusBlur = blurPlan.subject;
  const noise = clamp((Math.log2(effective.iso / 100) / 6) * .42, 0, .48), brightness = clamp(Math.pow(2, exposureDelta), .02, 8);

  const syncBufferCount = useCallback(() => {
    const count = encodingCountRef.current + pendingRef.current.length;
    bufferDecayRef.current = count;
    setBufferCount(count);
  }, []);

  // Start one write timer only when a completed frame is waiting. The callback
  // schedules the next write itself, so new burst frames cannot reset its cadence
  // and an empty buffer consumes no timer wake-ups.
  const scheduleBufferDrain = useCallback(() => {
    if (bufferTimerRef.current !== null || pendingRef.current.length === 0) return;
    const drain = () => {
      bufferTimerRef.current = null;
      const photo = pendingRef.current.shift();
      if (photo) setShots(prev => [photo, ...prev]);
      syncBufferCount();
      if (pendingRef.current.length > 0) bufferTimerRef.current = window.setTimeout(drain, BUFFER_WRITE_MS);
    };
    bufferTimerRef.current = window.setTimeout(drain, BUFFER_WRITE_MS);
  }, [syncBufferCount]);

  useEffect(() => () => {
    isBurstTriggerActiveRef.current = false;
    if (burstTimerRef.current) window.clearTimeout(burstTimerRef.current);
    if (bufferTimerRef.current !== null) window.clearTimeout(bufferTimerRef.current);
    if (exposureTimerRef.current) window.cancelAnimationFrame(exposureTimerRef.current);
    if (lookFrameRef.current) window.cancelAnimationFrame(lookFrameRef.current);
    captureGenerationRef.current += 1;
    pendingRef.current = [];
  }, []);

  useEffect(() => {
    const syncAim = () => setAiming(document.pointerLockElement === stageRef.current);
    document.addEventListener("pointerlockchange", syncAim);
    return () => document.removeEventListener("pointerlockchange", syncAim);
  }, []);

  useEffect(() => {
    const syncFullscreen = () => {
      const active = Boolean(document.fullscreenElement);
      setIsFullscreen(active);
      if (active) setFullscreenError(null);
    };
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (document.fullscreenElement) { await document.exitFullscreen(); return; }
    const target = document.documentElement;
    if (!document.fullscreenEnabled || typeof target.requestFullscreen !== "function") {
      setFullscreenError("此瀏覽器不支援真正全螢幕。請更新瀏覽器，或將網站加入主畫面後再開啟。");
      return;
    }
    try {
      // The Fullscreen API itself removes browser chrome. Omitting optional
      // arguments keeps this working on mobile engines with stricter signatures.
      await target.requestFullscreen();
    } catch {
      setFullscreenError("瀏覽器拒絕進入真正全螢幕。請再點一次全螢幕，或將網站加入主畫面後開啟。");
    }
  }, []);

  const capture = useCallback(() => {
    if (exposureStateRef.current || libraryOpen || !started) return;
    if (reservedFramesRef.current >= CARD_CAPACITY) return;
    if (bufferDecayRef.current >= MAX_BUFFER) return;

    const finalizeCapture = (trajectory: Look[]) => {
      const render = viewportRef.current?.capture({
        focalMm: focal,
        fNumber: effective.aperture,
        shutterSeconds: effective.shutter,
        brightness,
        noise,
        shakePx: cameraBlur,
        lookTrajectory: trajectory,
      });
      if (!render) return;

      const motionSpread = trajectoryDistance(trajectory) / Math.max(0.01, horizontalFieldOfView(focal)) * 80;
      const combinedMotionBlur = clamp(motionBlur + motionSpread, 0, 16);
      const measuredBlurPlan = depthBlurPlan(scene.id, { focalMm: focal, fNumber: effective.aperture, imageWidthPx: CAPTURE_REFERENCE_WIDTH, focusM: render.focusM, subjectM: render.subjectM });
      const measuredFocusBlur = measuredBlurPlan.subject;

      const expScore = clamp(100 - Math.abs(exposureDelta) * 34, 0, 100);
      const motionScore = clamp(100 - combinedMotionBlur * 13, 0, 100);
      const focusScore = clamp(100 - measuredFocusBlur * 12, 0, 100);
      const focalScore = focal >= scene.focal[0] && focal <= scene.focal[1] ? 100 : 55;
      const apertureScore = effective.aperture >= scene.aperture[0] && effective.aperture <= scene.aperture[1] ? 100 : 62;
      const totalScore = Math.round(expScore * .35 + motionScore * .25 + focusScore * .2 + apertureScore * .12 + focalScore * .08);
      const notes: string[] = [];

      if (Math.abs(exposureDelta) > .65) notes.push(exposureDelta > 0 ? "畫面過亮：降低 ISO、縮小光圈或加快快門。" : "畫面偏暗：提高 ISO、開大光圈或放慢快門。");
      if (measuredFocusBlur > FOCUS_MISS_PX) notes.push(render.focusM > render.subjectM ? "對焦落在主體後方：把對焦框壓在主體上再按快門。" : "對焦落在主體前方：把對焦框壓在主體上再按快門。");
      if (motionSpread > 3) notes.push("曝光期間有移動相機，畫面呈現出動態運鏡與光軌拖影。");
      else if (combinedMotionBlur > 2) notes.push(cameraBlur > subjectBlur ? "有手震：快門至少要接近 1／焦距秒。" : "主體有拖影：用更快快門凝結動作。");
      if (effective.aperture < scene.aperture[0] || effective.aperture > scene.aperture[1]) {
        notes.push(scene.id === "group" || scene.id === "landscape" || scene.id === "city_night" ? "景深不足：縮小光圈讓更多距離清楚。" : "可以開大光圈，讓主體從背景中跳出來。");
      }
      if (focal < scene.focal[0] || focal > scene.focal[1]) notes.push(`這個任務適合 ${scene.focal[0]}–${scene.focal[1]} mm。`);
      if (!notes.length) notes.push("曝光、對焦與景深都很到位。試著換模式再拍一次！");

      const title = totalScore >= 90 ? "精彩捕捉" : totalScore >= 75 ? "很接近了" : totalScore >= 55 ? "值得再試一次" : "先讀讀教練提示";
      const driveOption = DRIVE_MODES.find(d => d.key === driveMode) ?? DRIVE_MODES[0];
      const params = {
        mode: mode === "AUTO" ? "AUTO 全自動" : `${mode} 模式`,
        drive: driveOption.title,
        shutter: shutterLabel(effective.shutter),
        aperture: `F${effective.aperture}`,
        iso: usingAutoIso ? `AUTO ${effective.iso}` : `ISO ${effective.iso}`,
        focal: `${focal} mm`,
        ev: `${exposureComp > 0 ? "+" : ""}${exposureComp.toFixed(1)} EV`,
        lens: lens.name,
        focus: formatFocusDistance(render.focusM),
      };
      const settings = `${lens.name} · ${focal} mm · ${shutterLabel(effective.shutter)} · F${effective.aperture} · ISO ${effective.iso} · ${driveOption.label} · ${exposureComp > 0 ? "+" : ""}${exposureComp.toFixed(1)} EV · 對焦 ${formatFocusDistance(render.focusM)}`;

      const id = nextPhotoIdRef.current++;
      const generation = captureGenerationRef.current;
      reservedFramesRef.current += 1;
      encodingCountRef.current += 1;
      syncBufferCount();
      // The full-size image encodes async; once it's ready the frame is a fully-formed
      // Photo, so it enqueues (not queues a promise) into the write-out buffer. It only
      // reaches `shots` — and therefore the library — once the drain effect writes it out.
      render.image.then(image => {
        encodingCountRef.current = Math.max(0, encodingCountRef.current - 1);
        if (generation !== captureGenerationRef.current) return;
        if (!image) {
          reservedFramesRef.current = Math.max(0, reservedFramesRef.current - 1);
          syncBufferCount();
          return;
        }
        const photo: Photo = { id, scene: scene.id, score: totalScore, title, settings, width: render.width, height: render.height, image, thumb: render.thumb, params };
        pendingRef.current.push(photo);
        syncBufferCount();
        scheduleBufferDrain();
      });
      setCaptured(true);
      window.setTimeout(() => setCaptured(false), 180);
    };

    const shutterSec = effective.shutter;
    if (shutterSec < 0.2) {
      const look = lookRef.current;
      finalizeCapture([{ yaw: look.yaw, pitch: look.pitch }]);
      return;
    }

    const look = lookRef.current;
    const state: ExposureState = {
      startTime: performance.now(),
      durationSeconds: shutterSec,
      remainingSeconds: shutterSec,
      progress: 0,
      trajectory: [{ yaw: look.yaw, pitch: look.pitch }],
    };
    exposureStateRef.current = state;
    setExposureState(state);

    let lastProgressUpdate = state.startTime;
    const step = () => {
      const current = exposureStateRef.current;
      if (!current) return;
      const elapsed = (performance.now() - current.startTime) / 1000;
      const remaining = Math.max(0, current.durationSeconds - elapsed);
      const progress = Math.min(1, elapsed / current.durationSeconds);
      if (elapsed >= current.durationSeconds) {
        const finalTrajectory = [...current.trajectory];
        exposureStateRef.current = null;
        setExposureState(null);
        exposureTimerRef.current = null;
        finalizeCapture(finalTrajectory);
      } else {
        const now = performance.now();
        if (now - lastProgressUpdate >= 50) {
          lastProgressUpdate = now;
          setExposureState({ ...current, remainingSeconds: remaining, progress });
        }
        exposureTimerRef.current = window.requestAnimationFrame(step);
      }
    };
    exposureTimerRef.current = window.requestAnimationFrame(step);
  }, [brightness, cameraBlur, driveMode, effective.aperture, effective.iso, effective.shutter, exposureComp, exposureDelta, focal, lens.name, libraryOpen, mode, motionBlur, noise, scene, scheduleBufferDrain, started, subjectBlur, syncBufferCount, usingAutoIso]);

  // A burst reschedules itself through setTimeout, so its closure would keep firing
  // the capture from the instant the burst began — same framing, same exposure, 95 times.
  const captureRef = useRef(capture);
  useEffect(() => { captureRef.current = capture; }, [capture]);

  const stopBurst = useCallback(() => {
    isBurstTriggerActiveRef.current = false;
    setIsBursting(false);
    if (burstTimerRef.current) {
      window.clearTimeout(burstTimerRef.current);
      burstTimerRef.current = null;
    }
  }, []);

  const startBurst = useCallback(() => {
    if (exposureStateRef.current || libraryOpen || !started) return;
    if (reservedFramesRef.current >= CARD_CAPACITY) return;

    isBurstTriggerActiveRef.current = true;
    captureRef.current();

    if (driveMode === "single") return;

    setIsBursting(true);
    const driveOpt = DRIVE_MODES.find(d => d.key === driveMode) ?? DRIVE_MODES[0];

    const triggerNext = () => {
      if (!isBurstTriggerActiveRef.current || reservedFramesRef.current >= CARD_CAPACITY) {
        stopBurst();
        return;
      }
      captureRef.current();
      const delay = bufferDecayRef.current >= MAX_BUFFER ? Math.max(260, driveOpt.interval * 4) : driveOpt.interval;
      burstTimerRef.current = window.setTimeout(triggerNext, delay);
    };

    burstTimerRef.current = window.setTimeout(triggerNext, driveOpt.interval);
  }, [driveMode, libraryOpen, started, stopBurst]);

  const deletePhoto = useCallback((id: number) => {
    setShots(previous => {
      if (!previous.some(photo => photo.id === id)) return previous;
      reservedFramesRef.current = Math.max(0, reservedFramesRef.current - 1);
      return previous.filter(photo => photo.id !== id);
    });
  }, []);

  const clearLibrary = useCallback(() => {
    captureGenerationRef.current += 1;
    encodingCountRef.current = 0;
    reservedFramesRef.current = 0;
    pendingRef.current = [];
    bufferDecayRef.current = 0;
    if (bufferTimerRef.current !== null) {
      window.clearTimeout(bufferTimerRef.current);
      bufferTimerRef.current = null;
    }
    setBufferCount(0);
    setShots([]);
  }, []);

  const closeLibrary = useCallback(() => {
    setLibraryOpen(false);
  }, []);

  const openLibrary = useCallback(() => {
    if (document.pointerLockElement) document.exitPointerLock();
    setActiveControl(null);
    void loadPhotoLibrary();
    setLibraryOpen(true);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement || (target instanceof HTMLElement && target.isContentEditable)) return;
      // Space/Enter belong to the focused control. Without this guard, pressing
      // a start-screen or HUD button also fired the global shutter shortcut and
      // could unmount the fullscreen button before its native click occurred.
      if ((e.code === "Space" || e.code === "Enter") && target instanceof Element && target !== stageRef.current && target.closest('button,[role="button"],[role="menuitemradio"]')) return;

      if (!started) {
        if (!launching && (e.code === "Space" || e.code === "Enter")) {
          e.preventDefault();
          setLaunching(true);
          void warmCameraExperience().then(
            () => { setStarted(true); setLaunching(false); },
            () => setLaunching(false),
          );
        }
        return;
      }

      if (libraryOpen) {
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        if (!e.repeat && !isBurstTriggerActiveRef.current) {
          startBurst();
        }
      }
      else if (e.code === "KeyD") {
        e.preventDefault();
        setDriveMode(current => {
          const idx = DRIVE_MODES.findIndex(d => d.key === current);
          return DRIVE_MODES[(idx + 1) % DRIVE_MODES.length].key;
        });
      }
      else if (e.code === "KeyF") { e.preventDefault(); toggleFullscreen(); }
      else if (e.code === "KeyH") { e.preventDefault(); setHudVisible(v => !v); }
      else if (e.code === "KeyP") { e.preventDefault(); setDeckOpen(v => !v); }
      else if (e.code === "KeyG") { e.preventDefault(); openLibrary(); }
      else if (e.code === "Escape") {
        if (document.pointerLockElement) document.exitPointerLock();
        setModeMenuOpen(false);
        setDriveMenuOpen(false);
        setActiveControl(null);
        setDeckOpen(false);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        stopBurst();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [launching, libraryOpen, openLibrary, startBurst, started, stopBurst, toggleFullscreen]);

  useEffect(() => {
    if (!isBursting) return;
    window.addEventListener("pointerup", stopBurst);
    window.addEventListener("pointercancel", stopBurst);
    return () => {
      window.removeEventListener("pointerup", stopBurst);
      window.removeEventListener("pointercancel", stopBurst);
    };
  }, [isBursting, stopBurst]);

  useEffect(() => {
    const handleOutsideClick = () => {
      setModeMenuOpen(false);
      setDriveMenuOpen(false);
    };
    window.addEventListener("click", handleOutsideClick);
    return () => window.removeEventListener("click", handleOutsideClick);
  }, []);

  useEffect(() => {
    if (!aiming) return;
    const onMove = (event: MouseEvent) => {
      lookDeltaRef.current.x += event.movementX;
      lookDeltaRef.current.y += event.movementY;
      if (!lookFrameRef.current) {
        lookFrameRef.current = window.requestAnimationFrame(() => {
          lookFrameRef.current = 0;
          const delta = lookDeltaRef.current;
          lookDeltaRef.current = { x: 0, y: 0 };
          const degreesPerPixel = horizontalFieldOfView(focal) / Math.max(1, stageRef.current?.clientWidth ?? window.innerWidth);
          const limits = LOOK_LIMITS[scene.id] ?? LOOK_LIMITS.landscape;
          const previous = lookRef.current;
          applyLook({
            yaw: clamp(previous.yaw - delta.x * degreesPerPixel, -limits.yaw, limits.yaw),
            pitch: clamp(previous.pitch - delta.y * degreesPerPixel, -limits.pitchDown, limits.pitchUp),
          });
        });
      }
    };
    window.addEventListener("mousemove", onMove);
    return () => { window.removeEventListener("mousemove", onMove); if (lookFrameRef.current) window.cancelAnimationFrame(lookFrameRef.current); lookFrameRef.current = 0; lookDeltaRef.current = { x: 0, y: 0 }; };
  }, [aiming, applyLook, focal, scene.id]);

  const requestAim = useCallback(() => {
    const stage = stageRef.current;
    if (typeof stage?.requestPointerLock !== "function") return false;
    try { stage.requestPointerLock()?.catch?.(() => {}); } catch { return false; }
    return true;
  }, []);

  const enterGame = useCallback((fullscreen: boolean) => {
    if (launching) return;
    setLaunching(true);
    void warmCameraExperience().then(
      () => { setStarted(true); setLaunching(false); },
      () => setLaunching(false),
    );
    if (fullscreen) toggleFullscreen().finally(() => requestAim());
    else requestAim();
  }, [launching, requestAim, toggleFullscreen]);

  const selectScene = (idx: number) => {
    if (exposureTimerRef.current) {
      window.cancelAnimationFrame(exposureTimerRef.current);
      exposureTimerRef.current = null;
    }
    exposureStateRef.current = null;
    setExposureState(null);
    setSceneIndex(idx);
    lookRef.current = { yaw: 0, pitch: 0 };
    viewportRef.current?.setLook(lookRef.current);
    setFocusRead(null);
    setLightEv(0);
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (libraryOpen) return;
    if (event.pointerType === "mouse") {
      if (!aiming) {
        if (requestAim()) return;
      }
      startBurst();
      return;
    }
    if (aiming) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerDragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      yaw: lookRef.current.yaw,
      pitch: lookRef.current.pitch,
      moved: false,
    };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (aiming) return;
    const drag = pointerDragRef.current;
    if (!drag) return;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (Math.abs(deltaX) + Math.abs(deltaY) > 5) drag.moved = true;
    const degreesPerPixel = horizontalFieldOfView(focal) / Math.max(1, event.currentTarget.clientWidth);
    const limits = LOOK_LIMITS[scene.id] ?? LOOK_LIMITS.landscape;
    const nextLook = {
      yaw: clamp(drag.yaw + deltaX * degreesPerPixel, -limits.yaw, limits.yaw),
      pitch: clamp(drag.pitch + deltaY * degreesPerPixel, -limits.pitchDown, limits.pitchUp),
    };
    applyLook(nextLook);
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse") {
      stopBurst();
      return;
    }
    const drag = pointerDragRef.current;
    pointerDragRef.current = null;
    if (drag?.moved) return;
    // Touch input only turns the camera. The dedicated shutter remains the only
    // capture target, avoiding accidental photos while the player is aiming.
  };

  const mobileOptions = mobileControl === "shutter" ? SHUTTER_SCALE_OPTIONS : mobileControl === "aperture" ? apertureOptions : mobileControl === "iso" ? ISO_SCALE_OPTIONS : EXPOSURE_COMPENSATIONS;
  const mobileRawValue = mobileControl === "shutter" ? shutter : mobileControl === "aperture" ? aperture : mobileControl === "iso" ? usingAutoIso ? ISO_AUTO_SCALE_VALUE : iso : exposureComp;
  const mobileValue = mobileControl === "shutter" ? shutterLabel(effective.shutter) : mobileControl === "aperture" ? `F${effective.aperture}` : mobileControl === "iso" ? usingAutoIso ? `AUTO ${effective.iso}` : `${effective.iso}` : `${exposureComp > 0 ? "+" : ""}${exposureComp.toFixed(1)} EV`;
  const mobileDisabled = !controlAvailability[mobileControl];

  const setMobileValue = (index: number) => {
    const value = mobileOptions[clamp(index, 0, mobileOptions.length - 1)];
    if (mobileControl === "shutter") setShutter(value); else if (mobileControl === "aperture") setAperture(value); else if (mobileControl === "iso") { if (value === ISO_AUTO_SCALE_VALUE) setIsoAuto(true); else { setIsoAuto(false); setIso(value); } } else setExposureComp(value);
  };
  const activateControl = (control: MobileControl) => {
    if (!controlAvailability[control]) return;
    setMobileControl(control);
    setActiveControl(current => current === control ? null : control);
  };
  const activeOptions = activeControl === "shutter" ? SHUTTER_SCALE_OPTIONS : activeControl === "aperture" ? apertureOptions : activeControl === "iso" ? ISO_SCALE_OPTIONS : EXPOSURE_COMPENSATIONS;
  const activeRawValue = activeControl === "shutter" ? shutter : activeControl === "aperture" ? aperture : activeControl === "iso" ? usingAutoIso ? ISO_AUTO_SCALE_VALUE : iso : exposureComp;
  const activeIndex = Math.max(0, activeOptions.indexOf(activeRawValue));
  const visibleScaleValues = activeControl
    ? Array.from({ length: 9 }, (_, offset) => ({ index: clamp(activeIndex + offset - 4, 0, activeOptions.length - 1), position: offset * 12.5 })).filter((item, index, list) => list.findIndex(candidate => candidate.index === item.index) === index)
    : [];
  const activeLabel = activeControl === "shutter" ? "快門" : activeControl === "aperture" ? "光圈" : activeControl === "iso" ? "ISO" : "曝光值";
  const formatControlValue = (control: MobileControl | null, value: number) => control === "shutter" ? shutterLabel(value) : control === "aperture" ? `F${value}` : control === "iso" ? value === ISO_AUTO_SCALE_VALUE ? "AUTO" : `${value}` : `${value > 0 ? "+" : ""}${value.toFixed(1)}`;
  const setActiveValue = (nextIndex: number) => {
    if (!activeControl) return;
    const value = activeOptions[clamp(nextIndex, 0, activeOptions.length - 1)];
    if (activeControl === "shutter") setShutter(value); else if (activeControl === "aperture") setAperture(value); else if (activeControl === "iso") { if (value === ISO_AUTO_SCALE_VALUE) setIsoAuto(true); else { setIsoAuto(false); setIso(value); } } else setExposureComp(value);
  };

  const isFs = isFullscreen;
  const isSharp = focusBlur <= FOCUS_MISS_PX;

  return <main
    className={`game-shell ${captured ? "captured" : ""} ${exposureState ? "is-exposing" : ""} ${isBursting ? "is-bursting" : ""} ${hudVisible ? "" : "hud-off"} ${deckOpen ? "" : "deck-closed"} ${started ? "" : "not-started"}`}
    style={{ "--accent": scene.accent } as React.CSSProperties}
    onPointerDownCapture={event => {
      if (!activeControl || event.pointerType !== "mouse" || event.button !== 0) return;
      confirmingControlRef.current = true;
      event.preventDefault();
      event.stopPropagation();
      setActiveControl(null);
    }}
    onPointerUpCapture={event => {
      if (!confirmingControlRef.current || event.pointerType !== "mouse" || event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      window.setTimeout(() => { confirmingControlRef.current = false; }, 0);
    }}
    onClickCapture={event => {
      if (!confirmingControlRef.current || event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      confirmingControlRef.current = false;
    }}
    onWheelCapture={event => {
      if (activeControl) {
        event.preventDefault();
        event.stopPropagation();
        setActiveValue(activeIndex + (event.deltaY > 0 ? -1 : 1));
      }
    }}
  >
    {started && <CameraStyles />}
    <div
      ref={stageRef}
      className={`live-stage ${aiming ? "aiming" : ""} ${exposureState ? "exposing" : ""}`}
      role="button"
      tabIndex={0}
      aria-label="取景器；對焦框固定在正中央；滑鼠移動視角、點擊拍攝、滾輪變焦；觸控拖曳移動視角"
      onKeyDown={event => {
        if (event.key !== "Enter" || event.repeat) return;
        event.preventDefault();
        startBurst();
        window.setTimeout(stopBurst, 0);
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => { pointerDragRef.current = null; stopBurst(); }}
      onWheel={e => {
        e.preventDefault();
        const nextIndex = clamp(lens.focals.indexOf(focal) + (e.deltaY > 0 ? -1 : 1), 0, lens.focals.length - 1);
        setFocal(lens.focals[nextIndex]);
      }}
    >
      {started
        ? <Viewport3D ref={viewportRef} scene={scene.id} focal={focal} aimX={0} aimY={0} frozen={libraryOpen} onFocus={setFocusRead} onLight={onLightReading} />
        : <div className="viewport-stage" aria-hidden="true" />}
      <div className="viewfinder-shade" />
      <div className="grid-lines"><i /><i /><i /><i /></div>

      {exposureState && (
        <div className="exposure-countdown-hud glass" role="timer" aria-label={`長曝光進行中，剩餘 ${Math.ceil(exposureState.remainingSeconds)} 秒`}>
          <div className="countdown-status-row">
            <span className="countdown-badge"><i className="rec-dot" /> 曝光中 EXPOSING</span>
            <span className="countdown-target">/ {shutterLabel(exposureState.durationSeconds)}</span>
          </div>
          <div className="countdown-digits">
            <b>{exposureState.remainingSeconds >= 10 || exposureState.remainingSeconds >= 1 ? exposureState.remainingSeconds.toFixed(1) : exposureState.remainingSeconds.toFixed(2)}</b>
            <small>SEC</small>
          </div>
          <div className="countdown-progress-track">
            <div className="countdown-progress-bar" style={{ width: `${Math.min(100, exposureState.progress * 100)}%` }} />
          </div>
          <div className="countdown-params-row">
            <span>{focal} mm</span>
            <span>F{effective.aperture}</span>
            <span>ISO {effective.iso}</span>
            {exposureState.trajectory.length > 2 && <span className="countdown-motion-tag">✦ 運鏡光軌記錄中</span>}
          </div>
        </div>
      )}

      {started && !libraryOpen && !exposureState && (
        <div className={`af-frame af-size-${afFrameSize} ${isSharp ? "sharp" : ""} ${aiming ? "aiming" : ""}`} aria-hidden="true">
          <i /><i /><i /><i />
          <em>{formatFocusDistance(focusM)}</em>
        </div>
      )}
      <div className="flash" />
    </div>

    {started && <div className="hud">
      <header className="hud-top">
        <div className="hud-top-left hud-fade">
          <div className="scene-row">
            <div className="scene-identity">
              <p>{scene.eyebrow}</p>
              <h1>{scene.title}</h1>
            </div>
            {started && (
              <div className={`card-gauge ${cardFull ? "full" : cardRemaining <= CARD_CAPACITY * 0.1 ? "low" : ""}`} role="meter" aria-valuemin={0} aria-valuemax={CARD_CAPACITY} aria-valuenow={Math.max(0, cardRemaining)} aria-label={cardFull ? "記憶卡已滿，無法拍攝" : `記憶卡剩餘 ${cardRemaining} 張`}>
                <span className="card-gauge-slot" aria-hidden="true"><i /><i /><i /></span>
                <b>{cardFull ? "FULL" : cardRemaining}</b>
              </div>
            )}
          </div>
          <div className="hud-quick-modes">
            <div className="mode-strip mode-picker-wrap">
              <button
                type="button"
                className={`mode-icon-trigger ${modeMenuOpen ? "active" : ""}`}
                onClick={e => {
                  e.stopPropagation();
                  setModeMenuOpen(v => !v);
                  setDriveMenuOpen(false);
                }}
                title={`拍攝模式：${MODES.find(m => m.key === mode)?.label}（${MODES.find(m => m.key === mode)?.name}）`}
                aria-label={`拍攝模式：${mode}`}
                aria-expanded={modeMenuOpen}
                aria-haspopup="menu"
              >
                <span className="mode-glyph">{mode}</span>
              </button>

              {modeMenuOpen && (
                <div className="mode-popover glass" role="menu" aria-label="選擇拍攝模式">
                  {MODES.map(item => (
                    <button
                      key={item.key}
                      type="button"
                      role="menuitemradio"
                      aria-checked={mode === item.key}
                      onClick={e => {
                        e.stopPropagation();
                        setMode(item.key);
                        setActiveControl(null);
                        setModeMenuOpen(false);
                      }}
                      className={`mode-popover-item ${mode === item.key ? "active" : ""}`}
                      title={`${item.label}（${item.name}）`}
                    >
                      <span className="mode-glyph">{item.key}</span>
                      <small className="popover-badge">{item.name}</small>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="drive-strip drive-picker-wrap">
              <button
                type="button"
                className={`drive-icon-trigger ${driveMenuOpen ? "active" : ""}`}
                onClick={e => {
                  e.stopPropagation();
                  setDriveMenuOpen(v => !v);
                  setModeMenuOpen(false);
                }}
                title={`過片模式：${DRIVE_MODES.find(d => d.key === driveMode)?.title}`}
                aria-label={`過片模式：${driveMode}`}
                aria-expanded={driveMenuOpen}
                aria-haspopup="menu"
              >
                <span className="drive-icon-wrap" aria-hidden="true"><DriveIcon drive={driveMode} /></span>
              </button>

              {driveMenuOpen && (
                <div className="drive-popover glass" role="menu" aria-label="選擇過片模式">
                  {DRIVE_MODES.map(item => (
                    <button
                      key={item.key}
                      type="button"
                      role="menuitemradio"
                      aria-checked={driveMode === item.key}
                      onClick={e => {
                        e.stopPropagation();
                        setDriveMode(item.key);
                        setDriveMenuOpen(false);
                      }}
                      className={`drive-popover-item ${driveMode === item.key ? "active" : ""}`}
                      title={`${item.title}：${item.desc}`}
                    >
                      <span className="drive-icon-wrap" aria-hidden="true"><DriveIcon drive={item.key} /></span>
                      <small className="popover-badge">{item.tag}</small>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          {started && (driveMode !== "single" || bufferCount > 0) && (
            <div className={`buffer-gauge ${bufferCount > 0 ? "active" : ""} ${bufferCount >= MAX_BUFFER ? "full" : ""}`} role="meter" aria-valuemin={0} aria-valuemax={MAX_BUFFER} aria-valuenow={bufferCount} aria-label={`緩衝記憶體：${bufferCount} / ${MAX_BUFFER} 張`}>
              <b>{MAX_BUFFER - bufferCount}</b>
              <span className="buffer-segments" aria-hidden="true">
                {BUFFER_SEGMENT_INDICES.map(index => (
                  <i key={index} className={bufferCount / MAX_BUFFER > index / BUFFER_SEGMENTS ? "lit" : ""} />
                ))}
              </span>
              <small>{bufferCount >= MAX_BUFFER ? "BUSY" : "BUFFER"}</small>
            </div>
          )}
        </div>
        <div className="hud-top-mid hud-fade">
          <div className="focal-scale" aria-label="焦段刻度，使用滾輪調整">
            <div className="scale-heading">
              <b>{focal} mm</b>
              <small>{lens.category === "prime" ? "定焦鏡 · " : ""}視角 {horizontalFieldOfView(focal).toFixed(1)}°</small>
            </div>
            <div className="scale-track">
              {lens.focals.map((f, i) => {
                const percent = lens.focals.length <= 1 ? 50 : (i / (lens.focals.length - 1)) * 74 + 13;
                return (
                  <button
                    type="button"
                    key={f}
                    className={f === focal ? "active" : ""}
                    style={{ left: `${percent}%` }}
                    onClick={() => setFocal(f)}
                  >
                    <i />{f} mm{lens.category === "prime" ? " (定焦)" : ""}
                  </button>
                );
              })}
              <input
                aria-label="調整焦段"
                type="range"
                min="0"
                max={Math.max(1, lens.focals.length - 1)}
                step="1"
                disabled={lens.focals.length <= 1}
                value={Math.max(0, lens.focals.indexOf(focal))}
                onChange={e => setFocal(lens.focals[Number(e.target.value)])}
              />
              <em style={{ left: `${lens.focals.length <= 1 ? 50 : (Math.max(0, lens.focals.indexOf(focal)) / (lens.focals.length - 1)) * 74 + 13}%` }} />
            </div>
          </div>
        </div>
        <div className="hud-top-right">
          <div className="hud-actions">
            <button className="icon-button" type="button" aria-label="返回主頁面" onClick={() => { if (document.pointerLockElement) document.exitPointerLock(); setLibraryOpen(false); setStarted(false); }}><span aria-hidden="true">⌂</span></button>
            <button className="icon-button" type="button" aria-label="相機鏡頭與測光設定" aria-pressed={deckOpen} onClick={() => setDeckOpen(v => !v)}><span aria-hidden="true">☰</span></button>
            <button className="icon-button fullscreen-button" type="button" aria-label={isFs ? "離開全螢幕" : "進入全螢幕"} aria-pressed={isFs} onClick={toggleFullscreen}><span aria-hidden="true">{isFs ? "↙" : "⛶"}</span></button>
          </div>
        </div>
      </header>

      <aside className="param-deck glass" aria-label="相機鏡頭與測光設定">
        <div className="deck-head">
          <div className="deck-title-group">
            <span>⚙ 相機設定、鏡頭與過片模式</span>
            <b>SETTINGS & DRIVE</b>
          </div>
          <button type="button" className="deck-close-btn" aria-label="關閉面板 P" title="關閉設定面板 (P)" onClick={() => setDeckOpen(false)}>✕</button>
        </div>
        <div className="deck-body">
          <div className="deck-grid compact-deck">
            <section className="drive-section">
              <div className="section-head-row">
                <span className="section-label">過片模式 (Drive Mode / 連拍)</span>
                <span className="drive-spec-tag">{DRIVE_MODES.find(d => d.key === driveMode)?.title}</span>
              </div>
              <div className="drive-grid">
                {DRIVE_MODES.map(item => (
                  <button
                    key={item.key}
                    type="button"
                    className={`drive-card-btn ${driveMode === item.key ? "active" : ""}`}
                    onClick={() => setDriveMode(item.key)}
                  >
                    <div className="drive-btn-top">
                      <div className="drive-card-title-wrap">
                        <span className="drive-card-icon" aria-hidden="true"><DriveIcon drive={item.key} /></span>
                        <strong>{item.label}</strong>
                      </div>
                      <span className="drive-fps-badge">{item.tag}</span>
                    </div>
                    <small>{item.desc}</small>
                  </button>
                ))}
              </div>
              <p className="drive-buffer-hint">💡 長按快門鍵或空白鍵可進行連續連拍；緩衝記憶體滿載 ({MAX_BUFFER} 張) 時將自動降速寫入。</p>
            </section>

            <section className="lens-section">
              <div className="section-head-row">
                <span className="section-label">相機鏡頭選擇</span>
                <span className="lens-spec-tag">F{lensMaxAperture} 最大光圈 · {lens.category === "prime" ? "定焦" : "變焦"}</span>
              </div>
              <select
                aria-label="更換鏡頭"
                value={lensId}
                onChange={e => {
                  const l = LENSES.find(t => t.id === e.target.value) ?? LENSES[0];
                  setLensId(l.id);
                  setFocal(closest(l.focals, focal));
                }}
              >
                <optgroup label="── 變焦鏡頭群 (ZOOM) ──">
                  {LENSES.filter(l => l.category === "zoom").map(item => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </optgroup>
                <optgroup label="── 定焦鏡頭群 (PRIME) ──">
                  {LENSES.filter(l => l.category === "prime").map(item => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </optgroup>
              </select>
              <div className="lens-spec-info">
                <p><strong>當前視角</strong>：{horizontalFieldOfView(focal).toFixed(1)}° · {lens.category === "prime" ? `固定焦距 ${lens.focals[0]} mm (定焦鏡)` : `支援焦段 ${lens.focals[0]}–${lens.focals[lens.focals.length - 1]} mm (變焦鏡)`} · 光圈 F{lens.maxAperture(focal)}–F{lens.minAperture}</p>
                <p><strong>規格資訊</strong>：濾鏡 {lens.filter} · 重量 {lens.weight} · {lens.tag}</p>
                <p className="lens-desc-text"><strong>光學亮點</strong>：{lens.desc}</p>
              </div>
            </section>

            <section className="exposure-system">
              <div className="metering-row">
                <span className="section-label">測光模式</span>
                <select aria-label="測光模式" value={meteringMode} onChange={e => setMeteringMode(e.target.value as MeteringMode)}>
                  <option value="multi">多重測光 (Multi-Segment)</option>
                  <option value="center">中央偏重 (Center-Weighted)</option>
                  <option value="spot">定點點測光 (Spot)</option>
                  <option value="average">全螢幕平均 (Average)</option>
                  <option value="highlight">高光偏重 (Highlight)</option>
                </select>
              </div>
              <small className="metering-desc">
                {meteringMode === "multi" && "多重測光：分割全景綜合計算標準曝光，適合多數場景"}
                {meteringMode === "center" && "中央偏重：著重畫面中央 60% 區域，兼顧周圍光線"}
                {meteringMode === "spot" && "定點點測光：僅針對畫面焦點約 2-3% 區域進行精確測光"}
                {meteringMode === "average" && "全螢幕平均：整幅取景器均勻計算平均亮度"}
                {meteringMode === "highlight" && "高光偏重：優先偵測並保留亮部細節，防止過曝死白"}
              </small>
            </section>

            <Control
              label={lens.category === "prime" ? "鏡頭焦距 (定焦)" : "鏡頭焦距 (變焦)"}
              value={`${focal} mm`}
              helper={`視角 ${horizontalFieldOfView(focal).toFixed(1)}°${lens.category === "prime" ? " · 固定焦距" : ""}`}
              index={Math.max(0, lens.focals.indexOf(focal))}
              max={Math.max(1, lens.focals.length - 1)}
              disabled={lens.focals.length <= 1}
              onChange={v => setFocal(lens.focals[v])}
            />

            <section className="af-size-setting" aria-labelledby="af-size-label">
              <div>
                <span className="section-label" id="af-size-label">AF 對焦區域 (Spot 對焦點尺寸)</span>
                <small>參考旗艦相機點對焦規格 (Spot S / M / L)</small>
              </div>
              <div className="af-size-options" role="group" aria-label="AF 對焦框尺寸">
                {(["small", "medium", "large"] as AfFrameSize[]).map(size => (
                  <button
                    key={size}
                    type="button"
                    className={afFrameSize === size ? "active" : ""}
                    aria-pressed={afFrameSize === size}
                    onClick={() => setAfFrameSize(size)}
                  >
                    {size === "small" ? "點: S (小)" : size === "medium" ? "點: M (中)" : "點: L (大)"}
                  </button>
                ))}
              </div>
            </section>

            <section className="iso-auto-row">
              <div>
                <span className="section-label">ISO AUTO</span>
                <small style={{ color: "#7c817e", fontSize: "10px", display: "block", marginTop: "2px" }}>自動感光度限制 (100–12800)</small>
              </div>
              <button type="button" aria-pressed={usingAutoIso} disabled={mode === "AUTO"} onClick={() => setIsoAuto(v => !v)}>
                {usingAutoIso ? "開啟" : "關閉"}
              </button>
            </section>
          </div>
        </div>
      </aside>

      <footer className="hud-bottom hud-fade">
        {activeControl && <div className="exposure-scale" aria-label={`${activeLabel}刻度，使用滾輪調整，左鍵確認`}>
          <div className="scale-heading"><b>{formatControlValue(activeControl, activeOptions[activeIndex])}</b></div>
          <div className="scale-track">
            {visibleScaleValues.map(item => <span key={item.index} className={item.index === activeIndex ? "active" : ""} style={{ left: `${item.position}%` }}><i />{formatControlValue(activeControl, activeOptions[item.index])}</span>)}
            <input aria-label={`調整${activeLabel}`} type="range" min="0" max={activeOptions.length - 1} step="1" value={activeIndex} onChange={e => setActiveValue(Number(e.target.value))} />
            <em />
          </div>
        </div>}
        <div className="camera-dock">
          <button className="gear-button" type="button" aria-label="相機鏡頭與測光設定" aria-pressed={deckOpen} onClick={() => { if (document.pointerLockElement) document.exitPointerLock(); setActiveControl(null); setDeckOpen(value => !value); }}><span className="gear-icon" aria-hidden="true">⚙</span></button>
          <button
            className="shutter-button"
            type="button"
            aria-label={cardFull ? "記憶卡已滿，無法拍攝" : exposureState ? `曝光中，剩餘 ${exposureState.remainingSeconds.toFixed(1)} 秒` : driveMode === "single" ? "拍攝照片" : `連拍快門 (${DRIVE_MODES.find(d => d.key === driveMode)?.tag})`}
            disabled={Boolean(exposureState) || cardFull}
            onPointerDown={startBurst}
            onPointerUp={stopBurst}
            onPointerLeave={stopBurst}
            onPointerCancel={stopBurst}
          >
            <i />
          </button>
          <div className="dock-readout" role="group" aria-label="曝光控制">
            <button type="button" aria-label={`快門 ${shutterLabel(effective.shutter)}`} disabled={!controlAvailability.shutter} className={activeControl === "shutter" ? "active" : ""} onClick={() => activateControl("shutter")}><b>{shutterLabel(effective.shutter)}</b></button>
            <button type="button" aria-label={`光圈 F${effective.aperture}`} disabled={!controlAvailability.aperture} className={activeControl === "aperture" ? "active" : ""} onClick={() => activateControl("aperture")}><b>F{effective.aperture}</b></button>
            <button type="button" aria-label={`曝光值 ${exposureComp > 0 ? "+" : ""}${exposureComp.toFixed(1)}`} disabled={!controlAvailability.exposure} className={activeControl === "exposure" ? "active" : ""} onClick={() => activateControl("exposure")}><b>{exposureComp > 0 ? "+" : ""}{exposureComp.toFixed(1)}</b></button>
            <button type="button" aria-label={`ISO ${usingAutoIso ? `AUTO ${effective.iso}` : effective.iso}`} disabled={!controlAvailability.iso} className={activeControl === "iso" ? "active" : ""} onClick={() => activateControl("iso")}><b>{usingAutoIso ? `A ${effective.iso}` : effective.iso}</b></button>
          </div>
          <button className="library-button" type="button" aria-label={`開啟相片庫，${shots.length} 張照片`} onPointerEnter={() => void loadPhotoLibrary()} onPointerDown={() => void loadPhotoLibrary()} onFocus={() => void loadPhotoLibrary()} onClick={openLibrary}><span className="photo-icon" aria-hidden="true" /></button>
        </div>
      </footer>
    </div>}

    {!started && <div className="start-screen">
      <div className="start-card">
        <p className="start-eyebrow">PRO CAMERA SIMULATOR · 互動攝影練習場</p>
        <h1 className="start-title">APERTURE<b>WORLD</b></h1>
        <p className="start-lead">十一個場景，一台全片幅相機。選擇訓練場景、轉動曝光三要素，拍出動人照片。</p>
        <div className="start-scene-section">
          <div className="start-scene-header">
            <span>選擇訓練場景</span>
            <b>{String(sceneIndex + 1).padStart(2, "0")} / {String(SCENARIOS.length).padStart(2, "0")} · {scene.title}</b>
          </div>
          <div className="start-scene-grid">
            {SCENARIOS.map((item, idx) => (
              <button
                key={item.id}
                type="button"
                className={`start-scene-card ${idx === sceneIndex ? "active" : ""}`}
                onClick={() => selectScene(idx)}
                style={{ "--card-accent": item.accent } as React.CSSProperties}
              >
                <span className="card-num">{String(idx + 1).padStart(2, "0")}</span>
                <div className="card-info">
                  <p className="card-eyebrow">{item.eyebrow}</p>
                  <strong className="card-title">{item.title}</strong>
                  <small className="card-brief">{item.brief}</small>
                </div>
              </button>
            ))}
          </div>
        </div>
        <div className="start-actions" onPointerEnter={() => { void warmCameraExperience(); }} onPointerDown={() => { void warmCameraExperience(); }} onFocus={() => { void warmCameraExperience(); }}>
          <button className="start-play" type="button" disabled={launching} aria-busy={launching} onClick={() => enterGame(true)}>{launching ? "正在準備相機…" : "進入拍攝 (全螢幕)"}<span aria-hidden="true">⛶</span></button>
          <button className="start-alt" type="button" disabled={launching} onClick={() => enterGame(false)}>直接遊玩</button>
        </div>
        <ul className="start-keys">
          <li><b>滑鼠</b>轉動視角</li>
          <li><b>對焦框</b>固定畫面中央</li>
          <li><b>滾輪</b>變焦</li>
          <li><b>點擊 / 空白鍵</b>快門 (長按連拍)</li>
          <li><b>D</b>過片模式</li>
          <li><b>ESC</b>放開滑鼠</li>
          <li><b>P</b>參數面板</li>
          <li><b>H</b>隱藏介面</li>
          <li><b>F</b>全螢幕</li>
        </ul>
      </div>
    </div>}

    {fullscreenError && (
      <div className="fullscreen-notice" role="status">
        <span aria-hidden="true">⛶</span>
        <b>無法進入真正全螢幕</b>
        <small>{fullscreenError}</small>
        <button type="button" aria-label="關閉全螢幕提示" onClick={() => setFullscreenError(null)}>×</button>
      </div>
    )}

    {libraryOpen && <PhotoLibrary shots={shots} onClose={closeLibrary} onDelete={deletePhoto} onClear={clearLibrary} />}

    {started && <section className="mobile-console" aria-label="手機相機操作台">
      <div className="mobile-drive-strip" role="group" aria-label="手機過片模式">
        {DRIVE_MODES.map(item => (
          <button
            key={item.key}
            type="button"
            className={`mobile-drive-btn ${driveMode === item.key ? "active" : ""}`}
            onClick={() => setDriveMode(item.key)}
            title={item.title}
          >
            <span className="mobile-drive-icon" aria-hidden="true"><DriveIcon drive={item.key} /></span>
            <b>{item.label}</b>
            <small>{item.tag}</small>
          </button>
        ))}
      </div>
      <div className={`mobile-adjuster ${mobileDisabled ? "disabled" : ""}`}>
        <div><strong>{mobileValue}</strong>{mobileDisabled && <small>目前由相機自動設定</small>}</div>
        <input aria-label={`手機調整${mobileControl === "shutter" ? "快門" : mobileControl === "aperture" ? "光圈" : mobileControl === "iso" ? "ISO" : "曝光值"}`} type="range" min="0" max={mobileOptions.length - 1} step="1" value={Math.max(0, mobileOptions.indexOf(mobileRawValue))} disabled={mobileDisabled} onChange={event => setMobileValue(Number(event.target.value))} />
        {mobileControl === "iso" && <button className="mobile-iso-auto" type="button" aria-pressed={usingAutoIso} disabled={mode === "AUTO"} onClick={() => setIsoAuto(value => !value)}>AUTO {usingAutoIso ? "ON" : "OFF"}</button>}
      </div>
      <nav aria-label="手機快速控制">
        {(["shutter", "aperture", "exposure", "iso"] as MobileControl[]).map(item => {
          const label = item === "shutter" ? "快門" : item === "aperture" ? "光圈" : item === "iso" ? "ISO" : "曝光值";
          const value = item === "shutter" ? shutterLabel(effective.shutter) : item === "aperture" ? `F${effective.aperture}` : item === "iso" ? usingAutoIso ? `AUTO ${effective.iso}` : effective.iso : `${exposureComp > 0 ? "+" : ""}${exposureComp.toFixed(1)}`;
          return <button type="button" key={item} disabled={!controlAvailability[item]} className={`mobile-param ${mobileControl === item ? "active" : ""}`} aria-label={`${label} ${value}`} aria-pressed={mobileControl === item} onClick={() => activateControl(item)}><b>{value}</b></button>;
        })}
        <button
          type="button"
          className={`mobile-shutter ${exposureState ? "exposing" : ""} ${isBursting ? "bursting" : ""}`}
          aria-label={cardFull ? "記憶卡已滿，無法拍攝" : exposureState ? `曝光中，剩餘 ${exposureState.remainingSeconds.toFixed(1)} 秒` : driveMode !== "single" ? `連拍快門 (${DRIVE_MODES.find(d => d.key === driveMode)?.tag})` : "拍攝照片"}
          disabled={Boolean(exposureState) || cardFull}
          onPointerDown={startBurst}
          onPointerUp={stopBurst}
          onPointerLeave={stopBurst}
          onPointerCancel={stopBurst}
        >
          <i />
        </button>
        <button type="button" className="mobile-library" aria-label={`開啟相片庫，${shots.length} 張照片`} onPointerEnter={() => void loadPhotoLibrary()} onPointerDown={() => void loadPhotoLibrary()} onFocus={() => void loadPhotoLibrary()} onClick={openLibrary}><span>相片庫</span><b><i className="photo-icon" aria-hidden="true" /></b></button>
      </nav>
    </section>}
  </main>;
}
