import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the complete Korean luck arcade", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html[^>]*lang="ko"/i);
  assert.match(html, /<title>운빨 실험실 \| 오늘, 확률이 내 편일까\?<\/title>/i);
  assert.match(html, /오늘, 확률이/);
  assert.match(html, /로또 맞히기/);
  assert.match(html, /즉석김밥1000/);
  assert.match(html, /실제 복권 구매/);
  assert.match(html, /aria-controls="lotto-panel"/);
  assert.match(html, /aria-controls="gimbap-panel"/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("starter preview is removed and product metadata is present", async () => {
  const [page, layout, css, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /"use client"/);
  assert.match(page, /drawUniqueNumbers/);
  assert.match(page, /generateScratchTicket/);
  assert.match(page, /ScratchSurface/);
  assert.match(page, /prefers-reduced-motion|aria-pressed|aria-live/);
  assert.match(layout, /title: "운빨 실험실/);
  assert.match(layout, /<html lang="ko">/);
  assert.match(css, /\.number-grid/);
  assert.match(css, /\.scratch-canvas/);
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);

  await assert.rejects(access(new URL("../app/_sites-preview/SkeletonPreview.tsx", import.meta.url)));
  await assert.rejects(access(new URL("../app/_sites-preview/preview.css", import.meta.url)));
  assert.ok(projectRoot);
});
