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

  context!.configure({
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
   1,-1,-1, 1,0,1,   1, 1,-1, 1,0,1,   1, 1, 1, 1,0,1,
   1,-1,-1, 1,0,1,   1, 1, 1, 1,0,1,   1,-1, 1, 1,0,1,
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
   1,-1, 1, 1,0,0,   1, 1, 1, 1,0,0,  -1, 1, 1, 1,0,0,
   1,-1, 1, 1,0,0,  -1, 1, 1, 1,0,0,  -1,-1, 1, 1,0,0,
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


// --- Camera Setup ---
const camera = new Camera();
const keys = new Set<string>();
window.addEventListener("keydown", (e) => keys.add(e.key));
window.addEventListener("keyup", (e) => keys.delete(e.key));
let last = performance.now();

// --- Rendering ---
function frame(now: number) {
  // Camera update and matrices
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  camera.update(keys, dt);
  const aspect = canvas.width / canvas.height;
  const proj = mat4.perspective((60 * Math.PI) / 180, aspect, 0.1, 100.0);
  const view = camera.getViewMatrix();
  // Model matrix (no rotation)
  const model = mat4.scaling(0.8, 0.8, 0.8);
  // MVP matrix
  const vp = mat4.multiply(proj, view);
  const mvp = mat4.multiply(vp, model);
  device.queue.writeBuffer(uniformBuffer, 0, mvp.buffer, mvp.byteOffset, mvp.byteLength);

  // Render pass
  const encoder = device.createCommandEncoder();
  const pass = encoder.beginRenderPass({
    colorAttachments: [{
      view: context!.getCurrentTexture().createView(),
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