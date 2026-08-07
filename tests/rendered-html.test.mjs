import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

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

test("finished product has no disposable starter preview", async () => {
  const [page, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
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
  assert.doesNotMatch(page, /(?:bird|sports|portrait)_subject\.jpg/);
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
