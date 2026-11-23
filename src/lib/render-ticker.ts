type FrameRequest = {
  fps: number;
  until: number;
};

const requests = new Map<string, FrameRequest>();
let timer: number | undefined;
let invalidateFrame: (() => void) | null = null;

function fastestFps() {
  let fps = 0;
  for (const request of requests.values()) fps = Math.max(fps, request.fps);
  return fps;
}

function sync() {
  if (timer !== undefined) {
    clearInterval(timer);
    timer = undefined;
  }
  const fps = fastestFps();
  if (fps <= 0 || invalidateFrame === null) return;

  timer = window.setInterval(() => {
    invalidateFrame?.();

    const now = performance.now();
    let changed = false;
    for (const [name, request] of requests) {
      if (request.until <= now) {
        requests.delete(name);
        changed = true;
      }
    }
    if (changed && fastestFps() !== fps) sync();
  }, 1000 / fps);
}

export function requestFrames(
  name: string,
  fps: number,
  invalidate: () => void,
  seconds = Infinity,
) {
  invalidateFrame = invalidate;
  const until =
    seconds === Infinity ? Infinity : performance.now() + seconds * 1000;
  const previous = requests.get(name);
  requests.set(name, { fps, until });

  if (previous === undefined || previous.fps !== fps || timer === undefined) {
    sync();
  }
}

export function stopFrames(name: string) {
  if (requests.delete(name)) sync();
}
