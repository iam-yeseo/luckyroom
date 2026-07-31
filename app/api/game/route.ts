import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { getPublicUser } from "@/app/public-user";
import {
  RPS_MIN_BET,
  RPS_MOVES,
  STOCK_PRODUCTS,
  TIMING_GOD_MIN_BET,
  advanceRpsScore,
  applyStockChange,
  calculateLottoPayout,
  calculateTimingMultiplier,
  calculateTimingPayout,
  createHorseRace,
  createLottoRoundPrizes,
  createPaperBoard,
  createRpsAiBet,
  createRpsMove,
  derivativeRate,
  drawUniqueNumbers,
  evaluateLotto,
  evaluateRpsRound,
  evaluateTimingAttempt,
  generateScratchTicket,
  getRpsWinsRequired,
  getTimingTargetHundredths,
  randomInt,
} from "@/app/game-logic";

export const dynamic = "force-dynamic";

type ProfileRow = {
  email: string;
  display_name: string;
  balance: number;
  saved_luck: number;
  last_earn_at: number;
};

type HoldingRow = {
  symbol: string;
  quantity: number;
  average_price: number;
};

type MarketRow = {
  symbol: string;
  name: string;
  kind: string;
  underlying: string | null;
  multiplier: number;
  inverse: number;
  price: number;
  previous_price: number;
  status: "active" | "suspended" | "delisted";
  phase_started_at: number;
  updated_at: number;
};

type PaperCell = {
  id: string;
  rank: string;
  prize: number;
  available: boolean;
};

type BoardRow = {
  generation: number;
  cells_json: string;
  remaining: number;
  updated_at: number;
};

type RpsMove = (typeof RPS_MOVES)[number];
type RpsRoundResult = "win" | "lose" | "draw";
type RpsWinner = "player" | "ai";

type RpsRound = {
  turn: number;
  playerMove: RpsMove;
  aiMove: RpsMove;
  result: RpsRoundResult;
  playerWins: number;
  aiWins: number;
  decisiveRounds: number;
};

type RpsMatchRow = {
  id: string;
  user_email: string;
  match_type: number;
  wins_required: number;
  player_bet: number;
  ai_bet: number;
  player_wins: number;
  ai_wins: number;
  decisive_rounds: number;
  attempts: number;
  ai_move: RpsMove | "";
  history_json: string;
  status: "active" | "completed";
  winner: RpsWinner | null;
  payout: number;
  created_at: number;
  updated_at: number;
  completed_at: number | null;
};

type TimingStatsRow = {
  failure_count: number;
  updated_at: number;
};

