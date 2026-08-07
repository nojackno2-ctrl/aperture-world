"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Mode = "AUTO" | "P" | "S" | "A" | "M";
type FocusMode = "AF-S" | "AF-C" | "MF";
type SceneKey = "landscape" | "bird" | "sports" | "portrait" | "group" | "street" | "night";
type Scenario = { id: SceneKey; eyebrow: string; title: string; brief: string; lesson: string; sceneEv: number; speed: number; distance: number; focal: [number, number]; aperture: [number, number]; minShutter: number; accent: string };
type ShotEffect = { brightness: number; motionBlur: number; depthBlur: number; noise: number; focusOk: boolean; focal: number; panX: number; panY: number; subjectX: number };
type Photo = { id: number; scene: SceneKey; score: number; title: string; settings: string; shot: ShotEffect };
type Result = { score: number; title: string; notes: string[]; shot: ShotEffect; scene: SceneKey };

const SCENARIOS: Scenario[] = [
  { id: "landscape", eyebrow: "01 · 清晨風景", title: "山谷第一道光", brief: "保留天空層次，讓前後景都清楚。", lesson: "縮小光圈能增加景深；腳架可換取較慢快門。", sceneEv: 12.4, speed: 0, distance: 80, focal: [24, 50], aperture: [8, 16], minShutter: 1 / 40, accent: "#f1b45a" },
  { id: "bird", eyebrow: "02 · 飛鳥", title: "掠過濕地的蒼鷺", brief: "凝結翅膀，並以長焦填滿畫面。", lesson: "高速移動主體需要更快快門，通常也要提高 ISO。", sceneEv: 13.2, speed: 9, distance: 26, focal: [200, 300], aperture: [4, 8], minShutter: 1 / 1000, accent: "#9bc9d8" },
  { id: "sports", eyebrow: "03 · 運動賽事", title: "終點前的衝刺", brief: "抓住運動員騰空的決定性瞬間。", lesson: "快門先決很適合節奏快速、光線會變的場合。", sceneEv: 11.8, speed: 7, distance: 18, focal: [85, 200], aperture: [2.8, 8], minShutter: 1 / 800, accent: "#ef755e" },
  { id: "portrait", eyebrow: "04 · 人像", title: "窗邊自然光", brief: "眼睛銳利，背景柔和，不要讓膚色過曝。", lesson: "大光圈與較長焦距能分離人物和背景。", sceneEv: 9.8, speed: .25, distance: 3, focal: [50, 100], aperture: [1.4, 3.2], minShutter: 1 / 125, accent: "#d9a48f" },
  { id: "group", eyebrow: "05 · 合影", title: "朋友們的紀念照", brief: "每一排人的臉都要在景深範圍內。", lesson: "多人合影不要一味開大光圈；稍微縮小更安全。", sceneEv: 12.8, speed: .3, distance: 5, focal: [35, 70], aperture: [5.6, 11], minShutter: 1 / 160, accent: "#c7b573" },
  { id: "street", eyebrow: "06 · 白天街拍", title: "轉角的一秒", brief: "快速反應，兼顧移動人物與環境敘事。", lesson: "程式自動曝光適合光線穩定、瞬間難預測的街頭。", sceneEv: 14.2, speed: 2.5, distance: 9, focal: [28, 50], aperture: [4, 11], minShutter: 1 / 320, accent: "#5d95d2" },
  { id: "night", eyebrow: "07 · 夜間", title: "霓虹雨夜", brief: "留住環境光，同時避免人物晃動。", lesson: "夜間是光圈、快門與 ISO 的三方取捨。", sceneEv: 5.8, speed: 1.2, distance: 7, focal: [35, 85], aperture: [1.4, 2.8], minShutter: 1 / 125, accent: "#a77cf3" },
];
const APERTURES = [1.4, 2, 2.8, 4, 5.6, 8, 11, 16];
const SHUTTERS = [1 / 2000, 1 / 1000, 1 / 500, 1 / 250, 1 / 125, 1 / 60, 1 / 30, 1 / 15, 1 / 8, 1 / 4, 1 / 2, 1];
const ISOS = [100, 200, 400, 800, 1600, 3200, 6400];
const LENSES = [
  { id: "standard", name: "FE 24–70 mm F2.8", focals: [24, 35, 50, 70] },
  { id: "portrait", name: "FE 50–85 mm F1.8", focals: [50, 85] },
  { id: "tele", name: "FE 70–200 mm F2.8", focals: [70, 100, 135, 200] },
  { id: "wildlife", name: "FE 200–600 mm F5.6", focals: [200, 300, 400, 600] },
];
const MODES: { key: Mode; label: string; name: string }[] = [
  { key: "AUTO", label: "AUTO", name: "全自動" }, { key: "P", label: "P", name: "程式自動曝光" }, { key: "S", label: "S", name: "快門先決" }, { key: "A", label: "A", name: "光圈先決" }, { key: "M", label: "M", name: "手動曝光" },
];
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const closest = (values: number[], target: number) => values.reduce((best, value) => Math.abs(value - target) < Math.abs(best - target) ? value : best);
const shutterLabel = (value: number) => value >= 1 ? `${value}″` : `1/${Math.round(1 / value)}`;

