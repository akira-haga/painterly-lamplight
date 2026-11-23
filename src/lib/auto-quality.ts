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
  let coveredFrames = 0;
  let pending = false;
  let done = false;

  const finish = () => {
    done = true;
    (
      renderer.backend as unknown as { trackTimestamp: boolean }
    ).trackTimestamp = false;
  };

  return () => {
    if (done) return;
    frames++;
    coveredFrames++;
    if (pending) return;

    pending = true;
    const includedFrames = coveredFrames;
    coveredFrames = 0;

    renderer
      .resolveTimestampsAsync(THREE.TimestampQuery.RENDER)
      .then(() => {
        pending = false;

        const totalMs = renderer.info.render.timestamp;
        if (frames > WARMUP_FRAMES && totalMs > 0 && includedFrames > 0) {
          samples.push(totalMs / includedFrames);
        }

        if (samples.length === 0 && frames > WARMUP_FRAMES + GIVE_UP_FRAMES) {
          finish();
          console.warn("auto-quality: no GPU timestamps, keeping full quality");
          return;
        }

        if (samples.length >= SAMPLE_FRAMES) {
          finish();
          const sorted = [...samples].sort((a, b) => a - b);
          const medianMs = sorted[Math.floor(sorted.length / 2)];
          onResult(medianMs > LOW_FRAME_MS ? "low" : "normal", medianMs);
        }
      })
      .catch(() => {
        pending = false;
        finish();
      });
  };
}
