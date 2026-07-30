import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
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