function SceneArtwork({ scene, focal, blur, depthBlur, noise, exposure, focusOk, panX = 0, panY = 0, subjectX = 0 }: { scene: SceneKey; focal: number; blur: number; depthBlur: number; noise: number; exposure: number; focusOk: boolean; panX?: number; panY?: number; subjectX?: number }) {
  return <div className={`scene-art scene-${scene}`} style={{ filter: `brightness(${exposure})`, "--zoom": Math.max(1.08, focal / 24), "--motion": `${blur}px`, "--depth": `${depthBlur}px`, "--noise": noise, "--pan-x": `${panX}%`, "--pan-y": `${panY}%`, "--subject-x": `${subjectX}%` } as React.CSSProperties}>
    <div className="sky"><i className="sun" /><i className="moon" /><i className="cloud cloud-a" /><i className="cloud cloud-b" /></div>
    <div className="far-layer"><i className="mountain mountain-a" /><i className="mountain mountain-b" /><i className="city" /></div>
    <div className="ground-layer"><i className="track" /><i className="road" /><i className="water" /></div>
    <div className="subject-layer" style={{ filter: `${focusOk ? "" : "blur(5px)"} blur(var(--motion))` }}>
      {scene === "bird" && <div className="bird"><i /><b /></div>}
      {scene === "sports" && <div className="runner"><i className="head" /><i className="torso" /><i className="limb arm-one" /><i className="limb arm-two" /><i className="limb leg-one" /><i className="limb leg-two" /></div>}
      {scene === "portrait" && <div className="person"><i className="person-head" /><i className="person-body" /></div>}
      {scene === "group" && <div className="group-people">{[0, 1, 2, 3, 4].map((item) => <i key={item} className={`group-person p${item}`} />)}</div>}
      {scene === "street" && <div className="street-person"><i /><b /></div>}
      {scene === "night" && <div className="night-person"><i /><b /></div>}
    </div>
    <div className="mid-layer"><i className="mid-object" /></div>
    <div className="foreground-layer"><i className="near-object" /><i className="grass" /><i className="railing" /><i className="window-edge" /></div><div className="noise" />
  </div>;
}

