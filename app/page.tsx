"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from "react";
import {
  SPETTO_PRIZE_TABLE,
  drawUniqueNumbers,
  evaluateLotto,
  formatWon,
  generateScratchTicket,
} from "./game-logic";

type GameId = "lotto" | "gimbap";
type DrawPhase = "idle" | "drawing" | "bonus" | "complete";
type LottoResult = ReturnType<typeof evaluateLotto>;
type ScratchTicket = ReturnType<typeof generateScratchTicket>;

type SessionStats = {
  lottoDraws: number;
  gimbapOpened: number;
  virtualWon: number;
};

type ScratchSurfaceProps = {
  id: string;
  revealed: boolean;
  resetKey: number;
  label: string;
  revealedLabel: string;
  onReveal: (id: string) => void;
  children: ReactNode;
  tone?: "silver" | "seaweed";
};

const LOTTO_NUMBERS = Array.from({ length: 45 }, (_, index) => index + 1);
const EMPTY_SLOTS = Array.from({ length: 6 }, (_, index) => index);

function ballTone(number: number) {
  if (number <= 10) return "yellow";
  if (number <= 20) return "blue";
  if (number <= 30) return "red";
  if (number <= 40) return "gray";
  return "green";
}

function ScratchSurface({
  id,
  revealed,
  resetKey,
  label,
  revealedLabel,
  onReveal,
  children,
  tone = "silver",
}: ScratchSurfaceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const moveCountRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const drawCover = () => {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      const scale = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(rect.width * scale);
      canvas.height = Math.round(rect.height * scale);

      const context = canvas.getContext("2d");
      if (!context) return;

      context.setTransform(scale, 0, 0, scale, 0, 0);
      context.globalCompositeOperation = "source-over";

      const coverGradient = context.createLinearGradient(0, 0, rect.width, rect.height);
      if (tone === "seaweed") {
        coverGradient.addColorStop(0, "#1c2b24");
        coverGradient.addColorStop(0.5, "#35443a");
        coverGradient.addColorStop(1, "#18231e");
      } else {
        coverGradient.addColorStop(0, "#a5aaa4");
        coverGradient.addColorStop(0.45, "#d5d6cd");
        coverGradient.addColorStop(1, "#8f9690");
      }
      context.fillStyle = coverGradient;
      context.fillRect(0, 0, rect.width, rect.height);

      context.globalAlpha = tone === "seaweed" ? 0.32 : 0.24;
      context.fillStyle = tone === "seaweed" ? "#eef6c9" : "#ffffff";
      for (let x = -18; x < rect.width + 24; x += 22) {
        for (let y = -12; y < rect.height + 20; y += 19) {
          context.beginPath();
          context.arc(x + ((y / 19) % 2) * 9, y, 1.6, 0, Math.PI * 2);
          context.fill();
        }
      }

      context.globalAlpha = 0.84;
      context.fillStyle = tone === "seaweed" ? "#f3ffd0" : "#354037";
      context.font = `800 ${Math.max(10, Math.min(13, rect.width / 8))}px sans-serif`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText("문질러 긁기", rect.width / 2, rect.height / 2);
      context.globalAlpha = 1;
      moveCountRef.current = 0;
    };

    drawCover();
    const resizeObserver = new ResizeObserver(drawCover);
    resizeObserver.observe(canvas);

    return () => resizeObserver.disconnect();
  }, [resetKey, tone]);

  const getPoint = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  };

  const measureScratch = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let clearSamples = 0;
    let samples = 0;
    const pixelStep = 24;

    for (let index = 3; index < pixels.length; index += 4 * pixelStep) {
      samples += 1;
      if (pixels[index] < 32) clearSamples += 1;
    }

    if (samples > 0 && clearSamples / samples > 0.38) {
      onReveal(id);
    }
  };

  const scratch = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || revealed) return;
    const canvas = canvasRef.current;
    const point = getPoint(event);
    if (!canvas || !point) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const scale = Math.min(window.devicePixelRatio || 1, 2);
    context.setTransform(scale, 0, 0, scale, 0, 0);
    context.globalCompositeOperation = "destination-out";
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = 36;

    const lastPoint = lastPointRef.current ?? point;
    context.beginPath();
    context.moveTo(lastPoint.x, lastPoint.y);
    context.lineTo(point.x, point.y);
    context.stroke();
    lastPointRef.current = point;
    moveCountRef.current += 1;

    if (moveCountRef.current % 9 === 0) {
      measureScratch();
    }
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (revealed) return;
    isDrawingRef.current = true;
    lastPointRef.current = getPoint(event);
    event.currentTarget.setPointerCapture(event.pointerId);
    scratch(event);
  };

  const handlePointerUp = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    lastPointRef.current = null;
    measureScratch();
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onReveal(id);
    }
  };

  return (
    <div
      className={`scratch-surface ${revealed ? "is-revealed" : ""}`}
      role="button"
      tabIndex={0}
      aria-label={revealed ? revealedLabel : label}
      aria-pressed={revealed}
      onKeyDown={handleKeyDown}
    >
      <div className="scratch-content" aria-hidden={!revealed}>
        {children}
      </div>
      <canvas
        ref={canvasRef}
        className={`scratch-canvas scratch-canvas--${tone}`}
        onPointerDown={handlePointerDown}
        onPointerMove={scratch}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerUp}
        aria-hidden="true"
      />
      {!revealed && <span className="sr-only">마우스나 손가락으로 긁거나 Enter 키를 누르세요.</span>}
    </div>
  );
}

