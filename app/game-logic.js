export const STARTING_COINS = 1_000_000;
export const LOTTO_GAME_PRICE = 1_000;
export const PAPER_PICK_PRICE = 1_000;

export const LOTTO_BASE_PRIZES = Object.freeze({
  1: 2_000_000_000,
  2: 20_000_000,
  3: 3_000_000,
  4: 50_000,
  5: 5_000,
});

export const SCRATCH_TYPES = Object.freeze({
  1000: {
    id: 1000,
    price: 1_000,
    label: "즉석김밥 1000",
    tiers: [
      { prize: 500_000_000, label: "5억 C", denominator: 5_000_000, rank: "1등" },
      { prize: 20_000_000, label: "2천만 C", denominator: 1_000_000, rank: "2등" },
      { prize: 10_000, label: "1만 C", denominator: 181, rank: "3등" },
      { prize: 5_000, label: "5천 C", denominator: 40, rank: "4등" },
      { prize: 1_000, label: "1천 C", denominator: 3.3, rank: "5등" },
    ],
  },
  2000: {
    id: 2000,
    price: 2_000,
    label: "즉석김밥 2000",
    tiers: [
      { prize: 1_000_000_000, label: "10억 C", denominator: 5_000_000, rank: "1등" },
      { prize: 100_000_000, label: "1억 C", denominator: 6_660_000, rank: "2등" },
      { prize: 10_000_000, label: "1천만 C", denominator: 200_000, rank: "3등" },
      { prize: 20_000, label: "2만 C", denominator: 363, rank: "4등" },
      { prize: 4_000, label: "4천 C", denominator: 14, rank: "5등" },
      { prize: 2_000, label: "2천 C", denominator: 3.6, rank: "6등" },
    ],
  },
});

export const SPETTO_TOTAL_TICKETS = 5_000_000;
export const SPETTO_PRIZE_TABLE = [
  ...SCRATCH_TYPES[1000].tiers.map((tier) => ({
    ...tier,
    count: Math.round(SPETTO_TOTAL_TICKETS / tier.denominator),
  })),
  {
    prize: 0,
    label: "꽝",
    denominator: null,
    rank: null,
    count:
      SPETTO_TOTAL_TICKETS -
      SCRATCH_TYPES[1000].tiers.reduce(
        (total, tier) =>
          total + Math.round(SPETTO_TOTAL_TICKETS / tier.denominator),
        0,
      ),
  },
];

export const PAPER_PRIZES = Object.freeze([
  { rank: "1등", prize: 1_000_000, count: 1 },
  { rank: "2등", prize: 500_000, count: 3 },
  { rank: "3등", prize: 100_000, count: 10 },
  { rank: "4등", prize: 50_000, count: 20 },
  { rank: "꽝", prize: 0, count: 126 },
]);

export const BASE_STOCKS = Object.freeze([
  { symbol: "SSE", name: "사성전자" },
  { symbol: "INX", name: "아이닉스" },
  { symbol: "AAS", name: "안와에어로스페이스" },
  { symbol: "HGE", name: "헬지전자" },
  { symbol: "YDC", name: "연대자동차" },
  { symbol: "GAVER", name: "GAVER" },
  { symbol: "HGES", name: "헬지에너지솔루션" },
  { symbol: "WTR", name: "웰트리온" },
  { symbol: "JSC", name: "제이스건설" },
  { symbol: "GAKAO", name: "가카오" },
]);

export const LEVERAGED_UNDERLYINGS = Object.freeze(["SSE", "INX", "GAVER"]);

export const STOCK_PRODUCTS = Object.freeze([
  ...BASE_STOCKS.map((stock) => ({
    ...stock,
    kind: "base",
    underlying: null,
    multiplier: 1,
    inverse: false,
  })),
  ...BASE_STOCKS.filter((stock) =>
    LEVERAGED_UNDERLYINGS.includes(stock.symbol),
  ).flatMap((stock) => [
    {
      symbol: `${stock.symbol}2L`,
      name: `${stock.name} 2X`,
      kind: "derivative",
      underlying: stock.symbol,
      multiplier: 2,
      inverse: false,
    },
    {
      symbol: `${stock.symbol}2I`,
      name: `${stock.name} 2X 인버스`,
      kind: "derivative",
      underlying: stock.symbol,
      multiplier: 2,
      inverse: true,
    },
    {
      symbol: `${stock.symbol}3L`,
      name: `${stock.name} 3X`,
      kind: "derivative",
      underlying: stock.symbol,
      multiplier: 3,
      inverse: false,
    },
    {
      symbol: `${stock.symbol}3I`,
      name: `${stock.name} 3X 인버스`,
      kind: "derivative",
      underlying: stock.symbol,
      multiplier: 3,
      inverse: true,
    },
  ]),
]);