export default function Home() {
  const [sceneIndex, setSceneIndex] = useState(0), [mode, setMode] = useState<Mode>("A"), [aperture, setAperture] = useState(5.6), [shutter, setShutter] = useState(1 / 125), [iso, setIso] = useState(200), [focal, setFocal] = useState(50), [focus, setFocus] = useState(10), [focusMode, setFocusMode] = useState<FocusMode>("AF-S"), [captured, setCaptured] = useState(false), [lensId, setLensId] = useState("standard"), [pan, setPan] = useState({ x: 0, y: 0 }), [subjectX, setSubjectX] = useState(0);
  const dragRef = useRef<{ startX: number; startY: number; panX: number; panY: number; moved: boolean } | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [shots, setShots] = useState<Photo[]>([]);
  const scene = SCENARIOS[sceneIndex];
  const lens = LENSES.find(item => item.id === lensId) ?? LENSES[0];
  const effective = useMemo(() => {
    let a = aperture, s = shutter, i = iso;
    if (mode === "AUTO") { a = scene.id === "landscape" || scene.id === "group" ? 8 : scene.id === "portrait" || scene.id === "night" ? 2 : 4; s = closest(SHUTTERS, scene.minShutter); i = closest(ISOS, clamp(100 * Math.pow(2, Math.log2((a ** 2) / s) - scene.sceneEv), 100, 6400)); }
    else if (mode === "P") { a = scene.id === "landscape" ? 8 : 5.6; s = closest(SHUTTERS, (a ** 2) / Math.pow(2, scene.sceneEv + Math.log2(i / 100))); }
    else if (mode === "S") a = closest(APERTURES, clamp(Math.sqrt(s * Math.pow(2, scene.sceneEv + Math.log2(i / 100))), 1.4, 16));
    else if (mode === "A") s = closest(SHUTTERS, (a ** 2) / Math.pow(2, scene.sceneEv + Math.log2(i / 100)));
    return { aperture: a, shutter: s, iso: i };
  }, [aperture, shutter, iso, mode, scene]);
  const exposureDelta = scene.sceneEv - (Math.log2((effective.aperture ** 2) / effective.shutter) - Math.log2(effective.iso / 100));
  const cameraBlur = Math.max(0, effective.shutter * focal - 1) * 1.25, subjectBlur = Math.max(0, scene.speed * effective.shutter * 16), motionBlur = clamp(cameraBlur + subjectBlur, 0, 12);
  const actualFocus = focusMode === "MF" ? focus : scene.distance;
  const focusTolerance = Math.max(.7, (effective.aperture / 4) * (50 / focal) * scene.distance * .26), focusOk = Math.abs(actualFocus - scene.distance) <= focusTolerance;
  const depthBlur = clamp((4 / effective.aperture) * (focal / 50) * 2.2, 0, 9), noise = clamp((Math.log2(effective.iso / 100) / 6) * .42, 0, .48), brightness = clamp(Math.pow(2, exposureDelta * .42), .32, 2.1);

  useEffect(() => { setFocus(scene.distance); setResult(null); }, [scene]);
  useEffect(() => {
    const start = performance.now();
    const timer = window.setInterval(() => { const pace = scene.id === "bird" ? 1.35 : scene.id === "sports" ? 1.05 : .55; setSubjectX(Math.sin(((performance.now() - start) / 1000) * pace) * 24); }, 33);
    return () => window.clearInterval(timer);
  }, [scene.id]);
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
    const shot = { brightness, motionBlur, depthBlur, noise, focusOk, focal, panX: pan.x, panY: pan.y, subjectX };
    const settings = `${lens.name} · ${focal} mm · ${shutterLabel(effective.shutter)} · F${effective.aperture} · ISO ${effective.iso}`;
    setResult({ score, title, notes: notes.slice(0, 2), shot, scene: scene.id }); setShots(current => [{ id: Date.now(), scene: scene.id, score, title, settings, shot }, ...current].slice(0, 12)); setCaptured(true); window.setTimeout(() => setCaptured(false), 180);
  }, [actualFocus, brightness, cameraBlur, depthBlur, effective.aperture, effective.iso, effective.shutter, exposureDelta, focal, focusMode, focusOk, lens.name, motionBlur, noise, pan.x, pan.y, scene, subjectBlur, subjectX]);
  useEffect(() => { const onKey = (e: KeyboardEvent) => { if (e.code === "Space" && !(e.target instanceof HTMLInputElement)) { e.preventDefault(); capture(); } }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [capture]);
  const chooseScene = (index: number) => { setSceneIndex(index); setPan({ x: 0, y: 0 }); setResult(null); };
  const startPan = (event: React.PointerEvent<HTMLDivElement>) => { if (result) return; event.currentTarget.setPointerCapture(event.pointerId); dragRef.current = { startX: event.clientX, startY: event.clientY, panX: pan.x, panY: pan.y, moved: false }; };
  const movePan = (event: React.PointerEvent<HTMLDivElement>) => { const drag = dragRef.current; if (!drag) return; const dx = event.clientX - drag.startX, dy = event.clientY - drag.startY; if (Math.abs(dx) + Math.abs(dy) > 5) drag.moved = true; setPan({ x: clamp(drag.panX + dx / 12, -20, 20), y: clamp(drag.panY + dy / 12, -14, 14) }); };
  const finishPan = () => { const drag = dragRef.current; dragRef.current = null; if (!drag?.moved) result ? setResult(null) : capture(); };

  return <main className="game-shell" style={{ "--accent": scene.accent } as React.CSSProperties}>
    <header className="topbar"><div className="brand"><span className="brand-mark">AW</span><span><b>APERTURE WORLD</b><small>互動攝影學院</small></span></div><div className="progress-wrap" aria-label={`課程進度 ${sceneIndex + 1} / ${SCENARIOS.length}`}><span>訓練路線</span><div className="progress-track"><i style={{ width: `${((sceneIndex + 1) / SCENARIOS.length) * 100}%` }} /></div><b>{String(sceneIndex + 1).padStart(2, "0")} / 07</b></div><button className="sound-button" aria-label="聲音設定">聲音 <span>●</span></button></header>
    <section className="workspace">
      <aside className="mission-rail" aria-label="拍攝場景"><p className="rail-label">場景任務</p><nav>{SCENARIOS.map((item, index) => <button key={item.id} onClick={() => chooseScene(index)} className={index === sceneIndex ? "active" : ""} aria-label={item.title}><span>{String(index + 1).padStart(2, "0")}</span><i className={`scene-icon icon-${item.id}`} /></button>)}</nav><div className="rail-line" /><p className="shortcut">空白鍵<br />快門</p></aside>
      <section className="main-stage"><div className="mission-copy"><div><p>{scene.eyebrow}</p><h1>{scene.title}</h1></div><div className="brief"><span>任務</span><p>{scene.brief}</p></div></div>
        <div className={`camera-body ${captured ? "captured" : ""}`}><div className="camera-top"><span>α TRAINER</span><div className="hotshoe" /><span>FULL FRAME</span></div><div className="viewfinder" role="button" tabIndex={0} aria-label="取景器，拖曳移動鏡頭，點擊拍攝，滾輪變焦" onPointerDown={startPan} onPointerMove={movePan} onPointerUp={finishPan} onPointerCancel={() => { dragRef.current = null; }} onWheel={event => { event.preventDefault(); const index = lens.focals.indexOf(focal); const next = clamp(index + (event.deltaY > 0 ? -1 : 1), 0, lens.focals.length - 1); setFocal(lens.focals[next]); }}><SceneArtwork scene={scene.id} focal={focal} blur={0} depthBlur={0} noise={0} exposure={1} focusOk={true} panX={pan.x} panY={pan.y} subjectX={subjectX} /><div className="viewfinder-shade" /><div className="grid-lines"><i /><i /><i /><i /></div><div className={`focus-box ${focusOk ? "locked" : ""}`}><i /><i /><i /><i /></div><div className="vf-top"><span>RAW　X.FINE</span><span>{focusMode}　{mode}</span><span>▮▮▮　{shots.length ? `${shots.length}` : "—"}</span></div><div className="vf-bottom"><span><small>快門</small>{shutterLabel(effective.shutter)}</span><span><small>光圈</small>F{effective.aperture}</span><span><small>ISO</small>{effective.iso}</span><div className="meter"><small>−2　−1　0　+1　+2</small><i style={{ left: `${clamp((exposureDelta + 2) / 4, 0, 1) * 100}%` }} /></div></div><div className="focal-badge">{focal} mm　{focusMode}</div><div className="wheel-hint">拖曳取景 · 滾輪變焦 · 單擊快門</div><div className="flash" />{result && <div className="playback"><SceneArtwork scene={result.scene} {...result.shot} blur={result.shot.motionBlur} exposure={result.shot.brightness} /><div className="playback-top"><span>100-000{shots.length}</span><b>照片檢視</b><span>RAW</span></div><button onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); setResult(null); }}>返回即時取景</button></div>}</div><div className="camera-grip"><span /><span /><span /></div></div>
        <div className="under-camera"><div className="status-readout"><span className={Math.abs(exposureDelta) <= .65 ? "good" : "warn"}>{Math.abs(exposureDelta) <= .65 ? "曝光合適" : exposureDelta > 0 ? `過曝 +${exposureDelta.toFixed(1)} EV` : `欠曝 ${exposureDelta.toFixed(1)} EV`}</span><span className={motionBlur < 2 ? "good" : "warn"}>{motionBlur < 2 ? "動態清晰" : "偵測到動態模糊"}</span><span className={focusOk ? "good" : "warn"}>{focusOk ? "焦點鎖定" : "主體失焦"}</span></div><button className="shutter-button" onClick={capture}><i /><span>按下快門</span><small>SPACE</small></button><div className="lesson"><span>教練筆記</span><p>{scene.lesson}</p></div></div>
      </section>
      <aside className="control-panel"><div className="panel-heading"><span>相機設置</span><b>LIVE VIEW</b></div><section className="mode-section"><label>拍攝模式</label><div className="mode-dial">{MODES.map(item => <button key={item.key} onClick={() => setMode(item.key)} className={mode === item.key ? "active" : ""} title={item.name}><b>{item.label}</b><span>{item.name}</span></button>)}</div></section>
        <section className="lens-section"><div><label>鏡頭</label><small>E 接環</small></div><select aria-label="更換鏡頭" value={lensId} onChange={event => { const next = LENSES.find(item => item.id === event.target.value) ?? LENSES[0]; setLensId(next.id); setFocal(next.focals[0]); }} >{LENSES.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><p>{lens.focals[0]}–{lens.focals[lens.focals.length - 1]} mm · 使用取景器滾輪縮放</p></section>
        <section className="focus-mode-section"><div><label>對焦模式</label><small>{focusMode === "AF-C" ? "持續追蹤移動主體" : focusMode === "AF-S" ? "半按快門鎖定主體" : "手動指定對焦距離"}</small></div><div>{(["AF-S", "AF-C", "MF"] as FocusMode[]).map(item => <button key={item} className={focusMode === item ? "active" : ""} onClick={() => setFocusMode(item)}>{item}</button>)}</div></section>
        <Control label="快門速度" value={shutterLabel(effective.shutter)} helper={mode === "AUTO" || mode === "P" || mode === "A" ? "由相機計算" : "控制動態模糊"} disabled={mode === "AUTO" || mode === "P" || mode === "A"} index={SHUTTERS.indexOf(shutter)} max={SHUTTERS.length - 1} onChange={v => setShutter(SHUTTERS[v])} />
        <Control label="光圈" value={`F${effective.aperture}`} helper={mode === "AUTO" || mode === "P" || mode === "S" ? "由相機計算" : "控制景深"} disabled={mode === "AUTO" || mode === "P" || mode === "S"} index={APERTURES.indexOf(aperture)} max={APERTURES.length - 1} onChange={v => setAperture(APERTURES[v])} />
        <Control label="ISO 感光度" value={`${effective.iso}`} helper={effective.iso >= 3200 ? "高感光度會增加雜訊" : "亮度與畫質取捨"} disabled={mode === "AUTO"} index={ISOS.indexOf(iso)} max={ISOS.length - 1} onChange={v => setIso(ISOS[v])} />
        <Control label="焦距" value={`${focal} mm`} helper="改變視角與壓縮感" index={lens.focals.indexOf(focal)} max={lens.focals.length - 1} onChange={v => setFocal(lens.focals[v])} />
        <Control label="對焦距離" value={focusMode === "MF" ? (focus >= 80 ? "∞" : `${focus.toFixed(1)} m`) : `${scene.distance} m`} helper={focusMode === "MF" ? `主體約 ${scene.distance} m` : "自動對焦已鎖定主體"} disabled={focusMode !== "MF"} index={Math.round(clamp((Math.log10(focus + 1) / Math.log10(101)) * 100, 0, 100))} max={100} onChange={v => setFocus(Math.pow(101, v / 100) - 1)} />
        <div className="exposure-triangle"><div><span style={{ opacity: clamp(.25 + effective.shutter * 5, .25, 1) }}>◒</span><small>時間</small></div><div><span style={{ transform: `scale(${clamp(1.25 - effective.aperture / 20, .45, 1.15)})` }}>◉</span><small>景深</small></div><div><span style={{ opacity: clamp(.25 + noise, .25, 1) }}>░</span><small>雜訊</small></div></div>
        <section className="photo-library"><div className="library-heading"><label>圖片庫</label><span>{shots.length} / 12</span></div>{shots.length === 0 ? <p>拍下第一張照片後，作品會保存在這裡。</p> : <div className="photo-strip">{shots.filter(photo => photo.shot).map(photo => <button key={photo.id} title={photo.settings} onClick={() => setResult({ score: photo.score, title: "圖片庫回放", notes: [photo.settings], shot: photo.shot, scene: photo.scene })}><span className="photo-thumb"><SceneArtwork scene={photo.scene} {...photo.shot} blur={photo.shot.motionBlur} exposure={photo.shot.brightness} /></span><b>{photo.score}</b></button>)}</div>}</section>
      </aside>
    </section>
    <section className={`result-drawer ${result ? "open" : ""}`} aria-live="polite">{result && <><div className="score-ring" style={{ "--score": `${result.score * 3.6}deg` } as React.CSSProperties}><span>{result.score}</span><small>分</small></div><div><p>{result.title}</p><h2>{SCENARIOS.find(item => item.id === result.scene)?.title}</h2><ul>{result.notes.map(note => <li key={note}>{note}</li>)}</ul></div><button onClick={() => setResult(null)}>繼續調整 ×</button><button className="next-button" onClick={() => chooseScene((sceneIndex + 1) % SCENARIOS.length)}>下一個場景 →</button></>}</section>
  </main>;
}

function Control({ label, value, helper, index, max, disabled = false, onChange }: { label: string; value: string; helper: string; index: number; max: number; disabled?: boolean; onChange: (value: number) => void }) {
  return <section className={`control ${disabled ? "disabled" : ""}`}><div className="control-label"><label>{label}</label><strong>{value}</strong></div><input aria-label={label} type="range" min="0" max={max} step="1" value={Math.max(0, index)} disabled={disabled} onChange={e => onChange(Number(e.target.value))} /><div className="ticks"><i /><i /><i /><i /><i /></div><small>{helper}</small></section>;
}
