import { folder, useControls } from "leva";
import type * as THREE from "three/webgpu";
import type { BrushNode } from "../effects/BrushNode";
import type { FinalNode } from "../effects/FinalNode";
import type { GrainNode } from "../effects/GrainNode";
import type { KuwaharaNode } from "../effects/KuwaharaNode";
import type { OutlineNode } from "../effects/OutlineNode";

type SceneNodes = {
  renderPipeline: THREE.RenderPipeline;
  brushNode: BrushNode;
  grainNode: GrainNode;
  tensorNode: THREE.Node;
  kuwaharaNode: KuwaharaNode;
  outlineNode: OutlineNode;
  finalNode: FinalNode;
};

type PassToggles = {
  tensor: boolean;
  kuwahara: boolean;
  outline: boolean;
  final: boolean;
};

const setUniform = <T>(uniformNode: THREE.UniformNode<string, T>, value: T) => {
  uniformNode.value = value;
};

const setOutput = (
  renderPipeline: THREE.RenderPipeline,
  outputNode: THREE.Node,
  outputColorTransform: boolean,
) => {
  renderPipeline.outputNode = outputNode;
  renderPipeline.outputColorTransform = outputColorTransform;
  renderPipeline.needsUpdate = true;
};

export function useSceneControls(nodes: SceneNodes, invalidate: () => void) {
  const {
    renderPipeline,
    brushNode,
    grainNode,
    tensorNode,
    kuwaharaNode,
    outlineNode,
    finalNode,
  } = nodes;

  const update = <T>(uniformNode: THREE.UniformNode<string, T>, value: T) => {
    setUniform(uniformNode, value);
    invalidate();
  };

  const updateColor = (
    colorNode: THREE.UniformNode<"color", THREE.Color>,
    value: string,
  ) => {
    colorNode.value.set(value);
    invalidate();
  };

  const applyPasses = (passes: PassToggles) => {
    let outputNode: THREE.Node = grainNode;
    if (passes.tensor) outputNode = tensorNode;
    if (passes.kuwahara) outputNode = kuwaharaNode;
    if (passes.outline) outputNode = outlineNode;
    if (passes.final) outputNode = finalNode;
    setOutput(renderPipeline, outputNode, !passes.final);
    invalidate();
  };

  const applyBrushStrength = (enabled: boolean, strength: number) =>
    update(brushNode.strength, enabled ? strength : 0);

  const applyOutlineStrength = (enabled: boolean, strength: number) =>
    update(outlineNode.strength, enabled ? strength : 0);

  const [{ brushEnabled }] = useControls(
    () => ({
      passes: folder({
        tensorEnabled: {
          value: true,
          label: "tensor",
          onChange: (value: boolean, _path, context) =>
            applyPasses({
              tensor: value,
              kuwahara: context.get("passes.kuwaharaEnabled"),
              outline: context.get("passes.outlineEnabled"),
              final: context.get("passes.finalEnabled"),
            }),
        },
        kuwaharaEnabled: {
          value: true,
          label: "kuwahara",
          onChange: (value: boolean, _path, context) =>
            applyPasses({
              tensor: context.get("passes.tensorEnabled"),
              kuwahara: value,
              outline: context.get("passes.outlineEnabled"),
              final: context.get("passes.finalEnabled"),
            }),
        },
        outlineEnabled: {
          value: true,
          label: "outline",
          onChange: (value: boolean, _path, context) => {
            applyOutlineStrength(value, context.get("outline.strength"));
            applyPasses({
              tensor: context.get("passes.tensorEnabled"),
              kuwahara: context.get("passes.kuwaharaEnabled"),
              outline: value,
              final: context.get("passes.finalEnabled"),
            });
          },
        },
        finalEnabled: {
          value: true,
          label: "final",
          onChange: (value: boolean, _path, context) =>
            applyPasses({
              tensor: context.get("passes.tensorEnabled"),
              kuwahara: context.get("passes.kuwaharaEnabled"),
              outline: context.get("passes.outlineEnabled"),
              final: value,
            }),
        },
      }),
      radius: {
        value: 6,
        min: 1,
        max: 20,
        step: 1,
        onChange: (value: number) => update(kuwaharaNode.radius, value),
      },
      grainAmount: {
        value: 0.03,
        min: 0,
        max: 0.3,
        step: 0.005,
        label: "grain",
        onChange: (value: number) => update(grainNode.amount, value),
      },
      outline: folder({
        thickness: {
          value: 1.2,
          min: 0.5,
          max: 6,
          step: 0.1,
          onChange: (value: number) => update(outlineNode.thickness, value),
        },
        strength: {
          value: 0.85,
          min: 0,
          max: 1,
          step: 0.01,
          onChange: (value: number, _path, context) =>
            applyOutlineStrength(context.get("passes.outlineEnabled"), value),
        },
        depthWeight: {
          value: 1,
          min: 0,
          max: 4,
          step: 0.05,
          label: "depth",
          onChange: (value: number) => update(outlineNode.depthWeight, value),
        },
        lumaWeight: {
          value: 1.2,
          min: 0,
          max: 2,
          step: 0.05,
          label: "luma",
          onChange: (value: number) => update(outlineNode.lumaWeight, value),
        },
        threshold: {
          value: 0.08,
          min: 0,
          max: 0.5,
          step: 0.005,
          onChange: (value: number) => update(outlineNode.threshold, value),
        },
        softness: {
          value: 0.1,
          min: 0.001,
          max: 0.5,
          step: 0.005,
          onChange: (value: number) => update(outlineNode.softness, value),
        },
        wobbleAmount: {
          value: 1.8,
          min: 0,
          max: 8,
          step: 0.1,
          label: "wobble",
          onChange: (value: number) => update(outlineNode.wobbleAmount, value),
        },
        wobbleScale: {
          value: 6,
          min: 0.5,
          max: 40,
          step: 0.5,
          label: "wobble freq",
          onChange: (value: number) => update(outlineNode.wobbleScale, value),
        },
        inkColor: {
          value: "#1a1512",
          label: "ink",
          onChange: (value: string) => updateColor(outlineNode.inkColor, value),
        },
      }),
      "line break-up": folder({
        breakAmount: {
          value: 0.45,
          min: 0,
          max: 1,
          step: 0.01,
          label: "amount",
          onChange: (value: number) => update(outlineNode.breakAmount, value),
        },
        breakScale: {
          value: 38,
          min: 4,
          max: 200,
          step: 1,
          label: "density",
          onChange: (value: number) => update(outlineNode.breakScale, value),
        },
        breakAniso: {
          value: 0.12,
          min: 0.01,
          max: 1,
          step: 0.01,
          label: "aniso",
          onChange: (value: number) => update(outlineNode.breakAniso, value),
        },
        breakBias: {
          value: 0.5,
          min: 0,
          max: 1,
          step: 0.01,
          label: "bias",
          onChange: (value: number) => update(outlineNode.breakBias, value),
        },
      }),
      paper: folder({
        paperTile: {
          value: true,
          label: "tile",
          onChange: (value: boolean) =>
            update(finalNode.paperTile, value ? 1 : 0),
        },
        paperScale: {
          value: 0.25,
          min: 0,
          max: 8,
          step: 0.25,
          label: "tile scale",
          onChange: (value: number) => update(finalNode.paperScale, value),
        },
      }),
      final: folder({
        quantizeLevels: {
          value: 16,
          min: 4,
          max: 64,
          step: 1,
          label: "quantize",
          onChange: (value: number) => update(finalNode.quantizeLevels, value),
        },
        clampLow: {
          value: 0.2,
          min: 0,
          max: 0.5,
          step: 0.01,
          label: "clamp low",
          onChange: (value: number) => update(finalNode.clampLow, value),
        },
        clampHigh: {
          value: 0.7,
          min: 0.5,
          max: 1,
          step: 0.01,
          label: "clamp high",
          onChange: (value: number) => update(finalNode.clampHigh, value),
        },
        saturation: {
          value: 0.75,
          min: 0,
          max: 2,
          step: 0.05,
          label: "sat",
          onChange: (value: number) => update(finalNode.saturation, value),
        },
        ditherAmount: {
          value: 1,
          min: 0,
          max: 2,
          step: 0.05,
          label: "dither",
          onChange: (value: number) => update(finalNode.ditherAmount, value),
        },
        perChannel: {
          value: true,
          label: "per channel",
          onChange: (value: boolean) =>
            update(finalNode.perChannel, value ? 1 : 0),
        },
        satTowardWhite: {
          value: true,
          label: "sat toward white",
          onChange: (value: boolean) =>
            update(finalNode.satTowardWhite, value ? 1 : 0),
        },
      }),
      brush: folder({
        brushEnabled: {
          value: true,
          label: "enabled",
          transient: false,
          onChange: (value: boolean, _path, context) =>
            applyBrushStrength(value, context.get("brush.brushStrength")),
        },
        brushColor: {
          value: "#D9633F",
          label: "color",
          onChange: (value: string) => updateColor(brushNode.color, value),
        },
        brushSize: {
          value: 0.035,
          min: 0.005,
          max: 0.2,
          step: 0.005,
          label: "size",
          onChange: (value: number) => update(brushNode.size, value),
        },
        brushSoftness: {
          value: 0.6,
          min: 0,
          max: 1,
          step: 0.05,
          label: "softness",
          onChange: (value: number) => update(brushNode.softness, value),
        },
        brushLifetime: {
          value: 0.6,
          min: 0.2,
          max: 5,
          step: 0.1,
          label: "lifetime",
          onChange: (value: number) => update(brushNode.lifetime, value),
        },
        brushStrength: {
          value: 0.9,
          min: 0,
          max: 1,
          step: 0.05,
          label: "strength",
          onChange: (value: number, _path, context) =>
            applyBrushStrength(context.get("brush.brushEnabled"), value),
        },
        brushBreakAmount: {
          value: 0.35,
          min: 0,
          max: 1,
          step: 0.05,
          label: "break-up",
          onChange: (value: number) => update(brushNode.breakAmount, value),
        },
        brushBreakScale: {
          value: 60,
          min: 10,
          max: 200,
          step: 5,
          label: "break scale",
          onChange: (value: number) => update(brushNode.breakScale, value),
        },
      }),
    }),
    [nodes],
  );

  return { brushEnabled };
}