export const HORSE_NAMES = Object.freeze([
  "타재",
  "칼릭스",
  "불가사리",
  "우갈",
  "우꼬",
  "푸실",
  "캐롯",
  "루시안",
  "릴리아",
  "샤이어",
  "아리오스",
  "샤비",
  "늠름한갈기",
  "길게내린꼬리",
  "차분한갈기",
  "길게내린갈기",
  "앨리",
  "그리폰",
  "백마탄공주",
  "티거",
]);

export const HORSE_PAYOUT_RATES = Object.freeze([0.7, 0.2, 0.1]);

export const RPS_MIN_BET = 1_000;
export const RPS_MOVES = Object.freeze(["rock", "paper", "scissors"]);
export const RPS_MATCH_TYPES = Object.freeze({
  3: 2,
  5: 3,
  7: 5,
});

export const TIMING_GOD_MIN_BET = 1_000;
export const TIMING_GOD_TARGET_HUNDREDTHS = Object.freeze([
  300, 500, 777, 1_000, 1_001,
]);
export const TIMING_GOD_TARGETS = Object.freeze(
  TIMING_GOD_TARGET_HUNDREDTHS.map((target) => target / 100),
);

/**
 * Returns an unbiased integer from 0 (inclusive) to max (exclusive).
 * Web Crypto is used when available, with a Math.random fallback.
 * @param {number} max
 */
export function randomInt(max) {
  if (!Number.isSafeInteger(max) || max <= 0) {
    throw new RangeError("max must be a positive safe integer");
  }

  if (globalThis.crypto?.getRandomValues) {
    const range = 0x1_0000_0000;
    const limit = range - (range % max);
    const bucket = new Uint32Array(1);
    let value;

    do {
      globalThis.crypto.getRandomValues(bucket);
      value = bucket[0];
    } while (value >= limit);

    return value % max;
  }

  return Math.floor(Math.random() * max);
}

/** @template T @param {T[]} values @returns {T[]} */
export function shuffle(values) {
  const result = [...values];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }

  return result;
}

/** @param {number} count @param {number} max @returns {number[]} */
export function drawUniqueNumbers(count, max) {
  if (count > max) {
    throw new RangeError("count cannot be greater than max");
  }

  return shuffle(
    Array.from({ length: max }, (_, index) => index + 1),
  ).slice(0, count);
}

export function createHorseRoster() {
  return shuffle(HORSE_NAMES).slice(0, 12);
}

/** @param {number} matchType */
export function getRpsWinsRequired(matchType) {
  const winsRequired = RPS_MATCH_TYPES[matchType];
  if (!winsRequired) {
    throw new RangeError("match type must be 3, 5, or 7");
  }
  return winsRequired;
}

/**
 * Generates an integer AI stake within the player's inclusive ±25% range.
 * @param {number} playerBet
 * @param {(max: number) => number} randomIntFn
 */
export function createRpsAiBet(playerBet, randomIntFn = randomInt) {
  if (!Number.isSafeInteger(playerBet) || playerBet < RPS_MIN_BET) {
    throw new RangeError(`player bet must be at least ${RPS_MIN_BET}`);
  }

  const minimum = Math.ceil(playerBet * 0.75);
  const maximum = Math.floor(playerBet * 1.25);
  if (!Number.isSafeInteger(minimum) || !Number.isSafeInteger(maximum)) {
    throw new RangeError("player bet is too large");
  }

  return minimum + randomIntFn(maximum - minimum + 1);
}

/** @param {(max: number) => number} randomIntFn */
export function createRpsMove(randomIntFn = randomInt) {
  return RPS_MOVES[randomIntFn(RPS_MOVES.length)];
}

/**
 * Builds a cyclic three-lamp reveal that slows down and lands on the
 * predetermined AI move without visually jumping over a lamp.
 * @param {number} startIndex
 * @param {number} targetIndex
 * @param {boolean} reducedMotion
 */
export function createRpsRevealSteps(
  startIndex,
  targetIndex,
  reducedMotion = false,
) {
  for (const index of [startIndex, targetIndex]) {
    if (!Number.isSafeInteger(index) || index < 0 || index > 2) {
      throw new RangeError("RPS lamp indexes must be between zero and two");
    }
  }
  if (reducedMotion) {
    return [{ index: targetIndex, delay: 180 }];
  }

  const minimumSteps = 10;
  const stepCount =
    minimumSteps +
    ((targetIndex - ((startIndex + minimumSteps) % 3) + 3) % 3);

  return Array.from({ length: stepCount }, (_, index) => {
    const ratio = stepCount === 1 ? 1 : index / (stepCount - 1);
    return {
      index: (startIndex + index + 1) % 3,
      delay: 70 + Math.round(ratio * ratio * 260),
    };
  });
}

