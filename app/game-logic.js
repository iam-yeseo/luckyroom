export const SPETTO_TOTAL_TICKETS = 5_000_000;

export const SPETTO_PRIZE_TABLE = [
  { prize: 500_000_000, label: "5억원", count: 1, rank: "1등" },
  { prize: 20_000_000, label: "2천만원", count: 5, rank: "2등" },
  { prize: 10_000, label: "1만원", count: 27_500, rank: "3등" },
  { prize: 5_000, label: "5천원", count: 125_000, rank: "4등" },
  { prize: 1_000, label: "1천원", count: 1_500_000, rank: "5등" },
  { prize: 0, label: "꽝", count: 3_347_494, rank: null },
];

/**
 * Returns an unbiased integer from 0 (inclusive) to max (exclusive).
 * Web Crypto is used when available, with a Math.random fallback for older browsers.
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

/**
 * @template T
 * @param {T[]} values
 * @returns {T[]}
 */
export function shuffle(values) {
  const result = [...values];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }

  return result;
}

/**
 * @param {number} count
 * @param {number} max
 * @returns {number[]}
 */
export function drawUniqueNumbers(count, max) {
  if (count > max) {
    throw new RangeError("count cannot be greater than max");
  }

  return shuffle(
    Array.from({ length: max }, (_, index) => index + 1),
  ).slice(0, count);
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
      message: "선택한 여섯 숫자가 모두 맞았습니다. 오늘의 운은 역사적이에요.",
    };
  }

  if (matchCount === 5 && bonusMatch) {
    return {
      rank: 2,
      matchCount,
      bonusMatch: true,
      eyebrow: "본번호 5개 + 보너스",
      title: "짜릿한 2등!",
      message: "본번호 다섯 개와 보너스 번호까지 정확히 잡았습니다.",
    };
  }

  if (matchCount === 5) {
    return {
      rank: 3,
      matchCount,
      bonusMatch: false,
      eyebrow: "본번호 5개 일치",
      title: "엄청난 3등!",
      message: "보너스는 비껴갔지만 다섯 숫자가 정확히 맞았습니다.",
    };
  }

  if (matchCount === 4) {
    return {
      rank: 4,
      matchCount,
      bonusMatch,
      eyebrow: "본번호 4개 일치",
      title: "기분 좋은 4등!",
      message: "네 숫자를 맞혔어요. 운이 꽤 강하게 들어왔습니다.",
    };
  }

  if (matchCount === 3) {
    return {
      rank: 5,
      matchCount,
      bonusMatch,
      eyebrow: "본번호 3개 일치",
      title: "당첨, 5등!",
      message: "세 숫자가 맞았습니다. 작지만 분명한 행운이에요.",
    };
  }

  return {
    rank: null,
    matchCount,
    bonusMatch,
    eyebrow: `${matchCount}개 일치`,
    title: "이번 공은 살짝 빗나갔어요",
    message:
      bonusMatch && matchCount < 5
        ? "보너스 번호는 맞았지만, 보너스는 본번호 5개일 때만 힘을 발휘해요."
        : "확률은 다시 섞입니다. 같은 번호로 한 번 더 가볼까요?",
  };
}

function drawSpettoPrize() {
  const ticketIndex = randomInt(SPETTO_TOTAL_TICKETS);
  let cursor = 0;

  for (const tier of SPETTO_PRIZE_TABLE) {
    cursor += tier.count;
    if (ticketIndex < cursor) {
      return tier;
    }
  }

  return SPETTO_PRIZE_TABLE.at(-1);
}

function drawDecoyPrize() {
  const roll = randomInt(10_000);

  if (roll < 7_000) return 1_000;
  if (roll < 9_100) return 5_000;
  if (roll < 9_850) return 10_000;
  if (roll < 9_990) return 20_000_000;
  return 500_000_000;
}

/**
 * Builds the complete ticket before any scratch surface is revealed.
 */
export function generateScratchTicket() {
  const tier = drawSpettoPrize();
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
    if (index === winningIndex) {
      myNumbers.push(luckyNumber);
    } else {
      myNumbers.push(chosenOthers.shift());
    }
  }

  const cells = myNumbers.map((number, index) => ({
    number,
    prize: index === winningIndex ? tier.prize : drawDecoyPrize(),
    matches: index === winningIndex,
  }));

  return {
    luckyNumber,
    cells,
    winningIndex,
    isWinner,
    prize: tier.prize,
    prizeLabel: tier.label,
    rank: tier.rank,
  };
}

export function formatWon(amount) {
  return new Intl.NumberFormat("ko-KR").format(amount);
}
