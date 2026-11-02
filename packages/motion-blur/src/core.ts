import {
  mix,
  type Point,
  readOrigin,
  readTransform,
  travel,
} from "./matrix.ts";
import { echo } from "./techniques/echo.ts";

/**
 * Where the element is `t` frames from now, as a transform. `path(0)` is the
 * transform on screen. A 360° shutter draws `t` from -0.5 to 0.5.
 */
export type Path = (t: number) => DOMMatrixReadOnly;

/** What a technique gets each frame the element moves. */
export type Frame = {
  /** The element's transform while the shutter is open, from -0.5 (opens) to 0.5 (closes). */
  path: Path;
  /** The transform on screen now, `path(0)`. */
  matrix: DOMMatrixReadOnly;
  /** The element's `transform-origin` in px from its top left corner. */
  origin: Point;
  width: number;
  height: number;
  /** The furthest any corner travels while the shutter is open, in screen px. */
  streak: number;
  /** How far the centre travels while the shutter is open, in the element's own px. */
  dx: number;
  dy: number;
};

export type Target = {
  /** The element that moves. It must stay transparent. */
  host: HTMLElement;
  /** Its child that holds the visuals. It must not have a transform of its own. */
  layer: HTMLElement;
};

export type Painter = {
  /** Draw the streak for one frame. */
  paint: (frame: Frame) => void;
  /** Put the layer back the way it was. */
  clear: () => void;
  /** Remove anything the painter added to the page. */
  destroy?: () => void;
};

/**
 * A way of drawing the streak. Call it with an element to get a painter for it.
 * Give it a `key` so two equal techniques count as the same one.
 */
export type Technique = ((target: Target) => Painter) & { key?: string };

export type MotionBlurOptions = {
  /** How the streak is drawn. Defaults to `echo()`. */
  technique?: Technique;
  /**
   * Shutter angle in degrees. 180 draws half of each frame's travel, 360 all of it.
   * Past 360 draws more than one frame, which keeps a slowed-down animation's
   * streak the same as at full speed. 0 turns the blur off.
   */
  shutter?: number;
  /** The child that holds the visuals. Defaults to the first element child. */
  layer?: HTMLElement;
  /** `"user"` drops the blur when the user prefers reduced motion. `"never"` keeps it. */
  reducedMotion?: "user" | "never";
  /** Called every frame the element is watched or rendered, with the streak in px. */
  onFrame?: (streak: number) => void;
};

export type MotionBlur = {
  /** Watch the element's transform. Runs on its own for CSS transitions, animations and style changes. */
  start: () => void;
  /**
   * Draw one frame by hand, for positions you work out yourself. Pass the
   * transforms one frame apart, or a `Path`. The first call stops watching.
   */
  render: (from: Path | DOMMatrixReadOnly, to?: DOMMatrixReadOnly) => void;
  /** Change any option without starting over. */
  set: (options: Omit<MotionBlurOptions, "layer">) => void;
  /** Remove the streak until the next frame that moves. */
  clear: () => void;
  destroy: () => void;
};

const STILL = 0.1;

function same(a: Technique, b: Technique) {
  return a === b || (a.key !== undefined && a.key === b.key);
}

/**
 * Blurs `host` along whatever path its transform takes, drawn by the chosen
 * technique into its first child.
 */
export function motionBlur(
  host: HTMLElement,
  { layer: given, ...options }: MotionBlurOptions = {},
): MotionBlur {
  const layer = given ?? host.firstElementChild;
  if (!(layer instanceof HTMLElement)) {
    throw new Error(
      "motionBlur needs an element with a child that holds its visuals.",
    );
  }

  let technique = options.technique ?? echo();
  let shutter = options.shutter ?? 180;
  let reducedMotion = options.reducedMotion ?? "user";
  let onFrame = options.onFrame;
  let painter = technique({ host, layer });

  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  let manual = false;
  let previous: DOMMatrixReadOnly | null = null;
  let frame = 0;
  let still = 0;

  const draw = (path: Path) => {
    const open = Math.max(0, shutter) / 360;
    const blocked = reducedMotion === "user" && reduce.matches;
    const width = host.offsetWidth;
    const height = host.offsetHeight;
    const origin = readOrigin(host);
    const span: Path = (t) => path(t * open);
    const start = span(-0.5);
    const end = span(0.5);
    const streak =
      open && !blocked ? travel(start, end, origin, width, height) : 0;

    if (streak < STILL) {
      painter.clear();
      return streak;
    }

    const matrix = path(0);
    const inverse = matrix.inverse();
    const centre = new DOMPoint(width / 2 - origin.x, height / 2 - origin.y);
    const a = inverse.transformPoint(start.transformPoint(centre));
    const b = inverse.transformPoint(end.transformPoint(centre));

    painter.paint({
      path: span,
      matrix,
      origin,
      width,
      height,
      streak,
      dx: b.x - a.x,
      dy: b.y - a.y,
    });
    return streak;
  };

  const stop = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    painter.clear();
  };

  const tick = () => {
    const current = readTransform(host);
    const last = previous;
    const streak = last ? draw((t) => mix(last, current, 1 + t)) : 0;
    previous = current;
    onFrame?.(streak);

    const animating = host.getAnimations().length > 0;
    still = streak > 0 || animating ? 0 : still + 1;
    if (still < 2) frame = requestAnimationFrame(tick);
    else stop();
  };

  const start = () => {
    if (frame || manual) return;
    previous = readTransform(host);
    still = 0;
    frame = requestAnimationFrame(tick);
  };

  const own = (event: Event) => {
    if (event.target === host) start();
  };
  const inline = () => {
    const { transform, translate, rotate, scale } = host.style;
    return `${transform}|${translate}|${rotate}|${scale}`;
  };
  let seen = inline();
  const observer = new MutationObserver(() => {
    const now = inline();
    if (now === seen) return;
    seen = now;
    start();
  });

  host.addEventListener("transitionrun", own);
  host.addEventListener("animationstart", own);
  observer.observe(host, { attributes: true, attributeFilter: ["style"] });
  start();

  return {
    start,
    render(from, to) {
      if (!manual) {
        manual = true;
        stop();
        observer.disconnect();
      }
      const path: Path =
        typeof from === "function" ? from : (t) => mix(from, to ?? from, 1 + t);
      const streak = draw(path);
      onFrame?.(streak);
    },
    set(next) {
      if (next.technique && !same(next.technique, technique)) {
        painter.clear();
        painter.destroy?.();
        technique = next.technique;
        painter = technique({ host, layer });
      }
      if (next.shutter !== undefined) shutter = next.shutter;
      if (next.reducedMotion) reducedMotion = next.reducedMotion;
      if ("onFrame" in next) onFrame = next.onFrame;
      start();
    },
    clear: () => painter.clear(),
    destroy() {
      stop();
      observer.disconnect();
      host.removeEventListener("transitionrun", own);
      host.removeEventListener("animationstart", own);
      painter.destroy?.();
    },
  };
}
