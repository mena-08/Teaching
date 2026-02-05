<!-- ````md
# WebGPU Template: Transforms + Camera (WASD)

## Prerequisites
- Node.js LTS
- VS Code
- Chrome/Edge (WebGPU enabled by default in current versions)

## Create project
```bash
npm create vite@latest webgpu_transform_camera -- --template vanilla-ts

cd webgpu_transform_camera

npm install --save-dev @webgpu/types

npm run dev
````

## Replace files

Use the files in this template:

* `index.html`
* `src/style.css`
* `src/main.ts`
* `src/math.ts`
* `src/camera.ts`
* `src/shader.wgsl`

## Controls

* `W/A/S/D`: move on XZ plane
* `Q/E`: move down/up
* `Arrow Left/Right`: yaw
* `Arrow Up/Down`: pitch

## Notes

* Matrices are `Float32Array(16)` in column-major layout.
* MVP order in shader upload is: `P * V * M`.
* Resize is handled and depth buffer is recreated.

````

---

## 2) `index.html`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>WebGPU Transform + Camera</title>
  </head>
  <body>
    <canvas id="gfx-main"></canvas>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
````

---

## 3) `src/style.css`

```css
html, body {
  margin: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
}
canvas {
  width: 100%;
  height: 100%;
  display: block;
}
```

---

## 4) `src/math.ts` (students can work here)

```ts
export type Vec3 = [number, number, number];
export type Mat4 = Float32Array; // column-major

export const vec3 = {
  add: (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  scale: (v: Vec3, s: number): Vec3 => [v[0] * s, v[1] * s, v[2] * s],
  dot: (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a: Vec3, b: Vec3): Vec3 => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ],
  length: (v: Vec3): number => Math.hypot(v[0], v[1], v[2]),
  normalize: (v: Vec3): Vec3 => {
    const len = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / len, v[1] / len, v[2] / len];
  },
};

export const mat4 = {
  identity(): Mat4 {
    const m = new Float32Array(16);
    m[0] = m[5] = m[10] = m[15] = 1;
    return m;
  },

  // out = a * b (column-major)
  multiply(a: Mat4, b: Mat4): Mat4 {
    // Core exercise target: ask students to derive this multiplication.
    const out = new Float32Array(16);
    for (let c = 0; c < 4; c++) {
      for (let r = 0; r < 4; r++) {
        out[c * 4 + r] =
          a[0 * 4 + r] * b[c * 4 + 0] +
          a[1 * 4 + r] * b[c * 4 + 1] +
          a[2 * 4 + r] * b[c * 4 + 2] +
          a[3 * 4 + r] * b[c * 4 + 3];
      }
    }
    return out;
  },

  translation(tx: number, ty: number, tz: number): Mat4 {
    const m = mat4.identity();
    m[12] = tx;
    m[13] = ty;
    m[14] = tz;
    return m;
  },

  scaling(sx: number, sy: number, sz: number): Mat4 {
    const m = mat4.identity();
    m[0] = sx;
    m[5] = sy;
    m[10] = sz;
    return m;
  },

  rotationX(rad: number): Mat4 {
    const c = Math.cos(rad);
    const s = Math.sin(rad);
    const m = mat4.identity();
    m[5] = c;
    m[9] = -s;
    m[6] = s;
    m[10] = c;
    return m;
  },

  rotationY(rad: number): Mat4 {
    const c = Math.cos(rad);
    const s = Math.sin(rad);
    const m = mat4.identity();
    m[0] = c;
    m[8] = s;
    m[2] = -s;
    m[10] = c;
    return m;
  },

  rotationZ(rad: number): Mat4 {
    const c = Math.cos(rad);
    const s = Math.sin(rad);
    const m = mat4.identity();
    m[0] = c;
    m[4] = -s;
    m[1] = s;
    m[5] = c;
    return m;
  },

  perspective(fovyRad: number, aspect: number, near: number, far: number): Mat4 {
    const f = 1.0 / Math.tan(fovyRad / 2);
    const nf = 1 / (near - far);
    const m = new Float32Array(16);
    m[0] = f / aspect;
    m[5] = f;
    m[10] = (far + near) * nf;
    m[11] = -1;
    m[14] = (2 * far * near) * nf;
    return m;
  },

  lookAt(eye: Vec3, target: Vec3, up: Vec3): Mat4 {
    // Right-handed view matrix
    const z = vec3.normalize(vec3.sub(eye, target));    // camera backward
    const x = vec3.normalize(vec3.cross(up, z));        // camera right
    const y = vec3.cross(z, x);                         // camera up corrected

    const m = new Float32Array(16);
    m[0] = x[0]; m[4] = x[1]; m[8]  = x[2]; m[12] = -vec3.dot(x, eye);
    m[1] = y[0]; m[5] = y[1]; m[9]  = y[2]; m[13] = -vec3.dot(y, eye);
    m[2] = z[0]; m[6] = z[1]; m[10] = z[2]; m[14] = -vec3.dot(z, eye);
    m[3] = 0;    m[7] = 0;    m[11] = 0;    m[15] = 1;
    return m;
  },
};
```

---

## 5) `src/camera.ts`

```ts
import { Mat4, Vec3, mat4, vec3 } from "./math";

