import {
  type ComponentPublicInstance,
  computed,
  defineComponent,
  h,
  hasInjectionContext,
  type InjectionKey,
  inject,
  type MaybeRefOrGetter,
  type PropType,
  provide,
  type Ref,
  ref,
  toValue,
  watch,
  watchEffect,
} from "vue";
import {
  type MotionBlur as Instance,
  type MotionBlurOptions,
  motionBlur,
  type Technique,
} from "./core.ts";

export type MotionBlurDefaults = Omit<MotionBlurOptions, "layer" | "onFrame">;

const Defaults: InjectionKey<Ref<MotionBlurDefaults>> = Symbol("motion-blur");
const none = computed<MotionBlurDefaults>(() => ({}));

function useDefaults() {
  return hasInjectionContext() ? inject(Defaults, none) : none;
}

function defined<T extends object>(options: T) {
  return Object.fromEntries(
    Object.entries(options).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

const props = {
  technique: Function as PropType<Technique>,
  shutter: Number,
  reducedMotion: String as PropType<MotionBlurOptions["reducedMotion"]>,
};

/**
 * Sets the technique, shutter and reduced motion for every blur inside it.
 * Options passed to a blur win, and a nested provider overrides its parent.
 */
export const MotionBlurProvider = defineComponent({
  name: "MotionBlurProvider",
  props,
  setup(own, { slots }) {
    const parent = useDefaults();
    provide(
      Defaults,
      computed(() => ({
        ...parent.value,
        ...defined({
          technique: own.technique,
          shutter: own.shutter,
          reducedMotion: own.reducedMotion,
        }),
      })),
    );
    return () => slots.default?.();
  },
});

export type MotionBlurHandle = Pick<Instance, "render" | "start" | "clear">;

/** The element that moves, or a component whose root element moves. */
export type MotionBlurTarget =
  | HTMLElement
  | ComponentPublicInstance
  | null
  | undefined;

function resolve(target: MotionBlurTarget) {
  const el = target && "$el" in target ? target.$el : target;
  return el instanceof HTMLElement ? el : null;
}

/**
 * Blurs `target`, usually a template ref. Its first child holds the visuals.
 * Options can be a ref, a getter or a reactive object, and change without
 * starting over. Any left out come from `MotionBlurProvider`.
 */
export function useMotionBlur(
  target: MaybeRefOrGetter<MotionBlurTarget>,
  own: MaybeRefOrGetter<Omit<MotionBlurOptions, "layer">> = {},
): MotionBlurHandle {
  const defaults = useDefaults();
  const options = () => ({ ...defaults.value, ...defined(toValue(own)) });
  let latest = options();
  let instance: Instance | null = null;

  watch(
    () => resolve(toValue(target)),
    (host, _, onCleanup) => {
      if (!host) return;
      const { onFrame: _onFrame, ...rest } = latest;
      const blur = motionBlur(host, {
        ...rest,
        onFrame: (streak) => latest.onFrame?.(streak),
      });
      instance = blur;
      onCleanup(() => {
        blur.destroy();
        if (instance === blur) instance = null;
      });
    },
    { immediate: true, flush: "post" },
  );

  watchEffect(
    () => {
      latest = options();
      const { onFrame: _, ...rest } = latest;
      instance?.set(rest);
    },
    { flush: "post" },
  );

  return {
    render: (from, to) => instance?.render(from, to),
    start: () => instance?.start(),
    clear: () => instance?.clear(),
  };
}

/**
 * A `div` that blurs as it moves. Animate this element and style the content
 * inside it, because the element itself has to stay transparent.
 */
export const MotionBlur = defineComponent({
  name: "MotionBlur",
  props,
  emits: {
    /** Every frame the element is watched or rendered, with the streak in px. */
    frame: (streak: number) => typeof streak === "number",
  },
  setup(own, { slots, emit, expose }) {
    const host = ref<HTMLElement | null>(null);
    const blur = useMotionBlur(host, () => ({
      technique: own.technique,
      shutter: own.shutter,
      reducedMotion: own.reducedMotion,
      onFrame: (streak: number) => emit("frame", streak),
    }));
    expose({ ...blur, host });

    return () =>
      h("div", { ref: host }, [h("div", [h("div", slots.default?.())])]);
  },
});
