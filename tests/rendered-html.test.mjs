import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

test("deployment build contains the public guest page and game API", async () => {
  const [page, api, publicUser] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/game/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/public-user.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /<ArcadeClient \/>/);
  assert.doesNotMatch(page, /requireChatGPTUser/);
  assert.match(page, /dynamic = "force-dynamic"/);
  assert.match(api, /export async function GET/);
  assert.match(api, /export async function POST/);
  assert.match(api, /getPublicUser/);
  assert.match(api, /action === "earn"/);
  assert.match(api, /action === "save_luck"/);
  assert.match(api, /action === "paper_pick"/);
  assert.match(api, /action === "horse_race"/);
  assert.match(api, /action === "rps_start"/);
  assert.match(api, /action === "rps_play"/);
  assert.match(api, /action === "timing_start"/);
  assert.match(api, /action === "timing_stop"/);
  assert.match(api, /action === "trade"/);
  assert.match(api, /CREATE TABLE IF NOT EXISTS rps_matches/);
  assert.match(api, /CREATE TABLE IF NOT EXISTS timing_stats/);
  assert.match(api, /CREATE TABLE IF NOT EXISTS timing_games/);
  assert.match(api, /CREATE TABLE IF NOT EXISTS game_action_receipts/);
  assert.match(api, /evaluateRpsRound/);
  assert.match(api, /advanceRpsScore/);
  assert.match(api, /evaluateTimingAttempt/);
  assert.match(api, /calculateTimingPayout/);
  assert.match(api, /const aiMove = match\.ai_move/);
  assert.match(api, /const nextAiMove = winner \? "" : createRpsMove\(\)/);
  assert.match(
    api,
    /winner === "player" \? match\.player_bet \+ match\.ai_bet : 0/,
  );
  assert.match(
    api,
    /const failureStreak = success \? 0 : timingGame\.failure_count \+ 1/,
  );
  assert.match(api, /status = 'active'/);
  assert.match(api, /duplicate: true/);

  const publicRpsMatch = api.match(
    /function publicRpsMatch\(row: RpsMatchRow\) \{[\s\S]*?\n\}/,
  )?.[0];
  assert.ok(publicRpsMatch);
  assert.doesNotMatch(publicRpsMatch, /aiMove|ai_move/);
  assert.match(publicUser, /luckyroom_session/);
  assert.match(publicUser, /httpOnly: true/);
  assert.match(publicUser, /sameSite: "lax"/);
});

test("economy UI, seven games, and product metadata are present", async () => {
  const [page, layout, css, packageJson, readme] = await Promise.all([
    readFile(new URL("../app/arcade-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../README.md", import.meta.url), "utf8"),
  ]);

  assert.match(page, /"use client"/);
  assert.match(page, /drawUniqueNumbers/);
  assert.match(page, /운 저장하기/);
  assert.match(page, /추억의 종이뽑기판/);
  assert.match(page, /주식 투자하기/);
  assert.match(page, /행운 경마장/);
  assert.match(page, /가위바위보/);
  assert.match(page, /타이밍의 신/);
  assert.match(page, /id="rps-panel"/);
  assert.match(page, /id="timing-panel"/);
  assert.match(page, /3판 2선승/);
  assert.match(page, /5판 3선승/);
  assert.match(page, /7판 5선승/);
  assert.match(page, /type RpsRevealPhase[\s\S]*?"revealed"/);
  assert.match(page, /rps-machine-lamps/);
  assert.match(page, /rps-machine-lamp/);
  assert.match(page, /rps-next-round-button/);
  assert.match(page, /createRpsRevealSteps/);
  assert.match(page, /prefers-reduced-motion: reduce/);
  assert.match(page, /type TimingPhase[\s\S]*?"countdown"/);
  assert.match(page, /timingCountdownDeadlineRef/);
  assert.match(page, /timing-start-lights/);
  assert.match(page, /timing-start-light/);
  assert.match(page, /신호가 하나씩 꺼집니다/);
  assert.match(page, /const TIMING_TARGETS = \[3, 5, 7\.77, 10, 10\.01\]/);
  assert.match(page, /performance\.now\(\)/);
  assert.match(page, /requestAnimationFrame/);
  assert.match(page, /Math\.floor\(\(performance\.now\(\) - startedAt\) \/ 10\)/);
  assert.match(page, /AI 선택 릴이 회전 중입니다/);
  assert.match(page, /다음 게임/);
  assert.match(page, /전체 자동 선택/);
  assert.match(page, /전체 초기화/);
  assert.match(page, /market-clock__progress/);
  assert.match(page, /paper-result-modal/);
  assert.match(page, /\[1000, 2000\]/);
  assert.match(page, /aria-pressed|aria-live/);
  assert.match(layout, /const title = "운빨 실험실/);
  assert.match(layout, /FRONTIER LUCK CLUB/);
  assert.match(layout, /themeColor: "#1a100b"/);
  assert.match(layout, /summary_large_image/);
  assert.match(layout, /\/og-western\.png/);
  assert.match(layout, /<html lang="ko">/);
  assert.match(layout, /AI 가위바위보/);
  assert.match(layout, /타이밍 게임/);
  assert.match(css, /\.number-grid/);
  assert.match(css, /\.paper-board/);
  assert.match(css, /\.stock-table/);
  assert.match(css, /\.horse-track/);
  assert.match(css, /\.rps-arena/);
  assert.match(css, /\.rps-move-grid/);
  assert.match(css, /\.rps-machine-lamp\.is-lit/);
  assert.match(css, /\.rps-next-round-button/);
  assert.match(css, /\.timing-clock/);
  assert.match(css, /\.timing-stop-button/);
  assert.match(css, /\.timing-start-lights/);
  assert.match(css, /\.timing-start-light\.is-lit/);
  assert.match(css, /\.paper-result-modal/);
  assert.match(css, /\.luck-modal/);
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(readme, /일곱 가지 게임/);
  assert.match(readme, /AI 가위바위보/);
  assert.match(readme, /3판 2선승/);
  assert.match(readme, /5판 3선승/);
  assert.match(readme, /7판 5선승/);
  assert.match(readme, /타이밍의 신/);
  assert.match(readme, /3\.00·5\.00·7\.77·10\.00·10\.01초/);
  assert.doesNotMatch(readme, /다섯 가지 랜덤 게임/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);

  await assert.rejects(access(new URL("../app/_sites-preview/SkeletonPreview.tsx", import.meta.url)));
  await assert.rejects(access(new URL("../app/_sites-preview/preview.css", import.meta.url)));
  assert.ok(projectRoot);
});
