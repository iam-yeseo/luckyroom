import assert from "node:assert/strict";
import test from "node:test";
import {
  BASE_STOCKS,
  HORSE_NAMES,
  HORSE_PAYOUT_RATES,
  LOTTO_BASE_PRIZES,
  PAPER_PRIZES,
  RPS_MATCH_TYPES,
  RPS_MIN_BET,
  RPS_MOVES,
  SPETTO_PRIZE_TABLE,
  SPETTO_TOTAL_TICKETS,
  STOCK_PRODUCTS,
  SCRATCH_TYPES,
  TIMING_GOD_MIN_BET,
  TIMING_GOD_TARGET_HUNDREDTHS,
  TIMING_GOD_TARGETS,
  advanceRpsScore,
  applyStockChange,
  calculateLottoPayout,
  calculateOtherIncomeTax,
  calculateTimingMultiplier,
  calculateTimingPayout,
  createHorseRace,
  createHorseRoster,
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

test("horse derby draws twelve unique names and settles the full payout flow", () => {
  assert.equal(HORSE_NAMES.length, 20);
  assert.deepEqual(HORSE_PAYOUT_RATES, [0.7, 0.2, 0.1]);

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const horses = createHorseRoster();
    const selectedHorse = horses[0];
    const race = createHorseRace(horses, selectedHorse, 1);

    assert.equal(horses.length, 12);
    assert.equal(new Set(horses).size, 12);
    assert.ok(horses.every((horse) => HORSE_NAMES.includes(horse)));
    assert.equal(race.poolTicks.length, 30);
    assert.equal(race.poolTicks.at(-1).total, race.totalPool);
    assert.equal(race.poolTicks.at(-1).participants, race.participantCount);
    assert.ok(
      race.poolTicks.every(
        (tick) => tick.increment >= 100 && tick.increment <= 100_000_000,
      ),
    );
    assert.ok(race.participantCount >= 50 && race.participantCount <= 500);
    assert.equal(race.ranking.length, 12);
    assert.equal(new Set(race.ranking).size, 12);
    assert.ok(race.playerRank >= 1 && race.playerRank <= 12);
    assert.equal(
      Object.values(race.participantBets).reduce(
        (sum, participants) => sum + participants,
        0,
      ),
      race.participantCount,
    );

    if (race.playerRank <= 3) {
      assert.equal(
        race.payout,
        Math.floor(
          (race.totalPool * HORSE_PAYOUT_RATES[race.playerRank - 1]) /
            race.winners,
        ),
      );
    } else {
      assert.equal(race.payout, 0);
    }
  }
});

test("rock-paper-scissors preserves every requested match type and move", () => {
  assert.equal(RPS_MIN_BET, 1_000);
  assert.deepEqual(RPS_MOVES, ["rock", "paper", "scissors"]);
  assert.deepEqual(
    Object.entries(RPS_MATCH_TYPES).map(([matchType, winsRequired]) => [
      Number(matchType),
      winsRequired,
    ]),
    [
      [3, 2],
      [5, 3],
      [7, 5],
    ],
  );
  assert.equal(getRpsWinsRequired(3), 2);
  assert.equal(getRpsWinsRequired(5), 3);
  assert.equal(getRpsWinsRequired(7), 5);
  assert.throws(() => getRpsWinsRequired(1), RangeError);
  assert.throws(() => getRpsWinsRequired(9), RangeError);

  assert.equal(createRpsMove(() => 0), "rock");
  assert.equal(createRpsMove(() => 1), "paper");
  assert.equal(createRpsMove(() => 2), "scissors");
});

test("rock-paper-scissors evaluator covers wins, losses, and draws", () => {
  const outcomes = [
    ["rock", "rock", "draw"],
    ["rock", "paper", "lose"],
    ["rock", "scissors", "win"],
    ["paper", "rock", "win"],
    ["paper", "paper", "draw"],
    ["paper", "scissors", "lose"],
    ["scissors", "rock", "lose"],
    ["scissors", "paper", "win"],
    ["scissors", "scissors", "draw"],
  ];

  for (const [playerMove, aiMove, result] of outcomes) {
    assert.equal(evaluateRpsRound(playerMove, aiMove), result);
  }

  assert.throws(() => evaluateRpsRound("invalid", "rock"), RangeError);
  assert.throws(() => evaluateRpsRound("rock", "invalid"), RangeError);
});