type TimingGameRow = {
  id: string;
  user_email: string;
  target_hundredths: number;
  bet_amount: number;
  failure_count: number;
  multiplier_tenths: number;
  started_at: number;
  status: "active" | "completed";
  elapsed_hundredths: number | null;
  success: number | null;
  payout: number;
  completed_at: number | null;
  updated_at: number;
};

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS profiles (
    email TEXT PRIMARY KEY NOT NULL,
    display_name TEXT NOT NULL,
    balance INTEGER NOT NULL DEFAULT 1000000,
    saved_luck INTEGER NOT NULL DEFAULT 0,
    last_earn_at INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS holdings (
    user_email TEXT NOT NULL,
    symbol TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    average_price INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_email, symbol),
    FOREIGN KEY (user_email) REFERENCES profiles(email)
  )`,
  `CREATE TABLE IF NOT EXISTS market_state (
    symbol TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    kind TEXT NOT NULL,
    underlying TEXT,
    multiplier INTEGER NOT NULL DEFAULT 1,
    inverse INTEGER NOT NULL DEFAULT 0,
    price INTEGER NOT NULL,
    previous_price INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    phase_started_at INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS paper_boards (
    id INTEGER PRIMARY KEY NOT NULL,
    generation INTEGER NOT NULL,
    cells_json TEXT NOT NULL,
    remaining INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS coin_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    user_email TEXT NOT NULL,
    type TEXT NOT NULL,
    amount INTEGER NOT NULL,
    description TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_email) REFERENCES profiles(email)
  )`,
  "CREATE INDEX IF NOT EXISTS coin_transactions_user_idx ON coin_transactions (user_email, created_at DESC)",
  `CREATE TABLE IF NOT EXISTS rps_matches (
    id TEXT PRIMARY KEY NOT NULL,
    user_email TEXT NOT NULL,
    match_type INTEGER NOT NULL,
    wins_required INTEGER NOT NULL,
    player_bet INTEGER NOT NULL,
    ai_bet INTEGER NOT NULL,
    player_wins INTEGER NOT NULL DEFAULT 0,
    ai_wins INTEGER NOT NULL DEFAULT 0,
    decisive_rounds INTEGER NOT NULL DEFAULT 0,
    attempts INTEGER NOT NULL DEFAULT 0,
    ai_move TEXT NOT NULL,
    history_json TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'active',
    winner TEXT,
    payout INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    completed_at INTEGER,
    FOREIGN KEY (user_email) REFERENCES profiles(email)
  )`,
  "CREATE UNIQUE INDEX IF NOT EXISTS rps_matches_active_user_idx ON rps_matches (user_email) WHERE status = 'active'",
  `CREATE TABLE IF NOT EXISTS timing_stats (
    user_email TEXT PRIMARY KEY NOT NULL,
    failure_count INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (user_email) REFERENCES profiles(email)
  )`,
  `CREATE TABLE IF NOT EXISTS timing_games (
    id TEXT PRIMARY KEY NOT NULL,
    user_email TEXT NOT NULL,
    target_hundredths INTEGER NOT NULL,
    bet_amount INTEGER NOT NULL,
    failure_count INTEGER NOT NULL,
    multiplier_tenths INTEGER NOT NULL,
    started_at INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    elapsed_hundredths INTEGER,
    success INTEGER,
    payout INTEGER NOT NULL DEFAULT 0,
    completed_at INTEGER,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (user_email) REFERENCES profiles(email)
  )`,
  "CREATE UNIQUE INDEX IF NOT EXISTS timing_games_active_user_idx ON timing_games (user_email) WHERE status = 'active'",
  `CREATE TABLE IF NOT EXISTS game_action_receipts (
    id TEXT PRIMARY KEY NOT NULL,
    user_email TEXT NOT NULL,
    action TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_email) REFERENCES profiles(email)
  )`,
];

function db() {
  if (!env.DB) throw new Error("게임 데이터베이스를 사용할 수 없습니다.");
  return env.DB;
}

async function ensureSchema() {
  const database = db();
  await database.batch(
    SCHEMA_STATEMENTS.map((statement) => database.prepare(statement)),
  );
}

async function getApiUser() {
  const user = await getPublicUser();
  await ensureSchema();
  const now = Date.now();
  await db()
    .prepare(
      `INSERT INTO profiles
        (email, display_name, balance, saved_luck, last_earn_at, created_at, updated_at)
       VALUES (?, ?, 1000000, 0, 0, ?, ?)
       ON CONFLICT(email) DO UPDATE SET
         display_name = excluded.display_name,
         updated_at = excluded.updated_at`,
    )
    .bind(user.id, user.displayName, now, now)
    .run();

  return user;
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function parseRpsHistory(historyJson: string): RpsRound[] {
  try {
    const history = JSON.parse(historyJson) as unknown;
    return Array.isArray(history) ? (history as RpsRound[]) : [];
  } catch {
    return [];
  }
}

function publicRpsMatch(row: RpsMatchRow) {
  return {
    id: row.id,
    matchType: row.match_type,
    winsRequired: row.wins_required,
    playerBet: row.player_bet,
    aiBet: row.ai_bet,
    playerWins: row.player_wins,
    aiWins: row.ai_wins,
    decisiveRounds: row.decisive_rounds,
    attempts: row.attempts,
    nextTurn: row.attempts + 1,
    status: row.status,
    winner: row.winner,
    history: parseRpsHistory(row.history_json),
    payout: row.payout,
    netProfit:
      row.status === "active"
        ? null
        : row.payout > 0
          ? row.payout - row.player_bet
          : -row.player_bet,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  };
}

async function getRpsMatch(id: string, email: string) {
  return db()
    .prepare(
      `SELECT id, user_email, match_type, wins_required, player_bet, ai_bet,
              player_wins, ai_wins, decisive_rounds, attempts, ai_move,
              history_json, status, winner, payout, created_at, updated_at,
              completed_at
       FROM rps_matches WHERE id = ? AND user_email = ?`,
    )
    .bind(id, email)
    .first<RpsMatchRow>();
}

async function getActiveRpsMatch(email: string) {
  return db()
    .prepare(
      `SELECT id, user_email, match_type, wins_required, player_bet, ai_bet,
              player_wins, ai_wins, decisive_rounds, attempts, ai_move,
              history_json, status, winner, payout, created_at, updated_at,
              completed_at
       FROM rps_matches
       WHERE user_email = ? AND status = 'active'
       ORDER BY created_at DESC LIMIT 1`,
    )
    .bind(email)
    .first<RpsMatchRow>();
}

function publicTimingGame(row: TimingGameRow) {
  return {
    id: row.id,
    target: row.target_hundredths / 100,
    targetHundredths: row.target_hundredths,
    betAmount: row.bet_amount,
    multiplier: row.multiplier_tenths / 10,
    failureStreak: row.failure_count,
    startedAt: row.started_at,
    status: row.status,
  };
}

function publicTimingResult(row: TimingGameRow) {
  const success = Boolean(row.success);
  const elapsedHundredths = row.elapsed_hundredths ?? 0;
  const failureStreak = success ? 0 : row.failure_count + 1;

  return {
    gameId: row.id,
    target: row.target_hundredths / 100,
    targetHundredths: row.target_hundredths,
    elapsedSeconds: elapsedHundredths / 100,
    elapsedHundredths,
    betAmount: row.bet_amount,
    multiplier: row.multiplier_tenths / 10,
    success,
    payout: row.payout,
    netProfit: row.payout > 0 ? row.payout - row.bet_amount : -row.bet_amount,
    previousFailureStreak: row.failure_count,
    failureStreak,
    completedAt: row.completed_at,
  };
}

async function getTimingStats(email: string) {
  return db()
    .prepare(
      `SELECT failure_count, updated_at
       FROM timing_stats WHERE user_email = ?`,
    )
    .bind(email)
    .first<TimingStatsRow>();
}

async function getTimingGame(id: string, email: string) {
  return db()
    .prepare(
      `SELECT id, user_email, target_hundredths, bet_amount, failure_count,
              multiplier_tenths, started_at, status, elapsed_hundredths,
              success, payout, completed_at, updated_at
       FROM timing_games WHERE id = ? AND user_email = ?`,
    )
    .bind(id, email)
    .first<TimingGameRow>();
}

async function getActiveTimingGame(email: string) {
  return db()
    .prepare(
      `SELECT id, user_email, target_hundredths, bet_amount, failure_count,
              multiplier_tenths, started_at, status, elapsed_hundredths,
              success, payout, completed_at, updated_at
       FROM timing_games
       WHERE user_email = ? AND status = 'active'
       ORDER BY started_at DESC LIMIT 1`,
    )
    .bind(email)
    .first<TimingGameRow>();
}

function makeBoardCells(): PaperCell[] {
  return createPaperBoard().map((cell: Omit<PaperCell, "available">) => ({
    ...cell,
    available: true,
  }));
}

async function ensurePaperBoard(): Promise<BoardRow> {
  const existing = await db()
    .prepare(
      "SELECT generation, cells_json, remaining, updated_at FROM paper_boards WHERE id = 1",
    )
    .first<BoardRow>();
  if (existing) return existing;

  const now = Date.now();
  const cells = makeBoardCells();
  await db()
    .prepare(
      `INSERT OR IGNORE INTO paper_boards
        (id, generation, cells_json, remaining, updated_at)
       VALUES (1, 1, ?, 160, ?)`,
    )
    .bind(JSON.stringify(cells), now)
    .run();

  return (
    (await db()
      .prepare(
        "SELECT generation, cells_json, remaining, updated_at FROM paper_boards WHERE id = 1",
      )
      .first<BoardRow>()) ?? {
      generation: 1,
      cells_json: JSON.stringify(cells),
      remaining: 160,
      updated_at: now,
    }
  );
}

async function ensureMarket() {
  const row = await db()
    .prepare("SELECT COUNT(*) AS count FROM market_state")
    .first<{ count: number }>();
  if ((row?.count ?? 0) >= STOCK_PRODUCTS.length) return;

  const now = Date.now();
  const statements = STOCK_PRODUCTS.map((product) => {
    const price = (randomInt(190) + 10) * 1_000;
    return db()
      .prepare(
        `INSERT OR IGNORE INTO market_state
          (symbol, name, kind, underlying, multiplier, inverse, price,
           previous_price, status, phase_started_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', 0, ?)`,
      )
      .bind(
        product.symbol,
        product.name,
        product.kind,
        product.underlying,
        product.multiplier,
        product.inverse ? 1 : 0,
        price,
        price,
        now,
      );
  });
  await db().batch(statements);
}