/**
 * @param {string} playerMove
 * @param {string} aiMove
 * @returns {"win" | "lose" | "draw"}
 */
export function evaluateRpsRound(playerMove, aiMove) {
  if (!RPS_MOVES.includes(playerMove) || !RPS_MOVES.includes(aiMove)) {
    throw new RangeError("invalid rock-paper-scissors move");
  }
  if (playerMove === aiMove) return "draw";

  const winningMove = {
    rock: "scissors",
    paper: "rock",
    scissors: "paper",
  };
  return winningMove[playerMove] === aiMove ? "win" : "lose";
}

/**
 * Advances only the score and terminal state for a revealed RPS round.
 * Draws leave both scores unchanged and are not decisive rounds.
 * @param {number} playerWins
 * @param {number} aiWins
 * @param {"win" | "lose" | "draw"} result
 * @param {number} winsRequired
 */
export function advanceRpsScore(
  playerWins,
  aiWins,
  result,
  winsRequired,
) {
  if (
    !Number.isSafeInteger(playerWins) ||
    playerWins < 0 ||
    !Number.isSafeInteger(aiWins) ||
    aiWins < 0
  ) {
    throw new RangeError("RPS scores must be non-negative safe integers");
  }
  if (!["win", "lose", "draw"].includes(result)) {
    throw new RangeError("invalid RPS round result");
  }
  if (
    !Number.isSafeInteger(winsRequired) ||
    !Object.values(RPS_MATCH_TYPES).includes(winsRequired)
  ) {
    throw new RangeError("invalid RPS win target");
  }
  if (playerWins >= winsRequired || aiWins >= winsRequired) {
    throw new RangeError("RPS match is already complete");
  }

  const nextPlayerWins = playerWins + (result === "win" ? 1 : 0);
  const nextAiWins = aiWins + (result === "lose" ? 1 : 0);
  const winner =
    nextPlayerWins >= winsRequired
      ? "player"
      : nextAiWins >= winsRequired
        ? "ai"
        : null;

  return {
    playerWins: nextPlayerWins,
    aiWins: nextAiWins,
    decisiveRound: result !== "draw",
    winner,
    complete: winner !== null,
  };
}

/** @param {number} target */
export function getTimingTargetHundredths(target) {
  if (!Number.isFinite(target)) {
    throw new RangeError("timing target must be a finite number");
  }
  const hundredths = Math.round(target * 100);
  if (
    Math.abs(target * 100 - hundredths) > Number.EPSILON * 1_000 ||
    !TIMING_GOD_TARGET_HUNDREDTHS.includes(hundredths)
  ) {
    throw new RangeError("unknown timing target");
  }
  return hundredths;
}

/** @param {number} failureCount */
export function calculateTimingMultiplier(failureCount) {
  if (!Number.isSafeInteger(failureCount) || failureCount < 0) {
    throw new RangeError("failure count must be a non-negative safe integer");
  }
  const multiplierTenths = 11 + failureCount;
  if (!Number.isSafeInteger(multiplierTenths)) {
    throw new RangeError("timing multiplier is too large");
  }
  return multiplierTenths / 10;
}

/**
 * @param {number} betAmount
 * @param {number} failureCount
 */
export function calculateTimingPayout(betAmount, failureCount) {
  if (
    !Number.isSafeInteger(betAmount) ||
    betAmount < TIMING_GOD_MIN_BET
  ) {
    throw new RangeError(`bet must be at least ${TIMING_GOD_MIN_BET}`);
  }
  if (!Number.isSafeInteger(failureCount) || failureCount < 0) {
    throw new RangeError("failure count must be a non-negative safe integer");
  }
  const multiplierTenths = 11 + failureCount;
  const payoutTenths = betAmount * multiplierTenths;
  if (
    !Number.isSafeInteger(multiplierTenths) ||
    !Number.isSafeInteger(payoutTenths)
  ) {
    throw new RangeError("timing payout is too large");
  }
  return Math.floor(payoutTenths / 10);
}

/**
 * Compares integer hundredths so floating-point formatting cannot change the
 * result at the exact two-decimal boundary.
 * @param {number} targetHundredths
 * @param {number} elapsedHundredths
 */
