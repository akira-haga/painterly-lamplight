import { vec2 } from "three/tsl";
import * as THREE from "three/webgpu";

export const whiteNoise = (point: THREE.Node<"vec2">) =>
  point.dot(vec2(12.9898, 78.233)).sin().mul(43758.5453).fract();