function randomBaseRate() {
  return (randomInt(2001) - 1000) / 10_000;
}

async function advanceMarket(): Promise<MarketRow[]> {
  await ensureMarket();
  const result = await db()
    .prepare(
      `SELECT symbol, name, kind, underlying, multiplier, inverse, price,
              previous_price, status, phase_started_at, updated_at
       FROM market_state ORDER BY kind, symbol`,
    )
    .all<MarketRow>();
  const rows = result.results;
  const now = Date.now();
  const baseRates = new Map<string, number>();
  const nextRows = new Map<string, MarketRow>();

  for (const row of rows.filter((item) => item.kind === "base")) {
    let next = { ...row };
    if (row.status === "suspended" && now - row.phase_started_at >= 60_000) {
      next = { ...next, status: "delisted", phase_started_at: now };
    } else if (
      row.status === "delisted" &&
      now - row.phase_started_at >= 120_000
    ) {
      const relistPrice = (randomInt(190) + 10) * 1_000;
      next = {
        ...next,
        price: relistPrice,
        previous_price: relistPrice,
        status: "active",
        phase_started_at: 0,
        updated_at: now,
      };
    } else if (row.status === "active" && now - row.updated_at >= 5_000) {
      const ticks = Math.min(24, Math.floor((now - row.updated_at) / 5_000));
      let price = row.price;
      for (let index = 0; index < ticks; index += 1) {
        price = applyStockChange(price, randomBaseRate());
      }
      const totalRate = price / row.price - 1;
      baseRates.set(row.symbol, totalRate);
      next = {
        ...next,
        previous_price: row.price,
        price,
        updated_at: row.updated_at + ticks * 5_000,
      };
      if (price <= 1_000) {
        next.status = "suspended";
        next.phase_started_at = now;
      }
    }
    nextRows.set(row.symbol, next);
  }

  for (const row of rows.filter((item) => item.kind === "derivative")) {
    const underlying = row.underlying
      ? nextRows.get(row.underlying)
      : undefined;
    let next = { ...row };

    if (underlying && underlying.status !== "active") {
      next.status = underlying.status;
      next.phase_started_at = underlying.phase_started_at;
      next.updated_at = now;
    } else if (
      row.status === "suspended" &&
      now - row.phase_started_at >= 60_000
    ) {
      next.status = "delisted";
      next.phase_started_at = now;
      next.updated_at = now;
    } else if (
      row.status === "delisted" &&
      now - row.phase_started_at >= 120_000
    ) {
      const relistPrice = (randomInt(90) + 10) * 1_000;
      next = {
        ...next,
        price: relistPrice,
        previous_price: relistPrice,
        status: "active",
        phase_started_at: 0,
        updated_at: now,
      };
    } else if (
      row.status === "active" &&
      row.underlying &&
      baseRates.has(row.underlying)
    ) {
      const rate = derivativeRate(
        baseRates.get(row.underlying) ?? 0,
        row.multiplier,
        Boolean(row.inverse),
      );
      const price = applyStockChange(row.price, rate);
      next = {
        ...next,
        previous_price: row.price,
        price,
        updated_at: now,
      };
      if (price <= 1_000) {
        next.status = "suspended";
        next.phase_started_at = now;
      }
    }
    nextRows.set(row.symbol, next);
  }

  const changed = [...nextRows.values()].filter((next) => {
    const before = rows.find((row) => row.symbol === next.symbol);
    return before && JSON.stringify(before) !== JSON.stringify(next);
  });
  if (changed.length) {
    await db().batch(
      changed.map((row) =>
        db()
          .prepare(
            `UPDATE market_state SET
               price = ?, previous_price = ?, status = ?,
               phase_started_at = ?, updated_at = ?
             WHERE symbol = ?`,
          )
          .bind(
            row.price,
            row.previous_price,
            row.status,
            row.phase_started_at,
            row.updated_at,
            row.symbol,
          ),
      ),
    );
  }

  return [...nextRows.values()];
}

async function getProfile(email: string) {
  return db()
    .prepare(
      `SELECT email, display_name, balance, saved_luck, last_earn_at
       FROM profiles WHERE email = ?`,
    )
    .bind(email)
    .first<ProfileRow>();
}

