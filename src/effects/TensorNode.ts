import * as THREE from "three/webgpu";
import { Fn, nodeObject, screenSize, screenUV, vec2, vec4 } from "three/tsl";

export class TensorNode extends THREE.Node {
  inputNode: THREE.TextureNode;

  constructor(inputNode: THREE.TextureNode) {
    super("vec4");
    this.inputNode = inputNode;
  }

  setup() {
    const inputNode = this.inputNode;

    return Fn(() => {
      const texel = vec2(1).div(screenSize);
      const s = (dx: number, dy: number) =>
        inputNode.sample(screenUV.add(vec2(dx, -dy).mul(texel))).rgb;

      const tx0y0 = s(-1, -1);
      const tx0y1 = s(-1, 0);
      const tx0y2 = s(-1, 1);
      const tx1y0 = s(0, -1);
      const tx1y2 = s(0, 1);
      const tx2y0 = s(1, -1);
      const tx2y1 = s(1, 0);
      const tx2y2 = s(1, 1);

      const sx = tx0y0
        .negate()
        .sub(tx0y1.mul(2))
        .sub(tx0y2)
        .add(tx2y0)
        .add(tx2y1.mul(2))
        .add(tx2y2);

      const sy = tx0y0
        .negate()
        .sub(tx1y0.mul(2))
        .sub(tx2y0)
        .add(tx0y2)
        .add(tx1y2.mul(2))
        .add(tx2y2);

      return vec4(sx.dot(sx), sy.dot(sy), sx.dot(sy), 1);
    })();
  }
}

export const tensorPass = (node: THREE.TextureNode) =>
  nodeObject(new TensorNode(node));
