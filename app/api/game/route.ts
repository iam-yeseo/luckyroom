import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { getPublicUser } from "@/app/public-user";
import {
  STOCK_PRODUCTS,
  applyStockChange,
  calculateLottoPayout,
  createLottoRoundPrizes,
  createPaperBoard,
  derivativeRate,
  drawUniqueNumbers,
  evaluateLotto,
  generateScratchTicket,
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
    } else if (row.status === "active" && now - row.updated_at >= 10_000) {
      const ticks = Math.min(12, Math.floor((now - row.updated_at) / 10_000));
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
        updated_at: row.updated_at + ticks * 10_000,
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
  const [profile, holdingsResult, board, transactionsResult] =
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
    ]);
  const marketRows = market ?? (await advanceMarket());
  const cells = JSON.parse(board.cells_json) as PaperCell[];

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
