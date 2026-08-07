import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { motionPose } from "../app/motion.mjs";

const templateRoot = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request("http://localhost/", { headers: { accept: "text/html" } }), { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } }, { waitUntil() {}, passThroughOnException() {} });
}

test("server-renders the Aperture World game", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>Aperture World｜互動攝影練習場<\/title>/i);
  assert.match(html, /APERTURE WORLD/);
  assert.match(html, /山谷第一道光/);
  assert.match(html, /α1 曝光設置/);
  assert.match(html, /圖片庫/);
  assert.match(html, /ILCE-1/);
  assert.match(html, /快門類型/);
  assert.match(html, /測光模式/);
  assert.doesNotMatch(html, /codex-preview|SkeletonPreview|react-loading-skeleton/i);
});

test("finished product has mobile controls, fullscreen, realistic motion paths, and no disposable starter preview", async () => {
  const [page, styles, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  assert.match(page, /AF-S/);
  assert.match(page, /AF-C/);
  assert.match(page, /photo-library/);
  assert.match(page, /onPointerMove/);
  assert.match(page, /onWheel/);
  assert.match(page, /1 \/ 32000/);
  assert.match(page, /102400/);
  assert.match(page, /曝光補償/);
  assert.match(page, /MeteringMode/);
  assert.match(page, /ShutterType/);
  assert.match(page, /Math\.log2\(Math\.max\(24, focal\) \/ 24\)/);
  assert.match(page, /street_subject\.png/);
  assert.match(page, /night_subject\.png/);
  assert.match(page, /className="mobile-console"/);
  assert.match(page, /requestFullscreen/);
  assert.match(page, /fullscreenchange/);
  assert.match(page, /requestAnimationFrame/);
  assert.match(page, /motionPose\(scene\.id/);
  assert.match(page, /subjectY: subjectPose\.y/);
  assert.match(page, /subjectRotate: subjectPose\.rotate/);
  assert.match(page, /subjectScale: subjectPose\.scale/);
  assert.doesNotMatch(page, /(?:bird|sports|portrait)_subject\.jpg/);
  assert.match(styles, /@media\(max-width:720px\).*\.mobile-console\{display:block/s);
  assert.match(styles, /html:fullscreen \.game-shell/);
  assert.match(styles, /top:calc\([^)]*var\(--subject-y\)/);
  assert.match(layout, /og\.png/);
  assert.match(packageJson, /"name": "aperture-world"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await Promise.all([
    "bird_subject.png",
    "sports_subject.png",
    "portrait_subject.png",
    "street_subject.png",
    "night_subject.png",
    "sports_bg_clean.png",
    "portrait_bg_clean.png",
    "street_bg_clean.png",
    "night_bg_clean.png",
  ].map(file => access(new URL(`public/scenes/${file}`, templateRoot))));
  await assert.rejects(access(new URL("../app/_sites-preview", templateRoot)));
});

test("moving scenes follow distinct bounded multi-axis paths", () => {
  const durations = { bird: 7.2, sports: 5.4, street: 8.8, night: 10.5 };
  const directions = { bird: 1, sports: 1, street: 1, night: -1 };
  for (const [scene, duration] of Object.entries(durations)) {
    const poses = Array.from({ length: 101 }, (_, index) => motionPose(scene, duration * index / 101));
    const xs = poses.map(pose => pose.x), ys = poses.map(pose => pose.y), rotations = poses.map(pose => pose.rotate), scales = poses.map(pose => pose.scale);
    assert.ok(Math.max(...xs) - Math.min(...xs) > 40, `${scene} should cross a meaningful horizontal distance`);
    assert.ok(Math.max(...ys) - Math.min(...ys) > 4, `${scene} should also move vertically`);
    assert.ok(Math.max(...rotations) - Math.min(...rotations) > 1, `${scene} should change body angle`);
    assert.ok(Math.max(...scales) - Math.min(...scales) > .08, `${scene} should change perspective scale`);
    assert.equal(Math.sign(poses.at(-1).x - poses[0].x), directions[scene], `${scene} should travel in its intended direction`);
    assert.ok(Math.min(...xs) >= -35 && Math.max(...xs) <= 35, `${scene} should remain within the safe horizontal route`);
    assert.ok(Math.min(...ys) >= -12 && Math.max(...ys) <= 6, `${scene} should remain within the safe vertical route`);
  }
  for (const scene of ["landscape", "portrait", "group"]) assert.deepEqual(motionPose(scene, 4), { x: 0, y: 0, rotate: 0, scale: 1 });
});
