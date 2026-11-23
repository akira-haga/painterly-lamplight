import { useState } from "react";
import { useProgress } from "@react-three/drei";

const PAPER_TILE = "672px 480px";
const PAPER_ORIGIN = "left top";
const PAPER_TINT = "#CACACA";

export function LoadingScreen({
  ready,
  onEntered,
}: {
  ready: boolean;
  onEntered: () => void;
}) {
  const { progress } = useProgress();
  const [leaving, setLeaving] = useState(false);

  return (
    <div
      onTransitionEnd={(event) => {
        if (leaving && event.target === event.currentTarget) onEntered();
      }}
      className={`absolute inset-0 z-50 flex items-center justify-center transition-opacity duration-1200 ease-out ${
        leaving ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
      style={{
        backgroundImage: "url(/textures/paper.jpg)",
        backgroundSize: PAPER_TILE,
        backgroundPosition: PAPER_ORIGIN,
        backgroundRepeat: "repeat",
        backgroundColor: PAPER_TINT,
        backgroundBlendMode: "multiply",
      }}
    >
      <div
        className={`flex flex-col items-center gap-6 transition-opacity duration-200 ease-out ${
          leaving ? "opacity-0" : "opacity-100"
        }`}
      >
        <div className="flex h-12 items-center">
          {ready ? (
            <button
              type="button"
              onClick={() => setLeaving(true)}
              className="rounded-md border border-[#4A2E20] px-10 py-3 text-xs tracking-[0.3em] text-[#4A2E20] transition-colors duration-200 hover:bg-[#4A2E20] hover:text-[#B9B9B9]"
            >
              ENTER
            </button>
          ) : (
            <p className="animate-pulse text-xs tracking-[0.3em] text-[#4A2E20]/70">
              LOADING {Math.round(progress)}%
            </p>
          )}
        </div>

        <div className="h-px w-40 bg-[#4A2E20]/20">
          <div
            className="h-full bg-[#4A2E20] transition-[width] duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
