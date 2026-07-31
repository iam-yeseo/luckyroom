import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const profiles = sqliteTable("profiles", {
  email: text("email").primaryKey(),
  displayName: text("display_name").notNull(),
  balance: integer("balance").notNull().default(1_000_000),
  savedLuck: integer("saved_luck").notNull().default(0),
  lastEarnAt: integer("last_earn_at").notNull().default(0),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const holdings = sqliteTable(
  "holdings",
  {
    userEmail: text("user_email")
      .notNull()
      .references(() => profiles.email),
    symbol: text("symbol").notNull(),
    quantity: integer("quantity").notNull().default(0),
    averagePrice: integer("average_price").notNull().default(0),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.userEmail, table.symbol] })],
);

export const marketState = sqliteTable("market_state", {
  symbol: text("symbol").primaryKey(),
  name: text("name").notNull(),
  kind: text("kind").notNull(),
  underlying: text("underlying"),
  multiplier: integer("multiplier").notNull().default(1),
  inverse: integer("inverse", { mode: "boolean" }).notNull().default(false),
  price: integer("price").notNull(),
  previousPrice: integer("previous_price").notNull(),
  status: text("status").notNull().default("active"),
  phaseStartedAt: integer("phase_started_at").notNull().default(0),
  updatedAt: integer("updated_at").notNull(),
});

export const paperBoards = sqliteTable("paper_boards", {
  id: integer("id").primaryKey(),
  generation: integer("generation").notNull(),
  cellsJson: text("cells_json").notNull(),
  remaining: integer("remaining").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const coinTransactions = sqliteTable(
  "coin_transactions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userEmail: text("user_email")
      .notNull()
      .references(() => profiles.email),
    type: text("type").notNull(),
    amount: integer("amount").notNull(),
    description: text("description").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("coin_transactions_user_idx").on(
      table.userEmail,
      table.createdAt,
    ),
  ],
);

export const rpsMatches = sqliteTable(
  "rps_matches",
  {
    id: text("id").primaryKey(),
    userEmail: text("user_email")
      .notNull()
      .references(() => profiles.email),
    matchType: integer("match_type").notNull(),
    winsRequired: integer("wins_required").notNull(),
    playerBet: integer("player_bet").notNull(),
    aiBet: integer("ai_bet").notNull(),
    playerWins: integer("player_wins").notNull().default(0),
    aiWins: integer("ai_wins").notNull().default(0),
    decisiveRounds: integer("decisive_rounds").notNull().default(0),
    attempts: integer("attempts").notNull().default(0),
    aiMove: text("ai_move").notNull(),
    historyJson: text("history_json").notNull().default("[]"),
    status: text("status").notNull().default("active"),
    winner: text("winner"),
    payout: integer("payout").notNull().default(0),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    completedAt: integer("completed_at"),
  },
  (table) => [
    uniqueIndex("rps_matches_active_user_idx")
      .on(table.userEmail)
      .where(sql`${table.status} = 'active'`),
  ],
);

export const timingStats = sqliteTable("timing_stats", {
  userEmail: text("user_email")
    .primaryKey()
    .references(() => profiles.email),
  failureCount: integer("failure_count").notNull().default(0),
  updatedAt: integer("updated_at").notNull(),
});

export const timingGames = sqliteTable(
  "timing_games",
  {
    id: text("id").primaryKey(),
    userEmail: text("user_email")
      .notNull()
      .references(() => profiles.email),
    targetHundredths: integer("target_hundredths").notNull(),
    betAmount: integer("bet_amount").notNull(),
    failureCount: integer("failure_count").notNull(),
    multiplierTenths: integer("multiplier_tenths").notNull(),
    startedAt: integer("started_at").notNull(),
    status: text("status").notNull().default("active"),
    elapsedHundredths: integer("elapsed_hundredths"),
    success: integer("success", { mode: "boolean" }),
    payout: integer("payout").notNull().default(0),
    completedAt: integer("completed_at"),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("timing_games_active_user_idx")
      .on(table.userEmail)
      .where(sql`${table.status} = 'active'`),
  ],
);

export const gameActionReceipts = sqliteTable("game_action_receipts", {
  id: text("id").primaryKey(),
  userEmail: text("user_email")
    .notNull()
    .references(() => profiles.email),
  action: text("action").notNull(),
  createdAt: integer("created_at").notNull(),
});