async function publicState(email: string, market?: MarketRow[]) {
  const [
    profile,
    holdingsResult,
    board,
    transactionsResult,
    activeRpsMatch,
    timingStats,
    activeTimingGame,
  ] =
    await Promise.all([
      getProfile(email),
      db()
        .prepare(
          `SELECT symbol, quantity, average_price
           FROM holdings WHERE user_email = ? AND quantity > 0`,
        )
        .bind(email)
        .all<HoldingRow>(),
      ensurePaperBoard(),
      db()
        .prepare(
          `SELECT id, type, amount, description, created_at
           FROM coin_transactions
           WHERE user_email = ?
           ORDER BY created_at DESC LIMIT 10`,
        )
        .bind(email)
        .all<{
          id: number;
          type: string;
          amount: number;
          description: string;
          created_at: number;
        }>(),
      getActiveRpsMatch(email),
      getTimingStats(email),
      getActiveTimingGame(email),
    ]);
  const marketRows = market ?? (await advanceMarket());
  const cells = JSON.parse(board.cells_json) as PaperCell[];
  const failureStreak = timingStats?.failure_count ?? 0;

  return {
    profile: profile
      ? {
          email: profile.email,
          displayName: profile.display_name,
          balance: profile.balance,
          savedLuck: profile.saved_luck,
          lastEarnAt: profile.last_earn_at,
        }
      : null,
    holdings: holdingsResult.results.map((holding) => ({
      symbol: holding.symbol,
      quantity: holding.quantity,
      averagePrice: holding.average_price,
    })),
    market: marketRows.map((stock) => ({
      symbol: stock.symbol,
      name: stock.name,
      kind: stock.kind,
      underlying: stock.underlying,
      multiplier: stock.multiplier,
      inverse: Boolean(stock.inverse),
      price: stock.price,
      previousPrice: stock.previous_price,
      status: stock.status,
      phaseStartedAt: stock.phase_started_at,
      updatedAt: stock.updated_at,
    })),
    paperBoard: {
      generation: board.generation,
      remaining: board.remaining,
      availableIds: cells
        .filter((cell) => cell.available)
        .map((cell) => cell.id),
      updatedAt: board.updated_at,
    },
    transactions: transactionsResult.results.map((transaction) => ({
      id: transaction.id,
      type: transaction.type,
      amount: transaction.amount,
      description: transaction.description,
      createdAt: transaction.created_at,
    })),
    rpsMatch: activeRpsMatch ? publicRpsMatch(activeRpsMatch) : null,
    timing: {
      failureStreak,
      currentMultiplier: calculateTimingMultiplier(failureStreak),
      activeGame: activeTimingGame
        ? publicTimingGame(activeTimingGame)
        : null,
    },
    serverTime: Date.now(),
  };
}

