import type { Frame } from "../core.ts";

const BOX_TO_SIGMA = 1 / Math.sqrt(12);

/** The Gaussian with the same spread as a camera's box streak of this length. */
export function sigmaFor(length: number) {
  return length * BOX_TO_SIGMA;
}

export function direction({ dx, dy }: Frame) {
  return {
    length: Math.hypot(dx, dy),
    angle: (Math.atan2(dy, dx) * 180) / Math.PI,
  };
}

/** The layer's single child, which the directional techniques turn back upright. */
export function contentOf(layer: HTMLElement, name: string) {
  const content = layer.firstElementChild;
  if (!(content instanceof HTMLElement) || layer.childElementCount !== 1) {
    throw new Error(
      `${name}() needs the layer to wrap exactly one element, which it rotates back upright.`,
    );
  }
  return content;
}

export function reset(element: HTMLElement, ...properties: string[]) {
  for (const property of properties) element.style.removeProperty(property);
}