test("rock-paper-scissors score advances only to the configured win target", () => {
  assert.deepEqual(advanceRpsScore(0, 0, "draw", 2), {
    playerWins: 0,
    aiWins: 0,
    decisiveRound: false,
    winner: null,
    complete: false,
  });

  assert.deepEqual(advanceRpsScore(1, 0, "win", 2), {
    playerWins: 2,
    aiWins: 0,
    decisiveRound: true,
    winner: "player",
    complete: true,
  });
  assert.deepEqual(advanceRpsScore(0, 1, "lose", 2), {
    playerWins: 0,
    aiWins: 2,
    decisiveRound: true,
    winner: "ai",
    complete: true,
  });

  assert.deepEqual(advanceRpsScore(2, 2, "win", 3), {
    playerWins: 3,
    aiWins: 2,
    decisiveRound: true,
    winner: "player",
    complete: true,
  });
  assert.deepEqual(advanceRpsScore(2, 2, "lose", 3), {
    playerWins: 2,
    aiWins: 3,
    decisiveRound: true,
    winner: "ai",
    complete: true,
  });

  const seventhDecisiveRound = advanceRpsScore(3, 3, "win", 5);
  assert.deepEqual(seventhDecisiveRound, {
    playerWins: 4,
    aiWins: 3,
    decisiveRound: true,
    winner: null,
    complete: false,
  });
  assert.deepEqual(
    advanceRpsScore(
      seventhDecisiveRound.playerWins,
      seventhDecisiveRound.aiWins,
      "win",
      5,
    ),
    {
      playerWins: 5,
      aiWins: 3,
      decisiveRound: true,
      winner: "player",
      complete: true,
    },
  );

  assert.throws(() => advanceRpsScore(-1, 0, "win", 2), RangeError);
  assert.throws(() => advanceRpsScore(0.5, 0, "win", 2), RangeError);
  assert.throws(() => advanceRpsScore(0, 0, "invalid", 2), RangeError);
  assert.throws(() => advanceRpsScore(0, 0, "win", 4), RangeError);
  assert.throws(() => advanceRpsScore(2, 0, "draw", 2), RangeError);
  assert.throws(() => advanceRpsScore(0, 3, "win", 3), RangeError);
});

test("AI stake uses the inclusive integer plus-or-minus twenty-five-percent range", () => {
  let requestedBuckets = 0;
  assert.equal(
    createRpsAiBet(1_000, (bucketCount) => {
      requestedBuckets = bucketCount;
      return 0;
    }),
    750,
  );
  assert.equal(requestedBuckets, 501);
  assert.equal(
    createRpsAiBet(1_000, (bucketCount) => bucketCount - 1),
    1_250,
  );
  assert.equal(createRpsAiBet(1_001, () => 0), 751);
  assert.equal(
    createRpsAiBet(1_001, (bucketCount) => bucketCount - 1),
    1_251,
  );

  assert.throws(() => createRpsAiBet(999, () => 0), RangeError);
  assert.throws(() => createRpsAiBet(1_000.5, () => 0), RangeError);
  assert.throws(
    () => createRpsAiBet(Number.MAX_SAFE_INTEGER, () => 0),
    RangeError,
  );
});

test("Timing God compares the five targets as exact integer hundredths", () => {
  assert.equal(TIMING_GOD_MIN_BET, 1_000);
  assert.deepEqual(TIMING_GOD_TARGET_HUNDREDTHS, [
    300, 500, 777, 1_000, 1_001,
  ]);
  assert.deepEqual(TIMING_GOD_TARGETS, [3, 5, 7.77, 10, 10.01]);

  for (const [target, hundredths] of TIMING_GOD_TARGETS.map(
    (target, index) => [target, TIMING_GOD_TARGET_HUNDREDTHS[index]],
  )) {
    assert.equal(getTimingTargetHundredths(target), hundredths);
    assert.equal(evaluateTimingAttempt(hundredths, hundredths), true);
    assert.equal(evaluateTimingAttempt(hundredths, hundredths - 1), false);
    assert.equal(evaluateTimingAttempt(hundredths, hundredths + 1), false);
  }

  assert.throws(() => getTimingTargetHundredths(7.78), RangeError);
  assert.throws(() => getTimingTargetHundredths(Number.NaN), RangeError);
  assert.throws(() => evaluateTimingAttempt(778, 778), RangeError);
  assert.throws(() => evaluateTimingAttempt(1_000, -1), RangeError);
  assert.throws(() => evaluateTimingAttempt(1_000, 1_000.5), RangeError);
});

test("Timing God multiplier grows by 0.1 per failure and resets through settlement", () => {
  assert.equal(calculateTimingMultiplier(0), 1.1);
  assert.equal(calculateTimingMultiplier(1), 1.2);
  assert.equal(calculateTimingMultiplier(10), 2.1);
  assert.equal(calculateTimingPayout(1_000, 0), 1_100);
  assert.equal(calculateTimingPayout(1_000, 1), 1_200);
  assert.equal(calculateTimingPayout(1_000, 10), 2_100);
  assert.equal(calculateTimingPayout(1_001, 0), 1_101);

  assert.throws(() => calculateTimingMultiplier(-1), RangeError);
  assert.throws(() => calculateTimingMultiplier(0.5), RangeError);
  assert.throws(() => calculateTimingPayout(999, 0), RangeError);
  assert.throws(() => calculateTimingPayout(1_000.5, 0), RangeError);
  assert.throws(() => calculateTimingPayout(1_000, -1), RangeError);
});
