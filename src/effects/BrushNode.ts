import {
  float,
  Fn,
  Loop,
  mix,
  mx_fractal_noise_float,
  nodeObject,
  screenSize,
  screenUV,
  uniform,
  uniformArray,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import * as THREE from "three/webgpu";

export const TRAIL_LENGTH = 48;

export class BrushNode extends THREE.Node<"vec4"> {
  colorNode: THREE.Node<"vec4">;
  trail: THREE.Vector3[];
  points: THREE.UniformArrayNode<"vec3">;
  now: THREE.UniformNode<"float", number>;
  lifetime: THREE.UniformNode<"float", number>;
  size: THREE.UniformNode<"float", number>;
  softness: THREE.UniformNode<"float", number>;
  strength: THREE.UniformNode<"float", number>;
  breakAmount: THREE.UniformNode<"float", number>;
  breakScale: THREE.UniformNode<"float", number>;
  color: THREE.UniformNode<"color", THREE.Color>;

  constructor(colorNode: THREE.Node<"vec4">) {
    super("vec4");
    this.colorNode = colorNode;
    this.trail = Array.from(
      { length: TRAIL_LENGTH },
      () => new THREE.Vector3(0, 0, -1),
    );
    this.points = uniformArray(this.trail, "vec3");
    this.now = uniform(0).onFrameUpdate(() => performance.now() / 1000);
    this.lifetime = uniform(0.6);
    this.size = uniform(0.035);
    this.softness = uniform(0.6);
    this.strength = uniform(0.9);
    this.breakAmount = uniform(0.35);
    this.breakScale = uniform(60);
    this.color = uniform(new THREE.Color("#D9633F"));
  }

  setup() {
    return Fn(() => {
      const aspect = screenSize.x.div(screenSize.y);
      const aspectUv = vec2(screenUV.x.mul(aspect), screenUV.y);
      const coverageMax = float(0).toVar();

      Loop(TRAIL_LENGTH - 1, ({ i }) => {
        const newerPoint = this.points.element(i) as THREE.Node<"vec3">;
        const olderPoint = this.points.element(i.add(1)) as THREE.Node<"vec3">;

        const isValid = newerPoint.z
          .greaterThan(0)
          .and(olderPoint.z.greaterThan(0))
          .select(float(1), float(0));

        const fade = this.now
          .sub(newerPoint.z)
          .div(this.lifetime.max(0.0001))
          .oneMinus()
          .clamp(0, 1);

        const segment = olderPoint.xy.sub(newerPoint.xy);
        const alongSegment = aspectUv
          .sub(newerPoint.xy)
          .dot(segment)
          .div(segment.dot(segment).max(1e-6))
          .clamp(0, 1);
        const distanceToSegment = aspectUv
          .sub(newerPoint.xy.add(segment.mul(alongSegment)))
          .length();

        const width = this.size.mul(fade.mul(0.65).add(0.35));
        const innerWidth = width
          .mul(this.softness.oneMinus())
          .min(width.sub(1e-5));
        const coverage = distanceToSegment
          .smoothstep(innerWidth, width)
          .oneMinus();

        coverageMax.assign(coverageMax.max(coverage.mul(fade).mul(isValid)));
      });

      const breakNoise = mx_fractal_noise_float(
        vec3(aspectUv.mul(this.breakScale), 0),
        3,
        2,
        0.5,
        1,
      )
        .mul(0.5)
        .add(0.5);
      const breakMask = mix(
        float(1),
        breakNoise.smoothstep(0.35, 0.75),
        this.breakAmount,
      );
      const paintAlpha = coverageMax
        .mul(breakMask)
        .mul(this.strength)
        .clamp(0, 1);

      return vec4(mix(this.colorNode.rgb, this.color.rgb, paintAlpha), 1);
    })();
  }
}

export const brushPass = (colorNode: THREE.Node<"vec4">) =>
  nodeObject(new BrushNode(colorNode));
