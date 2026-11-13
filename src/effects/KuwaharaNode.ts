import {
  float,
  Fn,
  If,
  Loop,
  nodeObject,
  screenSize,
  screenUV,
  uniform,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import * as THREE from "three/webgpu";

export class KuwaharaNode extends THREE.Node {
  colorNode: THREE.TextureNode;
  tensorNode: THREE.Node;
  radius: THREE.UniformNode<"float", number>;

  constructor(
    colorNode: THREE.TextureNode,
    tensorNode: THREE.Node,
    radius = 6,
  ) {
    super("vec4");
    this.colorNode = colorNode;
    this.tensorNode = tensorNode;
    this.radius = uniform(radius);
  }

  setup() {
    const colorNode = this.colorNode;
    const tensorNode = this.tensorNode;
    const radius = this.radius;

    return Fn(() => {
      const texel = vec2(1).div(screenSize);
      const sampleAt = (sampleOffset: THREE.Node<"vec2">) =>
        colorNode.sample(screenUV.add(sampleOffset.mul(vec2(1, -1)).mul(texel)))
          .rgb;

      const tensor = (tensorNode as THREE.Node<"vec4">).toVar();
      const jxx = tensor.x;
      const jyy = tensor.y;
      const jxy = tensor.z;

      const trace = jxx.add(jyy);
      const determinant = jxx.mul(jyy).sub(jxy.mul(jxy));
      const discriminant = trace
        .mul(trace)
        .mul(0.25)
        .sub(determinant)
        .max(0)
        .sqrt();
      const lambda1 = trace.mul(0.5).add(discriminant);
      const lambda2 = trace.mul(0.5).sub(discriminant);

      const gradientDir = vec2(0).toVar();
      If(jxy.abs().greaterThan(1e-7), () => {
        gradientDir.assign(vec2(jxy.negate(), jxx.sub(lambda1)).normalize());
      }).Else(() => {
        gradientDir.assign(
          jxx.greaterThanEqual(jyy).select(vec2(1, 0), vec2(0, 1)),
        );
      });

      const anisotropy = lambda1
        .sub(lambda2)
        .div(lambda1.add(lambda2).add(1e-7));
      const alpha = float(1);
      const scaleX = alpha.div(anisotropy.add(alpha)).toVar();
      const scaleY = anisotropy.add(alpha).div(alpha).toVar();

      const weightOffset = float(0.1);
      const weightFalloff = float(0.5);
      const radialSigma = float(0.4);
      const radiusSteps = radius.max(1).toInt();

      const minVariance = float(10000).toVar();
      const finalColor = vec3(0).toVar();
      const weightedSum = vec3(0).toVar();
      const weightedSqSum = vec3(0).toVar();
      const totalWeight = float(0).toVar();

      Loop(8, ({ i }) => {
        const sectorAngle = float(i)
          .mul((Math.PI * 2) / 8)
          .toVar();

        weightedSum.assign(vec3(0));
        weightedSqSum.assign(vec3(0));
        totalWeight.assign(0);

        Loop({ start: 1, end: radiusSteps, condition: "<=" }, ({ i }) => {
          const r = float(i).toVar();
          Loop(3, ({ i }) => {
            const offsetAngle = float(i)
              .mul(Math.PI / 8)
              .sub(Math.PI / 8);
            const sampleAngle = sectorAngle.add(offsetAngle);
            const circleOffset = vec2(sampleAngle.cos(), sampleAngle.sin()).mul(
              r,
            );
            const ellipseOffset = vec2(
              circleOffset.x.mul(scaleX),
              circleOffset.y.mul(scaleY),
            );
            const sampleOffset = vec2(
              ellipseOffset.x
                .mul(gradientDir.x)
                .sub(ellipseOffset.y.mul(gradientDir.y)),
              ellipseOffset.x
                .mul(gradientDir.y)
                .add(ellipseOffset.y.mul(gradientDir.x)),
            );

            const sampleColor = sampleAt(sampleOffset);
            const sectorPos = vec2(offsetAngle.cos(), offsetAngle.sin()).mul(
              r.div(radius),
            );
            const weightBase = sectorPos.x
              .add(weightOffset)
              .sub(weightFalloff.mul(sectorPos.y.mul(sectorPos.y)));
            const radialFalloff = sectorPos
              .dot(sectorPos)
              .negate()
              .div(radialSigma.mul(radialSigma).mul(2))
              .exp();
            const weight = weightBase.max(0).pow(2).mul(radialFalloff);

            weightedSum.addAssign(sampleColor.mul(weight));
            weightedSqSum.addAssign(sampleColor.mul(sampleColor).mul(weight));
            totalWeight.addAssign(weight);
          });
        });

        const avgColor = weightedSum.div(totalWeight);
        const variance = weightedSqSum
          .div(totalWeight)
          .sub(avgColor.mul(avgColor))
          .dot(vec3(0.299, 0.587, 0.114))
          .toVar();

        If(variance.lessThan(minVariance), () => {
          minVariance.assign(variance);
          finalColor.assign(avgColor);
        });
      });

      return vec4(finalColor, 1);
    })();
  }
}

export const kuwaharaPass = (
  colorNode: THREE.TextureNode,
  tensorNode: THREE.Node,
  radius = 6,
) => nodeObject(new KuwaharaNode(colorNode, tensorNode, radius));