export class Camera {
  position: Vec3 = [0, 1.2, 4.0];
  yaw = -Math.PI / 2;   // face -Z initially
  pitch = 0;
  moveSpeed = 3.0;
  turnSpeed = 1.8;      // rad/s

  private clampPitch() {
    const lim = Math.PI / 2 - 0.01;
    if (this.pitch > lim) this.pitch = lim;
    if (this.pitch < -lim) this.pitch = -lim;
  }

  getForward(): Vec3 {
    const cp = Math.cos(this.pitch);
    return vec3.normalize([
      Math.cos(this.yaw) * cp,
      Math.sin(this.pitch),
      Math.sin(this.yaw) * cp,
    ]);
  }

  getViewMatrix(): Mat4 {
    const f = this.getForward();
    const target: Vec3 = vec3.add(this.position, f);
    return mat4.lookAt(this.position, target, [0, 1, 0]);
  }

  update(keys: Set<string>, dt: number) {
    // rotation (arrow keys)
    if (keys.has("ArrowLeft"))  this.yaw   -= this.turnSpeed * dt;
    if (keys.has("ArrowRight")) this.yaw   += this.turnSpeed * dt;
    if (keys.has("ArrowUp"))    this.pitch += this.turnSpeed * dt;
    if (keys.has("ArrowDown"))  this.pitch -= this.turnSpeed * dt;
    this.clampPitch();

    // movement (WASD on XZ plane + Q/E vertical)
    const f = this.getForward();
    const fXZ = vec3.normalize([f[0], 0, f[2]]);
    const right = vec3.normalize(vec3.cross(fXZ, [0, 1, 0]));
    const speed = this.moveSpeed * dt;

    if (keys.has("w") || keys.has("W")) this.position = vec3.add(this.position, vec3.scale(fXZ, speed));
    if (keys.has("s") || keys.has("S")) this.position = vec3.add(this.position, vec3.scale(fXZ, -speed));
    if (keys.has("d") || keys.has("D")) this.position = vec3.add(this.position, vec3.scale(right, speed));
    if (keys.has("a") || keys.has("A")) this.position = vec3.add(this.position, vec3.scale(right, -speed));
    if (keys.has("e") || keys.has("E")) this.position = vec3.add(this.position, [0, speed, 0]);
    if (keys.has("q") || keys.has("Q")) this.position = vec3.add(this.position, [0, -speed, 0]);
  }
}
```

---

## 6) `src/shader.wgsl`

```wgsl
struct Uniforms {
  mvp : mat4x4<f32>,
};

@group(0) @binding(0) var<uniform> u : Uniforms;

