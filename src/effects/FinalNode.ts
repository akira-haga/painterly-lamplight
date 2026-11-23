import {
  clamp,
  Fn,
  max,
  mix,
  nodeObject,
  renderOutput,
  screenSize,
  screenUV,
  step,
  texture,
  uniform,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import * as THREE from "three/webgpu";

const whiteNoise = (point: THREE.Node<"vec2">) =>
  point.dot(vec2(12.9898, 78.233)).sin().mul(43758.5453).fract();

const acesFilm = (color: THREE.Node<"vec3">) => {
  const numerator = color.mul(color.mul(2.51).add(0.03));
  const denominator = color.mul(color.mul(2.43).add(0.59)).add(0.14);
  return numerator.div(denominator).clamp(0, 1);
};

const adjustSaturation = (
  color: THREE.Node<"vec3">,
  amount: THREE.Node<"float">,
  towardWhite: THREE.Node<"float">,
) => {
  const luminance = vec3(color.dot(vec3(0.2125, 0.7154, 0.0721)));
  const brightest = vec3(max(max(color.r, color.g), color.b));
  const target = mix(luminance, brightest, towardWhite);
  return mix(target, color, amount);
};

export class FinalNode extends THREE.Node<"vec4"> {
  colorNode: THREE.Node<"vec4">;
  quantizeLevels: THREE.UniformNode<"float", number>;
  clampLow: THREE.UniformNode<"float", number>;
  clampHigh: THREE.UniformNode<"float", number>;
  perChannel: THREE.UniformNode<"float", number>;
  ditherAmount: THREE.UniformNode<"float", number>;
  saturation: THREE.UniformNode<"float", number>;
  satTowardWhite: THREE.UniformNode<"float", number>;
  paperNode: THREE.TextureNode;
  paperTile: THREE.UniformNode<"float", number>;
  paperScale: THREE.UniformNode<"float", number>;
  paperSize: THREE.UniformNode<"vec2", THREE.Vector2>;

  constructor(colorNode: THREE.Node<"vec4">, paperTexture: THREE.Texture) {
    super("vec4");
    this.colorNode = colorNode;
    this.paperNode = texture(paperTexture);
    this.paperTile = uniform(1);
    this.paperScale = uniform(0.25);
    const paperImage = paperTexture.image as HTMLImageElement;
    this.paperSize = uniform(
      new THREE.Vector2(paperImage.width, paperImage.height),
    );
    this.quantizeLevels = uniform(16);
    this.clampLow = uniform(0.2);
    this.clampHigh = uniform(0.7);
    this.perChannel = uniform(1);
    this.ditherAmount = uniform(1);
    this.saturation = uniform(0.75);
    this.satTowardWhite = uniform(1);
  }

  setup() {
    const input = nodeObject(this.colorNode);

    return Fn(() => {
      const displayColor = renderOutput(vec4(input.rgb, 1));
      const color = displayColor.rgb.toVar();

      const luma = color.dot(vec3(0.299, 0.587, 0.114));
      const quantizeBasis = mix(vec3(luma), color, this.perChannel);

      const stepsMinusOne = this.quantizeLevels.sub(1);
      const pixelCoord = screenUV.mul(screenSize);
      const dither = whiteNoise(pixelCoord).sub(0.5).mul(this.ditherAmount);
      const stepped = quantizeBasis
        .mul(stepsMinusOne)
        .add(0.5)
        .add(dither)
        .floor()
        .div(stepsMinusOne);
      const tone = clamp(
        stepped,
        vec3(this.clampLow),
        vec3(this.clampHigh),
      ).toVar();

      const darkened = mix(vec3(0.1), color, tone.mul(2));
      const lightened = mix(color, vec3(1), tone.sub(0.5).mul(2));
      color.assign(mix(darkened, lightened, step(0.5, tone)));

      color.assign(
        adjustSaturation(color, this.saturation, this.satTowardWhite),
      );
      color.assign(acesFilm(color));

      const repeat = screenSize.div(this.paperSize.mul(this.paperScale));
      const paperUv = mix(screenUV, screenUV.mul(repeat), this.paperTile);
      const paper = this.paperNode.sample(paperUv).rgb;

      return vec4(color.mul(paper), 1);
    })();
  }
}

export const finalPass = (
  colorNode: THREE.Node<"vec4">,
  paperTexture: THREE.Texture,
) => nodeObject(new FinalNode(colorNode, paperTexture));