function LottoBall({
  number,
  placeholder,
  matched,
  bonus,
  small,
}: {
  number?: number;
  placeholder?: string;
  matched?: boolean;
  bonus?: boolean;
  small?: boolean;
}) {
  return (
    <span
      className={[
        "lotto-ball",
        number ? `lotto-ball--${ballTone(number)}` : "lotto-ball--empty",
        matched ? "is-matched" : "",
        bonus ? "is-bonus" : "",
        small ? "lotto-ball--small" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={
        number
          ? `${number}번${matched ? ", 일치" : ""}${bonus ? ", 보너스" : ""}`
          : "빈 선택 칸"
      }
    >
      {number ?? placeholder ?? "·"}
      {matched && <span className="ball-check" aria-hidden="true">✓</span>}
    </span>
  );
}

export default function Home() {
  const [activeGame, setActiveGame] = useState<GameId>("lotto");
  const [soundOn, setSoundOn] = useState(true);
  const [stats, setStats] = useState<SessionStats>({
    lottoDraws: 0,
    gimbapOpened: 0,
    virtualWon: 0,
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const playTone = useCallback(
    (frequency = 440, duration = 0.07, volume = 0.035) => {
      if (!soundOn || typeof window === "undefined" || !window.AudioContext) return;

      const context =
        audioContextRef.current ?? new window.AudioContext();
      audioContextRef.current = context;

      if (context.state === "suspended") {
        void context.resume();
      }

      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const now = context.currentTime;

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, now);
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(90, frequency * 0.82),
        now + duration,
      );
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + duration);
    },
    [soundOn],
  );

  const switchGame = (game: GameId) => {
    setActiveGame(game);
    playTone(game === "lotto" ? 470 : 350, 0.06, 0.025);
  };

  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
  const [revealedNumbers, setRevealedNumbers] = useState<number[]>([]);
  const [bonusNumber, setBonusNumber] = useState<number | null>(null);
  const [drawPhase, setDrawPhase] = useState<DrawPhase>("idle");
  const [lottoResult, setLottoResult] = useState<LottoResult | null>(null);
  const drawTimersRef = useRef<number[]>([]);
  const currentDrawRef = useRef<{
    mainNumbers: number[];
    bonusNumber: number;
    selected: number[];
  } | null>(null);
  const finalizedDrawRef = useRef(false);
  const lottoResultRef = useRef<HTMLDivElement>(null);

  const clearDrawTimers = useCallback(() => {
    drawTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    drawTimersRef.current = [];
  }, []);

  useEffect(() => clearDrawTimers, [clearDrawTimers]);

  const finalizeLotto = useCallback(() => {
    const draw = currentDrawRef.current;
    if (!draw || finalizedDrawRef.current) return;

    finalizedDrawRef.current = true;
    clearDrawTimers();
    setRevealedNumbers(draw.mainNumbers);
    setBonusNumber(draw.bonusNumber);
    setDrawPhase("complete");

    const result = evaluateLotto(
      draw.selected,
      draw.mainNumbers,
      draw.bonusNumber,
    );
    setLottoResult(result);
    setStats((current) => ({
      ...current,
      lottoDraws: current.lottoDraws + 1,
    }));

    if (result.rank) {
      [620, 780, 930].forEach((tone, index) => {
        window.setTimeout(() => playTone(tone, 0.12, 0.04), index * 100);
      });
    } else {
      playTone(180, 0.12, 0.025);
    }
  }, [clearDrawTimers, playTone]);

  useEffect(() => {
    if (lottoResult) {
      window.setTimeout(() => lottoResultRef.current?.focus(), 80);
    }
  }, [lottoResult]);

  const resetLottoDisplay = () => {
    if (drawPhase === "complete") {
      setRevealedNumbers([]);
      setBonusNumber(null);
      setDrawPhase("idle");
      setLottoResult(null);
      currentDrawRef.current = null;
    }
  };

  const toggleLottoNumber = (number: number) => {
    if (drawPhase === "drawing" || drawPhase === "bonus") return;

    resetLottoDisplay();
    setSelectedNumbers((current) => {
      if (current.includes(number)) {
        playTone(260, 0.045, 0.02);
        return current.filter((item) => item !== number);
      }
      if (current.length >= 6) return current;
      playTone(480 + current.length * 40, 0.05, 0.024);
      return [...current, number].sort((a, b) => a - b);
    });
  };

  const autoPick = () => {
    if (drawPhase === "drawing" || drawPhase === "bonus") return;
    resetLottoDisplay();
    const picks = drawUniqueNumbers(6, 45).sort((a, b) => a - b);
    setSelectedNumbers(picks);
    [390, 460, 540].forEach((tone, index) => {
      window.setTimeout(() => playTone(tone, 0.055, 0.025), index * 55);
    });
  };

  const clearPicks = () => {
    if (drawPhase === "drawing" || drawPhase === "bonus") return;
    clearDrawTimers();
    setSelectedNumbers([]);
    setRevealedNumbers([]);
    setBonusNumber(null);
    setDrawPhase("idle");
    setLottoResult(null);
    currentDrawRef.current = null;
    playTone(210, 0.08, 0.02);
  };

  const startDraw = () => {
    if (
      selectedNumbers.length !== 6 ||
      drawPhase === "drawing" ||
      drawPhase === "bonus"
    ) {
      return;
    }

    clearDrawTimers();
    const draw = drawUniqueNumbers(7, 45);
    const mainNumbers = draw.slice(0, 6);
    const nextBonusNumber = draw[6];
    currentDrawRef.current = {
      mainNumbers,
      bonusNumber: nextBonusNumber,
      selected: [...selectedNumbers],
    };
    finalizedDrawRef.current = false;
    setRevealedNumbers([]);
    setBonusNumber(null);
    setLottoResult(null);
    setDrawPhase("drawing");
    playTone(240, 0.11, 0.03);

    mainNumbers.forEach((number, index) => {
      const timer = window.setTimeout(
        () => {
          setRevealedNumbers(mainNumbers.slice(0, index + 1));
          playTone(330 + number * 8, 0.08, 0.035);
        },
        520 + index * 620,
      );
      drawTimersRef.current.push(timer);
    });

    drawTimersRef.current.push(
      window.setTimeout(() => {
        setDrawPhase("bonus");
        setBonusNumber(nextBonusNumber);
        playTone(860, 0.16, 0.04);
      }, 520 + mainNumbers.length * 620),
    );

    drawTimersRef.current.push(
      window.setTimeout(
        finalizeLotto,
        960 + mainNumbers.length * 620,
      ),
    );
  };

  const isLottoDrawing = drawPhase === "drawing" || drawPhase === "bonus";
  const lottoMatchSet = useMemo(
    () => new Set(currentDrawRef.current?.selected ?? selectedNumbers),
    [selectedNumbers, lottoResult, drawPhase],
  );

  const [ticket, setTicket] = useState<ScratchTicket | null>(null);
  const [ticketNumber, setTicketNumber] = useState(1);
  const [scratchResetKey, setScratchResetKey] = useState(0);
  const [scratchedIds, setScratchedIds] = useState<string[]>([]);
  const scratchCountedRef = useRef(false);
  const scratchResultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTicket((current) => current ?? generateScratchTicket());
  }, []);

  const scratchComplete = scratchedIds.length === 7;
  const luckyRevealed = scratchedIds.includes("lucky");

  useEffect(() => {
    if (!ticket || !scratchComplete || scratchCountedRef.current) return;

    scratchCountedRef.current = true;
    setStats((current) => ({
      ...current,
      gimbapOpened: current.gimbapOpened + 1,
      virtualWon: current.virtualWon + ticket.prize,
    }));

    if (ticket.isWinner) {
      [520, 660, 820, 1040].forEach((tone, index) => {
        window.setTimeout(() => playTone(tone, 0.13, 0.035), index * 90);
      });
    } else {
      playTone(170, 0.15, 0.025);
    }

    window.setTimeout(() => scratchResultRef.current?.focus(), 100);
  }, [playTone, scratchComplete, ticket]);

  const revealScratch = useCallback(
    (id: string) => {
      setScratchedIds((current) => {
        if (current.includes(id)) return current;
        playTone(id === "lucky" ? 610 : 390 + current.length * 35, 0.06, 0.026);
        return [...current, id];
      });
    },
    [playTone],
  );

  const revealAllScratch = () => {
    setScratchedIds([
      "lucky",
      "cell-0",
      "cell-1",
      "cell-2",
      "cell-3",
      "cell-4",
      "cell-5",
    ]);
    playTone(740, 0.12, 0.035);
  };

  const makeNewTicket = () => {
    setTicket(generateScratchTicket());
    setTicketNumber((current) => current + 1);
    setScratchResetKey((current) => current + 1);
    setScratchedIds([]);
    scratchCountedRef.current = false;
    playTone(300, 0.09, 0.03);
  };

  const handleSoundToggle = () => {
    setSoundOn((current) => !current);
    if (!soundOn) playTone(520, 0.06, 0.025);
  };

  return (
    <main className="app-shell">
      <div className="ambient ambient--one" aria-hidden="true" />
      <div className="ambient ambient--two" aria-hidden="true" />

      <header className="site-header">
        <a className="brand" href="#top" aria-label="운빨 실험실 홈">
          <span className="brand-mark" aria-hidden="true">
            <span>?</span>
          </span>
          <span className="brand-copy">
            <strong>운빨 실험실</strong>
            <small>LUCK TEST ARCADE</small>
          </span>
        </a>

        <nav className="game-tabs" aria-label="게임 선택" role="tablist">
          <button
            className={activeGame === "lotto" ? "is-active" : ""}
            type="button"
            role="tab"
            aria-selected={activeGame === "lotto"}
            aria-controls="lotto-panel"
            onClick={() => switchGame("lotto")}
          >
            <span className="tab-index">01</span>
            로또 맞히기
          </button>
          <button
            className={activeGame === "gimbap" ? "is-active" : ""}
            type="button"
            role="tab"
            aria-selected={activeGame === "gimbap"}
            aria-controls="gimbap-panel"
            onClick={() => switchGame("gimbap")}
          >
            <span className="tab-index">02</span>
            즉석김밥1000
          </button>
        </nav>

        <button
          className="sound-toggle"
          type="button"
          aria-pressed={soundOn}
          onClick={handleSoundToggle}
        >
          <span aria-hidden="true">{soundOn ? "♪" : "×"}</span>
          소리 {soundOn ? "켜짐" : "꺼짐"}
        </button>
      </header>

      <section className="intro" id="top">
        <div className="intro-copy">
          <p className="eyebrow">
            <span className="status-dot" aria-hidden="true" />
            오늘의 확률 실험 접수 중
          </p>
          <h1>
            오늘, 확률이
            <br />
            <span>내 편일까?</span>
          </h1>
          <p className="intro-description">
            실력은 잠깐 내려놓고, 순수한 운만 시험해보세요.
            <br />
            결과는 정직하게 랜덤, 재미는 아주 진지하게 만들었습니다.
          </p>
        </div>

        <aside className="session-receipt" aria-label="이번 방문 실험 기록">
          <div className="receipt-topline">
            <span>SESSION REPORT</span>
            <span>LIVE</span>
          </div>
          <dl>
            <div>
              <dt>로또 추첨</dt>
              <dd>{String(stats.lottoDraws).padStart(2, "0")}회</dd>
            </div>
            <div>
              <dt>김밥 개봉</dt>
              <dd>{String(stats.gimbapOpened).padStart(2, "0")}장</dd>
            </div>
            <div className="receipt-total">
              <dt>가상 당첨금</dt>
              <dd>{formatWon(stats.virtualWon)}원</dd>
            </div>
          </dl>
          <p>※ 이 기록은 현재 페이지를 닫으면 사라져요.</p>
        </aside>
      </section>

      <section className="game-stage" aria-live="polite">
        <div
          id="lotto-panel"
          className={`game-panel ${activeGame === "lotto" ? "is-active" : ""}`}
          role="tabpanel"
          aria-hidden={activeGame !== "lotto"}
        >
          <div className="panel-heading">
            <div>
              <p className="game-number">GAME 01 · LOTTO 6/45</p>
              <h2>로또 맞히기</h2>
              <p>여섯 숫자를 고르면, 공이 하나씩 운명을 알려드립니다.</p>
            </div>
            <div className="rule-chip">
              <span>규칙</span>
              1~45 · 중복 없이 6개
            </div>
          </div>

          <div className="lotto-workspace">
            <section className="pick-card" aria-labelledby="pick-title">
              <div className="card-title-row">
                <div>
                  <p className="card-step">STEP 1</p>
                  <h3 id="pick-title">나의 숫자</h3>
                </div>
                <strong className="selection-count">
                  <span>{selectedNumbers.length}</span> / 6
                </strong>
              </div>

              <div className="selected-rack" aria-label="선택한 로또 번호">
                {EMPTY_SLOTS.map((slot) => (
                  <LottoBall
                    key={slot}
                    number={selectedNumbers[slot]}
                    placeholder={String(slot + 1).padStart(2, "0")}
                  />
                ))}
              </div>

              <div className="pick-toolbar">
                <p>
                  {selectedNumbers.length < 6
                    ? `${6 - selectedNumbers.length}개만 더 골라주세요`
                    : "선택 완료! 이제 추첨할 수 있어요"}
                </p>
                <div>
                  <button
                    type="button"
                    className="text-button"
                    onClick={autoPick}
                    disabled={isLottoDrawing}
                  >
                    자동 선택
                  </button>
                  <button
                    type="button"
                    className="text-button text-button--muted"
                    onClick={clearPicks}
                    disabled={isLottoDrawing || selectedNumbers.length === 0}
                  >
                    초기화
                  </button>
                </div>
              </div>

              <div className="number-grid" aria-label="1부터 45까지 번호판">
                {LOTTO_NUMBERS.map((number) => {
                  const selected = selectedNumbers.includes(number);
                  const selectionFull = selectedNumbers.length >= 6;
                  return (
                    <button
                      key={number}
                      type="button"
                      className={`number-pick number-pick--${ballTone(number)} ${
                        selected ? "is-selected" : ""
                      }`}
                      aria-pressed={selected}
                      aria-label={`${number}번${selected ? " 선택 해제" : " 선택"}`}
                      disabled={isLottoDrawing || (selectionFull && !selected)}
                      onClick={() => toggleLottoNumber(number)}
                    >
                      {number}
                      {selected && <span aria-hidden="true">✓</span>}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="draw-card" aria-labelledby="draw-title">
              <div className="card-title-row">
                <div>
                  <p className="card-step">STEP 2</p>
                  <h3 id="draw-title">행운 추첨기</h3>
                </div>
                <span className={`draw-status draw-status--${drawPhase}`}>
                  {drawPhase === "idle" && "READY"}
                  {drawPhase === "drawing" && "DRAWING"}
                  {drawPhase === "bonus" && "BONUS"}
                  {drawPhase === "complete" && "COMPLETE"}
                </span>
              </div>

              <div className={`lottery-machine ${isLottoDrawing ? "is-running" : ""}`}>
                <div className="machine-glass">
                  <div className="machine-shine" aria-hidden="true" />
                  {Array.from({ length: 13 }, (_, index) => (
                    <span
                      className={`machine-ball machine-ball--${(index % 5) + 1}`}
                      key={index}
                      style={
                        {
                          "--ball-index": index,
                        } as React.CSSProperties
                      }
                      aria-hidden="true"
                    >
                      {((index * 7 + 3) % 45) + 1}
                    </span>
                  ))}
                  <div className="machine-center">
                    <span>{revealedNumbers.length}</span>
                    <small>/ 6</small>
                  </div>
                </div>
                <div className="machine-neck" aria-hidden="true" />
                <div className="machine-base">
                  <span>LUCKY DRAW</span>
                  <i aria-hidden="true" />
                </div>
              </div>

              <div className="drawn-area">
                <p>추첨 번호</p>
                <div className="drawn-row">
                  {EMPTY_SLOTS.map((slot) => (
                    <LottoBall
                      key={slot}
                      number={revealedNumbers[slot]}
                      matched={
                        revealedNumbers[slot]
                          ? lottoMatchSet.has(revealedNumbers[slot])
                          : false
                      }
                      placeholder="?"
                      small
                    />
                  ))}
                  <span className="plus-sign" aria-hidden="true">+</span>
                  <div className="bonus-slot">
                    <LottoBall
                      number={bonusNumber ?? undefined}
                      matched={bonusNumber ? lottoMatchSet.has(bonusNumber) : false}
                      placeholder="B"
                      bonus
                      small
                    />
                    <small>보너스</small>
                  </div>
                </div>
              </div>

              <div className="draw-actions">
                <button
                  className="primary-button"
                  type="button"
                  onClick={startDraw}
                  disabled={selectedNumbers.length !== 6 || isLottoDrawing}
                >
                  <span aria-hidden="true">✦</span>
                  {drawPhase === "complete" ? "같은 번호로 다시 추첨" : "추첨하기"}
                </button>
                {isLottoDrawing && (
                  <button className="skip-button" type="button" onClick={finalizeLotto}>
                    결과 바로 보기
                  </button>
                )}
              </div>
            </section>
          </div>

          {lottoResult && (
            <div
              ref={lottoResultRef}
              className={`result-banner result-banner--lotto ${
                lottoResult.rank ? "is-win" : "is-miss"
              }`}
              tabIndex={-1}
            >
              {lottoResult.rank && (
                <div className="confetti" aria-hidden="true">
                  {Array.from({ length: 12 }, (_, index) => (
                    <i key={index} style={{ "--i": index } as React.CSSProperties} />
                  ))}
                </div>
              )}
              <div className="result-rank">
                <small>MY RESULT</small>
                <strong>{lottoResult.rank ? `${lottoResult.rank}등` : "다음 기회"}</strong>
              </div>
              <div className="result-copy">
                <p>{lottoResult.eyebrow}</p>
                <h3>{lottoResult.title}</h3>
                <span>{lottoResult.message}</span>
              </div>
              <div className="result-actions">
                <button type="button" onClick={startDraw}>
                  같은 번호로 다시
                </button>
                <button type="button" onClick={clearPicks}>
                  새 번호 고르기
                </button>
              </div>
            </div>
          )}

          <details className="rule-note">
            <summary>
              <span>당첨 판정은 어떻게 하나요?</span>
              <i aria-hidden="true">+</i>
            </summary>
            <div className="rule-grid">
              {[
                ["1등", "본번호 6개"],
                ["2등", "본번호 5개 + 보너스"],
                ["3등", "본번호 5개"],
                ["4등", "본번호 4개"],
                ["5등", "본번호 3개"],
              ].map(([rank, rule]) => (
                <div key={rank}>
                  <strong>{rank}</strong>
                  <span>{rule}</span>
                </div>
              ))}
            </div>
            <p>
              번호의 순서는 무관하며 보너스 번호는 2등과 3등을 구분할 때만
              사용합니다.{" "}
              <a
                href="https://www.dhlottery.co.kr/lt645/intro"
                target="_blank"
                rel="noreferrer"
              >
                동행복권 공식 규칙
              </a>
            </p>
          </details>
        </div>

        <div
          id="gimbap-panel"
          className={`game-panel ${activeGame === "gimbap" ? "is-active" : ""}`}
          role="tabpanel"
          aria-hidden={activeGame !== "gimbap"}
        >
          <div className="panel-heading panel-heading--gimbap">
            <div>
              <p className="game-number">GAME 02 · INSTANT GIMBAP 1000</p>
              <h2>즉석김밥1000</h2>
              <p>행운 숫자와 같은 속재료를 찾으면, 그 칸의 금액 당첨!</p>
            </div>
            <div className="rule-chip rule-chip--dark">
              <span>가격</span>
              가상 1,000원
            </div>
          </div>

          <div className="gimbap-workspace">
            <section className="gimbap-ticket" aria-label={`즉석김밥 ${ticketNumber}번 티켓`}>
              <div className="ticket-perforation ticket-perforation--top" aria-hidden="true" />
              <div className="ticket-header">
                <div className="ticket-brand">
                  <span className="gimbap-roll" aria-hidden="true">
                    <i />
                  </span>
                  <div>
                    <p>오늘 말아 바로 긁는</p>
                    <h3>즉석김밥<span>1000</span></h3>
                  </div>
                </div>
                <div className="ticket-serial">
                  <span>NO.</span>
                  {String(ticketNumber).padStart(6, "0")}
                </div>
              </div>

              <div className="ticket-rule-line">
                <span>HOW TO WIN</span>
                행운 숫자와 같은 ‘나의 숫자’를 찾으면 그 칸의 금액 당첨
              </div>

              {!ticket ? (
                <div className="ticket-loading" role="status">
                  <span className="loading-roll" aria-hidden="true" />
                  오늘의 김밥을 말고 있어요…
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
                    <ScratchSurface
                      id="lucky"
                      resetKey={scratchResetKey}
                      revealed={luckyRevealed}
                      label="숨겨진 행운 숫자, 긁어서 공개"
                      revealedLabel={`행운 숫자 ${ticket.luckyNumber}`}
                      onReveal={revealScratch}
                    >
                      <span className="lucky-number">{ticket.luckyNumber}</span>
                    </ScratchSurface>
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
                      {ticket.cells.map((cell, index) => {
                        const id = `cell-${index}`;
                        const revealed = scratchedIds.includes(id);
                        const confirmedMatch =
                          revealed && luckyRevealed && cell.matches;
                        return (
                          <div
                            className={`scratch-cell ${
                              confirmedMatch ? "is-winning-cell" : ""
                            }`}
                            key={id}
                          >
                            <span className="cell-index">{String(index + 1).padStart(2, "0")}</span>
                            <ScratchSurface
                              id={id}
                              resetKey={scratchResetKey}
                              revealed={revealed}
                              label={`${index + 1}번째 숨겨진 나의 숫자, 긁어서 공개`}
                              revealedLabel={`나의 숫자 ${cell.number}, 당첨금 ${formatWon(cell.prize)}원${
                                confirmedMatch ? ", 행운 숫자와 일치" : ""
                              }`}
                              onReveal={revealScratch}
                              tone="seaweed"
                            >
                              <strong className="my-scratch-number">{cell.number}</strong>
                              <span className="scratch-prize">
                                {cell.prize >= 100_000_000
                                  ? "5억원"
                                  : cell.prize >= 10_000_000
                                    ? "2천만원"
                                    : `${formatWon(cell.prize)}원`}
                              </span>
                              {confirmedMatch && (
                                <i className="match-stamp" aria-hidden="true">일치!</i>
                              )}
                            </ScratchSurface>
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
                  마우스나 손가락으로 문질러 긁어보세요.
                  <span>키보드는 Enter로 공개할 수 있어요.</span>
                </p>
                <div className="barcode" aria-hidden="true">
                  {Array.from({ length: 28 }, (_, index) => (
                    <i key={index} />
                  ))}
                </div>
              </div>
              <div className="ticket-perforation ticket-perforation--bottom" aria-hidden="true" />
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
                이 티켓의 결과는 이미 정해졌습니다.
                <br />
                이제 직접 긁어 확인할 차례예요.
              </p>

              <div className="scratch-progress" aria-label={`스크래치 진행률 ${scratchedIds.length}/7`}>
                <span style={{ width: `${(scratchedIds.length / 7) * 100}%` }} />
              </div>

              <ol className="scratch-steps">
                <li className={luckyRevealed ? "is-done" : ""}>
                  <span>{luckyRevealed ? "✓" : "1"}</span>
                  행운 숫자 확인
                </li>
                <li className={scratchedIds.length > (luckyRevealed ? 1 : 0) ? "is-done" : ""}>
                  <span>{scratchedIds.length > (luckyRevealed ? 1 : 0) ? "✓" : "2"}</span>
                  나의 숫자 긁기
                </li>
                <li className={scratchComplete ? "is-done" : ""}>
                  <span>{scratchComplete ? "✓" : "3"}</span>
                  당첨 결과 확인
                </li>
              </ol>

              <button
                type="button"
                className="primary-button primary-button--lime"
                onClick={revealAllScratch}
                disabled={!ticket || scratchComplete}
              >
                <span aria-hidden="true">✦</span>
                전체 긁기
              </button>
              <button
                type="button"
                className="new-ticket-button"
                onClick={makeNewTicket}
                disabled={!ticket}
              >
                새 김밥 말기
              </button>
            </aside>
          </div>

          {ticket && scratchComplete && (
            <div
              ref={scratchResultRef}
              className={`result-banner result-banner--scratch ${
                ticket.isWinner ? "is-win" : "is-miss"
              }`}
              tabIndex={-1}
            >
              {ticket.isWinner && (
                <div className="confetti" aria-hidden="true">
                  {Array.from({ length: 12 }, (_, index) => (
                    <i key={index} style={{ "--i": index } as React.CSSProperties} />
                  ))}
                </div>
              )}
              <div className="result-rank result-rank--scratch">
                <small>INSTANT RESULT</small>
                <strong>{ticket.isWinner ? ticket.rank : "아쉽!"}</strong>
              </div>
              <div className="result-copy">
                <p>
                  {ticket.isWinner
                    ? `행운 숫자 ${ticket.luckyNumber} 일치`
                    : "일치하는 숫자 없음"}
                </p>
                <h3>
                  {ticket.isWinner
                    ? "김밥 속에 행운이 말려 있었어요!"
                    : "이번 김밥은 담백한 꽝이에요"}
                </h3>
                <span>
                  {ticket.isWinner
                    ? `가상 당첨금 ${ticket.prizeLabel}! 오늘의 운이 제대로 터졌습니다.`
                    : "그래도 다음 김밥의 결과는 완전히 새로 섞입니다."}
                </span>
              </div>
              <div className="scratch-win-amount">
                <small>가상 당첨금</small>
                <strong>{formatWon(ticket.prize)}원</strong>
              </div>
              <div className="result-actions">
                <button type="button" onClick={makeNewTicket}>
                  새 김밥 말기
                </button>
              </div>
            </div>
          )}

          <details className="rule-note rule-note--gimbap">
            <summary>
              <span>실제 스피또1000 확률을 어떻게 반영했나요?</span>
              <i aria-hidden="true">+</i>
            </summary>
            <div className="prize-table" role="table" aria-label="즉석김밥1000 당첨 구조">
              {SPETTO_PRIZE_TABLE.map((tier) => (
                <div role="row" key={tier.label}>
                  <span role="cell">{tier.rank ?? "낙첨"}</span>
                  <strong role="cell">{tier.label}</strong>
                  <span role="cell">{formatWon(tier.count)}장 / 500만 장</span>
                </div>
              ))}
            </div>
            <p>
              공식 스피또1000의 기본 발행 단위 500만 장과 같은 비율로 결과를
              먼저 뽑은 뒤 숫자를 구성합니다. 표시 숫자 1~9는 이 게임의
              연출을 위한 범위입니다.{" "}
              <a
                href="https://www.dhlottery.co.kr/st/st10Intro"
                target="_blank"
                rel="noreferrer"
              >
                동행복권 공식 당첨구조
              </a>
            </p>
          </details>
        </div>
      </section>

      <section className="next-games">
        <div>
          <p className="eyebrow">MORE LUCK, SOON</p>
          <h2>다음 운빨 게임도<br />준비 중이에요.</h2>
        </div>
        <div className="coming-cards" aria-label="추후 추가 예정 게임">
          <article>
            <span>03</span>
            <div>
              <small>COMING SOON</small>
              <h3>오늘의 운세 뽑기</h3>
            </div>
            <i aria-hidden="true">↗</i>
          </article>
          <article>
            <span>04</span>
            <div>
              <small>COMING SOON</small>
              <h3>확률 상자</h3>
            </div>
            <i aria-hidden="true">↗</i>
          </article>
        </div>
      </section>

      <footer className="site-footer">
        <div className="footer-brand">
          <span className="brand-mark brand-mark--small" aria-hidden="true">?</span>
          <strong>운빨 실험실</strong>
        </div>
        <p>
          본 사이트는 재미를 위한 확률 시뮬레이션입니다.
          <br />
          실제 복권 구매, 당첨금 지급 및 동행복권과 무관합니다.
        </p>
        <a href="#top">맨 위로 ↑</a>
      </footer>
    </main>
  );
}