struct VSIn {
  @location(0) position : vec3<f32>,
  @location(1) color    : vec3<f32>,
};

struct VSOut {
  @builtin(position) clipPos : vec4<f32>,
  @location(0) color : vec3<f32>,
};

@vertex
fn vs_main(input: VSIn) -> VSOut {
  var out: VSOut;
  out.clipPos = u.mvp * vec4<f32>(input.position, 1.0);
  out.color = input.color;
  return out;
}

@fragment
fn fs_main(input: VSOut) -> @location(0) vec4<f32> {
  return vec4<f32>(input.color, 1.0);
}
```

---

## 7) `src/main.ts`

```ts
/// <reference types="@webgpu/types" />
import "./style.css";
import shaderCode from "./shader.wgsl?raw";
import { Camera } from "./camera";
import { mat4 } from "./math";

if (!navigator.gpu) throw new Error("WebGPU not supported");

const canvas = document.querySelector("#gfx-main") as HTMLCanvasElement;
const adapter = await navigator.gpu.requestAdapter();
if (!adapter) throw new Error("No GPU adapter");
const device = await adapter.requestDevice();

const context = canvas.getContext("webgpu");
if (!context) throw new Error("Could not get WebGPU context");

const format = navigator.gpu.getPreferredCanvasFormat();
let depthTexture: GPUTexture;

function resize() {
  canvas.width = Math.max(1, Math.floor(window.innerWidth * devicePixelRatio));
  canvas.height = Math.max(1, Math.floor(window.innerHeight * devicePixelRatio));

  context.configure({
    device,
    format,
    alphaMode: "premultiplied",
  });

  depthTexture?.destroy();
  depthTexture = device.createTexture({
    size: [canvas.width, canvas.height],
    format: "depth24plus",
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });
}
resize();
window.addEventListener("resize", resize);

// Cube (36 vertices), each vertex: position xyz + color rgb
const cube = new Float32Array([
  // +X
   1,-1,-1, 1,0,0,   1, 1,-1, 1,0,0,   1, 1, 1, 1,0,0,
   1,-1,-1, 1,0,0,   1, 1, 1, 1,0,0,   1,-1, 1, 1,0,0,
  // -X
  -1,-1, 1, 0,1,0,  -1, 1, 1, 0,1,0,  -1, 1,-1, 0,1,0,
  -1,-1, 1, 0,1,0,  -1, 1,-1, 0,1,0,  -1,-1,-1, 0,1,0,
  // +Y
  -1, 1,-1, 0,0,1,  -1, 1, 1, 0,0,1,   1, 1, 1, 0,0,1,
  -1, 1,-1, 0,0,1,   1, 1, 1, 0,0,1,   1, 1,-1, 0,0,1,
  // -Y
  -1,-1, 1, 1,1,0,  -1,-1,-1, 1,1,0,   1,-1,-1, 1,1,0,
  -1,-1, 1, 1,1,0,   1,-1,-1, 1,1,0,   1,-1, 1, 1,1,0,
  // +Z
   1,-1, 1, 1,0,1,   1, 1, 1, 1,0,1,  -1, 1, 1, 1,0,1,
   1,-1, 1, 1,0,1,  -1, 1, 1, 1,0,1,  -1,-1, 1, 1,0,1,
  // -Z
  -1,-1,-1, 0,1,1,  -1, 1,-1, 0,1,1,   1, 1,-1, 0,1,1,
  -1,-1,-1, 0,1,1,   1, 1,-1, 0,1,1,   1,-1,-1, 0,1,1,
]);

const vbo = device.createBuffer({
  size: cube.byteLength,
  usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
});
device.queue.writeBuffer(vbo, 0, cube);

const uniformBuffer = device.createBuffer({
  size: 64, // mat4x4<f32>
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});

const shader = device.createShaderModule({ code: shaderCode });

