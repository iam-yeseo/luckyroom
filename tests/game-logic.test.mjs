import assert from "node:assert/strict";
import test from "node:test";
import {
  BASE_STOCKS,
  LOTTO_BASE_PRIZES,
  PAPER_PRIZES,
  SPETTO_PRIZE_TABLE,
  SPETTO_TOTAL_TICKETS,
  STOCK_PRODUCTS,
  SCRATCH_TYPES,
  applyStockChange,
  calculateLottoPayout,
  calculateOtherIncomeTax,
  createLottoRoundPrizes,
  createPaperBoard,
  derivativeRate,
  drawUniqueNumbers,
  evaluateLotto,
  generateScratchTicket,
} from "../app/game-logic.js";

test("drawUniqueNumbers draws unique in-range values", () => {
  for (let attempt = 0; attempt < 250; attempt += 1) {
    const draw = drawUniqueNumbers(7, 45);
    assert.equal(draw.length, 7);
    assert.equal(new Set(draw).size, 7);
    assert.ok(draw.every((number) => number >= 1 && number <= 45));
  }
});

test("lotto evaluator distinguishes every official rank", () => {
  const main = [1, 2, 3, 4, 5, 6];
  const bonus = 7;

  assert.equal(evaluateLotto([1, 2, 3, 4, 5, 6], main, bonus).rank, 1);
  assert.equal(evaluateLotto([1, 2, 3, 4, 5, 7], main, bonus).rank, 2);
  assert.equal(evaluateLotto([1, 2, 3, 4, 5, 8], main, bonus).rank, 3);
  assert.equal(evaluateLotto([1, 2, 3, 4, 8, 9], main, bonus).rank, 4);
  assert.equal(evaluateLotto([1, 2, 3, 8, 9, 10], main, bonus).rank, 5);
  assert.equal(evaluateLotto([1, 2, 7, 8, 9, 10], main, bonus).rank, null);
});

test("Spetto prize weights exactly fill the official five-million ticket pool", () => {
  const total = SPETTO_PRIZE_TABLE.reduce((sum, tier) => sum + tier.count, 0);
  assert.equal(total, SPETTO_TOTAL_TICKETS);
  assert.equal(total, 5_000_000);
});

test("both instant gimbap ticket types are internally consistent", () => {
  for (const type of [1000, 2000]) {
    for (let attempt = 0; attempt < 500; attempt += 1) {
      const ticket = generateScratchTicket(type);
      const numbers = ticket.cells.map((cell) => cell.number);
      const matchingCells = ticket.cells.filter(
        (cell) => cell.number === ticket.luckyNumber,
      );

      assert.equal(ticket.type, type);
      assert.equal(ticket.price, type);
      assert.equal(ticket.cells.length, 6);
      assert.equal(new Set(numbers).size, 6);
      assert.ok(numbers.every((number) => number >= 1 && number <= 9));
      assert.ok(ticket.luckyNumber >= 1 && ticket.luckyNumber <= 9);

      if (ticket.isWinner) {
        assert.equal(matchingCells.length, 1);
        assert.equal(ticket.cells[ticket.winningIndex].prize, ticket.prize);
        assert.ok(ticket.prize > 0);
      } else {
        assert.equal(matchingCells.length, 0);
        assert.equal(ticket.winningIndex, -1);
        assert.equal(ticket.prize, 0);
      }
    }
  }
});

test("instant gimbap tables preserve every requested prize and probability", () => {
  assert.deepEqual(
    SCRATCH_TYPES[1000].tiers.map(({ prize, denominator }) => [
      prize,
      denominator,
    ]),
    [
      [500_000_000, 5_000_000],
      [20_000_000, 1_000_000],
      [10_000, 181],
      [5_000, 40],
      [1_000, 3.3],
    ],
  );
  assert.deepEqual(
    SCRATCH_TYPES[2000].tiers.map(({ prize, denominator }) => [
      prize,
      denominator,
    ]),
    [
      [1_000_000_000, 5_000_000],
      [100_000_000, 6_660_000],
      [10_000_000, 200_000],
      [20_000, 363],
      [4_000, 14],
      [2_000, 3.6],
    ],
  );
});

test("lotto round prizes vary within exactly plus or minus ten percent", () => {
  const low = createLottoRoundPrizes(-10);
  const high = createLottoRoundPrizes(10);

  for (const [rank, base] of Object.entries(LOTTO_BASE_PRIZES)) {
    assert.equal(low[rank], Math.round((base * 0.9) / 1_000) * 1_000);
    assert.equal(high[rank], Math.round((base * 1.1) / 1_000) * 1_000);
  }
});

test("lotto tax is progressive for ranks one through three", () => {
  assert.equal(calculateOtherIncomeTax(100_000_000), 22_000_000);
  assert.equal(calculateOtherIncomeTax(200_000_000), 55_000_000);
  assert.deepEqual(calculateLottoPayout(1, { 1: 200_000_000 }), {
    gross: 200_000_000,
    tax: 55_000_000,
    net: 145_000_000,
  });
  assert.deepEqual(calculateLottoPayout(4, { 4: 50_000 }), {
    gross: 50_000,
    tax: 0,
    net: 50_000,
  });
});

test("paper board always contains 160 randomly positioned prizes", () => {
  const board = createPaperBoard();
  assert.equal(board.length, 160);
  assert.equal(new Set(board.map((cell) => cell.id)).size, 160);

  for (const tier of PAPER_PRIZES) {
    assert.equal(
      board.filter(
        (cell) => cell.rank === tier.rank && cell.prize === tier.prize,
      ).length,
      tier.count,
    );
  }
});

test("market includes ten stocks and twelve leveraged products", () => {
  assert.equal(BASE_STOCKS.length, 10);
  assert.equal(STOCK_PRODUCTS.length, 22);
  assert.equal(
    STOCK_PRODUCTS.filter((stock) => stock.kind === "derivative").length,
    12,
  );
  assert.ok(Math.abs(derivativeRate(0.05, 3, false) - 0.15) < 1e-10);
  assert.ok(Math.abs(derivativeRate(0.05, 3, true) + 0.15) < 1e-10);
  assert.equal(applyStockChange(1_050, -0.2), 1_000);
});
