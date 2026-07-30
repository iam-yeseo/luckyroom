import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

test("deployment build contains the protected page and game API", async () => {
  const [page, api] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/game/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /requireChatGPTUser\("\/"\)/);
  assert.match(page, /dynamic = "force-dynamic"/);
  assert.match(api, /export async function GET/);
  assert.match(api, /export async function POST/);
  assert.match(api, /action === "earn"/);
  assert.match(api, /action === "save_luck"/);
  assert.match(api, /action === "paper_pick"/);
  assert.match(api, /action === "trade"/);
});

test("economy UI, new games, and product metadata are present", async () => {
  const [page, layout, css, packageJson] = await Promise.all([
    readFile(new URL("../app/arcade-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /"use client"/);
  assert.match(page, /drawUniqueNumbers/);
  assert.match(page, /운 저장하기/);
  assert.match(page, /추억의 종이뽑기판/);
  assert.match(page, /주식 투자하기/);
  assert.match(page, /\[1000, 2000\]/);
  assert.match(page, /aria-pressed|aria-live/);
  assert.match(layout, /const title = "운빨 실험실/);
  assert.match(layout, /summary_large_image/);
  assert.match(layout, /\/og\.png/);
  assert.match(layout, /<html lang="ko">/);
  assert.match(css, /\.number-grid/);
  assert.match(css, /\.paper-board/);
  assert.match(css, /\.stock-table/);
  assert.match(css, /\.luck-modal/);
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);

  await assert.rejects(access(new URL("../app/_sites-preview/SkeletonPreview.tsx", import.meta.url)));
  await assert.rejects(access(new URL("../app/_sites-preview/preview.css", import.meta.url)));
  assert.ok(projectRoot);
});