const pipeline = device.createRenderPipeline({
  layout: "auto",
  vertex: {
    module: shader,
    entryPoint: "vs_main",
    buffers: [
      {
        arrayStride: 6 * 4,
        attributes: [
          { shaderLocation: 0, offset: 0,      format: "float32x3" }, // position
          { shaderLocation: 1, offset: 3 * 4,  format: "float32x3" }, // color
        ],
      },
    ],
  },
  fragment: {
    module: shader,
    entryPoint: "fs_main",
    targets: [{ format }],
  },
  primitive: { topology: "triangle-list", cullMode: "back" },
  depthStencil: {
    depthWriteEnabled: true,
    depthCompare: "less",
    format: "depth24plus",
  },
});

const bindGroup = device.createBindGroup({
  layout: pipeline.getBindGroupLayout(0),
  entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
});

const camera = new Camera();
const keys = new Set<string>();
window.addEventListener("keydown", (e) => keys.add(e.key));
window.addEventListener("keyup", (e) => keys.delete(e.key));

let last = performance.now();

function frame(now: number) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;

  camera.update(keys, dt);

  const aspect = canvas.width / canvas.height;
  const proj = mat4.perspective((60 * Math.PI) / 180, aspect, 0.1, 100.0);
  const view = camera.getViewMatrix();

  const t = now * 0.001;
  const model = mat4.multiply(
    mat4.rotationY(t * 0.8),
    mat4.multiply(mat4.rotationX(t * 0.4), mat4.scaling(0.8, 0.8, 0.8))
  );

  const vp = mat4.multiply(proj, view);
  const mvp = mat4.multiply(vp, model);

  device.queue.writeBuffer(uniformBuffer, 0, mvp.buffer, mvp.byteOffset, mvp.byteLength);

  const encoder = device.createCommandEncoder();
  const pass = encoder.beginRenderPass({
    colorAttachments: [{
      view: context.getCurrentTexture().createView(),
      clearValue: { r: 0.06, g: 0.08, b: 0.12, a: 1 },
      loadOp: "clear",
      storeOp: "store",
    }],
    depthStencilAttachment: {
      view: depthTexture.createView(),
      depthClearValue: 1.0,
      depthLoadOp: "clear",
      depthStoreOp: "store",
    },
  });

  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.setVertexBuffer(0, vbo);
  pass.draw(cube.length / 6);
  pass.end();

  device.queue.submit([encoder.finish()]);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
```

---

## 8) Nice exercise for students (focused + meaningful)

**Exercise: “Manual Matrix Engine + Camera Lab”**

1. In `math.ts`, make students **re-implement**:

* `mat4.multiply`
* one rotation matrix (`rotationY`)
* `lookAt`

2. Add one new transform:

* `shearXY(kx, ky)` (4x4 affine shear)

3. Add runtime toggle:

* key `1`: model = `T * R * S`
* key `2`: model = `R * T * S`
* ask them to explain the visual difference (non-commutativity)

4. Deliverable:

* short note with one numeric matrix multiplication example (hand-computed)
* screenshot for each transform order + WASD navigation. -->


````md
# WebGPU Template — Transforms + Camera

This project is a **teaching template** for transforms and camera in WebGPU.

- Starter scene renders **one red front face** first (so students always see output).
- Students then implement:
  1. matrix math (`multiply`, translation, scaling, rotations),
  2. remaining cube faces,
  3. transform-order comparison (`TRS`, `RTS`, `SRT`).

---

## 1) Prerequisites

- Node.js LTS
- VS Code
- Chrome/Edge with WebGPU support

---

## 2) Project setup

```bash
npm create vite@latest webgpu_transform_camera -- --template vanilla-ts
cd webgpu_transform_camera
npm install
npm install --save-dev @webgpu/types
npm run dev
````

Then replace files with this template:

* `index.html`
* `src/style.css`
* `src/main.ts`
* `src/math.ts`
* `src/camera.ts`
* `src/shader.wgsl`

---

## 3) Quick file overview

