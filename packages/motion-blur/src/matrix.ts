const KEYS = [
  "m11",
  "m12",
  "m13",
  "m14",
  "m21",
  "m22",
  "m23",
  "m24",
  "m31",
  "m32",
  "m33",
  "m34",
  "m41",
  "m42",
  "m43",
  "m44",
] as const;

export type Point = { x: number; y: number };

const px = (value: string) => value.split(" ").map(Number.parseFloat);

/** The element's full transform, including the individual `translate`, `rotate` and `scale` properties. */
export function readTransform(element: Element) {
  const style = getComputedStyle(element);
  const matrix = new DOMMatrix();

  if (style.translate !== "none") {
    const [x = 0, y = 0, z = 0] = px(style.translate);
    matrix.translateSelf(x, y, z);
  }
  if (style.rotate !== "none") {
    const parts = style.rotate.split(" ");
    const angle = Number.parseFloat(parts.at(-1) ?? "0");
    if (parts.length === 4) {
      const [x, y, z] = parts.map(Number);
      matrix.rotateAxisAngleSelf(x, y, z, angle);
    } else if (parts.length === 2) {
      const axis = parts[0];
      matrix.rotateAxisAngleSelf(
        axis === "x" ? 1 : 0,
        axis === "y" ? 1 : 0,
        axis === "z" ? 1 : 0,
        angle,
      );
    } else {
      matrix.rotateSelf(angle);
    }
  }
  if (style.scale !== "none") {
    const [x = 1, y = x, z = 1] = style.scale.split(" ").map(Number);
    matrix.scaleSelf(x, y, z);
  }
  if (style.transform !== "none") {
    matrix.multiplySelf(new DOMMatrix(style.transform));
  }

  return matrix;
}

export function readOrigin(element: Element): Point {
  const [x = 0, y = 0] = px(getComputedStyle(element).transformOrigin);
  return { x, y };
}

/** Blends two transforms entry by entry. `t` past 1 or below 0 extrapolates. */
export function mix(from: DOMMatrixReadOnly, to: DOMMatrixReadOnly, t: number) {
  const out = new DOMMatrix();
  for (const key of KEYS) out[key] = from[key] + (to[key] - from[key]) * t;
  return out;
}

/** The furthest any corner of a `width` by `height` box moves between two transforms about `origin`. */
export function travel(
  from: DOMMatrixReadOnly,
  to: DOMMatrixReadOnly,
  origin: Point,
  width: number,
  height: number,
) {
  let longest = 0;
  for (const [x, y] of [
    [0, 0],
    [width, 0],
    [0, height],
    [width, height],
  ]) {
    const point = new DOMPoint(x - origin.x, y - origin.y);
    const a = from.transformPoint(point);
    const b = to.transformPoint(point);
    longest = Math.max(longest, Math.hypot(b.x - a.x, b.y - a.y));
  }
  return longest;
}
