"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  SCRATCH_TYPES,
  createHorseRoster,
  drawUniqueNumbers,
  formatCoins,
  randomInt,
} from "./game-logic";

type GameId =
  | "lotto"
  | "gimbap"
  | "paper"
  | "stock"
  | "horse"
  | "rps"
  | "timing";
type StockStatus = "active" | "suspended" | "delisted";
type RpsMove = "rock" | "paper" | "scissors";
type RpsRoundResult = "win" | "lose" | "draw";
type HorseRacePhase =
  | "idle"
  | "select"
  | "bet"
  | "waiting"
  | "racing"
  | "result";
type TimingPhase = "setup" | "running" | "stopped" | "result";

type Profile = {
  email: string;
  displayName: string;
  balance: number;
  savedLuck: number;
  lastEarnAt: number;
};

type Holding = {
  symbol: string;
  quantity: number;
  averagePrice: number;
};

type Stock = {
  symbol: string;
  name: string;
  kind: "base" | "derivative";
  underlying: string | null;
  multiplier: number;
  inverse: boolean;
  price: number;
  previousPrice: number;
  status: StockStatus;
  phaseStartedAt: number;
  updatedAt: number;
};

type PaperBoard = {
  generation: number;
  remaining: number;
  availableIds: string[];
  updatedAt: number;
};

type Transaction = {
  id: number;
  type: string;
  amount: number;
  description: string;
  createdAt: number;
};

type GameState = {
  profile: Profile;
  holdings: Holding[];
  market: Stock[];
  paperBoard: PaperBoard;
  transactions: Transaction[];
  rpsMatch: RpsMatch | null;
  timing: {
    failureStreak: number;
    currentMultiplier: number;
    activeGame: TimingGame | null;
  };
  serverTime: number;
};

type ScratchTicket = {
  type: 1000 | 2000;
  price: number;
  luckyNumber: number;
  cells: Array<{
    number: number;
    prize: number;
    matches: boolean;
  }>;
  isWinner: boolean;
  prize: number;
  prizeLabel: string;
  rank: string | null;
};

type LottoPayout = {
  gross: number;
  tax: number;
  net: number;
};

type LottoPlayResult = {
  selected: number[];
  rank: number | null;
  matchCount: number;
  bonusMatch: boolean;
  eyebrow: string;
  title: string;
  message: string;
  payout: LottoPayout;
};

type LottoRound = {
  mainNumbers: number[];
  bonusNumber: number;
  roundPrizes: Record<number, number>;
  results: LottoPlayResult[];
  cost: number;
  netPrize: number;
};

type HorsePoolTick = {
  second: number;
  increment: number;
  total: number;
  participants: number;
};

type HorseRaceRound = {
  horses: string[];
  selectedHorse: string;
  betAmount: number;
  poolTicks: HorsePoolTick[];
  totalPool: number;
  participantCount: number;
  participantBets: Record<string, number>;
  ranking: string[];
  playerRank: number;
  payoutRate: number;
  winners: number;
  payout: number;
};

type RpsHistoryRound = {
  turn: number;
  playerMove: RpsMove;
  aiMove: RpsMove;
  result: RpsRoundResult;
  playerWins: number;
  aiWins: number;
  decisiveRounds: number;
};

type RpsMatch = {
  id: string;
  matchType: 3 | 5 | 7;
  winsRequired: 2 | 3 | 5;
  playerBet: number;
  aiBet: number;
  playerWins: number;
  aiWins: number;
  decisiveRounds: number;
  attempts: number;
  nextTurn: number;
  status: "active" | "completed";
  winner: "player" | "ai" | null;
  history: RpsHistoryRound[];
  payout: number;
  netProfit: number | null;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
};

type TimingGame = {
  id: string;
  target: number;
  targetHundredths: number;
  betAmount: number;
  multiplier: number;
  failureStreak: number;
  startedAt: number;
  status: "active";
};

type TimingResult = {
  gameId: string;
  target: number;
  targetHundredths: number;
  elapsedSeconds: number;
  elapsedHundredths: number;
  betAmount: number;
  multiplier: number;
  success: boolean;
  payout: number;
  netProfit: number;
  previousFailureStreak: number;
  failureStreak: number;
  completedAt: number;
};

type ApiResponse = {
  state?: GameState;
  error?: string;
  reward?: number;
  saved?: number;
  ticket?: ScratchTicket;
  lotto?: LottoRound;
  race?: HorseRaceRound;
  rpsMatch?: RpsMatch;
  round?: RpsHistoryRound;
  resumed?: boolean;
  duplicate?: boolean;
  timingGame?: TimingGame;
  timingResult?: TimingResult;
  removedId?: string;
  result?: { rank: string; prize: number } | null;
  boardReset?: boolean;
  trade?: {
    symbol: string;
    side: "buy" | "sell";
    quantity: number;
    price: number;
    total: number;
  };
};

const GAME_TABS: Array<{
  id: GameId;
  index: string;
  label: string;
  short: string;
}> = [
  { id: "lotto", index: "01", label: "로또 맞히기", short: "로또" },
  { id: "gimbap", index: "02", label: "즉석김밥", short: "김밥" },
  { id: "paper", index: "03", label: "종이뽑기판", short: "종이뽑기" },
  { id: "stock", index: "04", label: "주식 투자", short: "주식" },
  { id: "horse", index: "05", label: "행운 경마", short: "경마" },
  { id: "rps", index: "06", label: "가위바위보", short: "가위" },
  { id: "timing", index: "07", label: "타이밍의 신", short: "타이밍" },
];

const RPS_MATCH_OPTIONS = [
  { matchType: 3 as const, winsRequired: 2 as const, label: "3판 2선승" },
  { matchType: 5 as const, winsRequired: 3 as const, label: "5판 3선승" },
  { matchType: 7 as const, winsRequired: 5 as const, label: "7판 5선승" },
];

const RPS_MOVES: Array<{
  id: RpsMove;
  label: string;
  icon: string;
}> = [
  { id: "scissors", label: "가위", icon: "✌️" },
  { id: "rock", label: "바위", icon: "✊" },
  { id: "paper", label: "보", icon: "✋" },
];

const TIMING_TARGETS = [3, 5, 7.77, 10, 10.01] as const;

const LOTTO_NUMBERS = Array.from({ length: 45 }, (_, index) => index + 1);
const PAPER_CELLS = Array.from(
  { length: 160 },
  (_, index) => `P${String(index + 1).padStart(3, "0")}`,
);
const SCRATCH_IDS = [
  "lucky",
  "cell-0",
  "cell-1",
  "cell-2",
  "cell-3",
  "cell-4",
  "cell-5",
];

function ballTone(number: number) {
  if (number <= 10) return "yellow";
  if (number <= 20) return "blue";
  if (number <= 30) return "red";
  if (number <= 40) return "gray";
  return "green";
}

