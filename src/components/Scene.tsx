import { useFrame, useThree } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import { pass, rtt } from "three/tsl";
import * as THREE from "three/webgpu";
import { gaussianBlur } from "three/addons/tsl/display/GaussianBlurNode.js";
import { brushPass, type BrushNode } from "../effects/BrushNode";
import { grainPass, type GrainNode } from "../effects/GrainNode";
import { tensorPass } from "../effects/TensorNode";
import { kuwaharaPass, type KuwaharaNode } from "../effects/KuwaharaNode";
import { outlinePass, type OutlineNode } from "../effects/OutlineNode";
import { finalPass, type FinalNode } from "../effects/FinalNode";
import { useSceneControls } from "./scene-controls";

export function Scene() {
  const gl = useThree((s) => s.gl) as unknown as THREE.WebGPURenderer;
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);

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

  useSceneControls(sceneNodes);

  useEffect(() => {
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
    };

    const onLeave = () => pushPoint(0, 0, -1);

    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);
    return () => {
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
    };
  }, [gl, brushNode]);

  useFrame(() => {
    renderPipeline.render();
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
