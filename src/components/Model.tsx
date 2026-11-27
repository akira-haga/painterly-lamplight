import { useGLTF, useTexture } from "@react-three/drei";
import * as THREE from "three/webgpu";

export function Model() {
  const { nodes } = useGLTF("/models/Cube.glb");
  const cube = nodes.Cube as THREE.Mesh;

  const bakedTexture = useTexture("/textures/Cube_Bake.png", (loaded) => {
    loaded.flipY = false;
    loaded.colorSpace = THREE.SRGBColorSpace;
  });

  return (
    <mesh
      geometry={cube.geometry}
      position={cube.position}
      quaternion={cube.quaternion}
      scale={cube.scale}
    >
      <meshBasicMaterial map={bakedTexture} />
    </mesh>
  );
}
