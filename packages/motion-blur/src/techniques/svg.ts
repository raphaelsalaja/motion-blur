import type { Technique } from "../core.ts";
import { contentOf, direction, reset, sigmaFor } from "./shared.ts";

const NS = "http://www.w3.org/2000/svg";

let count = 0;

/**
 * An SVG `feGaussianBlur` along one axis, with the layer turned to the angle
 * of motion and the content turned back. The filter region is widened so the
 * streak isn't cut off at either end.
 */
export function svg() {
  const technique: Technique = ({ layer }) => {
    const content = contentOf(layer, "svg");
    const id = `motion-blur-${++count}`;

    const defs = document.createElementNS(NS, "svg");
    defs.setAttribute("aria-hidden", "true");
    defs.setAttribute("width", "0");
    defs.setAttribute("height", "0");
    defs.style.position = "absolute";

    const filter = document.createElementNS(NS, "filter");
    filter.id = id;
    for (const [name, value] of [
      ["x", "-150%"],
      ["y", "-50%"],
      ["width", "400%"],
      ["height", "200%"],
      ["color-interpolation-filters", "sRGB"],
    ]) {
      filter.setAttribute(name, value);
    }

    const kernel = document.createElementNS(NS, "feGaussianBlur");
    kernel.setAttribute("stdDeviation", "0 0");
    filter.append(kernel);
    defs.append(filter);
    document.body.append(defs);

    const clear = () => {
      reset(layer, "transform", "filter");
      reset(content, "transform");
    };

    return {
      clear,
      destroy() {
        clear();
        defs.remove();
      },
      paint(frame) {
        const { length, angle } = direction(frame);
        const sigma = sigmaFor(length);
        if (sigma < 0.05) return clear();
        kernel.setAttribute("stdDeviation", `${sigma.toFixed(2)} 0`);
        layer.style.transform = `rotate(${angle}deg)`;
        layer.style.filter = `url(#${id})`;
        content.style.transform = `rotate(${-angle}deg)`;
      },
    };
  };
  technique.key = "svg";
  return technique;
}
