import type { Technique } from "../core.ts";
import { contentOf, direction, reset, sigmaFor } from "./shared.ts";

export type SqueezeOptions = {
  /** How much narrower the content is drawn before the blur. */
  factor?: number;
};

/**
 * Squeezes the content along the motion, blurs it and stretches it back, so a
 * plain CSS blur comes out `factor` times longer than it is tall. Cheaper than
 * Echo, with a Gaussian edge instead of a box.
 */
export function squeeze({ factor = 16 }: SqueezeOptions = {}) {
  const technique: Technique = ({ layer }) => {
    const content = contentOf(layer, "squeeze");
    const clear = () => {
      reset(layer, "transform", "filter");
      reset(content, "transform");
    };

    return {
      clear,
      paint(frame) {
        const { length, angle } = direction(frame);
        const sigma = sigmaFor(length);
        if (sigma < 0.05) return clear();
        layer.style.transform = `rotate(${angle}deg) scaleX(${factor})`;
        layer.style.filter = `blur(${(sigma / factor).toFixed(3)}px)`;
        content.style.transform = `scaleX(${1 / factor}) rotate(${-angle}deg)`;
      },
    };
  };
  technique.key = `squeeze:${factor}`;
  return technique;
}
