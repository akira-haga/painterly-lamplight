import { useFrame, useThree } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import { pass, rtt } from "three/tsl";
import * as THREE from "three/webgpu";
import { gaussianBlur } from "three/addons/tsl/display/GaussianBlurNode.js";
import { brushPass, type BrushNode } from "../effects/BrushNode";
import { grainPass, type GrainNode } from "../effects/GrainNode";
import { tensorPass } from "../effects/TensorNode";
import { kuwaharaPass, type KuwaharaNode } from "../effects/KuwaharaNode";
import { outlinePass, type OutlineNode } from "../effects/OutlineNode";
import { finalPass, type FinalNode } from "../effects/FinalNode";
import { createQualityProbe } from "../lib/auto-quality";
import { requestFrames, stopFrames } from "../lib/render-ticker";
import { useSceneControls } from "./scene-controls";

const BRUSH_FPS = 20;
const PROBE_FPS = 12;

export type AutoLowInfo = { ms: number; restore: () => void };

export function Scene({
  onAutoLow,
  onReady,
}: {
  onAutoLow?: (info: AutoLowInfo) => void;
  onReady?: () => void;
}) {
  const gl = useThree((s) => s.gl) as unknown as THREE.WebGPURenderer;
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);

  // https://unsplash.com/photos/vS3idIiYxX0
  const paperTexture = useTexture("/textures/paper.jpg", (loaded) => {
    loaded.colorSpace = THREE.NoColorSpace;
    loaded.wrapS = THREE.RepeatWrapping;
    loaded.wrapT = THREE.RepeatWrapping;
  });

  const sceneNodes = useMemo(() => {
    const scenePass = pass(scene, camera);
    const color = scenePass.getTextureNode("output");
    const depth = scenePass.getTextureNode("depth");
    const brushNode = brushPass(color) as unknown as BrushNode;
    const grainNode = grainPass(brushNode) as unknown as GrainNode;
    const grainedColor = rtt(grainNode, null, null, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
    });
    const tensorNode = gaussianBlur(tensorPass(grainedColor), 1, 2);
    const kuwaharaNode = kuwaharaPass(
      grainedColor,
      tensorNode,
    ) as unknown as KuwaharaNode;
    const outlineNode = outlinePass(
      rtt(kuwaharaNode),
      depth,
      camera as THREE.PerspectiveCamera,
      paperTexture,
    ) as unknown as OutlineNode;
    const finalNode = finalPass(
      outlineNode,
      paperTexture,
    ) as unknown as FinalNode;
    const renderPipeline = new THREE.RenderPipeline(gl, finalNode);
    renderPipeline.outputColorTransform = false;
    return {
      renderPipeline,
      brushNode,
      grainNode,
      tensorNode,
      kuwaharaNode,
      outlineNode,
      finalNode,
    };
  }, [gl, scene, camera, paperTexture]);
  const { renderPipeline, brushNode } = sceneNodes;

  const { brushEnabled, quality, setControls } = useSceneControls(
    sceneNodes,
    invalidate,
  );
  const lowQuality = quality === "low";
  const isMeasuring = quality === "auto";
  const hasDrawn = useRef(false);

  useEffect(() => {
    if (!new URLSearchParams(location.search).has("low")) return;
    setControls({ quality: "low" });
    onAutoLow?.({ ms: 0, restore: () => setControls({ quality: "normal" }) });
  }, [setControls, onAutoLow]);

  const probe = useMemo(
    () =>
      createQualityProbe(gl, (level, ms) => {
        if (ms > 0) {
          console.warn(`auto-quality: GPU ${ms.toFixed(1)}ms/frame → ${level}`);
        }
        setControls({ quality: level });
        if (level === "low") {
          onAutoLow?.({
            ms,
            restore: () => setControls({ quality: "normal" }),
          });
        }
      }),
    [gl, setControls, onAutoLow],
  );

  useEffect(() => {
    if (!isMeasuring) return;
    requestFrames("probe", PROBE_FPS, invalidate);
    return () => stopFrames("probe");
  }, [isMeasuring, invalidate]);

  useEffect(() => {
    if (!brushEnabled || lowQuality) return;
    const canvas = gl.domElement;
    const trail = brushNode.trail;
    const minStep = 0.012;

    const pushPoint = (x: number, y: number, time: number) => {
      const recycled = trail.pop()!;
      recycled.set(x, y, time);
      trail.unshift(recycled);
    };

    const onMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.height;
      const y = (event.clientY - rect.top) / rect.height;
      const head = trail[0];
      if (head.z > 0 && Math.hypot(x - head.x, y - head.y) < minStep) return;
      pushPoint(x, y, performance.now() / 1000);
      requestFrames("brush", BRUSH_FPS, invalidate, brushNode.lifetime.value);
    };

    const onLeave = () => pushPoint(0, 0, -1);

    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);
    return () => {
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      stopFrames("brush");
    };
  }, [gl, brushNode, brushEnabled, lowQuality, invalidate]);

  useFrame(() => {
    renderPipeline.render();
    if (!hasDrawn.current) {
      hasDrawn.current = true;
      onReady?.();
    }
    if (isMeasuring) probe();
  }, 1);

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[3, 5, 2]} intensity={2} />
      <mesh>
        <boxGeometry />
        <meshStandardMaterial color="#c8a27a" />
      </mesh>
    </>
  );
}
