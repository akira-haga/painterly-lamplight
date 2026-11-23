import { useFrame, useThree } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import { pass, rtt } from "three/tsl";
import * as THREE from "three/webgpu";
import { gaussianBlur } from "three/addons/tsl/display/GaussianBlurNode.js";
import { brushPass, type BrushNode } from "../effects/BrushNode";
import { grainPass } from "../effects/GrainNode";
import { tensorPass } from "../effects/TensorNode";
import { kuwaharaPass } from "../effects/KuwaharaNode";
import { outlinePass } from "../effects/OutlineNode";
import { finalPass } from "../effects/FinalNode";

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

  const { renderPipeline, brushNode } = useMemo(() => {
    const scenePass = pass(scene, camera);
    const color = scenePass.getTextureNode("output");
    const depth = scenePass.getTextureNode("depth");
    const brushNode = brushPass(color) as unknown as BrushNode;
    const grainedColor = rtt(grainPass(brushNode), null, null, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
    });
    const tensor = gaussianBlur(tensorPass(grainedColor), 1, 2);
    const kuwahara = kuwaharaPass(grainedColor, tensor);
    const outline = outlinePass(
      rtt(kuwahara),
      depth,
      camera as THREE.PerspectiveCamera,
    );
    const final = finalPass(outline, paperTexture);
    const pipeline = new THREE.RenderPipeline(gl, final);
    pipeline.outputColorTransform = false;
    return { renderPipeline: pipeline, brushNode };
  }, [gl, scene, camera, paperTexture]);

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
