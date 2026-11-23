import {
  float,
  Fn,
  mix,
  mx_fractal_noise_float,
  mx_fractal_noise_vec3,
  nodeObject,
  perspectiveDepthToViewZ,
  screenSize,
  screenUV,
  texture,
  uniform,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import * as THREE from "three/webgpu";

const sobelGradient = (
  sampleAt: (dx: number, dy: number) => THREE.Node<"float">,
) => {
  const tx0y0 = sampleAt(-1, -1);
  const tx0y1 = sampleAt(-1, 0);
  const tx0y2 = sampleAt(-1, 1);
  const tx1y0 = sampleAt(0, -1);
  const tx1y2 = sampleAt(0, 1);
  const tx2y0 = sampleAt(1, -1);
  const tx2y1 = sampleAt(1, 0);
  const tx2y2 = sampleAt(1, 1);

  const gradientX = tx0y0
    .negate()
    .sub(tx0y1.mul(2))
    .sub(tx0y2)
    .add(tx2y0)
    .add(tx2y1.mul(2))
    .add(tx2y2);

  const gradientY = tx0y0
    .negate()
    .sub(tx1y0.mul(2))
    .sub(tx2y0)
    .add(tx0y2)
    .add(tx1y2.mul(2))
    .add(tx2y2);

  return vec2(gradientX, gradientY);
};

export class OutlineNode extends THREE.Node<"vec4"> {
  colorNode: THREE.TextureNode;
  depthNode: THREE.TextureNode;
  cameraNear: THREE.UniformNode<"float", number>;
  cameraFar: THREE.UniformNode<"float", number>;
  thickness: THREE.UniformNode<"float", number>;
  wobbleAmount: THREE.UniformNode<"float", number>;
  wobbleScale: THREE.UniformNode<"float", number>;
  depthWeight: THREE.UniformNode<"float", number>;
  lumaWeight: THREE.UniformNode<"float", number>;
  threshold: THREE.UniformNode<"float", number>;
  softness: THREE.UniformNode<"float", number>;
  strength: THREE.UniformNode<"float", number>;
  inkColor: THREE.UniformNode<"color", THREE.Color>;
  breakAmount: THREE.UniformNode<"float", number>;
  breakScale: THREE.UniformNode<"float", number>;
  breakAniso: THREE.UniformNode<"float", number>;
  breakBias: THREE.UniformNode<"float", number>;
  paperNode: THREE.TextureNode;
  paperAmount: THREE.UniformNode<"float", number>;
  paperThreshold: THREE.UniformNode<"float", number>;
  paperTile: THREE.UniformNode<"float", number>;
  paperScale: THREE.UniformNode<"float", number>;
  paperSize: THREE.UniformNode<"vec2", THREE.Vector2>;

  constructor(
    colorNode: THREE.TextureNode,
    depthNode: THREE.TextureNode,
    camera: THREE.PerspectiveCamera,
    paperTexture: THREE.Texture,
  ) {
    super("vec4");
    this.colorNode = colorNode;
    this.depthNode = depthNode;
    this.cameraNear = uniform(camera.near);
    this.cameraFar = uniform(camera.far);
    this.thickness = uniform(1.2);
    this.wobbleAmount = uniform(1.8);
    this.wobbleScale = uniform(6);
    this.depthWeight = uniform(1);
    this.lumaWeight = uniform(1.2);
    this.threshold = uniform(0.08);
    this.softness = uniform(0.1);
    this.strength = uniform(0.85);
    this.inkColor = uniform(new THREE.Color(0x1a1512));
    this.breakAmount = uniform(0.45);
    this.breakScale = uniform(38);
    this.breakAniso = uniform(0.12);
    this.breakBias = uniform(0.5);
    this.paperNode = texture(paperTexture);
    this.paperAmount = uniform(0);
    this.paperThreshold = uniform(0.5);
    this.paperTile = uniform(1);
    this.paperScale = uniform(0.25);
    const paperImage = paperTexture.image as HTMLImageElement;
    this.paperSize = uniform(
      new THREE.Vector2(paperImage.width, paperImage.height),
    );
  }

  setup() {
    return Fn(() => {
      const texel = vec2(1).div(screenSize);

      const noiseUv = screenUV.mul(this.wobbleScale);
      const wobbleNoise = mx_fractal_noise_vec3(vec3(noiseUv, 0), 3, 2, 0.5, 1);
      const wobbleOffset = wobbleNoise.xy.mul(this.wobbleAmount).mul(texel);
      const wobbledUv = screenUV.add(wobbleOffset).toVar();
      const tapUv = (dx: number, dy: number) =>
        wobbledUv.add(vec2(dx, -dy).mul(this.thickness).mul(texel));

      const distanceAt = (dx: number, dy: number) =>
        perspectiveDepthToViewZ(
          this.depthNode.sample(tapUv(dx, dy)).r,
          this.cameraNear,
          this.cameraFar,
        ).negate();
      const centerDistance = distanceAt(0, 0).toVar();
      const depthGradient = sobelGradient(distanceAt).div(
        centerDistance.max(1e-4),
      );
      const lumaAt = (dx: number, dy: number) =>
        this.colorNode.sample(tapUv(dx, dy)).rgb.dot(vec3(0.299, 0.587, 0.114));
      const lumaGradient = sobelGradient(lumaAt);
      const edgeStrength = depthGradient
        .length()
        .mul(this.depthWeight)
        .add(lumaGradient.length().mul(this.lumaWeight));
      const lineMask = edgeStrength
        .smoothstep(this.threshold, this.threshold.add(this.softness))
        .mul(this.strength)
        .clamp(0, 1)
        .toVar();

      const combinedGradient = depthGradient
        .mul(this.depthWeight)
        .add(lumaGradient.mul(this.lumaWeight));
      const normalDir = combinedGradient.div(
        combinedGradient.length().max(1e-6),
      );
      const tangentDir = vec2(normalDir.y.negate(), normalDir.x);

      const aspect = screenSize.x.div(screenSize.y);
      const aspectUv = vec2(screenUV.x.mul(aspect), screenUV.y.negate());
      const alongLine = aspectUv.dot(tangentDir).mul(this.breakScale);
      const acrossLine = aspectUv
        .dot(normalDir)
        .mul(this.breakScale)
        .mul(this.breakAniso);
      const breakNoise = mx_fractal_noise_float(
        vec3(alongLine, acrossLine, 0),
        3,
        2,
        0.5,
        1,
      );

      const breakThreshold = mix(float(-1), float(0.9), this.breakAmount);
      const keepMask = breakNoise
        .smoothstep(breakThreshold.sub(0.12), breakThreshold.add(0.12))
        .toVar();

      const paperRepeat = screenSize.div(this.paperSize.mul(this.paperScale));
      const paperUv = mix(screenUV, screenUV.mul(paperRepeat), this.paperTile);
      const paperLuma = this.paperNode
        .sample(paperUv)
        .rgb.dot(vec3(0.299, 0.587, 0.114));
      const paperMask = paperLuma.smoothstep(
        this.paperThreshold.sub(0.15),
        this.paperThreshold.add(0.15),
      );
      keepMask.mulAssign(mix(float(1), paperMask, this.paperAmount));

      const resistance = lineMask.mul(this.breakBias).clamp(0, 1);
      lineMask.mulAssign(mix(keepMask, float(1), resistance));

      const baseColor = this.colorNode.sample(screenUV).rgb;
      const inkedColor = mix(baseColor, this.inkColor, lineMask);

      return vec4(inkedColor, 1);
    })();
  }
}

export const outlinePass = (
  colorNode: THREE.TextureNode,
  depthNode: THREE.TextureNode,
  camera: THREE.PerspectiveCamera,
  paperTexture: THREE.Texture,
) => nodeObject(new OutlineNode(colorNode, depthNode, camera, paperTexture));
