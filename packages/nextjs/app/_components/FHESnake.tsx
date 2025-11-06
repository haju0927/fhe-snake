"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFhevm } from "@fhevm-sdk";
import confetti from "canvas-confetti";
import { motion } from "framer-motion";
import { useAccount } from "wagmi";
import { RainbowKitCustomConnectButton } from "~~/components/helper/RainbowKitCustomConnectButton";
import { useFHESnakeWagmi } from "~~/hooks/useFHESnakeWagmi";

type Point = { x: number; y: number };

export function FHESnake() {
  const { isConnected, chain } = useAccount();
  const chainId = chain?.id;
  const provider = useMemo(() => (typeof window !== "undefined" ? (window as any).ethereum : undefined), []);

  const initialMockChains = {
    11155111: `https://eth-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`,
  };

  const {
    instance: fhevmInstance,
    status: fhevmStatus,
    error: fhevmError,
  } = useFhevm({
    provider,
    chainId,
    initialMockChains,
    enabled: true,
  });

  const fheSnake = useFHESnakeWagmi({ instance: fhevmInstance, initialMockChains });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [running, setRunning] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [speed, setSpeed] = useState(120);
  const tileCount = 20;
  const tileSize = 20;

  const [snake, setSnake] = useState<Point[]>([{ x: 10, y: 10 }]);
  const [dir, setDir] = useState<Point>({ x: 1, y: 0 });
  const [food, setFood] = useState<Point>({ x: 5, y: 5 });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!running) return;
      if (e.key === "ArrowUp" && dir.y === 0) setDir({ x: 0, y: -1 });
      if (e.key === "ArrowDown" && dir.y === 0) setDir({ x: 0, y: 1 });
      if (e.key === "ArrowLeft" && dir.x === 0) setDir({ x: -1, y: 0 });
      if (e.key === "ArrowRight" && dir.x === 0) setDir({ x: 1, y: 0 });
      if (["w", "a", "s", "d"].includes(e.key.toLowerCase())) {
        const map: Record<string, Point> = {
          w: { x: 0, y: -1 },
          s: { x: 0, y: 1 },
          a: { x: -1, y: 0 },
          d: { x: 1, y: 0 },
        };
        if (
          (e.key === "w" && dir.y !== 1) ||
          (e.key === "s" && dir.y !== -1) ||
          (e.key === "a" && dir.x !== 1) ||
          (e.key === "d" && dir.x !== -1)
        ) {
          setDir(map[e.key]);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dir, running]);

  // 🧠 Game Loop
  useEffect(() => {
    let timer: any;
    if (!running || gameOver) return;

    timer = setInterval(() => {
      setSnake(prev => {
        const head = { x: prev[0].x + dir.x, y: prev[0].y + dir.y };

        // đụng tường
        if (head.x < 0 || head.x >= tileCount || head.y < 0 || head.y >= tileCount) {
          setGameOver(true);
          setRunning(false);
          confetti({ particleCount: 70, spread: 80 });
          return prev;
        }

        // đụng chính mình
        if (prev.some(p => p.x === head.x && p.y === head.y)) {
          setGameOver(true);
          setRunning(false);
          confetti({ particleCount: 70, spread: 80 });
          return prev;
        }

        const grew = head.x === food.x && head.y === food.y;
        const next = [head, ...prev];
        if (!grew) next.pop();
        else {
          setScore(s => s + 1);
          let nx = Math.floor(Math.random() * tileCount);
          let ny = Math.floor(Math.random() * tileCount);
          const occupied = new Set(next.map(p => `${p.x},${p.y}`));
          while (occupied.has(`${nx},${ny}`)) {
            nx = Math.floor(Math.random() * tileCount);
            ny = Math.floor(Math.random() * tileCount);
          }
          setFood({ x: nx, y: ny });
        }
        return next;
      });
    }, speed);
    return () => clearInterval(timer);
  }, [running, dir, food, gameOver, speed]);

  // 🎨 Render canvas
  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#001010";
    ctx.fillRect(0, 0, cvs.width, cvs.height);

    ctx.fillStyle = "#062b29";
    for (let x = 0; x < tileCount; x++) {
      for (let y = 0; y < tileCount; y++) {
        ctx.fillRect(x * tileSize + 1, y * tileSize + 1, tileSize - 2, tileSize - 2);
      }
    }

    ctx.fillStyle = "#ff5252";
    ctx.fillRect(food.x * tileSize + 3, food.y * tileSize + 3, tileSize - 6, tileSize - 6);

    snake.forEach((p, i) => {
      ctx.fillStyle = i === 0 ? "#00ff9c" : "#1ed760";
      ctx.fillRect(p.x * tileSize + 2, p.y * tileSize + 2, tileSize - 4, tileSize - 4);
    });
  }, [snake, food]);

  useEffect(() => {
    if (!gameOver || !fheSnake.canSubmit) return;
    (async () => {
      try {
        await fheSnake.updateLength(score);
        await fheSnake.fetchLongestLength();
      } catch (e) {
        console.warn("updateLength error:", e);
      }
    })();
  }, [gameOver]);

  const handleStart = () => {
    setSnake([{ x: 10, y: 10 }]);
    setDir({ x: 1, y: 0 });
    setFood({ x: Math.floor(Math.random() * tileCount), y: Math.floor(Math.random() * tileCount) });
    setScore(0);
    setGameOver(false);
    setRunning(true);
  };

  const handleRestart = () => {
    setRunning(false);
    setGameOver(false);
    setSnake([{ x: 10, y: 10 }]);
    setDir({ x: 1, y: 0 });
    setFood({ x: Math.floor(Math.random() * tileCount), y: Math.floor(Math.random() * tileCount) });
    setScore(0);
    setTimeout(() => setRunning(true), 100);
  };

  const handleDecrypt = async () => {
    if (!fheSnake.canDecrypt || fheSnake.isDecrypting) return;
    await fheSnake.decryptResult();
  };

  const safeMessage =
    typeof fheSnake.message === "string" ? fheSnake.message : fheSnake.message ? String(fheSnake.message) : "";

  if (!isConnected) {
    return (
      <div className="h-[calc(100vh-100px)] flex w-full items-center justify-center text-white">
        <motion.div
          className="p-10 bg-white/10 border border-white/20 rounded-3xl shadow-2xl text-center backdrop-blur-lg"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div className="text-6xl mb-4 animate-bounce">🐍</div>
          <h2 className="text-4xl font-bold mb-3">Connect Wallet to Play</h2>
          <p className="text-gray-300 mb-6">Your score is encrypted and stored on-chain!</p>
          <RainbowKitCustomConnectButton />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-60px)] w-full flex flex-col items-center justify-start py-6 text-white">
      <h1 className="text-3xl font-extrabold text-green-400 mb-4">🐍 FHE Snake</h1>

      {/* Game area */}
      <div className="flex flex-col items-center mb-6">
        <canvas
          ref={canvasRef}
          width={tileCount * tileSize}
          height={tileCount * tileSize}
          className="border-4 border-green-600 rounded-2xl shadow-2xl bg-black"
        />
        <div className="flex items-center gap-3 mt-4">
          {!running && !gameOver && (
            <button onClick={handleStart} className="px-5 py-2 bg-green-500 text-black rounded-lg hover:bg-green-400">
              ▶️ Start
            </button>
          )}
          {!running && gameOver && (
            <button onClick={handleRestart} className="px-5 py-2 bg-green-500 text-black rounded-lg hover:bg-green-400">
              🔁 Restart
            </button>
          )}
          {running && (
            <button
              onClick={() => setRunning(false)}
              className="px-5 py-2 bg-yellow-500 text-black rounded-lg hover:bg-yellow-400"
            >
              ⏸ Pause
            </button>
          )}
          <div className="text-sm font-mono">
            Score: <b>{score}</b>
          </div>
          <div className="text-sm font-mono">
            Length: <b>{snake.length}</b>
          </div>
        </div>
      </div>

      {/* Decrypt section */}
      <div className="w-full max-w-2xl bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md shadow-xl">
        <h3 className="text-lg font-semibold text-green-300 mb-2">🏆 Top On-chain Snake Record</h3>
        {fheSnake.bestResult ? (
          <p className="text-3xl font-bold text-yellow-300 text-center mb-3">
            {fheSnake.results?.[fheSnake.bestResult?.handle] ?? "🔒 Encrypted"}
          </p>
        ) : (
          <p className="text-gray-400 italic mb-3 text-center">No record yet</p>
        )}

        <button
          onClick={handleDecrypt}
          disabled={!fheSnake.canDecrypt || fheSnake.isDecrypting}
          className={`w-full py-2 rounded-lg font-semibold ${
            fheSnake.isDecrypting
              ? "bg-gray-400 text-black cursor-not-allowed"
              : "bg-green-500 text-black hover:bg-green-400"
          }`}
        >
          {fheSnake.isDecrypting ? "Decrypting..." : "🔓 Decrypt Top Score"}
        </button>

        {safeMessage && (
          <div className="mt-3 text-sm bg-white/5 border border-white/10 rounded-xl p-3 text-green-200">
            💬 {safeMessage}
          </div>
        )}

        <div className="mt-3 text-xs text-gray-400 text-center">
          FHEVM: {String(fhevmStatus || "—")} • Chain: {String(chainId ?? "—")}
          {fhevmError && <div>⚠️ {String(fhevmError)}</div>}
        </div>
      </div>
    </div>
  );
}
