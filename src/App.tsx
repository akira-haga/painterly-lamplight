import {
  Canvas,
  extend,
  type Catalogue,
  type ThreeToJSXElements,
} from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Suspense, useCallback, useState } from "react";
import * as THREE from "three/webgpu";
import { LoadingScreen } from "./components/LoadingScreen";
import { QualityNotice } from "./components/QualityNotice";
import { Scene, type AutoLowInfo } from "./components/Scene";

declare module "@react-three/fiber" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface ThreeElements extends ThreeToJSXElements<typeof THREE> {}
}

extend(THREE as unknown as Catalogue);

function App() {
  const [autoLow, setAutoLow] = useState<AutoLowInfo | null>(null);
  const handleAutoLow = useCallback(
    (info: AutoLowInfo) => setAutoLow(info),
    [],
  );

  const [ready, setReady] = useState(false);
  const handleReady = useCallback(() => setReady(true), []);

  const [entered, setEntered] = useState(false);
  const handleEntered = useCallback(() => setEntered(true), []);

  return (
    <div className="h-dvh w-full">
      <Canvas
        flat
        frameloop="demand"
        dpr={[1, 1]}
        camera={{ position: [3, 2, 4], fov: 45 }}
        gl={async (props) => {
          const forceWebGL = new URLSearchParams(location.search).has("webgl");
          const renderer = new THREE.WebGPURenderer({
            ...(props as THREE.WebGPURendererParameters),
            forceWebGL,
            trackTimestamp: true,
          });
          await renderer.init();
          const isWebGL = (
            renderer.backend as unknown as { isWebGLBackend?: boolean }
          ).isWebGLBackend;
          console.warn(`renderer backend: ${isWebGL ? "WebGL2" : "WebGPU"}`);
          return renderer;
        }}
      >
        <color attach="background" args={["#E7E7E7"]} />
        <Suspense fallback={null}>
          <Scene onAutoLow={handleAutoLow} onReady={handleReady} />
        </Suspense>
        <OrbitControls />
      </Canvas>

      {autoLow && entered && (
        <QualityNotice
          ms={autoLow.ms}
          onRestore={() => {
            autoLow.restore();
            setAutoLow(null);
          }}
          onDismiss={() => setAutoLow(null)}
        />
      )}

      {!entered && <LoadingScreen ready={ready} onEntered={handleEntered} />}
    </div>
  );
}

export default App;
