"use client";

import {
  type ComponentProps,
  createContext,
  type ReactNode,
  type Ref,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import {
  type MotionBlur as Instance,
  type MotionBlurOptions,
  motionBlur,
} from "./core.ts";

export type MotionBlurDefaults = Omit<MotionBlurOptions, "layer" | "onFrame">;

const Defaults = createContext<MotionBlurDefaults>({});

function defined<T extends object>(options: T) {
  return Object.fromEntries(
    Object.entries(options).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

/**
 * Sets the technique, shutter and reduced motion for every blur inside it.
 * Options passed to a blur win, and a nested provider overrides its parent.
 */
export function MotionBlurProvider({
  technique,
  shutter,
  reducedMotion,
  children,
}: MotionBlurDefaults & { children?: ReactNode }) {
  const parent = useContext(Defaults);
  const value = useMemo(
    () => ({ ...parent, ...defined({ technique, shutter, reducedMotion }) }),
    [parent, technique, shutter, reducedMotion],
  );
  return <Defaults value={value}>{children}</Defaults>;
}

export type MotionBlurHandle = Pick<Instance, "render" | "start" | "clear"> & {
  /** Put this on the element that moves. Its first child holds the visuals. */
  ref: (host: HTMLElement | null) => () => void;
};

/**
 * Blurs the element you put `ref` on. Options can change on any render
 * without starting over, and any left out come from `MotionBlurProvider`.
 */
export function useMotionBlur(
  own: Omit<MotionBlurOptions, "layer"> = {},
): MotionBlurHandle {
  const options = { ...useContext(Defaults), ...defined(own) };
  const latest = useRef(options);
  const instance = useRef<Instance | null>(null);

  useLayoutEffect(() => {
    latest.current = options;
    const { onFrame: _, ...rest } = options;
    instance.current?.set(rest);
  });

  const ref = useCallback((host: HTMLElement | null) => {
    instance.current?.destroy();
    instance.current = null;
    if (!host) return () => {};

    const { onFrame: _, ...rest } = latest.current;
    const blur = motionBlur(host, {
      ...rest,
      onFrame: (streak) => latest.current.onFrame?.(streak),
    });
    instance.current = blur;
    return () => {
      blur.destroy();
      if (instance.current === blur) instance.current = null;
    };
  }, []);

  return useMemo(
    () => ({
      ref,
      render: (from, to) => instance.current?.render(from, to),
      start: () => instance.current?.start(),
      clear: () => instance.current?.clear(),
    }),
    [ref],
  );
}

function merge<T>(...refs: (Ref<T> | undefined)[]) {
  return (node: T | null) => {
    const cleanups = refs.map((ref) => {
      if (typeof ref === "function") return ref(node);
      if (ref) ref.current = node;
      return undefined;
    });
    return () => {
      cleanups.forEach((cleanup, i) => {
        const ref = refs[i];
        if (typeof cleanup === "function") cleanup();
        else if (typeof ref === "function") ref(null);
        else if (ref) ref.current = null;
      });
    };
  };
}

export type MotionBlurProps = Omit<MotionBlurOptions, "layer"> &
  ComponentProps<"div">;

/**
 * A `div` that blurs as it moves. Animate this element and style the content
 * inside it, because the element itself has to stay transparent.
 */
export function MotionBlur({
  technique,
  shutter,
  reducedMotion,
  onFrame,
  ref,
  children,
  ...props
}: MotionBlurProps) {
  const blur = useMotionBlur({ technique, shutter, reducedMotion, onFrame });
  const refs = useMemo(() => merge(ref, blur.ref), [ref, blur.ref]);

  return (
    <div {...props} ref={refs}>
      <div>
        <div>{children}</div>
      </div>
    </div>
  );
}