async function recordBalanceChange(
  email: string,
  amount: number,
  type: string,
  description: string,
  now = Date.now(),
) {
  await db().batch([
    db()
      .prepare(
        "UPDATE profiles SET balance = balance + ?, updated_at = ? WHERE email = ?",
      )
      .bind(amount, now, email),
    db()
      .prepare(
        `INSERT INTO coin_transactions
          (user_email, type, amount, description, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(email, type, amount, description, now),
  ]);
}

export async function GET() {
  const user = await getApiUser();
  const market = await advanceMarket();
  return NextResponse.json(await publicState(user.id, market));
}

export async function POST(request: Request) {
  const user = await getApiUser();
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonError("요청 형식이 올바르지 않습니다.");
  }

  const action = body.action;
  const now = Date.now();
  const profile = await getProfile(user.id);
  if (!profile) return jsonError("지갑을 불러오지 못했습니다.", 500);

  if (action === "earn") {
    const remaining = 10_000 - (now - profile.last_earn_at);
    if (remaining > 0) {
      return jsonError(
        `${Math.ceil(remaining / 1_000)}초 뒤에 다시 코인을 받을 수 있어요.`,
        429,
      );
    }
    const reward = randomInt(1_000_000) + 1;
    await db().batch([
      db()
        .prepare(
          `UPDATE profiles SET
             balance = balance + ?, last_earn_at = ?, updated_at = ?
           WHERE email = ?`,
        )
        .bind(reward, now, now, user.id),
      db()
        .prepare(
          `INSERT INTO coin_transactions
            (user_email, type, amount, description, created_at)
           VALUES (?, 'earn', ?, '랜덤 코인 받기', ?)`,
        )
        .bind(user.id, reward, now),
    ]);
    return NextResponse.json({
      reward,
      state: await publicState(user.id),
    });
  }

  if (action === "save_luck") {
    const amount = Number(body.amount);
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      return jsonError("저장할 코인을 올바르게 입력해주세요.");
    }
    if (amount > profile.balance) return jsonError("보유 코인이 부족합니다.");

    await db().batch([
      db()
        .prepare(
          `UPDATE profiles SET
             balance = balance - ?, saved_luck = saved_luck + ?, updated_at = ?
           WHERE email = ?`,
        )
        .bind(amount, amount, now, user.id),
      db()
        .prepare(
          `INSERT INTO coin_transactions
            (user_email, type, amount, description, created_at)
           VALUES (?, 'save_luck', ?, '운 저장하기', ?)`,
        )
        .bind(user.id, -amount, now),
    ]);
    return NextResponse.json({
      saved: amount,
      state: await publicState(user.id),
    });
  }

  if (action === "rps_start") {
    const matchType = Number(body.matchType);
    const betAmount = Number(body.betAmount);
    let winsRequired: number;

    try {
      winsRequired = getRpsWinsRequired(matchType);
    } catch {
      return jsonError("3판, 5판, 7판 중 하나를 선택해주세요.");
    }
    if (!Number.isSafeInteger(betAmount) || betAmount < RPS_MIN_BET) {
      return jsonError(
        `배팅 금액은 최소 ${RPS_MIN_BET.toLocaleString("ko-KR")} C입니다.`,
      );
    }

    const activeMatch = await getActiveRpsMatch(user.id);
    if (activeMatch) {
      return NextResponse.json({
        rpsMatch: publicRpsMatch(activeMatch),
        resumed: true,
        state: await publicState(user.id),
      });
    }
    if (betAmount > profile.balance) {
      return jsonError("보유 코인보다 많이 배팅할 수 없습니다.");
    }

    let aiBet: number;
    try {
      aiBet = createRpsAiBet(betAmount);
      if (!Number.isSafeInteger(betAmount + aiBet)) {
        throw new RangeError("payout is too large");
      }
    } catch {
      return jsonError("배팅 금액이 너무 큽니다.");
    }

    const matchId = `rps-${crypto.randomUUID()}`;
    const aiMove = createRpsMove();
    try {
      await db().batch([
        db()
          .prepare(
            `INSERT INTO rps_matches
              (id, user_email, match_type, wins_required, player_bet, ai_bet,
               player_wins, ai_wins, decisive_rounds, attempts, ai_move,
               history_json, status, winner, payout, created_at, updated_at,
               completed_at)
             SELECT ?, ?, ?, ?, ?, ?, 0, 0, 0, 0, ?, '[]', 'active',
                    NULL, 0, ?, ?, NULL
             FROM profiles WHERE email = ? AND balance >= ?`,
          )
          .bind(
            matchId,
            user.id,
            matchType,
            winsRequired,
            betAmount,
            aiBet,
            aiMove,
            now,
            now,
            user.id,
            betAmount,
          ),
        db()
          .prepare(
            `UPDATE profiles
             SET balance = balance - ?, updated_at = ?
             WHERE email = ?
               AND EXISTS (SELECT 1 FROM rps_matches WHERE id = ?)`,
          )
          .bind(betAmount, now, user.id, matchId),
        db()
          .prepare(
            `INSERT INTO coin_transactions
              (user_email, type, amount, description, created_at)
             SELECT user_email, 'rps_bet', ?, ?, ?
             FROM rps_matches WHERE id = ?`,
          )
          .bind(
            -betAmount,
            `가위바위보 ${matchType}판 배팅`,
            now,
            matchId,
          ),
      ]);
    } catch {
      const concurrentMatch = await getActiveRpsMatch(user.id);
      if (concurrentMatch) {
        return NextResponse.json({
          rpsMatch: publicRpsMatch(concurrentMatch),
          resumed: true,
          state: await publicState(user.id),
        });
      }
      return jsonError("가위바위보 경기를 시작하지 못했습니다.", 409);
    }

    const match = await getRpsMatch(matchId, user.id);
    if (!match) {
      return jsonError("보유 코인이 부족합니다.");
    }
    return NextResponse.json({
      rpsMatch: publicRpsMatch(match),
      resumed: false,
      state: await publicState(user.id),
    });
  }

  if (action === "rps_play") {
    const matchId = String(body.matchId ?? "");
    const turn = Number(body.turn);
    const requestedMove = String(body.move ?? "");
    if (!matchId || !Number.isSafeInteger(turn) || turn < 1) {
      return jsonError("경기 턴 정보가 올바르지 않습니다.");
    }
    if (!RPS_MOVES.includes(requestedMove)) {
      return jsonError("가위, 바위, 보 중 하나를 선택해주세요.");
    }
    const playerMove = requestedMove as RpsMove;
    const match = await getRpsMatch(matchId, user.id);
    if (!match) return jsonError("가위바위보 경기를 찾지 못했습니다.", 404);

    const existingHistory = parseRpsHistory(match.history_json);
    if (turn <= match.attempts) {
      return NextResponse.json({
        rpsMatch: publicRpsMatch(match),
        round:
          existingHistory.find((round) => round.turn === turn) ??
          existingHistory.at(-1) ??
          null,
        duplicate: true,
        state: await publicState(user.id),
      });
    }
    if (match.status !== "active") {
      return jsonError("이미 끝난 경기입니다.", 409);
    }
    if (turn !== match.attempts + 1) {
      return jsonError("최신 경기 결과를 먼저 확인해주세요.", 409);
    }
    if (!RPS_MOVES.includes(match.ai_move)) {
      return jsonError("AI 선택을 불러오지 못했습니다.", 500);
    }

    const aiMove = match.ai_move as RpsMove;
    const result = evaluateRpsRound(playerMove, aiMove);
    const score = advanceRpsScore(
      match.player_wins,
      match.ai_wins,
      result,
      match.wins_required,
    );
    const { playerWins, aiWins, winner } = score;
    const decisiveRounds =
      match.decisive_rounds + (score.decisiveRound ? 1 : 0);
    const payout =
      winner === "player" ? match.player_bet + match.ai_bet : 0;
    const round: RpsRound = {
      turn,
      playerMove,
      aiMove,
      result,
      playerWins,
      aiWins,
      decisiveRounds,
    };
    const nextHistory = [...existingHistory, round];
    const nextAiMove = winner ? "" : createRpsMove();
    const receiptId = `${match.id}:turn:${turn}`;
    const statements = [
      db()
        .prepare(
          `INSERT INTO game_action_receipts
            (id, user_email, action, created_at)
           VALUES (?, ?, 'rps_play', ?)`,
        )
        .bind(receiptId, user.id, now),
      db()
        .prepare(
          `UPDATE rps_matches SET
             player_wins = ?, ai_wins = ?, decisive_rounds = ?,
             attempts = ?, ai_move = ?, history_json = ?, status = ?,
             winner = ?, payout = ?, updated_at = ?, completed_at = ?
           WHERE id = ? AND user_email = ? AND status = 'active'
             AND attempts = ?`,
        )
        .bind(
          playerWins,
          aiWins,
          decisiveRounds,
          turn,
          nextAiMove,
          JSON.stringify(nextHistory),
          winner ? "completed" : "active",
          winner,
          payout,
          now,
          winner ? now : null,
          match.id,
          user.id,
          match.attempts,
        ),
    ];

    if (winner === "player") {
      statements.push(
        db()
          .prepare(
            `UPDATE profiles
             SET balance = balance + ?, updated_at = ?
             WHERE email = ?
               AND EXISTS (
                 SELECT 1 FROM rps_matches
                 WHERE id = ? AND user_email = ? AND winner = 'player'
                   AND attempts = ? AND updated_at = ?
               )`,
          )
          .bind(
            payout,
            now,
            user.id,
            match.id,
            user.id,
            turn,
            now,
          ),
        db()
          .prepare(
            `INSERT INTO coin_transactions
              (user_email, type, amount, description, created_at)
             SELECT user_email, 'rps_win', ?, '가위바위보 승리 보상', ?
             FROM rps_matches
             WHERE id = ? AND winner = 'player' AND attempts = ?
               AND updated_at = ?`,
          )
          .bind(payout, now, match.id, turn, now),
      );
    }

    try {
      await db().batch(statements);
    } catch {
      const currentMatch = await getRpsMatch(match.id, user.id);
      if (currentMatch && currentMatch.attempts >= turn) {
        const history = parseRpsHistory(currentMatch.history_json);
        return NextResponse.json({
          rpsMatch: publicRpsMatch(currentMatch),
          round:
            history.find((item) => item.turn === turn) ??
            history.at(-1) ??
            null,
          duplicate: true,
          state: await publicState(user.id),
        });
      }
      return jsonError("가위바위보 결과를 저장하지 못했습니다.", 409);
    }

    const updatedMatch = await getRpsMatch(match.id, user.id);
    if (!updatedMatch) {
      return jsonError("가위바위보 결과를 불러오지 못했습니다.", 500);
    }
    return NextResponse.json({
      rpsMatch: publicRpsMatch(updatedMatch),
      round,
      duplicate: false,
      state: await publicState(user.id),
    });
  }

  if (action === "timing_start") {
    const requestedTarget =
      body.target === undefined
        ? Number(body.targetHundredths) / 100
        : Number(body.target);
    const betAmount = Number(body.betAmount);
    let targetHundredths: number;

    try {
      targetHundredths = getTimingTargetHundredths(requestedTarget);
    } catch {
      return jsonError("목표 시간을 다시 선택해주세요.");
    }
    if (
      !Number.isSafeInteger(betAmount) ||
      betAmount < TIMING_GOD_MIN_BET
    ) {
      return jsonError(
        `배팅 금액은 최소 ${TIMING_GOD_MIN_BET.toLocaleString("ko-KR")} C입니다.`,
      );
    }

    const activeGame = await getActiveTimingGame(user.id);
    if (activeGame) {
      return NextResponse.json({
        timingGame: publicTimingGame(activeGame),
        resumed: true,
        state: await publicState(user.id),
      });
    }
    if (betAmount > profile.balance) {
      return jsonError("보유 코인보다 많이 배팅할 수 없습니다.");
    }

    const stats = await getTimingStats(user.id);
    const failureStreak = stats?.failure_count ?? 0;
    try {
      calculateTimingPayout(betAmount, failureStreak);
    } catch {
      return jsonError("배팅 금액이 너무 큽니다.");
    }
    const multiplierTenths = 11 + failureStreak;
    const gameId = `timing-${crypto.randomUUID()}`;

    try {
      await db().batch([
        db()
          .prepare(
            `INSERT INTO timing_games
              (id, user_email, target_hundredths, bet_amount, failure_count,
               multiplier_tenths, started_at, status, elapsed_hundredths,
               success, payout, completed_at, updated_at)
             SELECT ?, ?, ?, ?, ?, ?, ?, 'active', NULL, NULL, 0, NULL, ?
             FROM profiles WHERE email = ? AND balance >= ?`,
          )
          .bind(
            gameId,
            user.id,
            targetHundredths,
            betAmount,
            failureStreak,
            multiplierTenths,
            now,
            now,
            user.id,
            betAmount,
          ),
        db()
          .prepare(
            `UPDATE profiles
             SET balance = balance - ?, updated_at = ?
             WHERE email = ?
               AND EXISTS (SELECT 1 FROM timing_games WHERE id = ?)`,
          )
          .bind(betAmount, now, user.id, gameId),
        db()
          .prepare(
            `INSERT INTO coin_transactions
              (user_email, type, amount, description, created_at)
             SELECT user_email, 'timing_bet', ?, ?, ?
             FROM timing_games WHERE id = ?`,
          )
          .bind(
            -betAmount,
            `타이밍의 신 ${(targetHundredths / 100).toFixed(2)}초 배팅`,
            now,
            gameId,
          ),
      ]);
    } catch {
      const concurrentGame = await getActiveTimingGame(user.id);
      if (concurrentGame) {
        return NextResponse.json({
          timingGame: publicTimingGame(concurrentGame),
          resumed: true,
          state: await publicState(user.id),
        });
      }
      return jsonError("타이밍 게임을 시작하지 못했습니다.", 409);
    }

    const timingGame = await getTimingGame(gameId, user.id);
    if (!timingGame) return jsonError("보유 코인이 부족합니다.");
    return NextResponse.json({
      timingGame: publicTimingGame(timingGame),
      resumed: false,
      state: await publicState(user.id),
    });
  }

  if (action === "timing_stop") {
    const gameId = String(body.gameId ?? "");
    const elapsedHundredths = Number(body.elapsedHundredths);
    if (
      !gameId ||
      !Number.isSafeInteger(elapsedHundredths) ||
      elapsedHundredths < 0
    ) {
      return jsonError("측정 시간을 올바르게 전송해주세요.");
    }

    const timingGame = await getTimingGame(gameId, user.id);
    if (!timingGame) return jsonError("타이밍 게임을 찾지 못했습니다.", 404);
    if (timingGame.status === "completed") {
      return NextResponse.json({
        timingResult: publicTimingResult(timingGame),
        duplicate: true,
        state: await publicState(user.id),
      });
    }

    const success = evaluateTimingAttempt(
      timingGame.target_hundredths,
      elapsedHundredths,
    );
    const payout = success
      ? calculateTimingPayout(
          timingGame.bet_amount,
          timingGame.failure_count,
        )
      : 0;
    const failureStreak = success ? 0 : timingGame.failure_count + 1;
    const receiptId = `${timingGame.id}:stop`;
    const statements = [
      db()
        .prepare(
          `INSERT INTO game_action_receipts
            (id, user_email, action, created_at)
           VALUES (?, ?, 'timing_stop', ?)`,
        )
        .bind(receiptId, user.id, now),
      db()
        .prepare(
          `UPDATE timing_games SET
             status = 'completed', elapsed_hundredths = ?, success = ?,
             payout = ?, completed_at = ?, updated_at = ?
           WHERE id = ? AND user_email = ? AND status = 'active'`,
        )
        .bind(
          elapsedHundredths,
          success ? 1 : 0,
          payout,
          now,
          now,
          timingGame.id,
          user.id,
        ),
      db()
        .prepare(
          `INSERT INTO timing_stats (user_email, failure_count, updated_at)
           VALUES (?, ?, ?)
           ON CONFLICT(user_email) DO UPDATE SET
             failure_count = excluded.failure_count,
             updated_at = excluded.updated_at`,
        )
        .bind(user.id, failureStreak, now),
    ];

    if (success) {
      statements.push(
        db()
          .prepare(
            `UPDATE profiles
             SET balance = balance + ?, updated_at = ?
             WHERE email = ?
               AND EXISTS (
                 SELECT 1 FROM timing_games
                 WHERE id = ? AND user_email = ? AND status = 'completed'
                   AND success = 1 AND updated_at = ?
               )`,
          )
          .bind(
            payout,
            now,
            user.id,
            timingGame.id,
            user.id,
            now,
          ),
        db()
          .prepare(
            `INSERT INTO coin_transactions
              (user_email, type, amount, description, created_at)
             SELECT user_email, 'timing_win', ?, '타이밍의 신 성공 보상', ?
             FROM timing_games
             WHERE id = ? AND success = 1 AND updated_at = ?`,
          )
          .bind(payout, now, timingGame.id, now),
      );
    }

    try {
      await db().batch(statements);
    } catch {
      const currentGame = await getTimingGame(timingGame.id, user.id);
      if (currentGame?.status === "completed") {
        return NextResponse.json({
          timingResult: publicTimingResult(currentGame),
          duplicate: true,
          state: await publicState(user.id),
        });
      }
      return jsonError("타이밍 결과를 저장하지 못했습니다.", 409);
    }

    const completedGame = await getTimingGame(timingGame.id, user.id);
    if (!completedGame) {
      return jsonError("타이밍 결과를 불러오지 못했습니다.", 500);
    }
    return NextResponse.json({
      timingResult: publicTimingResult(completedGame),
      duplicate: false,
      state: await publicState(user.id),
    });
  }

  if (action === "lotto") {
    const entries = body.entries;
    if (!Array.isArray(entries) || entries.length < 1 || entries.length > 5) {
      return jsonError("로또는 1~5게임까지 진행할 수 있습니다.");
    }
    const valid = entries.every(
      (entry) =>
        Array.isArray(entry) &&
        entry.length === 6 &&
        new Set(entry).size === 6 &&
        entry.every(
          (number) =>
            Number.isInteger(number) && number >= 1 && number <= 45,
        ),
    );
    if (!valid) return jsonError("각 게임마다 중복 없이 번호 6개가 필요합니다.");

    const cost = entries.length * 1_000;
    if (profile.balance < cost) return jsonError("로또 구매 코인이 부족합니다.");

    const draw = drawUniqueNumbers(7, 45);
    const mainNumbers = draw.slice(0, 6).sort((a, b) => a - b);
    const bonusNumber = draw[6];
    const roundPrizes = createLottoRoundPrizes();
    const results = entries.map((entry) => {
      const selected = [...entry].sort((a, b) => a - b);
      const result = evaluateLotto(selected, mainNumbers, bonusNumber);
      return {
        selected,
        ...result,
        payout: calculateLottoPayout(result.rank, roundPrizes),
      };
    });
    const netPrize = results.reduce(
      (total, result) => total + result.payout.net,
      0,
    );
    await recordBalanceChange(
      user.id,
      netPrize - cost,
      "lotto",
      `로또 ${entries.length}게임`,
      now,
    );
    return NextResponse.json({
      lotto: {
        mainNumbers,
        bonusNumber,
        roundPrizes,
        results,
        cost,
        netPrize,
      },
      state: await publicState(user.id),
    });
  }

  if (action === "gimbap") {
    const type = Number(body.type);
    if (type !== 1000 && type !== 2000) {
      return jsonError("즉석김밥 종류를 선택해주세요.");
    }
    if (profile.balance < type) return jsonError("김밥 구매 코인이 부족합니다.");
    const ticket = generateScratchTicket(type);
    await recordBalanceChange(
      user.id,
      ticket.prize - type,
      "gimbap",
      `즉석김밥 ${type}`,
      now,
    );
    return NextResponse.json({
      ticket,
      state: await publicState(user.id),
    });
  }

  if (action === "paper_pick" || action === "paper_auto") {
    const board = await ensurePaperBoard();
    const cells = JSON.parse(board.cells_json) as PaperCell[];
    const available = cells.filter((cell) => cell.available);
    if (!available.length) return jsonError("새 뽑기판을 준비하고 있습니다.");

    let chosen: PaperCell | undefined;
    if (action === "paper_pick") {
      if (profile.balance < 1_000) return jsonError("뽑기 코인이 부족합니다.");
      const cellId = String(body.cellId ?? "");
      chosen = cells.find((cell) => cell.id === cellId && cell.available);
      if (!chosen) return jsonError("이미 사라진 뽑기입니다.", 409);
    } else {
      chosen = available[randomInt(available.length)];
    }

    chosen.available = false;
    const remaining = board.remaining - 1;
    const nextCells = remaining === 0 ? makeBoardCells() : cells;
    const nextGeneration =
      remaining === 0 ? board.generation + 1 : board.generation;
    const nextRemaining = remaining === 0 ? 160 : remaining;
    const statements = [
      db()
        .prepare(
          `UPDATE paper_boards SET
             generation = ?, cells_json = ?, remaining = ?, updated_at = ?
           WHERE id = 1`,
        )
        .bind(
          nextGeneration,
          JSON.stringify(nextCells),
          nextRemaining,
          now,
        ),
    ];

    if (action === "paper_pick") {
      statements.push(
        db()
          .prepare(
            "UPDATE profiles SET balance = balance + ?, updated_at = ? WHERE email = ?",
          )
          .bind(chosen.prize - 1_000, now, user.id),
        db()
          .prepare(
            `INSERT INTO coin_transactions
              (user_email, type, amount, description, created_at)
             VALUES (?, 'paper', ?, ?, ?)`,
          )
          .bind(
            user.id,
            chosen.prize - 1_000,
            `종이뽑기 ${chosen.rank}`,
            now,
          ),
      );
    }
    await db().batch(statements);

    return NextResponse.json({
      removedId: chosen.id,
      result:
        action === "paper_pick"
          ? { rank: chosen.rank, prize: chosen.prize }
          : null,
      boardReset: remaining === 0,
      state: await publicState(user.id),
    });
  }

  if (action === "horse_race") {
    const horses = body.horses;
    const selectedHorse = String(body.selectedHorse ?? "");
    const betAmount = Number(body.betAmount);

    if (!Number.isSafeInteger(betAmount) || betAmount < 1) {
      return jsonError("배팅 금액은 1 C 이상 입력해주세요.");
    }
    if (betAmount > profile.balance) {
      return jsonError("보유 코인보다 많이 배팅할 수 없습니다.");
    }

    let race;
    try {
      race = createHorseRace(horses as string[], selectedHorse, betAmount);
    } catch {
      return jsonError("경주마를 다시 선택해주세요.");
    }

    await recordBalanceChange(
      user.id,
      race.payout - betAmount,
      "horse_race",
      `${selectedHorse} 경마 ${race.playerRank}위`,
      now,
    );

    return NextResponse.json({
      race,
      state: await publicState(user.id),
    });
  }

  if (action === "trade") {
    const symbol = String(body.symbol ?? "");
    const side = body.side;
    const quantity = Number(body.quantity);
    if (
      (side !== "buy" && side !== "sell") ||
      !Number.isSafeInteger(quantity) ||
      quantity <= 0
    ) {
      return jsonError("거래 수량을 올바르게 입력해주세요.");
    }

    const market = await advanceMarket();
    const stock = market.find((item) => item.symbol === symbol);
    if (!stock) return jsonError("존재하지 않는 종목입니다.");
    if (stock.status !== "active") {
      return jsonError("현재 거래할 수 없는 종목입니다.");
    }

    const currentHolding = await db()
      .prepare(
        `SELECT symbol, quantity, average_price
         FROM holdings WHERE user_email = ? AND symbol = ?`,
      )
      .bind(user.id, symbol)
      .first<HoldingRow>();
    const held = currentHolding?.quantity ?? 0;
    const total = stock.price * quantity;

    if (side === "buy") {
      if (profile.balance < total) return jsonError("매수 코인이 부족합니다.");
      const newQuantity = held + quantity;
      const newAverage = Math.round(
        ((currentHolding?.average_price ?? 0) * held + total) / newQuantity,
      );
      await db().batch([
        db()
          .prepare(
            "UPDATE profiles SET balance = balance - ?, updated_at = ? WHERE email = ?",
          )
          .bind(total, now, user.id),
        db()
          .prepare(
            `INSERT INTO holdings
              (user_email, symbol, quantity, average_price, updated_at)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(user_email, symbol) DO UPDATE SET
               quantity = excluded.quantity,
               average_price = excluded.average_price,
               updated_at = excluded.updated_at`,
          )
          .bind(user.id, symbol, newQuantity, newAverage, now),
        db()
          .prepare(
            `INSERT INTO coin_transactions
              (user_email, type, amount, description, created_at)
             VALUES (?, 'stock_buy', ?, ?, ?)`,
          )
          .bind(user.id, -total, `${stock.name} ${quantity}주 매수`, now),
      ]);
    } else {
      if (held < quantity) return jsonError("보유 수량이 부족합니다.");
      const newQuantity = held - quantity;
      await db().batch([
        db()
          .prepare(
            "UPDATE profiles SET balance = balance + ?, updated_at = ? WHERE email = ?",
          )
          .bind(total, now, user.id),
        db()
          .prepare(
            `UPDATE holdings SET quantity = ?, average_price = ?, updated_at = ?
             WHERE user_email = ? AND symbol = ?`,
          )
          .bind(
            newQuantity,
            newQuantity ? currentHolding?.average_price ?? 0 : 0,
            now,
            user.id,
            symbol,
          ),
        db()
          .prepare(
            `INSERT INTO coin_transactions
              (user_email, type, amount, description, created_at)
             VALUES (?, 'stock_sell', ?, ?, ?)`,
          )
          .bind(user.id, total, `${stock.name} ${quantity}주 매도`, now),
      ]);
    }

    return NextResponse.json({
      trade: { symbol, side, quantity, price: stock.price, total },
      state: await publicState(user.id, market),
    });
  }

  return jsonError("지원하지 않는 요청입니다.");
}
