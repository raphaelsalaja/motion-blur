import type { Technique } from "../core.ts";

export type EchoOptions = {
  /** Pixels of streak each copy covers. Past this the copies show as steps. */
  spacing?: number;
  /** Most copies drawn on one frame, including the original. */
  copies?: number;
};

function copy(layer: HTMLElement) {
  const clone = layer.cloneNode(true) as HTMLElement;
  for (const node of [clone, ...clone.querySelectorAll<HTMLElement>("*")]) {
    node.removeAttribute("id");
    node.removeAttribute("name");
    node.removeAttribute("autofocus");
  }
  clone.setAttribute("aria-hidden", "true");
  clone.inert = true;
  Object.assign(clone.style, {
    position: "absolute",
    left: `${layer.offsetLeft}px`,
    top: `${layer.offsetTop}px`,
    width: `${layer.offsetWidth}px`,
    height: `${layer.offsetHeight}px`,
    margin: "0",
    boxSizing: "border-box",
    pointerEvents: "none",
  });
  return clone;
}

/**
 * Draws the layer several times along the streak, each at a fraction of its
 * opacity, and adds them up with `plus-lighter`. It has the box shape a camera
 * records, and follows rotation, scale and curved paths.
 */
export function echo({ spacing = 1.5, copies = 16 }: EchoOptions = {}) {
  const technique: Technique = ({ host, layer }) => {
    let clones: HTMLElement[] = [];

    const clear = () => {
      for (const clone of clones) clone.remove();
      clones = [];
      for (const property of [
        "transform",
        "transform-origin",
        "opacity",
        "mix-blend-mode",
      ]) {
        layer.style.removeProperty(property);
      }
      host.style.removeProperty("isolation");
    };

    return {
      clear,
      destroy: clear,
      paint({ path, matrix, origin, streak }) {
        if (streak <= 0.5) return clear();
        const count = Math.min(
          copies,
          Math.max(2, Math.ceil(streak / spacing)),
        );
        const inverse = matrix.inverse();
        if (Number.isNaN(inverse.m11)) return clear();

        if (!clones.length) {
          clones = Array.from({ length: copies - 1 }, () => copy(layer));
          host.append(...clones);
        }

        const pivot = `${origin.x - layer.offsetLeft - host.clientLeft}px ${origin.y - layer.offsetTop - host.clientTop}px`;
        host.style.isolation = "isolate";

        [layer, ...clones].forEach((element, i) => {
          if (i >= count) {
            element.style.opacity = "0";
            return;
          }
          // Opacity is composited in 8 bits, so equal shares of 1 / count
          // round and stop summing to 1. Whole 255ths that add up to 255
          // keep solid areas at full strength.
          const share =
            Math.round(((i + 1) * 255) / count) - Math.round((i * 255) / count);
          const sample = inverse.multiply(path(i / (count - 1) - 0.5));
          element.style.transform = sample.toString();
          element.style.transformOrigin = pivot;
          element.style.opacity = String(share / 255);
          element.style.mixBlendMode = "plus-lighter";
        });
      },
    };
  };
  technique.key = `echo:${spacing}:${copies}`;
  return technique;
}
