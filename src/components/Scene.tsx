import { useFrame, useThree } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { useMemo } from "react";
import { pass, rtt } from "three/tsl";
import * as THREE from "three/webgpu";
import { gaussianBlur } from "three/addons/tsl/display/GaussianBlurNode.js";
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

  const renderPipeline = useMemo(() => {
    const scenePass = pass(scene, camera);
    const color = scenePass.getTextureNode("output");
    const depth = scenePass.getTextureNode("depth");
    const tensor = gaussianBlur(tensorPass(color), 1, 2);
    const kuwahara = kuwaharaPass(color, tensor);
    const outline = outlinePass(
      rtt(kuwahara),
      depth,
      camera as THREE.PerspectiveCamera,
    );
    const final = finalPass(outline, paperTexture);
    const pipeline = new THREE.RenderPipeline(gl, final);
    pipeline.outputColorTransform = false;
    return pipeline;
  }, [gl, scene, camera, paperTexture]);

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
