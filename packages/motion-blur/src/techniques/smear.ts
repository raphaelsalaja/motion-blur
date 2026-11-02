import type { Technique } from "../core.ts";
import { direction, reset } from "./shared.ts";

export type SmearOptions = {
  /** The most the layer is stretched along the motion. Past 1.05 text visibly distorts. */
  limit?: number;
};

/**
 * Stretches the layer along its motion by the length of the streak, like an
 * animator's smear frame. Only a transform, so nothing is filtered, but it
 * stretches the content instead of blurring it.
 */
export function smear({ limit = 1.05 }: SmearOptions = {}) {
  const technique: Technique = ({ layer }) => {
    const clear = () => reset(layer, "transform");

    return {
      clear,
      paint(frame) {
        const { length, angle } = direction(frame);
        const radians = (angle * Math.PI) / 180;
        const extent =
          Math.abs(layer.offsetWidth * Math.cos(radians)) +
          Math.abs(layer.offsetHeight * Math.sin(radians));
        const stretch = Math.min(limit, 1 + length / Math.max(1, extent));
        if (stretch < 1.001) return clear();
        layer.style.transform = `rotate(${angle}deg) scaleX(${stretch.toFixed(3)}) rotate(${-angle}deg)`;
      },
    };
  };
  technique.key = `smear:${limit}`;
  return technique;
}