function LottoBall({
  number,
  bonus = false,
  matched = false,
  small = false,
}: {
  number?: number;
  bonus?: boolean;
  matched?: boolean;
  small?: boolean;
}) {
  return (
    <span
      className={[
        "lotto-ball",
        number ? `lotto-ball--${ballTone(number)}` : "lotto-ball--empty",
        bonus ? "is-bonus" : "",
        matched ? "is-matched" : "",
        small ? "lotto-ball--small" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={
        number
          ? `${number}번${bonus ? " 보너스" : ""}${matched ? " 일치" : ""}`
          : "빈 번호"
      }
    >
      {number ?? "·"}
      {matched && <span className="ball-check">✓</span>}
    </span>
  );
}

function ScratchTile({
  id,
  revealed,
  label,
  onReveal,
  children,
  dark = false,
}: {
  id: string;
  revealed: boolean;
  label: string;
  onReveal: (id: string) => void;
  children: React.ReactNode;
  dark?: boolean;
}) {
  return (
    <button
      type="button"
      className={`scratch-tile ${dark ? "scratch-tile--dark" : ""} ${
        revealed ? "is-revealed" : ""
      }`}
      aria-pressed={revealed}
      aria-label={revealed ? `${label}, 공개됨` : `${label}, 눌러서 긁기`}
      onClick={() => onReveal(id)}
    >
      <span className="scratch-tile__result">{children}</span>
      <span className="scratch-tile__cover" aria-hidden="true">
        <i />
        문질러 긁기
      </span>
    </button>
  );
}

function PriceChange({ stock }: { stock: Stock }) {
  const change = stock.price - stock.previousPrice;
  const rate = stock.previousPrice
    ? (change / stock.previousPrice) * 100
    : 0;
  const tone = change > 0 ? "up" : change < 0 ? "down" : "flat";

  return (
    <span className={`price-change price-change--${tone}`}>
      {change > 0 ? "▲" : change < 0 ? "▼" : "─"}{" "}
      {Math.abs(rate).toFixed(2)}%
    </span>
  );
}

function statusLabel(status: StockStatus) {
  if (status === "suspended") return "거래정지";
  if (status === "delisted") return "상장폐지";
  return "거래중";
}

function rpsMoveMeta(move?: RpsMove) {
  return RPS_MOVES.find((item) => item.id === move) ?? {
    id: "rock" as const,
    label: "선택 전",
    icon: "?",
  };
}

function formatStopwatch(hundredths: number) {
  const safeHundredths = Math.max(0, Math.trunc(hundredths));
  const seconds = Math.floor(safeHundredths / 100);
  const fraction = safeHundredths % 100;
  return `${String(seconds).padStart(2, "0")}.${String(fraction).padStart(2, "0")}`;
}

async function apiRequest(
  body?: Record<string, unknown>,
): Promise<ApiResponse | GameState> {
  const response = await fetch("/api/game", {
    method: body ? "POST" : "GET",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = (await response.json()) as ApiResponse | GameState;
  if (!response.ok) {
    throw new Error(
      "error" in payload && payload.error
        ? payload.error
        : "잠시 후 다시 시도해주세요.",
    );
  }
  return payload;
}

export default function ArcadeClient() {
  const [activeGame, setActiveGame] = useState<GameId>("lotto");
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [notice, setNotice] = useState<{
    tone: "good" | "bad" | "plain";
    text: string;
  } | null>(null);
  const noticeTimerRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const activeSessionRef = useRef(false);

  const showNotice = useCallback(
    (text: string, tone: "good" | "bad" | "plain" = "plain") => {
      setNotice({ text, tone });
      if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
      noticeTimerRef.current = window.setTimeout(
        () => setNotice(null),
        4_200,
      );
    },
    [],
  );

  const playTone = useCallback(
    (frequency = 440, duration = 0.08, volume = 0.028) => {
      if (!soundOn || typeof window === "undefined" || !window.AudioContext) {
        return;
      }
      const context = audioContextRef.current ?? new window.AudioContext();
      audioContextRef.current = context;
      if (context.state === "suspended") void context.resume();

      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, context.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(100, frequency * 0.8),
        context.currentTime + duration,
      );
      gain.gain.setValueAtTime(volume, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        context.currentTime + duration,
      );
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + duration);
    },
    [soundOn],
  );

  const loadState = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      try {
        const payload = (await apiRequest()) as GameState;
        setGameState(payload);
      } catch (error) {
        showNotice(
          error instanceof Error ? error.message : "게임 정보를 불러오지 못했습니다.",
          "bad",
        );
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [showNotice],
  );

  const runAction = useCallback(
    async (
      actionName: string,
      body: Record<string, unknown>,
      options: { quiet?: boolean } = {},
    ) => {
      if (!options.quiet) setBusyAction(actionName);
      try {
        return (await apiRequest(body)) as ApiResponse;
      } catch (error) {
        if (!options.quiet) {
          showNotice(
            error instanceof Error ? error.message : "요청을 처리하지 못했습니다.",
            "bad",
          );
        }
        return null;
      } finally {
        if (!options.quiet) setBusyAction(null);
      }
    },
    [showNotice],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => void loadState(), 0);
    return () => window.clearTimeout(timer);
  }, [loadState]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!activeSessionRef.current) void loadState(true);
    }, 5_000);
    return () => window.clearInterval(timer);
  }, [loadState]);

  useEffect(
    () => () => {
      if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
      void audioContextRef.current?.close();
    },
    [],
  );

  const [luckOpen, setLuckOpen] = useState(false);
  const [luckAmount, setLuckAmount] = useState("");

  const earnCooldown = gameState?.profile
    ? Math.max(
        0,
        Math.ceil((gameState.profile.lastEarnAt + 10_000 - now) / 1_000),
      )
    : 0;

  const handleEarn = async () => {
    const response = await runAction("earn", { action: "earn" });
    if (!response?.state) return;
    setGameState(response.state);
    playTone(760, 0.13, 0.04);
    showNotice(
      `${formatCoins(response.reward ?? 0)}을 받았습니다!`,
      "good",
    );
  };

  const handleSaveLuck = async () => {
    const amount = Number(luckAmount.replaceAll(",", ""));
    const response = await runAction("save_luck", {
      action: "save_luck",
      amount,
    });
    if (!response?.state) return;
    setGameState(response.state);
    setLuckAmount("");
    setLuckOpen(false);
    playTone(680, 0.12, 0.035);
    showNotice(`${formatCoins(amount)}만큼 운을 저장했습니다.`, "good");
  };

  const switchGame = (game: GameId) => {
    setActiveGame(game);
    playTone(320 + GAME_TABS.findIndex((tab) => tab.id === game) * 80);
  };

  const [lottoGameCount, setLottoGameCount] = useState(1);
  const [lottoEntries, setLottoEntries] = useState<number[][]>([[]]);
  const [activeLottoLine, setActiveLottoLine] = useState(0);
  const [lottoRound, setLottoRound] = useState<LottoRound | null>(null);

  const setGameCount = (count: number) => {
    setLottoGameCount(count);
    setLottoEntries((current) =>
      Array.from({ length: count }, (_, index) => {
        if (current[index]) return current[index];
        return drawUniqueNumbers(6, 45).sort((a, b) => a - b);
      }),
    );
    setActiveLottoLine((current) => Math.min(current, count - 1));
    setLottoRound(null);
  };

  const toggleLottoNumber = (number: number) => {
    if (busyAction === "lotto") return;
    setLottoRound(null);
    setLottoEntries((entries) =>
      entries.map((entry, index) => {
        if (index !== activeLottoLine) return entry;
        if (entry.includes(number)) {
          playTone(260);
          return entry.filter((item) => item !== number);
        }
        if (entry.length >= 6) return entry;
        playTone(430 + entry.length * 35);
        return [...entry, number].sort((a, b) => a - b);
      }),
    );
  };

  const autoPickLine = (index = activeLottoLine) => {
    setLottoEntries((entries) =>
      entries.map((entry, entryIndex) =>
        entryIndex === index
          ? drawUniqueNumbers(6, 45).sort((a, b) => a - b)
          : entry,
      ),
    );
    setLottoRound(null);
    playTone(520);
  };

  const autoPickAllLottoLines = () => {
    setLottoEntries((entries) =>
      entries.map(() => drawUniqueNumbers(6, 45).sort((a, b) => a - b)),
    );
    setLottoRound(null);
    playTone(620, 0.12);
  };

  const clearLottoLine = () => {
    setLottoEntries((entries) =>
      entries.map((entry, index) =>
        index === activeLottoLine ? [] : entry,
      ),
    );
    setLottoRound(null);
  };

  const clearAllLottoLines = () => {
    setLottoEntries((entries) => entries.map(() => []));
    setLottoRound(null);
    playTone(240);
  };

  const playLotto = async () => {
    if (lottoEntries.some((entry) => entry.length !== 6)) {
      showNotice("모든 게임의 번호 6개를 채워주세요.", "bad");
      return;
    }
    const response = await runAction("lotto", {
      action: "lotto",
      entries: lottoEntries,
    });
    if (!response?.state || !response.lotto) return;
    setGameState(response.state);
    setLottoRound(response.lotto);
    const won = response.lotto.netPrize;
    playTone(won > 0 ? 880 : 180, 0.16, 0.04);
    showNotice(
      won > 0
        ? `세후 당첨금 ${formatCoins(won)}을 받았습니다!`
        : "이번 회차는 아쉽게도 낙첨입니다.",
      won > 0 ? "good" : "plain",
    );
  };

  const [scratchType, setScratchType] = useState<1000 | 2000>(1000);
  const [scratchTicket, setScratchTicket] =
    useState<ScratchTicket | null>(null);
  const [scratchedIds, setScratchedIds] = useState<string[]>([]);
  const [scratchPendingReveal, setScratchPendingReveal] = useState(false);

  const scratchComplete =
    Boolean(scratchTicket) && scratchedIds.length === SCRATCH_IDS.length;
  const luckyRevealed = scratchedIds.includes("lucky");

  useEffect(() => {
    if (!scratchComplete || !scratchPendingReveal || !scratchTicket) return;
    const timer = window.setTimeout(() => {
      setScratchPendingReveal(false);
      playTone(scratchTicket.isWinner ? 920 : 170, 0.16, 0.04);
      showNotice(
        scratchTicket.isWinner
          ? `${scratchTicket.rank} 당첨! ${formatCoins(scratchTicket.prize)} 지급`
          : "이번 김밥은 담백한 꽝입니다.",
        scratchTicket.isWinner ? "good" : "plain",
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, [
    playTone,
    scratchComplete,
    scratchPendingReveal,
    scratchTicket,
    showNotice,
  ]);

  const buyScratch = async () => {
    const response = await runAction("gimbap", {
      action: "gimbap",
      type: scratchType,
    });
    if (!response?.ticket || !response.state) return;
    setScratchTicket(response.ticket);
    setScratchedIds([]);
    setGameState(response.state);
    setScratchPendingReveal(true);
    playTone(360);
  };

  const revealScratch = (id: string) => {
    setScratchedIds((current) => {
      if (current.includes(id)) return current;
      playTone(id === "lucky" ? 640 : 410 + current.length * 30);
      return [...current, id];
    });
  };

  const revealAllScratch = () => {
    if (!scratchTicket) return;
    setScratchedIds(SCRATCH_IDS);
  };

  const [paperResult, setPaperResult] = useState<{
    id: string;
    rank: string;
    prize: number;
  } | null>(null);
  const [paperPopupOpen, setPaperPopupOpen] = useState(false);
  const [paperRemovedId, setPaperRemovedId] = useState<string | null>(null);
  const paperAutoBusyRef = useRef(false);
  const hasGameState = Boolean(gameState);

  useEffect(() => {
    if (activeGame !== "paper" || !hasGameState) return;
    let cancelled = false;
    let timer = 0;

    const schedule = () => {
      timer = window.setTimeout(async () => {
        if (cancelled || paperAutoBusyRef.current) return;
        paperAutoBusyRef.current = true;
        const response = await runAction(
          "paper_auto",
          { action: "paper_auto" },
          { quiet: true },
        );
        paperAutoBusyRef.current = false;
        if (cancelled) return;
        if (response?.state && response.removedId) {
          setPaperRemovedId(response.removedId);
          setGameState(response.state);
          if (response.boardReset) {
            showNotice("뽑기판이 모두 비어 새 판으로 교체됐습니다.");
          }
          window.setTimeout(() => setPaperRemovedId(null), 700);
        }
        schedule();
      }, 3_000 + randomInt(2_001));
    };

    schedule();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [activeGame, hasGameState, runAction, showNotice]);

  const pickPaper = async (cellId: string) => {
    const response = await runAction("paper_pick", {
      action: "paper_pick",
      cellId,
    });
    if (!response?.state || !response.result) return;
    setGameState(response.state);
    setPaperRemovedId(cellId);
    setPaperResult({ id: cellId, ...response.result });
    setPaperPopupOpen(true);
    playTone(response.result.prize > 0 ? 820 : 190, 0.14, 0.04);
    showNotice(
      response.result.prize > 0
        ? `${response.result.rank}! ${formatCoins(response.result.prize)} 당첨`
        : "꽝! 다음 종이를 골라보세요.",
      response.result.prize > 0 ? "good" : "plain",
    );
    window.setTimeout(() => setPaperRemovedId(null), 700);
  };

  const [stockFilter, setStockFilter] = useState<"base" | "derivative">(
    "base",
  );
  const [selectedStockSymbol, setSelectedStockSymbol] = useState("SSE");
  const [tradeQuantity, setTradeQuantity] = useState(1);

  const selectedStock = gameState?.market.find(
    (stock) => stock.symbol === selectedStockSymbol,
  );
  const selectedHolding = gameState?.holdings.find(
    (holding) => holding.symbol === selectedStockSymbol,
  );
  const portfolioValue = useMemo(() => {
    if (!gameState) return 0;
    return gameState.holdings.reduce((total, holding) => {
      const stock = gameState.market.find(
        (item) => item.symbol === holding.symbol,
      );
      return total + holding.quantity * (stock?.price ?? 0);
    }, 0);
  }, [gameState]);

  const tradeStock = async (side: "buy" | "sell") => {
    if (!selectedStock) return;
    const response = await runAction("trade", {
      action: "trade",
      symbol: selectedStock.symbol,
      side,
      quantity: tradeQuantity,
    });
    if (!response?.state || !response.trade) return;
    setGameState(response.state);
    playTone(side === "buy" ? 570 : 420);
    showNotice(
      `${selectedStock.name} ${tradeQuantity}주 ${
        side === "buy" ? "매수" : "매도"
      } 완료`,
      "good",
    );
  };

  const [horsePhase, setHorsePhase] = useState<HorseRacePhase>("idle");
  const [horseRoster, setHorseRoster] = useState<string[]>([]);
  const [selectedHorse, setSelectedHorse] = useState<string | null>(null);
  const [horseBetAmount, setHorseBetAmount] = useState("");
  const [horseRace, setHorseRace] = useState<HorseRaceRound | null>(null);
  const [horsePoolTick, setHorsePoolTick] = useState(0);
  const [horseRaceFrame, setHorseRaceFrame] = useState(0);
  const [horseClaimed, setHorseClaimed] = useState(false);
  const pendingRaceStateRef = useRef<GameState | null>(null);

  const startHorseGame = () => {
    if (activeSessionRef.current) return;
    setHorseRoster(createHorseRoster());
    setSelectedHorse(null);
    setHorseBetAmount("");
    setHorseRace(null);
    setHorsePoolTick(0);
    setHorseRaceFrame(0);
    setHorseClaimed(false);
    setHorsePhase("select");
    playTone(480, 0.12);
  };

  const chooseHorse = (horse: string) => {
    if (horsePhase !== "select" && horsePhase !== "bet") return;
    setSelectedHorse(horse);
    setHorsePhase("bet");
    playTone(430 + horseRoster.indexOf(horse) * 18);
  };

  const startHorseRace = async () => {
    const betAmount = Number(horseBetAmount.replaceAll(",", ""));
    if (!selectedHorse) {
      showNotice("응원할 말을 먼저 선택해주세요.", "bad");
      return;
    }
    if (
      !Number.isSafeInteger(betAmount) ||
      betAmount < 1 ||
      betAmount > (gameState?.profile.balance ?? 0)
    ) {
      showNotice("1 C 이상, 보유 코인 안에서 배팅해주세요.", "bad");
      return;
    }

    activeSessionRef.current = true;
    const response = await runAction("horse_race", {
      action: "horse_race",
      horses: horseRoster,
      selectedHorse,
      betAmount,
    });
    if (!response?.state || !response.race) {
      activeSessionRef.current = false;
      return;
    }

    pendingRaceStateRef.current = response.state;
    setHorseRace(response.race);
    setHorsePoolTick(0);
    setHorseRaceFrame(0);
    setHorseClaimed(false);
    setHorsePhase("waiting");
    playTone(560, 0.14);
  };

  useEffect(() => {
    if (horsePhase !== "waiting" || !horseRace) return;
    const timer = window.setInterval(() => {
      setHorsePoolTick((current) => Math.min(30, current + 1));
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [horsePhase, horseRace]);

  useEffect(() => {
    if (horsePhase !== "waiting" || horsePoolTick < 30) return;
    const timer = window.setTimeout(() => setHorsePhase("racing"), 0);
    return () => window.clearTimeout(timer);
  }, [horsePhase, horsePoolTick]);

  useEffect(() => {
    if (horsePhase !== "racing" || !horseRace) return;
    const timer = window.setInterval(() => {
      setHorseRaceFrame((current) => Math.min(20, current + 1));
    }, 400);
    return () => window.clearInterval(timer);
  }, [horsePhase, horseRace]);

  useEffect(() => {
    if (horsePhase !== "racing" || horseRaceFrame < 20) return;
    const timer = window.setTimeout(() => {
      setHorsePhase("result");
      playTone((horseRace?.payout ?? 0) > 0 ? 920 : 190, 0.18, 0.045);
    }, 450);
    return () => window.clearTimeout(timer);
  }, [horsePhase, horseRace, horseRaceFrame, playTone]);

  const claimHorseResult = () => {
    if (horseClaimed) return;
    if (pendingRaceStateRef.current) {
      setGameState(pendingRaceStateRef.current);
      pendingRaceStateRef.current = null;
    }
    activeSessionRef.current = false;
    setHorseClaimed(true);
    if ((horseRace?.payout ?? 0) > 0) {
      showNotice(
        `${formatCoins(horseRace?.payout ?? 0)} 당첨금을 받았습니다!`,
        "good",
      );
    } else {
      showNotice("경기가 종료됐습니다. 다음 경주에 다시 도전해보세요.");
    }
  };

  const [rpsMatchType, setRpsMatchType] = useState<3 | 5 | 7>(3);
  const [rpsBetAmount, setRpsBetAmount] = useState("");
  const [rpsMatch, setRpsMatch] = useState<RpsMatch | null>(null);
  const [rpsRound, setRpsRound] = useState<RpsHistoryRound | null>(null);
  const rpsPlayBusyRef = useRef(false);

  useEffect(() => {
    const activeMatch = gameState?.rpsMatch;
    if (!activeMatch || activeMatch.status !== "active") return;
    activeSessionRef.current = true;
    const timer = window.setTimeout(() => {
      setRpsMatch((current) =>
        current?.id === activeMatch.id ? current : activeMatch,
      );
      setRpsMatchType(activeMatch.matchType);
      setRpsBetAmount(String(activeMatch.playerBet));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [gameState?.rpsMatch]);

  const startRpsMatch = async () => {
    if (activeSessionRef.current && rpsMatch?.status !== "active") {
      showNotice("진행 중인 게임을 먼저 마무리해주세요.", "bad");
      return;
    }
    const betAmount = Number(rpsBetAmount.replaceAll(",", ""));
    if (
      !Number.isSafeInteger(betAmount) ||
      betAmount < 1_000 ||
      betAmount > (gameState?.profile.balance ?? 0)
    ) {
      showNotice("1,000 C 이상, 보유 코인 안에서 배팅해주세요.", "bad");
      return;
    }

    activeSessionRef.current = true;
    const response = await runAction("rps_start", {
      action: "rps_start",
      matchType: rpsMatchType,
      betAmount,
    });
    if (!response?.state || !response.rpsMatch) {
      activeSessionRef.current = false;
      return;
    }

    setGameState(response.state);
    setRpsMatch(response.rpsMatch);
    setRpsMatchType(response.rpsMatch.matchType);
    setRpsBetAmount(String(response.rpsMatch.playerBet));
    setRpsRound(response.rpsMatch.history.at(-1) ?? null);
    playTone(response.resumed ? 420 : 610, 0.13);
    showNotice(
      response.resumed
        ? "진행 중이던 AI 대결을 이어갑니다."
        : `AI가 ${formatCoins(response.rpsMatch.aiBet)}을 배팅했습니다.`,
      response.resumed ? "plain" : "good",
    );
  };

  const playRpsMove = async (move: RpsMove) => {
    if (
      !rpsMatch ||
      rpsMatch.status !== "active" ||
      rpsPlayBusyRef.current
    ) {
      return;
    }
    rpsPlayBusyRef.current = true;
    const response = await runAction("rps_play", {
      action: "rps_play",
      matchId: rpsMatch.id,
      turn: rpsMatch.nextTurn,
      move,
    });
    rpsPlayBusyRef.current = false;
    if (!response?.state || !response.rpsMatch || !response.round) return;

    setGameState(response.state);
    setRpsMatch(response.rpsMatch);
    setRpsRound(response.round);
    const roundTone =
      response.round.result === "win"
        ? 780
        : response.round.result === "lose"
          ? 190
          : 420;
    playTone(roundTone, 0.14, 0.04);

    if (response.rpsMatch.status === "completed") {
      activeSessionRef.current = false;
      const won = response.rpsMatch.winner === "player";
      showNotice(
        won
          ? `최종 승리! AI 배팅금 ${formatCoins(response.rpsMatch.aiBet)}을 받았습니다.`
          : `최종 패배. 배팅금 ${formatCoins(response.rpsMatch.playerBet)}이 소멸됐습니다.`,
        won ? "good" : "bad",
      );
      return;
    }

    showNotice(
      response.round.result === "win"
        ? "이번 판 승리! 다음 AI 패가 정해졌습니다."
        : response.round.result === "lose"
          ? "이번 판 패배. 다음 패를 선택해주세요."
          : "무승부! 승수 변화 없이 다시 겨룹니다.",
      response.round.result === "win"
        ? "good"
        : response.round.result === "lose"
          ? "bad"
          : "plain",
    );
  };

  const resetRpsMatch = () => {
    if (rpsMatch?.status === "active") return;
    setRpsMatch(null);
    setRpsRound(null);
    setRpsBetAmount("");
  };

  const [timingTarget, setTimingTarget] =
    useState<(typeof TIMING_TARGETS)[number]>(3);
  const [timingBetAmount, setTimingBetAmount] = useState("");
  const [timingGame, setTimingGame] = useState<TimingGame | null>(null);
  const [timingResult, setTimingResult] = useState<TimingResult | null>(null);
  const [timingPhase, setTimingPhase] = useState<TimingPhase>("setup");
  const [timingElapsedHundredths, setTimingElapsedHundredths] = useState(0);
  const timingStartRef = useRef<number | null>(null);
  const timingFrameRef = useRef<number | null>(null);
  const timingStopBusyRef = useRef(false);

  useEffect(() => {
    const activeGame = gameState?.timing.activeGame;
    if (!activeGame || timingGame?.id === activeGame.id) return;
    const elapsedSinceServerStart = Math.max(
      0,
      Date.now() - activeGame.startedAt,
    );
    timingStartRef.current = performance.now() - elapsedSinceServerStart;
    activeSessionRef.current = true;
    const timer = window.setTimeout(() => {
      setTimingGame(activeGame);
      setTimingTarget(
        activeGame.target as (typeof TIMING_TARGETS)[number],
      );
      setTimingBetAmount(String(activeGame.betAmount));
      setTimingResult(null);
      setTimingElapsedHundredths(Math.floor(elapsedSinceServerStart / 10));
      setTimingPhase("running");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [gameState?.timing.activeGame, timingGame?.id]);

  useEffect(() => {
    if (timingPhase !== "running" || !timingGame) return;

    const updateClock = () => {
      const startedAt = timingStartRef.current;
      if (startedAt !== null) {
        setTimingElapsedHundredths(
          Math.max(0, Math.floor((performance.now() - startedAt) / 10)),
        );
      }
      timingFrameRef.current = window.requestAnimationFrame(updateClock);
    };

    timingFrameRef.current = window.requestAnimationFrame(updateClock);
    return () => {
      if (timingFrameRef.current !== null) {
        window.cancelAnimationFrame(timingFrameRef.current);
        timingFrameRef.current = null;
      }
    };
  }, [timingGame, timingPhase]);

  const startTimingGame = async () => {
    if (activeSessionRef.current) {
      showNotice("진행 중인 게임을 먼저 마무리해주세요.", "bad");
      return;
    }
    const betAmount = Number(timingBetAmount.replaceAll(",", ""));
    if (
      !Number.isSafeInteger(betAmount) ||
      betAmount < 1_000 ||
      betAmount > (gameState?.profile.balance ?? 0)
    ) {
      showNotice("1,000 C 이상, 보유 코인 안에서 배팅해주세요.", "bad");
      return;
    }

    activeSessionRef.current = true;
    const response = await runAction("timing_start", {
      action: "timing_start",
      target: timingTarget,
      betAmount,
    });
    if (!response?.state || !response.timingGame) {
      activeSessionRef.current = false;
      return;
    }

    setGameState(response.state);
    setTimingGame(response.timingGame);
    setTimingTarget(
      response.timingGame.target as (typeof TIMING_TARGETS)[number],
    );
    setTimingBetAmount(String(response.timingGame.betAmount));
    setTimingResult(null);
    setTimingElapsedHundredths(0);
    timingStartRef.current = performance.now();
    setTimingPhase("running");
    playTone(640, 0.12, 0.035);
  };

  const settleTimingGame = async (elapsedHundredths: number) => {
    if (!timingGame || timingStopBusyRef.current) return;
    timingStopBusyRef.current = true;
    const response = await runAction("timing_stop", {
      action: "timing_stop",
      gameId: timingGame.id,
      elapsedHundredths,
    });
    timingStopBusyRef.current = false;
    if (!response?.state || !response.timingResult) return;

    setGameState(response.state);
    setTimingResult(response.timingResult);
    setTimingElapsedHundredths(response.timingResult.elapsedHundredths);
    setTimingPhase("result");
    activeSessionRef.current = false;
    playTone(
      response.timingResult.success ? 940 : 170,
      0.18,
      0.045,
    );
    showNotice(
      response.timingResult.success
        ? `${response.timingResult.multiplier.toFixed(1)}배 성공! ${formatCoins(response.timingResult.payout)}을 받았습니다.`
        : `${formatStopwatch(response.timingResult.elapsedHundredths)}초에 멈췄습니다. 다음 배수가 올랐어요.`,
      response.timingResult.success ? "good" : "bad",
    );
  };

  const stopTimingGame = () => {
    if (
      timingPhase !== "running" ||
      !timingGame ||
      timingStopBusyRef.current
    ) {
      return;
    }
    const startedAt = timingStartRef.current;
    if (startedAt === null) return;
    const elapsedHundredths = Math.max(
      0,
      Math.floor((performance.now() - startedAt) / 10),
    );
    setTimingElapsedHundredths(elapsedHundredths);
    setTimingPhase("stopped");
    void settleTimingGame(elapsedHundredths);
  };

  const resetTimingGame = () => {
    setTimingGame(null);
    setTimingResult(null);
    setTimingElapsedHundredths(0);
    setTimingPhase("setup");
    timingStartRef.current = null;
  };

  const currentHorsePool =
    horsePoolTick > 0
      ? horseRace?.poolTicks[horsePoolTick - 1]
      : undefined;
  const horseWaitingSeconds = Math.max(0, 30 - horsePoolTick);
  const horseLaneProgress = (horse: string, laneIndex: number) => {
    if (!horseRace || horsePhase === "waiting") return 2;
    const finishRank = horseRace.ranking.indexOf(horse);
    const finishPosition = 94 - finishRank * 1.45;
    if (horsePhase === "racing") {
      const ratio = horseRaceFrame / 20;
      const stride =
        horseRaceFrame < 20
          ? Math.sin((horseRaceFrame + laneIndex) * 1.7) * 1.6
          : 0;
      return Math.max(2, Math.min(finishPosition, finishPosition * ratio + stride));
    }
    if (horsePhase === "result") return finishPosition;
    return 2;
  };

  const visibleBalance =
    (gameState?.profile.balance ?? 0) -
    (scratchPendingReveal ? scratchTicket?.prize ?? 0 : 0) -
    ((horsePhase === "waiting" ||
      horsePhase === "racing" ||
      horsePhase === "result") &&
    !horseClaimed
      ? horseRace?.betAmount ?? 0
      : 0);
  const accountOwner = gameState?.profile ?? {
    displayName: "행운 손님",
    email: "브라우저별 자동 저장",
  };
  const paperAvailable = useMemo(
    () => new Set(gameState?.paperBoard.availableIds ?? []),
    [gameState?.paperBoard.availableIds],
  );
  const currentLottoEntry = lottoEntries[activeLottoLine] ?? [];
  const stockCycleProgress = selectedStock
    ? Math.min(1, Math.max(0, (now - selectedStock.updatedAt) / 5_000))
    : 0;
  const stockSecondsLeft = selectedStock
    ? Math.max(0, Math.ceil((selectedStock.updatedAt + 5_000 - now) / 1_000))
    : 5;
  const rpsBetValue = Number(rpsBetAmount.replaceAll(",", "")) || 0;
  const rpsAiBetLow = Math.ceil(rpsBetValue * 0.75);
  const rpsAiBetHigh = Math.floor(rpsBetValue * 1.25);
  const timingBetValue = Number(timingBetAmount.replaceAll(",", "")) || 0;
  const timingMultiplier =
    timingGame?.multiplier ??
    gameState?.timing.currentMultiplier ??
    1.1;
  const timingPayoutPreview = Math.floor(
    timingBetValue * timingMultiplier,
  );
  const timingDifference = timingResult
    ? timingResult.elapsedHundredths - timingResult.targetHundredths
    : 0;

  if (loading && !gameState) {
    return (
      <main className="app-shell app-loading" aria-busy="true">
        <span className="loading-orb">?</span>
        <p>오늘의 확률과 지갑을 준비하고 있어요…</p>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <div className="ambient ambient--one" aria-hidden="true" />
      <div className="ambient ambient--two" aria-hidden="true" />

      <header className="site-header site-header--economy">
        <a className="brand" href="#top" aria-label="운빨 실험실 홈">
          <span className="brand-mark" aria-hidden="true">
            <span>?</span>
          </span>
          <span className="brand-copy">
            <strong>운빨 실험실</strong>
            <small>COIN LUCK ARCADE</small>
          </span>
        </a>

        <nav className="game-tabs game-tabs--seven" aria-label="게임 선택">
          {GAME_TABS.map((tab) => (
            <button
              key={tab.id}
              className={activeGame === tab.id ? "is-active" : ""}
              type="button"
              aria-pressed={activeGame === tab.id}
              aria-controls={`${tab.id}-panel`}
              onClick={() => switchGame(tab.id)}
            >
              <span className="tab-index">{tab.index}</span>
              <span className="tab-label">{tab.label}</span>
              <span className="tab-label-short">{tab.short}</span>
            </button>
          ))}
        </nav>

        <div className="wallet-tools">
          <div className="wallet-balance" aria-label="내 지갑">
            <span>MY WALLET</span>
            <strong>{formatCoins(visibleBalance)}</strong>
          </div>
          <button
            type="button"
            className="earn-button"
            onClick={handleEarn}
            disabled={earnCooldown > 0 || busyAction === "earn"}
          >
            {earnCooldown > 0 ? `${earnCooldown}초` : "랜덤 C 받기"}
          </button>
          <button
            type="button"
            className="luck-save-button"
            onClick={() => setLuckOpen(true)}
          >
            운 저장하기
          </button>
          <button
            className="sound-toggle sound-toggle--compact"
            type="button"
            aria-pressed={soundOn}
            aria-label={`소리 ${soundOn ? "끄기" : "켜기"}`}
            onClick={() => setSoundOn((current) => !current)}
          >
            <span aria-hidden="true">{soundOn ? "♪" : "×"}</span>
          </button>
        </div>
      </header>

      <section className="intro intro--economy" id="top">
        <div className="intro-copy">
          <p className="eyebrow">
            <span className="status-dot" aria-hidden="true" />
            1,000,000 C에서 시작하는 운의 경제
          </p>
          <h1>
            운을 쓰고,
            <br />
            <span>코인을 불려보세요.</span>
          </h1>
          <p className="intro-description">
            일곱 가지 게임으로 시험하는 오늘의 운과 실시간 모의 주식 시장.
            <br />
            모든 코인은 게임 속 재화이며 실제 가치가 없습니다.
          </p>
        </div>

        <aside className="economy-receipt" aria-label="내 운빨 계좌">
          <div className="receipt-topline">
            <span>LUCK ACCOUNT</span>
            <span>LIVE</span>
          </div>
          <div className="account-owner">
            <span>{accountOwner.displayName.slice(0, 1).toUpperCase()}</span>
            <div>
              <strong>{accountOwner.displayName}</strong>
              <small>
                {accountOwner.email.startsWith("guest:")
                  ? "이 브라우저에 자동 저장"
                  : accountOwner.email}
              </small>
            </div>
          </div>
          <dl>
            <div>
              <dt>사용 가능</dt>
              <dd>{formatCoins(visibleBalance)}</dd>
            </div>
            <div>
              <dt>저장한 운</dt>
              <dd>{formatCoins(gameState?.profile.savedLuck ?? 0)}</dd>
            </div>
            <div>
              <dt>주식 평가액</dt>
              <dd>{formatCoins(portfolioValue)}</dd>
            </div>
          </dl>
          <p>※ 코인은 오직 이 아케이드 안에서만 사용됩니다.</p>
        </aside>
      </section>

      <section className="game-stage game-stage--expanded" aria-live="polite">
        <div
          id="lotto-panel"
          className={`game-panel ${activeGame === "lotto" ? "is-active" : ""}`}
          aria-hidden={activeGame !== "lotto"}
        >
          <div className="panel-heading">
            <div>
              <p className="game-number">GAME 01 · LOTTO 6/45</p>
              <h2>로또 맞히기</h2>
              <p>최대 5게임을 한 회차에 구매하고 세후 당첨금을 받아보세요.</p>
            </div>
            <div className="rule-chip">
              <span>가격</span>
              1게임 · 1,000 C
            </div>
          </div>

          <div className="lotto-control-bar">
            <div>
              <span>게임 수</span>
              <div className="segmented-control" aria-label="로또 게임 수">
                {[1, 2, 3, 4, 5].map((count) => (
                  <button
                    key={count}
                    type="button"
                    className={lottoGameCount === count ? "is-active" : ""}
                    aria-pressed={lottoGameCount === count}
                    onClick={() => setGameCount(count)}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>
            <strong>총 {formatCoins(lottoGameCount * 1_000)}</strong>
          </div>

          <div className="lotto-workspace lotto-workspace--multi">
            <section className="pick-card" aria-labelledby="pick-title">
              <div className="card-title-row">
                <div>
                  <p className="card-step">STEP 1</p>
                  <h3 id="pick-title">게임별 번호 선택</h3>
                </div>
                <strong className="selection-count">
                  <span>{currentLottoEntry.length}</span> / 6
                </strong>
              </div>

              <div className="lotto-lines">
                {lottoEntries.map((entry, index) => (
                  <button
                    type="button"
                    key={index}
                    className={`lotto-line ${
                      activeLottoLine === index ? "is-active" : ""
                    }`}
                    onClick={() => setActiveLottoLine(index)}
                    aria-pressed={activeLottoLine === index}
                  >
                    <span>{String.fromCharCode(65 + index)}</span>
                    <div>
                      {Array.from({ length: 6 }, (_, slot) => (
                        <LottoBall
                          key={slot}
                          number={entry[slot]}
                          small
                        />
                      ))}
                    </div>
                    <i>{entry.length === 6 ? "READY" : `${entry.length}/6`}</i>
                  </button>
                ))}
              </div>

              <div className="pick-toolbar">
                <p>{String.fromCharCode(65 + activeLottoLine)}게임 번호 선택</p>
                <div className="pick-toolbar__actions">
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => autoPickLine()}
                  >
                    자동 선택
                  </button>
                  <button
                    type="button"
                    className="text-button text-button--muted"
                    onClick={clearLottoLine}
                  >
                    비우기
                  </button>
                  <span aria-hidden="true" />
                  <button
                    type="button"
                    className="text-button"
                    onClick={autoPickAllLottoLines}
                  >
                    전체 자동 선택
                  </button>
                  <button
                    type="button"
                    className="text-button text-button--muted"
                    onClick={clearAllLottoLines}
                  >
                    전체 초기화
                  </button>
                </div>
              </div>

              <div className="number-grid" aria-label="1부터 45까지 번호판">
                {LOTTO_NUMBERS.map((number) => {
                  const selected = currentLottoEntry.includes(number);
                  return (
                    <button
                      key={number}
                      type="button"
                      className={`number-pick number-pick--${ballTone(number)} ${
                        selected ? "is-selected" : ""
                      }`}
                      aria-pressed={selected}
                      disabled={
                        !selected && currentLottoEntry.length >= 6
                      }
                      onClick={() => toggleLottoNumber(number)}
                    >
                      {number}
                      {selected && <span aria-hidden="true">✓</span>}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="draw-card draw-card--round">
              <div className="card-title-row">
                <div>
                  <p className="card-step">STEP 2</p>
                  <h3>이번 회차 추첨</h3>
                </div>
                <span
                  className={`draw-status ${
                    lottoRound ? "draw-status--complete" : ""
                  }`}
                >
                  {lottoRound ? "COMPLETE" : "READY"}
                </span>
              </div>

              <div className="round-jackpot">
                <small>이번 회차 1등</small>
                <strong>
                  {formatCoins(
                    lottoRound?.roundPrizes[1] ?? 2_000_000_000,
                  )}
                </strong>
                <p>매 회차 기본 당첨금에서 ±10% 변동</p>
              </div>

              <div className="drawn-area">
                <p>당첨 번호</p>
                <div className="drawn-row">
                  {Array.from({ length: 6 }, (_, index) => (
                    <LottoBall
                      key={index}
                      number={lottoRound?.mainNumbers[index]}
                      small
                    />
                  ))}
                  <span className="plus-sign">+</span>
                  <LottoBall
                    number={lottoRound?.bonusNumber}
                    bonus
                    small
                  />
                </div>
              </div>

              <button
                className="primary-button"
                type="button"
                onClick={playLotto}
                disabled={
                  busyAction === "lotto" ||
                  lottoEntries.some((entry) => entry.length !== 6)
                }
              >
                <span aria-hidden="true">✦</span>
                {busyAction === "lotto"
                  ? "추첨 중…"
                  : `${lottoGameCount}게임 구매하고 추첨`}
              </button>
            </section>
          </div>

          {lottoRound && (
            <section className="lotto-results" aria-label="로또 결과">
              <div className="result-summary">
                <span>ROUND RESULT</span>
                <strong>{formatCoins(lottoRound.netPrize)}</strong>
                <small>총 세후 당첨금</small>
              </div>
              <div className="result-lines">
                {lottoRound.results.map((result, index) => (
                  <article
                    key={index}
                    className={result.rank ? "is-win" : ""}
                  >
                    <span>{String.fromCharCode(65 + index)}</span>
                    <div className="result-number-row">
                      {result.selected.map((number) => (
                        <LottoBall
                          key={number}
                          number={number}
                          matched={
                            lottoRound.mainNumbers.includes(number) ||
                            lottoRound.bonusNumber === number
                          }
                          small
                        />
                      ))}
                    </div>
                    <div className="line-outcome">
                      <strong>
                        {result.rank ? `${result.rank}등` : "낙첨"}
                      </strong>
                      <small>{result.matchCount}개 일치</small>
                    </div>
                    <div className="line-prize">
                      <strong>{formatCoins(result.payout.net)}</strong>
                      {result.payout.tax > 0 && (
                        <small>
                          세금 -{formatCoins(result.payout.tax)}
                        </small>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          <details className="rule-note">
            <summary>
              <span>당첨금과 세금 안내</span>
              <i aria-hidden="true">+</i>
            </summary>
            <div className="rule-grid rule-grid--prizes">
              {[
                ["1등", "20억 C"],
                ["2등", "2천만 C"],
                ["3등", "300만 C"],
                ["4등", "5만 C"],
                ["5등", "5천 C"],
              ].map(([rank, prize]) => (
                <div key={rank}>
                  <strong>{rank}</strong>
                  <span>{prize}</span>
                </div>
              ))}
            </div>
            <p>
              회차별 당첨금은 위 기본 금액에서 ±10% 변동합니다. 1~3등은
              1억 C까지 22%, 1억 C 초과분은 33%를 공제한 뒤 지갑으로
              지급합니다.
            </p>
          </details>
        </div>

        <div
          id="gimbap-panel"
          className={`game-panel ${activeGame === "gimbap" ? "is-active" : ""}`}
          aria-hidden={activeGame !== "gimbap"}
        >
          <div className="panel-heading panel-heading--gimbap">
            <div>
              <p className="game-number">GAME 02 · INSTANT GIMBAP</p>
              <h2>즉석김밥</h2>
              <p>1000과 2000 중 한 장을 골라 직접 긁고 당첨금을 확인하세요.</p>
            </div>
            <div className="ticket-type-switch" aria-label="김밥 종류 선택">
              {[1000, 2000].map((type) => (
                <button
                  key={type}
                  type="button"
                  className={scratchType === type ? "is-active" : ""}
                  disabled={Boolean(scratchTicket) && !scratchComplete}
                  onClick={() => setScratchType(type as 1000 | 2000)}
                >
                  김밥 {type}
                  <small>{formatCoins(type)}</small>
                </button>
              ))}
            </div>
          </div>

          <div className="gimbap-workspace">
            <section
              className={`gimbap-ticket gimbap-ticket--${scratchType}`}
              aria-label={`즉석김밥 ${scratchType}`}
            >
              <div className="ticket-perforation ticket-perforation--top" />
              <div className="ticket-header">
                <div className="ticket-brand">
                  <span className="gimbap-roll" aria-hidden="true">
                    <i />
                  </span>
                  <div>
                    <p>오늘 말아 바로 긁는</p>
                    <h3>
                      즉석김밥<span>{scratchType}</span>
                    </h3>
                  </div>
                </div>
                <div className="ticket-serial">
                  <span>PRICE</span>
                  {formatCoins(scratchType)}
                </div>
              </div>

              {!scratchTicket ? (
                <div className="ticket-empty">
                  <span aria-hidden="true">✦</span>
                  <h3>아직 말지 않은 김밥이에요</h3>
                  <p>
                    김밥 {scratchType} 한 장을 구매하면 결과가 즉시
                    결정됩니다.
                  </p>
                  <button
                    type="button"
                    className="primary-button primary-button--lime"
                    onClick={buyScratch}
                    disabled={busyAction === "gimbap"}
                  >
                    {busyAction === "gimbap"
                      ? "김밥 마는 중…"
                      : `${formatCoins(scratchType)}에 구매`}
                  </button>
                </div>
              ) : (
                <>
                  <div className="lucky-zone">
                    <div className="zone-label">
                      <span>01</span>
                      <div>
                        <strong>행운 숫자</strong>
                        <small>LUCKY NUMBER</small>
                      </div>
                    </div>
                    <ScratchTile
                      id="lucky"
                      revealed={luckyRevealed}
                      label="행운 숫자"
                      onReveal={revealScratch}
                    >
                      <strong className="lucky-number">
                        {scratchTicket.luckyNumber}
                      </strong>
                    </ScratchTile>
                    <p>먼저 이 칸부터 긁어보세요</p>
                  </div>

                  <div className="my-number-zone">
                    <div className="zone-label zone-label--wide">
                      <span>02</span>
                      <div>
                        <strong>나의 숫자</strong>
                        <small>MY NUMBERS · 숫자 아래 금액까지 확인</small>
                      </div>
                    </div>
                    <div className="scratch-grid">
                      {scratchTicket.cells.map((cell, index) => {
                        const id = `cell-${index}`;
                        const revealed = scratchedIds.includes(id);
                        const match =
                          revealed && luckyRevealed && cell.matches;
                        return (
                          <div
                            key={id}
                            className={`scratch-cell ${
                              match ? "is-winning-cell" : ""
                            }`}
                          >
                            <span className="cell-index">
                              {String(index + 1).padStart(2, "0")}
                            </span>
                            <ScratchTile
                              id={id}
                              revealed={revealed}
                              label={`${index + 1}번째 나의 숫자`}
                              onReveal={revealScratch}
                              dark
                            >
                              <strong className="my-scratch-number">
                                {cell.number}
                              </strong>
                              <span className="scratch-prize">
                                {formatCoins(cell.prize)}
                              </span>
                              {match && (
                                <i className="match-stamp">일치!</i>
                              )}
                            </ScratchTile>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              <div className="ticket-footer">
                <p>
                  <strong>TIP</strong>
                  은색 칸을 눌러 긁어보세요.
                </p>
              </div>
              <div className="ticket-perforation ticket-perforation--bottom" />
            </section>

            <aside className="scratch-console">
              <div className="console-top">
                <p className="card-step">LUCK CHECK</p>
                <span>{scratchedIds.length} / 7 OPEN</span>
              </div>
              <h3>
                김밥 속에 행운이
                <br />
                말려 있을까요?
              </h3>
              <p>
                구매 순간 결과가 정해집니다.
                <br />
                일곱 칸을 모두 긁으면 지갑에 당첨금이 표시돼요.
              </p>
              <div className="scratch-progress">
                <span
                  style={{
                    width: `${(scratchedIds.length / 7) * 100}%`,
                  }}
                />
              </div>
              {scratchTicket && (
                <>
                  <button
                    type="button"
                    className="primary-button primary-button--lime"
                    onClick={revealAllScratch}
                    disabled={scratchComplete}
                  >
                    전체 긁기
                  </button>
                  {scratchComplete && (
                    <button
                      type="button"
                      className="new-ticket-button"
                      onClick={buyScratch}
                      disabled={busyAction === "gimbap"}
                    >
                      새 김밥 {scratchType} 구매
                    </button>
                  )}
                </>
              )}
              {scratchComplete && scratchTicket && (
                <div
                  className={`instant-result ${
                    scratchTicket.isWinner ? "is-win" : ""
                  }`}
                >
                  <small>INSTANT RESULT</small>
                  <strong>
                    {scratchTicket.rank ?? "꽝"}
                  </strong>
                  <span>{formatCoins(scratchTicket.prize)}</span>
                </div>
              )}
            </aside>
          </div>

          <div className="scratch-odds-grid">
            {([1000, 2000] as const).map((type) => (
              <details key={type} className="rule-note" open={type === 1000}>
                <summary>
                  <span>즉석김밥 {type} 당첨표</span>
                  <i>+</i>
                </summary>
                <div className="prize-table">
                  {SCRATCH_TYPES[type].tiers.map((tier) => (
                    <div key={tier.rank}>
                      <span>{tier.rank}</span>
                      <strong>{tier.label}</strong>
                      <span>1 / {tier.denominator.toLocaleString("ko-KR")}</span>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </div>

        <div
          id="paper-panel"
          className={`game-panel ${activeGame === "paper" ? "is-active" : ""}`}
          aria-hidden={activeGame !== "paper"}
        >
          <div className="panel-heading panel-heading--paper">
            <div>
              <p className="game-number">GAME 03 · PAPER LUCK BOARD</p>
              <h2>추억의 종이뽑기판</h2>
              <p>160장의 종이 중 한 장을 골라 뒤에 숨은 등수를 확인하세요.</p>
            </div>
            <div className="paper-live-chip">
              <i />
              <span>
                {gameState?.paperBoard.remaining ?? 0}
                <small>/ 160장 남음</small>
              </span>
            </div>
          </div>

          <div className="paper-layout">
            <section className="paper-board-wrap">
              <div className="paper-board-header">
                <div>
                  <span>행운 문방구</span>
                  <strong>천원 종이뽑기</strong>
                </div>
                <p>
                  제 {gameState?.paperBoard.generation ?? 1}판
                  <small>한 장 1,000 C</small>
                </p>
              </div>
              <div className="paper-board" aria-label="160칸 종이뽑기판">
                {PAPER_CELLS.map((cellId, index) => {
                  const available = paperAvailable.has(cellId);
                  const removing = paperRemovedId === cellId;
                  return (
                    <button
                      key={cellId}
                      type="button"
                      className={`${available ? "" : "is-gone"} ${
                        removing ? "is-removing" : ""
                      }`}
                      disabled={
                        !available ||
                        busyAction === "paper_pick"
                      }
                      onClick={() => pickPaper(cellId)}
                      aria-label={`${index + 1}번 종이 ${
                        available ? "뽑기" : "이미 사라짐"
                      }`}
                    >
                      <span>{index + 1}</span>
                      <i aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
              <p className="paper-board-foot">
                다른 손님도 3~5초마다 한 장씩 뽑아가요. 마지막 장이
                사라지면 새 판으로 교체됩니다.
              </p>
            </section>

            <aside className="paper-prize-panel">
              <p className="card-step">PRIZE BOARD</p>
              <h3>뒤집으면 바로 당첨</h3>
              <div className="paper-prizes">
                {[
                  ["1등", "1장", "1,000,000 C"],
                  ["2등", "3장", "500,000 C"],
                  ["3등", "10장", "100,000 C"],
                  ["4등", "20장", "50,000 C"],
                  ["꽝", "126장", "0 C"],
                ].map(([rank, count, prize]) => (
                  <div key={rank}>
                    <strong>{rank}</strong>
                    <span>{count}</span>
                    <b>{prize}</b>
                  </div>
                ))}
              </div>
              {paperResult ? (
                <div
                  className={`paper-result ${
                    paperResult.prize > 0 ? "is-win" : ""
                  }`}
                >
                  <small>{paperResult.id} 결과</small>
                  <strong>{paperResult.rank}</strong>
                  <span>{formatCoins(paperResult.prize)}</span>
                </div>
              ) : (
                <div className="paper-result paper-result--empty">
                  <small>YOUR PICK</small>
                  <strong>?</strong>
                  <span>한 장을 골라보세요</span>
                </div>
              )}
              <p className="paper-warning">
                종이를 고르는 즉시 1,000 C가 사용됩니다.
              </p>
            </aside>
          </div>
        </div>

        <div
          id="stock-panel"
          className={`game-panel ${activeGame === "stock" ? "is-active" : ""}`}
          aria-hidden={activeGame !== "stock"}
        >
          <div className="panel-heading panel-heading--stock">
            <div>
              <p className="game-number">GAME 04 · LUCK EXCHANGE</p>
              <h2>주식 투자하기</h2>
              <p>5초마다 움직이는 10개 종목과 레버리지 상품에 투자하세요.</p>
            </div>
            <div className="market-clock">
              <i />
              <span>LUCK EXCHANGE</span>
              <strong>{stockSecondsLeft}초 후 주가 변경</strong>
              <div
                className="market-clock__progress"
                role="progressbar"
                aria-label="다음 주가 변경까지 진행률"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(stockCycleProgress * 100)}
              >
                <span style={{ width: `${stockCycleProgress * 100}%` }} />
              </div>
            </div>
          </div>

          <div className="portfolio-strip">
            <div>
              <span>주문 가능</span>
              <strong>{formatCoins(visibleBalance)}</strong>
            </div>
            <div>
              <span>주식 평가액</span>
              <strong>{formatCoins(portfolioValue)}</strong>
            </div>
            <div>
              <span>총 자산</span>
              <strong>{formatCoins(visibleBalance + portfolioValue)}</strong>
            </div>
            <div>
              <span>보유 종목</span>
              <strong>{gameState?.holdings.length ?? 0}개</strong>
            </div>
          </div>

          <div className="stock-layout">
            <section className="market-board">
              <div className="market-toolbar">
                <div className="segmented-control">
                  <button
                    type="button"
                    className={stockFilter === "base" ? "is-active" : ""}
                    onClick={() => setStockFilter("base")}
                  >
                    일반 10종목
                  </button>
                  <button
                    type="button"
                    className={
                      stockFilter === "derivative" ? "is-active" : ""
                    }
                    onClick={() => setStockFilter("derivative")}
                  >
                    레버리지·인버스 12종목
                  </button>
                </div>
                <span>가격은 자동 갱신됩니다</span>
              </div>
              <div className="stock-table" role="table">
                <div className="stock-table-head" role="row">
                  <span>종목</span>
                  <span>현재가</span>
                  <span>변동</span>
                  <span>상태</span>
                </div>
                {gameState?.market
                  .filter((stock) => stock.kind === stockFilter)
                  .map((stock) => {
                    const selected = stock.symbol === selectedStockSymbol;
                    const holding = gameState.holdings.find(
                      (item) => item.symbol === stock.symbol,
                    );
                    return (
                      <button
                        type="button"
                        role="row"
                        key={stock.symbol}
                        className={selected ? "is-selected" : ""}
                        onClick={() => setSelectedStockSymbol(stock.symbol)}
                      >
                        <span>
                          <i>{stock.symbol.slice(0, 3)}</i>
                          <span>
                            <strong>{stock.name}</strong>
                            <small>
                              {holding
                                ? `${holding.quantity}주 보유`
                                : stock.kind === "base"
                                  ? "일반주"
                                  : `${
                                      stock.inverse ? "인버스" : "레버리지"
                                    } ${stock.multiplier}X`}
                            </small>
                          </span>
                        </span>
                        <strong>{formatCoins(stock.price)}</strong>
                        <PriceChange stock={stock} />
                        <span
                          className={`stock-status stock-status--${stock.status}`}
                        >
                          {statusLabel(stock.status)}
                        </span>
                      </button>
                    );
                  })}
              </div>
            </section>

            <aside className="trade-ticket">
              {selectedStock ? (
                <>
                  <div className="trade-title">
                    <span>{selectedStock.symbol}</span>
                    <PriceChange stock={selectedStock} />
                    <h3>{selectedStock.name}</h3>
                    <strong>{formatCoins(selectedStock.price)}</strong>
                  </div>
                  <div className="trade-meta">
                    <div>
                      <span>상태</span>
                      <strong>{statusLabel(selectedStock.status)}</strong>
                    </div>
                    <div>
                      <span>보유</span>
                      <strong>{selectedHolding?.quantity ?? 0}주</strong>
                    </div>
                    <div>
                      <span>평균가</span>
                      <strong>
                        {formatCoins(selectedHolding?.averagePrice ?? 0)}
                      </strong>
                    </div>
                  </div>
                  {selectedStock.status !== "active" && (
                    <div className="stock-halt-note">
                      <strong>{statusLabel(selectedStock.status)}</strong>
                      <p>
                        {selectedStock.status === "suspended"
                          ? "1,000 C 도달로 60초간 거래가 정지됩니다."
                          : "상장폐지 후 120초가 지나면 랜덤 가격으로 재상장됩니다."}
                      </p>
                    </div>
                  )}
                  <label className="quantity-field">
                    <span>주문 수량</span>
                    <div>
                      <button
                        type="button"
                        onClick={() =>
                          setTradeQuantity((value) =>
                            Math.max(1, value - 1),
                          )
                        }
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={tradeQuantity}
                        onChange={(event) =>
                          setTradeQuantity(
                            Math.max(1, Math.trunc(Number(event.target.value))),
                          )
                        }
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setTradeQuantity((value) => value + 1)
                        }
                      >
                        +
                      </button>
                    </div>
                  </label>
                  <div className="order-total">
                    <span>주문 금액</span>
                    <strong>
                      {formatCoins(selectedStock.price * tradeQuantity)}
                    </strong>
                  </div>
                  <div className="trade-actions">
                    <button
                      type="button"
                      className="buy"
                      disabled={
                        selectedStock.status !== "active" ||
                        busyAction === "trade"
                      }
                      onClick={() => tradeStock("buy")}
                    >
                      매수
                    </button>
                    <button
                      type="button"
                      className="sell"
                      disabled={
                        selectedStock.status !== "active" ||
                        busyAction === "trade" ||
                        (selectedHolding?.quantity ?? 0) < tradeQuantity
                      }
                      onClick={() => tradeStock("sell")}
                    >
                      매도
                    </button>
                  </div>
                </>
              ) : (
                <p>거래할 종목을 선택해주세요.</p>
              )}
            </aside>
          </div>

          <details className="rule-note stock-rule-note">
            <summary>
              <span>거래정지·상장폐지와 레버리지 규칙</span>
              <i>+</i>
            </summary>
            <p>
              주가는 5초마다 -10%~+10% 범위에서 무작위 변동합니다.
              사성전자·아이닉스·GAVER에는 정방향/인버스 2배·3배 상품이
              있습니다. 가격이 1,000 C에 닿으면 60초 거래정지 후
              상장폐지되며, 120초 뒤 랜덤 가격으로 재상장합니다.
            </p>
          </details>
        </div>

        <div
          id="horse-panel"
          className={`game-panel ${activeGame === "horse" ? "is-active" : ""}`}
          aria-hidden={activeGame !== "horse"}
        >
          <div className="panel-heading panel-heading--horse">
            <div>
              <p className="game-number">GAME 05 · LUCKY DERBY</p>
              <h2>행운 경마장</h2>
              <p>무작위로 출전한 12마리 중 한 마리를 골라 결승선을 지켜보세요.</p>
            </div>
            <div className="horse-rule-chip">
              <span>상금 배분</span>
              <strong>70 · 20 · 10</strong>
              <small>1위부터 3위까지</small>
            </div>
          </div>

          {horsePhase === "idle" && (
            <section className="horse-start-card">
              <div className="horse-start-card__mark" aria-hidden="true">
                <span>♞</span>
              </div>
              <p className="card-step">TODAY&apos;S RANDOM DERBY</p>
              <h3>
                열두 마리의 이름도,
                <br />
                우승마도 매번 달라집니다.
              </h3>
              <p>
                출전 명단을 연 뒤 한 마리를 선택하고 1 C부터 보유 코인까지
                자유롭게 배팅하세요.
              </p>
              <button
                type="button"
                className="primary-button primary-button--race"
                onClick={startHorseGame}
              >
                <span aria-hidden="true">♞</span>
                게임 시작
              </button>
            </section>
          )}

          {(horsePhase === "select" || horsePhase === "bet") && (
            <div className="horse-entry-layout">
              <section className="horse-roster">
                <div className="horse-section-title">
                  <div>
                    <p className="card-step">STEP 1 · PICK A HORSE</p>
                    <h3>오늘의 출전마 12</h3>
                  </div>
                  <span>{selectedHorse ? "선택 완료" : "한 마리를 선택하세요"}</span>
                </div>
                <div className="horse-roster-grid">
                  {horseRoster.map((horse, index) => (
                    <button
                      type="button"
                      key={horse}
                      className={selectedHorse === horse ? "is-selected" : ""}
                      aria-pressed={selectedHorse === horse}
                      onClick={() => chooseHorse(horse)}
                    >
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <i aria-hidden="true">♞</i>
                      <strong>{horse}</strong>
                      <small>
                        {selectedHorse === horse ? "MY PICK" : "선택하기"}
                      </small>
                    </button>
                  ))}
                </div>
              </section>

              <aside className="horse-bet-ticket">
                <p className="card-step">STEP 2 · PLACE A BET</p>
                <span className="horse-bet-ticket__icon" aria-hidden="true">
                  ♞
                </span>
                <h3>{selectedHorse ?? "출전마 선택 전"}</h3>
                <p>
                  {selectedHorse
                    ? "선택한 말에 걸 코인을 입력하세요."
                    : "왼쪽 출전 명단에서 응원할 말을 골라주세요."}
                </p>
                <div className="horse-wallet">
                  <span>배팅 가능</span>
                  <strong>{formatCoins(gameState?.profile.balance ?? 0)}</strong>
                </div>
                <label className="horse-bet-input">
                  <span>배팅 금액</span>
                  <div>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="최소 1"
                      value={horseBetAmount}
                      disabled={!selectedHorse}
                      onChange={(event) =>
                        setHorseBetAmount(
                          event.target.value
                            .replaceAll(/[^0-9]/g, "")
                            .replace(/\B(?=(\d{3})+(?!\d))/g, ","),
                        )
                      }
                    />
                    <b>C</b>
                  </div>
                </label>
                <div className="horse-bet-quick">
                  {[1_000, 10_000, 100_000].map((amount) => (
                    <button
                      type="button"
                      key={amount}
                      disabled={
                        !selectedHorse ||
                        amount > (gameState?.profile.balance ?? 0)
                      }
                      onClick={() =>
                        setHorseBetAmount(amount.toLocaleString("ko-KR"))
                      }
                    >
                      {amount >= 100_000 ? "10만" : amount >= 10_000 ? "1만" : "1천"}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={!selectedHorse}
                    onClick={() =>
                      setHorseBetAmount(
                        (gameState?.profile.balance ?? 0).toLocaleString("ko-KR"),
                      )
                    }
                  >
                    전액
                  </button>
                </div>
                <button
                  type="button"
                  className="primary-button primary-button--race"
                  onClick={startHorseRace}
                  disabled={
                    !selectedHorse ||
                    busyAction === "horse_race" ||
                    Number(horseBetAmount.replaceAll(",", "")) < 1 ||
                    Number(horseBetAmount.replaceAll(",", "")) >
                      (gameState?.profile.balance ?? 0)
                  }
                >
                  {busyAction === "horse_race"
                    ? "배팅 접수 중…"
                    : "배팅 확정하고 입장"}
                </button>
                <small className="horse-bet-note">
                  배팅 확정 후에는 취소할 수 없습니다.
                </small>
              </aside>
            </div>
          )}

          {horsePhase === "waiting" && horseRace && (
            <section className="horse-waiting-board">
              <div className="horse-waiting-title">
                <div>
                  <p className="card-step">BETTING LIVE</p>
                  <h3>경기 시작 전 배팅 집계</h3>
                </div>
                <span>
                  <strong>{horseWaitingSeconds}</strong>초
                </span>
              </div>
              <div className="horse-tote">
                <div>
                  <span>누적 배팅금</span>
                  <strong>
                    {formatCoins(currentHorsePool?.total ?? horseRace.betAmount)}
                  </strong>
                  <small>
                    방금 +{formatCoins(currentHorsePool?.increment ?? 0)}
                  </small>
                </div>
                <div>
                  <span>참가자</span>
                  <strong>
                    {(currentHorsePool?.participants ?? 1).toLocaleString("ko-KR")}
                    명
                  </strong>
                  <small>최대 500명 실시간 집계</small>
                </div>
                <div>
                  <span>나의 선택</span>
                  <strong>{horseRace.selectedHorse}</strong>
                  <small>{formatCoins(horseRace.betAmount)} 배팅</small>
                </div>
              </div>
              <div
                className="horse-waiting-progress"
                role="progressbar"
                aria-label="경기 시작 전 대기 시간"
                aria-valuemin={0}
                aria-valuemax={30}
                aria-valuenow={horsePoolTick}
              >
                <span style={{ width: `${(horsePoolTick / 30) * 100}%` }} />
              </div>
              <div className="horse-waiting-roster" aria-label="출전 대기 중인 말">
                {horseRace.horses.map((horse, index) => (
                  <span
                    key={horse}
                    className={horse === horseRace.selectedHorse ? "is-mine" : ""}
                  >
                    {index + 1}. {horse}
                  </span>
                ))}
              </div>
              <p className="horse-waiting-message">
                매초 100 C부터 1억 C 사이의 배팅이 새로 모입니다.
              </p>
            </section>
          )}

          {(horsePhase === "racing" || horsePhase === "result") && horseRace && (
            <div className="horse-race-layout">
              <section className="horse-track-card">
                <div className="horse-track-title">
                  <div>
                    <p className="card-step">
                      {horsePhase === "racing" ? "RACE LIVE" : "RACE FINISHED"}
                    </p>
                    <h3>
                      {horsePhase === "racing"
                        ? "결승선을 향해 달리는 중"
                        : "최종 순위가 확정됐습니다"}
                    </h3>
                  </div>
                  <span className={horsePhase === "racing" ? "is-live" : ""}>
                    {horsePhase === "racing" ? "LIVE" : "FINISH"}
                  </span>
                </div>
                <div className="horse-track" aria-label="경마 경기 진행">
                  {horseRace.horses.map((horse, index) => {
                    const finishRank = horseRace.ranking.indexOf(horse) + 1;
                    return (
                      <div
                        className={`horse-lane ${
                          horse === horseRace.selectedHorse ? "is-mine" : ""
                        }`}
                        key={horse}
                      >
                        <span className="horse-lane__number">{index + 1}</span>
                        <span className="horse-lane__name">{horse}</span>
                        <span className="horse-lane__rail" aria-hidden="true" />
                        <span
                          className="horse-runner"
                          aria-label={`${horse} ${
                            horsePhase === "result" ? `${finishRank}위` : "경주 중"
                          }`}
                          style={{ left: `${horseLaneProgress(horse, index)}%` }}
                        >
                          <i>♞</i>
                        </span>
                        {horsePhase === "result" && (
                          <b className={finishRank <= 3 ? "is-podium" : ""}>
                            {finishRank}위
                          </b>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>

              <aside className="horse-live-ticket">
                <p className="card-step">
                  {horsePhase === "racing" ? "MY BET" : "FINAL RESULT"}
                </p>
                {horsePhase === "racing" ? (
                  <>
                    <span className="horse-live-ticket__mark" aria-hidden="true">
                      ♞
                    </span>
                    <h3>{horseRace.selectedHorse}</h3>
                    <p>나의 말이 결승선을 향해 달리고 있습니다.</p>
                    <dl>
                      <div>
                        <dt>최종 배팅금</dt>
                        <dd>{formatCoins(horseRace.totalPool)}</dd>
                      </div>
                      <div>
                        <dt>참가자</dt>
                        <dd>{horseRace.participantCount}명</dd>
                      </div>
                    </dl>
                  </>
                ) : (
                  <>
                    <span
                      className={`horse-result-rank ${
                        horseRace.playerRank <= 3 ? "is-win" : ""
                      }`}
                    >
                      {horseRace.playerRank}위
                    </span>
                    <h3>{horseRace.selectedHorse}</h3>
                    <p>
                      {horseRace.playerRank <= 3
                        ? `${Math.round(horseRace.payoutRate * 100)}% 상금 ${
                            horseRace.winners
                          }명 공동 분배`
                        : "아쉽게도 이번 경주는 입상하지 못했습니다."}
                    </p>
                    <div className="horse-payout-total">
                      <span>나의 당첨금</span>
                      <strong>{formatCoins(horseRace.payout)}</strong>
                    </div>
                    <div className="horse-podium">
                      {horseRace.ranking.slice(0, 3).map((horse, index) => (
                        <div key={horse}>
                          <span>{index + 1}</span>
                          <strong>{horse}</strong>
                          <small>
                            {Math.round([0.7, 0.2, 0.1][index] * 100)}% ·{" "}
                            {horseRace.participantBets[horse]}명
                          </small>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="primary-button primary-button--race"
                      onClick={claimHorseResult}
                      disabled={horseClaimed}
                    >
                      {horseClaimed
                        ? horseRace.payout > 0
                          ? "당첨금 수령 완료"
                          : "결과 확인 완료"
                        : horseRace.payout > 0
                          ? "당첨금 수령"
                          : "결과 확인"}
                    </button>
                    {horseClaimed && (
                      <button
                        type="button"
                        className="horse-again-button"
                        onClick={startHorseGame}
                      >
                        새 경주 시작
                      </button>
                    )}
                  </>
                )}
              </aside>
            </div>
          )}

          {horsePhase !== "idle" && (
            <details className="rule-note horse-rule-note">
              <summary>
                <span>경마 배팅과 당첨금 규칙</span>
                <i>+</i>
              </summary>
              <p>
                경기 전 30초 동안 매초 100 C~1억 C가 누적되며 참가자 수는
                50~500명 사이에서 정해집니다. 최종 누적금의 70%·20%·10%를
                1~3위 선택자끼리 각각 똑같이 나눠 받습니다.
              </p>
            </details>
          )}
        </div>

        <div
          id="rps-panel"
          className={`game-panel ${activeGame === "rps" ? "is-active" : ""}`}
          aria-hidden={activeGame !== "rps"}
        >
          <div className="panel-heading panel-heading--rps">
            <div>
              <p className="game-number">GAME 06 · AI HAND DUEL</p>
              <h2>가위바위보</h2>
              <p>
                AI와 승부를 겨루고 최종 승리하면 AI가 건 코인을
                가져갑니다.
              </p>
            </div>
            <div className="rps-rule-chip">
              <span>최소 배팅</span>
              <strong>1,000 C</strong>
              <small>AI 배팅 · 내 금액의 ±25%</small>
            </div>
          </div>

          {!rpsMatch ? (
            <div className="rps-setup-grid">
              <section className="rps-format-card">
                <p className="card-step">STEP 1 · MATCH TYPE</p>
                <h3>승부 방식을 고르세요</h3>
                <p>
                  정해진 승수를 먼저 채우면 매치가 끝납니다. 무승부는
                  승수에 포함되지 않습니다.
                </p>
                <div className="rps-format-options" aria-label="매치 방식">
                  {RPS_MATCH_OPTIONS.map((option) => (
                    <button
                      type="button"
                      key={option.matchType}
                      className={`rps-format-option ${
                        rpsMatchType === option.matchType ? "is-selected" : ""
                      }`}
                      aria-pressed={rpsMatchType === option.matchType}
                      onClick={() => setRpsMatchType(option.matchType)}
                    >
                      <span>BEST OF {option.matchType}</span>
                      <strong>{option.label}</strong>
                      <small>{option.winsRequired}승 먼저 달성</small>
                    </button>
                  ))}
                </div>
              </section>

              <aside className="rps-bet-card">
                <p className="card-step">STEP 2 · COIN BET</p>
                <h3>내 배팅금 정하기</h3>
                <p>배팅과 동시에 AI도 자신의 금액을 확정합니다.</p>
                <div className="rps-wallet">
                  <span>사용 가능</span>
                  <strong>{formatCoins(gameState?.profile.balance ?? 0)}</strong>
                </div>
                <label className="rps-bet-input">
                  <span>배팅 금액</span>
                  <div>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={rpsBetAmount}
                      placeholder="최소 1,000"
                      aria-label="가위바위보 배팅 금액"
                      onChange={(event) =>
                        setRpsBetAmount(
                          event.target.value
                            .replaceAll(",", "")
                            .replace(/\D/g, "")
                            .slice(0, 12),
                        )
                      }
                    />
                    <b>C</b>
                  </div>
                </label>
                <div className="horse-bet-quick" aria-label="빠른 금액 선택">
                  {[1_000, 5_000, 10_000, 50_000].map((amount) => (
                    <button
                      type="button"
                      key={amount}
                      disabled={amount > (gameState?.profile.balance ?? 0)}
                      onClick={() => setRpsBetAmount(String(amount))}
                    >
                      {amount >= 10_000
                        ? `${amount / 10_000}만`
                        : `${amount / 1_000}천`}
                    </button>
                  ))}
                </div>
                <div className="rps-ai-preview">
                  <span>AI 예상 배팅 범위</span>
                  <strong>
                    {rpsBetValue >= 1_000
                      ? `${formatCoins(rpsAiBetLow)} ~ ${formatCoins(rpsAiBetHigh)}`
                      : "금액 입력 후 공개"}
                  </strong>
                </div>
                <button
                  type="button"
                  className="primary-button"
                  onClick={startRpsMatch}
                  disabled={
                    busyAction === "rps_start" ||
                    rpsBetValue < 1_000 ||
                    rpsBetValue > (gameState?.profile.balance ?? 0)
                  }
                >
                  {busyAction === "rps_start"
                    ? "AI 배팅 중…"
                    : "배팅 확정하고 대결 시작"}
                </button>
                {(gameState?.profile.balance ?? 0) < 1_000 && (
                  <small>플레이하려면 최소 1,000 C가 필요합니다.</small>
                )}
              </aside>
            </div>
          ) : (
            <section className="rps-arena" aria-live="polite">
              <div className="rps-scoreboard">
                <div>
                  <span>PLAYER</span>
                  <strong>{rpsMatch.playerWins}</strong>
                  <small>{formatCoins(rpsMatch.playerBet)} 배팅</small>
                </div>
                <p>
                  <span>
                    {rpsMatch.matchType}판 · {rpsMatch.winsRequired}선승
                  </span>
                  <strong>:</strong>
                  <small>
                    결정 {rpsMatch.decisiveRounds}판 · 시도{" "}
                    {rpsMatch.attempts}회
                  </small>
                </p>
                <div>
                  <span>AI</span>
                  <strong>{rpsMatch.aiWins}</strong>
                  <small>{formatCoins(rpsMatch.aiBet)} 배팅</small>
                </div>
              </div>

              <div className="rps-duel">
                <article className="rps-hand-card">
                  <span>AI · 직전 패</span>
                  <strong aria-hidden="true">
                    {rpsRound ? rpsMoveMeta(rpsRound.aiMove).icon : "?"}
                  </strong>
                  <small>
                    {rpsRound
                      ? rpsMoveMeta(rpsRound.aiMove).label
                      : "선택 완료 · 공개 전"}
                  </small>
                </article>
                <div className="rps-vs" aria-hidden="true">
                  VS
                </div>
                <article className="rps-hand-card">
                  <span>PLAYER · 직전 패</span>
                  <strong aria-hidden="true">
                    {rpsRound ? rpsMoveMeta(rpsRound.playerMove).icon : "?"}
                  </strong>
                  <small>
                    {rpsRound
                      ? rpsMoveMeta(rpsRound.playerMove).label
                      : "아래에서 패 선택"}
                  </small>
                </article>
              </div>

              {rpsRound && (
                <p className={`rps-round-result is-${rpsRound.result}`}>
                  {rpsRound.result === "win"
                    ? "이번 판 승리"
                    : rpsRound.result === "lose"
                      ? "이번 판 패배"
                      : "무승부 · 승수 변화 없음"}
                </p>
              )}

              {rpsMatch.status === "active" ? (
                <>
                  <div className="rps-status-line">
                    <span className="status-dot" aria-hidden="true" />
                    AI의 다음 패는 이미 정해졌습니다 · 패를 선택하면 즉시 공개
                  </div>
                  <div className="rps-move-grid" aria-label="가위바위보 패 선택">
                    {RPS_MOVES.map((move) => (
                      <button
                        type="button"
                        key={move.id}
                        disabled={busyAction === "rps_play"}
                        onClick={() => void playRpsMove(move.id)}
                      >
                        <span aria-hidden="true">{move.icon}</span>
                        <strong>{move.label}</strong>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div
                  className={`rps-final ${
                    rpsMatch.winner === "player" ? "is-win" : "is-loss"
                  }`}
                >
                  <span>
                    {rpsMatch.winner === "player"
                      ? "MATCH WIN"
                      : "MATCH LOSE"}
                  </span>
                  <h3>
                    {rpsMatch.winner === "player"
                      ? "AI 배팅금을 획득했습니다!"
                      : "내 배팅금이 소멸됐습니다."}
                  </h3>
                  <strong>
                    {rpsMatch.winner === "player" ? "+" : "−"}
                    {formatCoins(
                      rpsMatch.winner === "player"
                        ? rpsMatch.aiBet
                        : rpsMatch.playerBet,
                    )}
                  </strong>
                  <button
                    type="button"
                    className="rps-again-button"
                    onClick={resetRpsMatch}
                  >
                    새 매치 준비
                  </button>
                </div>
              )}

              {rpsMatch.history.length > 0 && (
                <div className="rps-history" aria-label="라운드 기록">
                  {rpsMatch.history.slice(-8).map((round) => (
                    <span
                      key={round.turn}
                      className={`is-${round.result}`}
                      title={`${rpsMoveMeta(round.playerMove).label} vs ${rpsMoveMeta(round.aiMove).label}`}
                    >
                      {round.turn}
                    </span>
                  ))}
                </div>
              )}
            </section>
          )}

          <details className="rule-note rps-rule-note">
            <summary>
              <span>가위바위보 배팅과 승부 규칙</span>
              <i>+</i>
            </summary>
            <p>
              내 배팅금은 매치 시작 시 지갑에서 빠집니다. AI는 그 금액의
              75~125%를 무작위로 걸고, 최종 승리하면 내 원금과 AI 배팅금을
              돌려받습니다. 패배하면 내 배팅금은 소멸됩니다. 7판 5선승은
              5승을 먼저 채울 때까지 진행하며 무승부는 판수와 승수에
              포함하지 않습니다.
            </p>
          </details>
        </div>

        <div
          id="timing-panel"
          className={`game-panel ${activeGame === "timing" ? "is-active" : ""}`}
          aria-hidden={activeGame !== "timing"}
        >
          <div className="panel-heading panel-heading--timing">
            <div>
              <p className="game-number">GAME 07 · STOP AT THE MOMENT</p>
              <h2>타이밍의 신</h2>
              <p>
                목표 시간과 소수점 둘째 자리까지 정확히 일치하는 순간에
                버튼을 누르세요.
              </p>
            </div>
            <div className="timing-rule-chip">
              <span>현재 도전 배수</span>
              <strong>
                {(gameState?.timing.currentMultiplier ?? 1.1).toFixed(1)}×
              </strong>
              <small>
                연속 실패 {gameState?.timing.failureStreak ?? 0}회
              </small>
            </div>
          </div>

          {timingPhase === "setup" ? (
            <div className="timing-layout">
              <section className="timing-setup-card">
                <p className="card-step">STEP 1 · TARGET</p>
                <h3>목표 시간을 설정하세요</h3>
                <div className="timing-target-grid" aria-label="목표 시간">
                  {TIMING_TARGETS.map((target) => (
                    <button
                      type="button"
                      key={target}
                      className={`timing-target-button ${
                        timingTarget === target ? "is-selected" : ""
                      }`}
                      aria-pressed={timingTarget === target}
                      onClick={() => setTimingTarget(target)}
                    >
                      {target.toFixed(2)}
                      <small>SEC</small>
                    </button>
                  ))}
                </div>

                <label className="timing-bet-input">
                  <span>배팅 금액 · 최소 1,000 C</span>
                  <div>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={timingBetAmount}
                      placeholder="최소 1,000"
                      aria-label="타이밍 게임 배팅 금액"
                      onChange={(event) =>
                        setTimingBetAmount(
                          event.target.value
                            .replaceAll(",", "")
                            .replace(/\D/g, "")
                            .slice(0, 12),
                        )
                      }
                    />
                    <b>C</b>
                  </div>
                </label>
                <div className="horse-bet-quick" aria-label="빠른 금액 선택">
                  {[1_000, 5_000, 10_000, 50_000].map((amount) => (
                    <button
                      type="button"
                      key={amount}
                      disabled={amount > (gameState?.profile.balance ?? 0)}
                      onClick={() => setTimingBetAmount(String(amount))}
                    >
                      {amount >= 10_000
                        ? `${amount / 10_000}만`
                        : `${amount / 1_000}천`}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="primary-button"
                  onClick={startTimingGame}
                  disabled={
                    busyAction === "timing_start" ||
                    timingBetValue < 1_000 ||
                    timingBetValue > (gameState?.profile.balance ?? 0)
                  }
                >
                  {busyAction === "timing_start"
                    ? "스톱워치 준비 중…"
                    : "배팅하고 게임 시작"}
                </button>
                {(gameState?.profile.balance ?? 0) < 1_000 && (
                  <small>플레이하려면 최소 1,000 C가 필요합니다.</small>
                )}
              </section>

              <aside className="timing-multiplier-card">
                <p className="card-step">PAYOUT MULTIPLIER</p>
                <span>이번 도전</span>
                <strong>{timingMultiplier.toFixed(1)}×</strong>
                <dl>
                  <div>
                    <dt>연속 실패</dt>
                    <dd>{gameState?.timing.failureStreak ?? 0}회</dd>
                  </div>
                  <div>
                    <dt>성공 시 총 지급</dt>
                    <dd>
                      {timingBetValue >= 1_000
                        ? formatCoins(timingPayoutPreview)
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt>성공 시 순이익</dt>
                    <dd>
                      {timingBetValue >= 1_000
                        ? `+${formatCoins(timingPayoutPreview - timingBetValue)}`
                        : "—"}
                    </dd>
                  </div>
                </dl>
                <p>
                  실패할 때마다 다음 배수가 0.1배 오르고, 성공하면
                  1.1배로 초기화됩니다.
                </p>
              </aside>
            </div>
          ) : (
            <section
              className={`timing-arena ${
                timingResult?.success ? "is-success" : ""
              }`}
              aria-live="polite"
            >
              <div className="timing-status">
                <span
                  className={timingPhase === "running" ? "is-live" : ""}
                >
                  {timingPhase === "running"
                    ? "LIVE"
                    : timingPhase === "stopped"
                      ? "CHECK"
                      : timingResult?.success
                        ? "PERFECT"
                        : "MISS"}
                </span>
                <p>
                  {timingPhase === "running"
                    ? "지금 흐르는 시간을 보고 정확한 순간에 멈추세요."
                    : timingPhase === "stopped"
                      ? "클릭한 순간을 정산하고 있습니다."
                      : timingResult?.success
                        ? "소수점 둘째 자리까지 정확히 일치했습니다!"
                        : "목표 시간과 일치하지 않았습니다."}
                </p>
              </div>

              <div
                className={`timing-clock ${
                  timingPhase === "running" ? "is-running" : ""
                }`}
                aria-label={`현재 ${formatStopwatch(timingElapsedHundredths)}초`}
              >
                <span>{formatStopwatch(timingElapsedHundredths)}</span>
                <small>SECONDS</small>
              </div>

              <div className="timing-target-line">
                <span>목표 시간</span>
                <strong>{timingGame?.target.toFixed(2)}초</strong>
                <i aria-hidden="true">◎</i>
                <span>도전 배수</span>
                <strong>{timingGame?.multiplier.toFixed(1)}배</strong>
              </div>

              {timingPhase !== "result" ? (
                <button
                  type="button"
                  className="timing-stop-button"
                  onClick={
                    timingPhase === "running"
                      ? stopTimingGame
                      : () =>
                          void settleTimingGame(timingElapsedHundredths)
                  }
                  disabled={busyAction === "timing_stop"}
                >
                  {timingPhase === "running"
                    ? "지금 멈추기"
                    : busyAction === "timing_stop"
                      ? "결과 확인 중…"
                      : "정산 다시 시도"}
                </button>
              ) : (
                timingResult && (
                  <div
                    className={`timing-result ${
                      timingResult.success ? "is-success" : "is-failure"
                    }`}
                  >
                    <div className="timing-difference">
                      <span>목표와의 차이</span>
                      <strong>
                        {timingDifference > 0 ? "+" : ""}
                        {(timingDifference / 100).toFixed(2)}초
                      </strong>
                    </div>
                    <dl>
                      <div>
                        <dt>최종 기록</dt>
                        <dd>
                          {formatStopwatch(timingResult.elapsedHundredths)}초
                        </dd>
                      </div>
                      <div>
                        <dt>
                          {timingResult.success ? "총 지급액" : "소멸 배팅금"}
                        </dt>
                        <dd>
                          {formatCoins(
                            timingResult.success
                              ? timingResult.payout
                              : timingResult.betAmount,
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>다음 배수</dt>
                        <dd>
                          {(
                            gameState?.timing.currentMultiplier ?? 1.1
                          ).toFixed(1)}
                          배
                        </dd>
                      </div>
                    </dl>
                    <p>
                      {timingResult.success
                        ? "성공으로 연속 실패 기록과 배수가 초기화됐습니다."
                        : `연속 실패 ${timingResult.failureStreak}회 · 다음 성공 보상이 더 커집니다.`}
                    </p>
                    <button
                      type="button"
                      className="timing-again-button"
                      onClick={resetTimingGame}
                    >
                      다시 도전하기
                    </button>
                  </div>
                )
              )}
            </section>
          )}

          <details className="rule-note timing-rule-note">
            <summary>
              <span>타이밍 판정과 배수 규칙</span>
              <i>+</i>
            </summary>
            <p>
              게임 시작 후 흐르는 스톱워치를 0.01초 단위로 판정합니다. 목표
              숫자와 표시된 기록이 완전히 같아야 성공입니다. 배팅금은 시작할
              때 차감되고, 성공하면 해당 배수만큼 총 지급됩니다. 실패 횟수가
              10회면 배수는 2.1배이며 성공 즉시 1.1배로 돌아갑니다.
            </p>
          </details>
        </div>
      </section>

      <section className="account-ledger">
        <div>
          <p className="eyebrow">COIN LEDGER</p>
          <h2>최근 코인 기록</h2>
          <p>게임, 투자, 저장으로 움직인 코인을 한눈에 확인하세요.</p>
        </div>
        <div className="ledger-list">
          {gameState?.transactions.length ? (
            gameState.transactions.slice(0, 6).map((transaction) => (
              <article key={transaction.id}>
                <span
                  className={
                    transaction.amount >= 0 ? "ledger-plus" : "ledger-minus"
                  }
                >
                  {transaction.amount >= 0 ? "+" : "−"}
                </span>
                <div>
                  <strong>{transaction.description}</strong>
                  <small>
                    {new Intl.DateTimeFormat("ko-KR", {
                      month: "numeric",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(transaction.createdAt)}
                  </small>
                </div>
                <b>
                  {transaction.amount > 0 ? "+" : ""}
                  {formatCoins(transaction.amount)}
                </b>
              </article>
            ))
          ) : (
            <p className="empty-ledger">아직 코인 사용 기록이 없습니다.</p>
          )}
        </div>
      </section>

      <footer className="site-footer">
        <div className="footer-brand">
          <span className="brand-mark brand-mark--small" aria-hidden="true">
            ?
          </span>
          <strong>운빨 실험실</strong>
        </div>
        <p>
          코인은 게임 안에서만 사용하는 가상 재화입니다.
          <br />
          실제 금융상품, 복권 구매 및 현금 가치와 무관합니다.
        </p>
        <div className="footer-links">
          <a href="#top">맨 위로 ↑</a>
        </div>
      </footer>

      {luckOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setLuckOpen(false);
          }}
        >
          <section
            className="luck-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="luck-modal-title"
          >
            <button
              type="button"
              className="modal-close"
              aria-label="닫기"
              onClick={() => setLuckOpen(false)}
            >
              ×
            </button>
            <span className="luck-vault-icon" aria-hidden="true">
              ✦
            </span>
            <p className="card-step">LUCK VAULT</p>
            <h2 id="luck-modal-title">운 저장하기</h2>
            <p>
              원하는 만큼 코인을 사용해 운으로 저장합니다. 저장한 운은
              기록으로만 남으며 <strong>다시 코인으로 꺼낼 수 없습니다.</strong>
            </p>
            <div className="vault-balance">
              <span>사용 가능</span>
              <strong>{formatCoins(visibleBalance)}</strong>
            </div>
            <label className="luck-input">
              <span>저장할 코인</span>
              <div>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={luckAmount}
                  onChange={(event) =>
                    setLuckAmount(
                      event.target.value
                        .replaceAll(/[^0-9]/g, "")
                        .replace(/\B(?=(\d{3})+(?!\d))/g, ","),
                    )
                  }
                  autoFocus
                />
                <b>C</b>
              </div>
            </label>
            <div className="luck-quick">
              {[10_000, 100_000, 500_000].map((amount) => (
                <button
                  type="button"
                  key={amount}
                  onClick={() =>
                    setLuckAmount(amount.toLocaleString("ko-KR"))
                  }
                  disabled={amount > visibleBalance}
                >
                  +{formatCoins(amount)}
                </button>
              ))}
              <button
                type="button"
                onClick={() =>
                  setLuckAmount(visibleBalance.toLocaleString("ko-KR"))
                }
              >
                전액
              </button>
            </div>
            <button
              type="button"
              className="primary-button"
              onClick={handleSaveLuck}
              disabled={
                busyAction === "save_luck" ||
                Number(luckAmount.replaceAll(",", "")) <= 0 ||
                Number(luckAmount.replaceAll(",", "")) > visibleBalance
              }
            >
              되돌릴 수 없음에 동의하고 저장
            </button>
          </section>
        </div>
      )}

      {paperPopupOpen && paperResult && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPaperPopupOpen(false);
          }}
        >
          <section
            className={`paper-result-modal ${
              paperResult.prize > 0 ? "is-win" : ""
            }`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="paper-result-modal-title"
          >
            <button
              type="button"
              className="modal-close"
              aria-label="결과 팝업 닫기"
              onClick={() => setPaperPopupOpen(false)}
            >
              ×
            </button>
            <span className="paper-result-modal__ticket" aria-hidden="true">
              {paperResult.id.replace("P", "")}
            </span>
            <p className="card-step">PAPER DRAW RESULT</p>
            <h2 id="paper-result-modal-title">
              {paperResult.prize > 0 ? "당첨!" : "아쉬운 꽝"}
            </h2>
            <strong>{paperResult.rank}</strong>
            <span>{formatCoins(paperResult.prize)}</span>
            <p>
              {paperResult.prize > 0
                ? "당첨금이 지갑에 바로 지급됐습니다."
                : "다음 종이에는 행운이 숨어 있을지도 몰라요."}
            </p>
            <button
              type="button"
              className="primary-button"
              onClick={() => setPaperPopupOpen(false)}
            >
              확인
            </button>
          </section>
        </div>
      )}

      {notice && (
        <div
          className={`toast toast--${notice.tone}`}
          role="status"
          aria-live="polite"
        >
          <span aria-hidden="true">
            {notice.tone === "good" ? "✓" : notice.tone === "bad" ? "!" : "·"}
          </span>
          {notice.text}
        </div>
      )}
    </main>
  );
}