export function evaluateTimingAttempt(
  targetHundredths,
  elapsedHundredths,
) {
  if (!TIMING_GOD_TARGET_HUNDREDTHS.includes(targetHundredths)) {
    throw new RangeError("unknown timing target");
  }
  if (!Number.isSafeInteger(elapsedHundredths) || elapsedHundredths < 0) {
    throw new RangeError(
      "elapsed time must be a non-negative integer hundredth",
    );
  }
  return elapsedHundredths === targetHundredths;
}

/**
 * Prepares the full 30-second betting pool and race result.
 * @param {string[]} horses
 * @param {string} selectedHorse
 * @param {number} betAmount
 */
export function createHorseRace(horses, selectedHorse, betAmount) {
  if (
    !Array.isArray(horses) ||
    horses.length !== 12 ||
    new Set(horses).size !== 12 ||
    !horses.every((horse) => HORSE_NAMES.includes(horse))
  ) {
    throw new RangeError("invalid horse roster");
  }
  if (!horses.includes(selectedHorse)) {
    throw new RangeError("selected horse is not in the race");
  }
  if (!Number.isSafeInteger(betAmount) || betAmount < 1) {
    throw new RangeError("bet must be a positive safe integer");
  }

  const participantCount = randomInt(451) + 50;
  const participantBets = Object.fromEntries(
    horses.map((horse) => [horse, 1]),
  );
  for (let index = 12; index < participantCount; index += 1) {
    const horse = horses[randomInt(horses.length)];
    participantBets[horse] += 1;
  }

  const poolTicks = [];
  let totalPool = betAmount;
  let previousParticipants = 1;
  for (let index = 0; index < 30; index += 1) {
    const increment = randomInt(99_999_901) + 100;
    totalPool += increment;
    const timeRatio = (index + 1) / 30;
    const jitter = index === 29 ? 0 : randomInt(17) - 8;
    const participants =
      index === 29
        ? participantCount
        : Math.min(
            participantCount,
            Math.max(
              previousParticipants,
              Math.round(participantCount * timeRatio) + jitter,
            ),
          );
    previousParticipants = participants;
    poolTicks.push({
      second: index + 1,
      increment,
      total: totalPool,
      participants,
    });
  }

  const ranking = shuffle(horses);
  const playerRank = ranking.indexOf(selectedHorse) + 1;
  const payoutRate = HORSE_PAYOUT_RATES[playerRank - 1] ?? 0;
  const winners = participantBets[selectedHorse];
  const payout =
    payoutRate > 0 ? Math.floor((totalPool * payoutRate) / winners) : 0;

  return {
    horses: [...horses],
    selectedHorse,
    betAmount,
    poolTicks,
    totalPool,
    participantCount,
    participantBets,
    ranking,
    playerRank,
    payoutRate,
    winners,
    payout,
  };
}

/**
 * @param {number[]} selected
 * @param {number[]} mainNumbers
 * @param {number} bonusNumber
 */
export function evaluateLotto(selected, mainNumbers, bonusNumber) {
  const mainSet = new Set(mainNumbers);
  const matchCount = selected.filter((number) => mainSet.has(number)).length;
  const bonusMatch = selected.includes(bonusNumber);

  if (matchCount === 6) {
    return {
      rank: 1,
      matchCount,
      bonusMatch: false,
      eyebrow: "확률 1 / 8,145,060",
      title: "말도 안 돼, 1등!",
      message: "선택한 여섯 숫자가 모두 맞았습니다.",
    };
  }
  if (matchCount === 5 && bonusMatch) {
    return {
      rank: 2,
      matchCount,
      bonusMatch: true,
      eyebrow: "본번호 5개 + 보너스",
      title: "짜릿한 2등!",
      message: "본번호 다섯 개와 보너스 번호까지 맞았습니다.",
    };
  }
  if (matchCount === 5) {
    return {
      rank: 3,
      matchCount,
      bonusMatch: false,
      eyebrow: "본번호 5개 일치",
      title: "엄청난 3등!",
      message: "다섯 숫자가 정확히 맞았습니다.",
    };
  }
  if (matchCount === 4) {
    return {
      rank: 4,
      matchCount,
      bonusMatch,
      eyebrow: "본번호 4개 일치",
      title: "기분 좋은 4등!",
      message: "네 숫자를 맞혔습니다.",
    };
  }
  if (matchCount === 3) {
    return {
      rank: 5,
      matchCount,
      bonusMatch,
      eyebrow: "본번호 3개 일치",
      title: "당첨, 5등!",
      message: "세 숫자가 맞았습니다.",
    };
  }
  return {
    rank: null,
    matchCount,
    bonusMatch,
    eyebrow: `${matchCount}개 일치`,
    title: "이번 공은 살짝 빗나갔어요",
    message: "다음 회차의 확률은 완전히 새로 섞입니다.",
  };
}

