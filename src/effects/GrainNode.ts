import {
  Fn,
  nodeObject,
  screenSize,
  screenUV,
  uniform,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import * as THREE from "three/webgpu";
import { whiteNoise } from "./noise";

export class GrainNode extends THREE.Node<"vec4"> {
  colorNode: THREE.Node<"vec4">;
  amount: THREE.UniformNode<"float", number>;

  constructor(colorNode: THREE.Node<"vec4">, amount = 0.03) {
    super("vec4");
    this.colorNode = colorNode;
    this.amount = uniform(amount);
  }

  setup() {
    return Fn(() => {
      const pixelCoord = screenUV.mul(screenSize).floor();
      const noise = vec3(
        whiteNoise(pixelCoord),
        whiteNoise(pixelCoord.add(vec2(37, 17))),
        whiteNoise(pixelCoord.add(vec2(11, 47))),
      )
        .sub(0.5)
        .mul(this.amount.mul(0.5));

      const displayColor = this.colorNode.rgb.max(0).sqrt();
      const perturbed = displayColor.add(noise).max(0);
      return vec4(perturbed.mul(perturbed), 1);
    })();
  }
}

export const grainPass = (colorNode: THREE.Node<"vec4">, amount = 0.03) =>
  nodeObject(new GrainNode(colorNode, amount));
