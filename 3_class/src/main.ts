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

/**
 * Vertex format: [x,y,z, r,g,b]
 *only FRONT face (z = +1), red
 * TODO-7: add the other 5 faces:
 *   back (z=-1), left (x=-1), right (x=+1), top (y=+1), bottom (y=-1)
 * Each face = 2 triangles = 6 vertices
 */
const vertices = new Float32Array([
  -1, -1,  0,   1, 0, 0,
   1, -1,  0,   1, 0, 0,
   1,  1,  0,   1, 0, 0,

  -1, -1,  0,   1, 0, 0,
   1,  1,  0,   1, 0, 0,
  -1,  1,  0,   1, 0, 0,
]);


const vertexBuffer = device.createBuffer({
  size: vertices.byteLength,
  usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
});
device.queue.writeBuffer(vertexBuffer, 0, vertices);

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
    buffers: [{
      arrayStride: 6 * 4,
      attributes: [
        { shaderLocation: 0, offset: 0,     format: "float32x3" }, // position
        { shaderLocation: 1, offset: 3 * 4, format: "float32x3" }, // color
      ],
    }],
  },
  fragment: {
    module: shader,
    entryPoint: "fs_main",
    targets: [{ format }],
  },
  primitive: {
    topology: "triangle-list",
    cullMode: "back",
  },
  depthStencil: {
    format: "depth24plus",
    depthWriteEnabled: true,
    depthCompare: "less-equal",
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

type ModelOrder = "TRS" | "RTS" | "SRT";
const modelState = {
  tx: 0, ty: 0, tz: 0,
  rx: 0, ry: 0, rz: 0,
  s: 1,
  order: "TRS" as ModelOrder,
};

function updateModelState(dt: number) {
  const tSpeed = 1.6 * dt;
  const rSpeed = 1.8 * dt;
  const sSpeed = 1.2 * dt;

  // Object translation keys
  if (keys.has("j") || keys.has("J")) modelState.tx -= tSpeed;
  if (keys.has("l") || keys.has("L")) modelState.tx += tSpeed;
  if (keys.has("u") || keys.has("U")) modelState.ty += tSpeed;
  if (keys.has("o") || keys.has("O")) modelState.ty -= tSpeed;
  if (keys.has("i") || keys.has("I")) modelState.tz -= tSpeed;
  if (keys.has("k") || keys.has("K")) modelState.tz += tSpeed;

  // Object rotation keys (manual only, no time-based animation)
  if (keys.has("t") || keys.has("T")) modelState.rx += rSpeed;
  if (keys.has("g") || keys.has("G")) modelState.rx -= rSpeed;
  if (keys.has("y") || keys.has("Y")) modelState.ry += rSpeed;
  if (keys.has("h") || keys.has("H")) modelState.ry -= rSpeed;
  if (keys.has("r") || keys.has("R")) modelState.rz += rSpeed;
  if (keys.has("f") || keys.has("F")) modelState.rz -= rSpeed;

  // Uniform scale
  if (keys.has("x") || keys.has("X")) modelState.s += sSpeed;
  if (keys.has("z") || keys.has("Z")) modelState.s = Math.max(0.1, modelState.s - sSpeed);

  // Order toggles
  if (keys.has("1")) modelState.order = "TRS";
  if (keys.has("2")) modelState.order = "RTS";
  if (keys.has("3")) modelState.order = "SRT";

  // Reset
  if (keys.has("0")) {
    modelState.tx = modelState.ty = modelState.tz = 0;
    modelState.rx = modelState.ry = modelState.rz = 0;
    modelState.s = 1;
    modelState.order = "TRS";
  }
}

function buildModelMatrix() {
  const T = mat4.translation(modelState.tx, modelState.ty, modelState.tz);
  const S = mat4.scaling(modelState.s, modelState.s, modelState.s);

  const Rx = mat4.rotationX(modelState.rx);
  const Ry = mat4.rotationY(modelState.ry);
  const Rz = mat4.rotationZ(modelState.rz);

  // TODO-8: verify and explain this rotation composition
  const R = mat4.multiply(Rz, mat4.multiply(Ry, Rx));

  // TODO-9: test and explain why order matters
  switch (modelState.order) {
    case "TRS": return mat4.multiply(T, mat4.multiply(R, S));
    case "RTS": return mat4.multiply(R, mat4.multiply(T, S));
    case "SRT": return mat4.multiply(S, mat4.multiply(R, T));
  }
}

let lastTime = performance.now();

function frame(now: number) {
  const dt = Math.min(0.033, (now - lastTime) / 1000);
  lastTime = now;

  camera.update(keys, dt);
  updateModelState(dt);

  const aspect = canvas.width / canvas.height;
  const proj = mat4.perspective((60 * Math.PI) / 180, aspect, 0.1, 100.0);
  const view = camera.getViewMatrix();
  const model = buildModelMatrix();

  const vp = mat4.multiply(proj, view);
  const mvp = mat4.multiply(vp, model);

  device.queue.writeBuffer(uniformBuffer, 0, mvp);

  const encoder = device.createCommandEncoder();
  const pass = encoder.beginRenderPass({
    colorAttachments: [{
      view: context.getCurrentTexture().createView(),
      clearValue: { r: 0.06, g: 0.08, b: 0.12, a: 1.0 },
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
  pass.setVertexBuffer(0, vertexBuffer);

  // draw current vertex count
  pass.draw(vertices.length / 6);

  pass.end();
  device.queue.submit([encoder.finish()]);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
