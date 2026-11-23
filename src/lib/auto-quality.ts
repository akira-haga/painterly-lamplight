import * as THREE from "three/webgpu";

const WARMUP_FRAMES = 8;
const SAMPLE_FRAMES = 30;
const GIVE_UP_FRAMES = 20;
const LOW_FRAME_MS = 60;

export type QualityLevel = "normal" | "low";

export function createQualityProbe(
  renderer: THREE.WebGPURenderer,
  onResult: (level: QualityLevel, medianMs: number) => void,
) {
  const samples: number[] = [];
  let frames = 0;
  let pending = false;
  let verdict: [QualityLevel, number] | null = null;

  const finish = (level: QualityLevel, medianMs: number) => {
    verdict = [level, medianMs];
    (
      renderer.backend as unknown as { trackTimestamp: boolean }
    ).trackTimestamp = false;
    onResult(level, medianMs);
  };

  return () => {
    if (verdict) {
      onResult(...verdict);
      return;
    }
    frames++;
    if (pending) return;

    pending = true;

    renderer.resolveTimestampsAsync(THREE.TimestampQuery.RENDER).then(
      (frameMs = 0) => {
        pending = false;

        if (frames > WARMUP_FRAMES && frameMs > 0) {
          samples.push(frameMs);
        }

        if (samples.length === 0 && frames > WARMUP_FRAMES + GIVE_UP_FRAMES) {
          console.warn("auto-quality: no GPU timestamps, keeping full quality");
          finish("normal", 0);
          return;
        }

        if (samples.length >= SAMPLE_FRAMES) {
          const sorted = [...samples].sort((a, b) => a - b);
          const medianMs = sorted[Math.floor(sorted.length / 2)];
          finish(medianMs > LOW_FRAME_MS ? "low" : "normal", medianMs);
        }
      },
      () => {
        pending = false;
        finish("normal", 0);
      },
    );
  };
}
