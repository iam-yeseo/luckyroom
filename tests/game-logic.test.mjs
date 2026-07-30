import assert from "node:assert/strict";
import test from "node:test";
import {
  SPETTO_PRIZE_TABLE,
  SPETTO_TOTAL_TICKETS,
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

test("scratch ticket result is fixed and internally consistent", () => {
  for (let attempt = 0; attempt < 1_000; attempt += 1) {
    const ticket = generateScratchTicket();
    const numbers = ticket.cells.map((cell) => cell.number);
    const matchingCells = ticket.cells.filter(
      (cell) => cell.number === ticket.luckyNumber,
    );

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
});
