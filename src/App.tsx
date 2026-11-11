import {
  Canvas,
  extend,
  type Catalogue,
  type ThreeToJSXElements,
} from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three/webgpu";
import { Scene } from "./components/Scene";

declare module "@react-three/fiber" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface ThreeElements extends ThreeToJSXElements<typeof THREE> {}
}

extend(THREE as unknown as Catalogue);

function App() {
  return (
    <div className="h-screen w-full">
      <Canvas
        flat
        camera={{ position: [3, 2, 4], fov: 45 }}
        gl={async (props) => {
          const renderer = new THREE.WebGPURenderer(
            props as THREE.WebGPURendererParameters,
          );
          await renderer.init();
          return renderer;
        }}
      >
        <color attach="background" args={["#E7E7E7"]} />
        <Scene />
        <OrbitControls />
      </Canvas>
    </div>
  );
}

export default App;