```txt
webgpu_transform_camera/
├─ index.html          # canvas + entry point
├─ src/
│  ├─ main.ts          # WebGPU init, pipeline, buffers, render loop, input, MVP upload
│  ├─ math.ts          # Vec3/Mat4 helpers + TODO matrix operations for students
│  ├─ camera.ts        # WASD + yaw/pitch camera, view matrix
│  ├─ shader.wgsl      # vertex/fragment shaders using uniform MVP
│  └─ style.css        # fullscreen canvas
```

### What each file does

* **`index.html`**: creates `<canvas id="gfx-main">` and loads `src/main.ts`.
* **`src/style.css`**: full-window canvas styling.
* **`src/shader.wgsl`**:

  * reads `u.mvp` uniform matrix,
  * transforms vertex position with `u.mvp * vec4(position,1)`,
  * passes vertex color to fragment.
* **`src/camera.ts`**:

  * arrow keys = yaw/pitch,
  * WASD = move in XZ plane, Q/E = vertical.
* **`src/math.ts`**:

  * vector ops + matrix constructors.
  * student TODOs for matrix math and transforms.
* **`src/main.ts`**:

  * WebGPU device/context/pipeline creation,
  * depth buffer + resize handling,
  * starter geometry (front face only),
  * per-frame `MVP = P * V * M` upload and draw call.

---

## 4) Important starter settings (so something is visible immediately)

For Starter B, keep these defaults:

1. **Starter face at `z = 0`** (not `z = 1`) in `main.ts`.
2. In render pipeline depth state, use:

   ```ts
   depthCompare: "less-equal"
   ```
3. If debugging visibility, temporarily:

   ```ts
   cullMode: "none"
   ```

   then switch back to `"back"` after full cube is implemented.
4. Implement `mat4.multiply` early. If left as placeholder, camera/projection/model composition won’t work.

---

## 5) Controls

### Camera

* `W/A/S/D`: move on XZ plane
* `Q/E`: move down/up
* `Arrow Left/Right`: yaw
* `Arrow Up/Down`: pitch

### Object transforms

* Translation: `J/L` (x), `U/O` (y), `I/K` (z)
* Rotation: `T/G` (x), `Y/H` (y), `R/F` (z)
* Scale: `X` increase, `Z` decrease
* Order toggles:

  * `1` → `T * R * S`
  * `2` → `R * T * S`
  * `3` → `S * R * T`
* `0` → reset transform state

---

## 6) Student TODOs

### TODO A — Matrix math (`src/math.ts`)

Implement:

* `mat4.multiply(a, b)` (column-major, `out = a * b`)
* `mat4.translation(tx, ty, tz)`
* `mat4.scaling(sx, sy, sz)`
* `mat4.rotationX(rad)`
* `mat4.rotationY(rad)`
* `mat4.rotationZ(rad)`

### TODO B — Geometry (`src/main.ts`)

Start with one red front face, then add remaining cube faces:

* back (`z = -1`)
* left (`x = -1`)
* right (`x = +1`)
* top (`y = +1`)
* bottom (`y = -1`)

Each face = 2 triangles = 6 vertices
Vertex format = `[x, y, z, r, g, b]`

### TODO C — Transform order analysis

Compare visual behavior for:

* `T * R * S`
* `R * T * S`
* `S * R * T`

Capture screenshots and explain the difference (non-commutativity).

---

## 7) Math conventions used in this template

* `Mat4` uses `Float32Array(16)` in **column-major** order.
* Final matrix upload each frame:

  ```txt
  MVP = P * V * M
  ```
* Shader applies:

  ```wgsl
  clipPos = u.mvp * vec4(position, 1.0)
  ```

---

## 8) Minimal expected behavior (checkpoint)

Before full TODO completion, the app should show:

* one **red face** rendered,
* movable camera (WASD + arrows),
* object transforms reacting to keys.

After TODOs, it should show:

* full colored cube,
* working transform composition,
* clear difference between matrix orders.