/** @param {number} prize */
export function calculateOtherIncomeTax(prize) {
  if (prize <= 0) return 0;
  const firstBracket = Math.min(prize, 100_000_000);
  const excess = Math.max(0, prize - 100_000_000);
  return Math.floor(firstBracket * 0.22 + excess * 0.33);
}

/**
 * @param {number|null} rank
 * @param {Record<number, number>} roundPrizes
 */
export function calculateLottoPayout(rank, roundPrizes) {
  if (!rank) return { gross: 0, tax: 0, net: 0 };
  const gross = roundPrizes[rank] ?? 0;
  const tax = rank <= 3 ? calculateOtherIncomeTax(gross) : 0;
  return { gross, tax, net: gross - tax };
}

/** @param {number=} variationPercent */
export function createLottoRoundPrizes(variationPercent) {
  const factor =
    variationPercent === undefined
      ? 0.9 + randomInt(200_001) / 1_000_000
      : 1 + variationPercent / 100;

  return Object.fromEntries(
    Object.entries(LOTTO_BASE_PRIZES).map(([rank, prize]) => [
      Number(rank),
      Math.round((prize * factor) / 1_000) * 1_000,
    ]),
  );
}

/** @param {number} type */
function drawScratchPrize(type) {
  const config = SCRATCH_TYPES[type];
  if (!config) throw new RangeError("unknown scratch ticket type");

  const roll = randomInt(1_000_000_000) / 1_000_000_000;
  let cursor = 0;
  for (const tier of config.tiers) {
    cursor += 1 / tier.denominator;
    if (roll < cursor) return tier;
  }

  return { prize: 0, label: "꽝", denominator: null, rank: null };
}

/** @param {number} type */
function drawDecoyPrize(type) {
  const prizes = SCRATCH_TYPES[type].tiers.map((tier) => tier.prize);
  return prizes[randomInt(prizes.length)];
}

/** Builds the complete ticket before any scratch surface is revealed. */
export function generateScratchTicket(type = 1000) {
  const config = SCRATCH_TYPES[type];
  if (!config) throw new RangeError("unknown scratch ticket type");

  const tier = drawScratchPrize(type);
  const luckyNumber = randomInt(9) + 1;
  const otherNumbers = shuffle(
    Array.from({ length: 9 }, (_, index) => index + 1).filter(
      (number) => number !== luckyNumber,
    ),
  );
  const isWinner = tier.prize > 0;
  const winningIndex = isWinner ? randomInt(6) : -1;
  const chosenOthers = otherNumbers.slice(0, isWinner ? 5 : 6);
  const myNumbers = [];

  for (let index = 0; index < 6; index += 1) {
    myNumbers.push(
      index === winningIndex ? luckyNumber : chosenOthers.shift(),
    );
  }

  return {
    type,
    price: config.price,
    luckyNumber,
    cells: myNumbers.map((number, index) => ({
      number,
      prize:
        index === winningIndex ? tier.prize : drawDecoyPrize(type),
      matches: index === winningIndex,
    })),
    winningIndex,
    isWinner,
    prize: tier.prize,
    prizeLabel: tier.label,
    rank: tier.rank,
  };
}

export function createPaperBoard() {
  const cells = PAPER_PRIZES.flatMap((tier) =>
    Array.from({ length: tier.count }, (_, index) => ({
      id: `${tier.rank}-${index + 1}`,
      rank: tier.rank,
      prize: tier.prize,
    })),
  );
  return shuffle(cells).map((cell, index) => ({
    ...cell,
    id: `P${String(index + 1).padStart(3, "0")}`,
  }));
}

/**
 * @param {number} price
 * @param {number} changeRate
 */
export function applyStockChange(price, changeRate) {
  return Math.max(1_000, Math.round(price * (1 + changeRate)));
}

/**
 * @param {number} baseRate
 * @param {number} multiplier
 * @param {boolean} inverse
 */
export function derivativeRate(baseRate, multiplier, inverse) {
  return baseRate * multiplier * (inverse ? -1 : 1);
}

export function formatCoins(amount) {
  return `${new Intl.NumberFormat("ko-KR").format(Math.trunc(amount))} C`;
}

// Kept for the existing UI and external links that still import this helper.
export function formatWon(amount) {
  return new Intl.NumberFormat("ko-KR").format(amount);
}
