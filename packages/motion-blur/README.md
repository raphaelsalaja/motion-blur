# @web-kits/motion-blur

Motion blur for elements that move on the web. It reads the element's transform every frame, works out how far it travelled while a virtual shutter was open, and draws the streak with the technique you pick. It works with CSS transitions, CSS animations, the Web Animations API, Motion, or positions you set yourself.

Read how it works, with live examples, in [the write-up](https://www.raphaelsalaja.com/work/motion-blur).

```sh
npm install @web-kits/motion-blur
```

## Quick Start

The element that moves is the **host**. Its first child is the **layer**, which holds everything you can see. The blur is drawn into the layer, so the host itself has to stay transparent: put backgrounds, borders and shadows on the layer or inside it.

```html
<div class="card">
  <div class="card-face">…</div>
</div>
```

```ts
import { motionBlur } from "@web-kits/motion-blur";

const blur = motionBlur(document.querySelector(".card")!);
```

That's all for CSS. The host is watched whenever a transition or animation starts on it, or its inline `transform`, `translate`, `rotate` or `scale` changes, and the blur clears itself once it stops.

### React

```tsx
import { useMotionBlur } from "@web-kits/motion-blur/react";

function Card() {
  const blur = useMotionBlur({ shutter: 180 });
  return (
    <motion.div ref={blur.ref} animate={{ x: open ? 320 : 0 }}>
      <div className="card-face">…</div>
    </motion.div>
  );
}
```

Options can change on any render, and the current blur picks them up without starting over. There's also a component that sets up the host and layer for you:

```tsx
import { MotionBlur } from "@web-kits/motion-blur/react";

<MotionBlur className="card" shutter={360}>
  …
</MotionBlur>;
```

Animate the outer element and style what's inside it.

To set the technique, shutter or reduced motion for a whole tree, wrap it in a provider. Options a blur sets itself win, and a nested provider overrides its parent:

```tsx
import { echo } from "@web-kits/motion-blur";
import { MotionBlurProvider } from "@web-kits/motion-blur/react";

<MotionBlurProvider technique={echo({ spacing: 1 })} shutter={270}>
  <App />
</MotionBlurProvider>;
```

`shutter={0}` on a provider turns off every blur inside it.

## Options

| Option          | Default     |                                                                             |
| --------------- | ----------- | --------------------------------------------------------------------------- |
| `technique`     | `echo()`    | How the streak is drawn.                                                    |
| `shutter`       | `180`       | Shutter angle in degrees.                                                   |
| `reducedMotion` | `"user"`    | `"user"` drops the blur under `prefers-reduced-motion`. `"never"` keeps it. |
| `onFrame`       |             | Called every frame with the streak length in px.                            |
| `layer`         | first child | The element that holds the visuals. Not available in React.                 |

**Shutter.** At 180° the streak covers half of each frame's travel, and at 360° it covers all of it, which closes the gaps that make fast motion strobe. 0 turns the blur off. Values past 360 draw more than one frame's travel, so an animation played at a quarter of its speed with `shutter: 720` keeps the streak it had at full speed.

The streak is tied to the real frame time, so at 120Hz it's half as long as at 60Hz, the same as the gap it fills.

## Techniques

```ts
import { echo, smear, squeeze, svg } from "@web-kits/motion-blur";

motionBlur(el, { technique: squeeze({ factor: 16 }) });
```

| Technique   | Options                        |                                                                                                                                                                  |
| ----------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `echo()`    | `spacing = 1.5`, `copies = 16` | Copies of the layer along the path at `1/n` opacity, added with `plus-lighter`. The only one shaped like a camera's blur, and the only one that follows a curve. |
| `squeeze()` | `factor = 16`                  | A CSS blur stretched along the motion by scaling the layer before the filter. No copies, so it's the cheapest blur.                                              |
| `svg()`     |                                | `feGaussianBlur` along one axis, rotated to the direction of motion.                                                                                             |
| `smear()`   | `limit = 1.05`                 | Stretches the layer along the motion. Nothing is blurred, so keep the limit low on anything with text.                                                           |

Echo gets one copy for every `spacing` px of streak, up to `copies`. Squeeze and SVG rotate the layer and its child in opposite directions, so the layer must have exactly one element child.

## Writing a Technique

A technique is a function that takes the host and layer and returns a painter. The painter gets a frame every time the element moves and has to undo everything in `clear`.

```ts
import { sigmaFor, type Technique } from "@web-kits/motion-blur";

const soft: Technique = ({ layer }) => ({
  paint({ dx, dy }) {
    layer.style.filter = `blur(${sigmaFor(Math.hypot(dx, dy))}px)`;
  },
  clear() {
    layer.style.removeProperty("filter");
  },
});
```

Each frame has:

| Field                       |                                                                                |
| --------------------------- | ------------------------------------------------------------------------------ |
| `path(t)`                   | The element's transform while the shutter is open, from `t = -0.5` to `0.5`.   |
| `matrix`                    | The transform on screen now.                                                   |
| `dx`, `dy`                  | How far the centre travels while the shutter is open, in the element's own px. |
| `streak`                    | The furthest any corner travels, in screen px.                                 |
| `origin`, `width`, `height` | The element's `transform-origin` and size.                                     |

Add `destroy` to the painter if it puts anything in the page. Set `soft.key = "soft"` when you build techniques inside a render, so a new function with the same settings doesn't rebuild the painter. `sigmaFor(length)` turns a streak length into the Gaussian with the same spread as a camera's box blur.

## Positions You Work Out Yourself

For a physics loop, a canvas-driven position or anything else you set by hand, call `render` once a frame. The first call stops the automatic watching.

```ts
blur.render(previous, current);
```

Pass a path instead when the motion bends, so Echo puts its copies along the curve instead of on a straight line between two frames:

```ts
el.style.transform = at(angle).toString();
blur.render((t) => at(angle + t * speed * frameTime));
```

`t` is in frames, so `path(-0.5)` is half a frame back.

## Instance

`motionBlur` returns:

| Method              |                                                          |
| ------------------- | -------------------------------------------------------- |
| `start()`           | Start watching now, for changes it can't see on its own. |
| `render(from, to?)` | Draw one frame by hand, from two transforms or a path.   |
| `set(options)`      | Change any option except `layer`.                        |
| `clear()`           | Remove the streak until the element next moves.          |
| `destroy()`         | Stop watching and remove anything it added.              |

## When to Use It

Blur what the eye can't follow: a thrown card, a sheet being dismissed, a panel snapping in, a spinner. Leave it off anything the reader tracks or reads, like scrolling, carousels and lists sliding into place. The screen already blurs what the eye follows, and more blur on top turns text into grey bars.

A background tab throttles `requestAnimationFrame`, which stretches the frame time and every streak with it, so check streak lengths in a focused tab.
