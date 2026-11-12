import { useFrame, useThree } from "@react-three/fiber";
import { useMemo } from "react";
import { pass } from "three/tsl";
import * as THREE from "three/webgpu";
import { tensorPass } from "../effects/TensorNode";

export function Scene() {
  const gl = useThree((s) => s.gl) as unknown as THREE.WebGPURenderer;
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);

  const renderPipeline = useMemo(() => {
    const scenePass = pass(scene, camera);
    const color = scenePass.getTextureNode("output");
    const tensor = tensorPass(color);
    return new THREE.RenderPipeline(gl, tensor);
  }, [gl, scene, camera]);

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
