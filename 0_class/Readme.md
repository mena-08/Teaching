# Class 1 Demo: WebGPU "Hello World" Setup

**Goal:** Go from an empty folder to a rendered triangle in the browser using a professional development stack.

**Prerequisites:**

* Node.js installed (LTS version recommended).
* VS Code installed.
* "WebGPU" extension for VS Code (optional but recommended for WGSL syntax highlighting).

---

## Part 1: Scaffolding the Project (Terminal)

1. Open **VS Code**.
2. Open the **Integrated Terminal** (`Ctrl` + ```).
3. Run the following commands to scaffold a Vite + TypeScript project:

```bash
# 1. Create the project (follow prompts: Project name -> Framework: Vanilla -> Variant: TypeScript)
npm create vite@latest webgpu_0 -- --template vanilla-ts

# 2. Enter the folder
cd webgpu-engine

# 3. Install dependencies
npm install
npm install --save-dev @webgpu/types

# 4. Start the local dev server immediately to test
npm run dev

```

* *Action:* `Ctrl` + `Click` the Localhost URL in the terminal (e.g., `http://localhost:5173`) to open the browser. You should see the default Vite "Hello World".

---

## Part 2: Cleaning the Canvas

We need a clean slate.

1. Open `index.html`. Replace the content inside `<body>` with a single canvas:
```css
<body>
  <canvas id="gfx-main" width="100vw" height="100vh"></canvas>
  <script type="module" src="/src/main.ts"></script>
</body>
```


2. Open `src/style.css`. Delete everything and replace with basic reset:
```css
body, html {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
}

canvas {
    display: block; /* Removes tiny scrollbar gap at bottom */
    width: 100%;
    height: 100%;
}
```



---

## Part 3: The WebGPU Initialization (`main.ts`)

Open `src/main.ts`. Delete everything and write this code live to explain the steps.

### Step A: Initialization

```typescript
/// <reference types="@webgpu/types" />

// 1. Entry Check
if (!navigator.gpu) {
    alert("WebGPU is not supported in this browser.");
    throw new Error("WebGPU not supported on this browser.");
}else{
    console.log("WebGPU is supported!");
}

// 2. Adapter: Represents the physical GPU
const adapter = await navigator.gpu.requestAdapter();
if (!adapter) {
    throw new Error("No appropriate GPUAdapter found.");
}

// 3. Device: The logical connection to the GPU
const device = await adapter.requestDevice();
console.log("GPU Device acquired:", device);

// Get the canvas element from the HTML
const canvas = document.querySelector("#gfx-main") as HTMLCanvasElement;

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
resizeCanvas();

window.addEventListener('resize', () => {
    resizeCanvas();
    if (context) {
        context.configure({
            device: device,
            format: canvasFormat,
            alphaMode: "premultiplied",
        });
    } else {
        console.error("WebGPU context is null during resize.");
    }
});

// 4. Context: The interface between WebGPU and the HTML Canvas
const context = canvas.getContext("webgpu");
console.log("WebGPU Context acquired:", context);

// 5. Configure the Context
const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
console.log("Preferred Canvas Format:", canvasFormat);

context!.configure({
    device: device,
    format: canvasFormat,
    alphaMode: "premultiplied",
});
```

### Step B: The Shaders (WGSL)

*Note: For this first demo, we hardcode vertices in the shader to skip Buffer complexity.*

```typescript
const shaderCode = `
@vertex
fn vs_main(@builtin(vertex_index) vertexIndex : u32) -> @builtin(position) vec4f {
    // Hardcoded triangle vertices
    var pos = array<vec2f, 3>(
        vec2f( 0.0,  0.5),  // Top Center
        vec2f(-0.5, -0.5),  // Bottom Left
        vec2f( 0.5, -0.5)   // Bottom Right
    );

    return vec4f(pos[vertexIndex], 0.0, 1.0);
}

@fragment
fn fs_main() -> @location(0) vec4f {
    return vec4f(1.0, 0.0, 0.0, 1.0); // Red Color
}
`;

const shaderModule = device.createShaderModule({
    label: "Hardcoded Triangle Shaders",
    code: shaderCode,
});

```

### Step C: The Render Pipeline

Tell the GPU how to interpret the data.

```typescript
const pipeline = device.createRenderPipeline({
    label: "Our First Pipeline",
    layout: "auto",
    vertex: {
        module: shaderModule,
        entryPoint: "vs_main",
    },
    fragment: {
        module: shaderModule,
        entryPoint: "fs_main",
        targets: [{ format: canvasFormat }], // Must match canvas format
    },
    primitive: {
        topology: "triangle-list", // Drawing triangles
    },
});

```

### Step D: The Render Loop

Draw the frame repeatedly.

```typescript
function render() {
    // 1. Create a Command Encoder to record GPU commands
    const encoder = device.createCommandEncoder();

    // 2. Start a Render Pass (clearing the screen)
    const pass = encoder.beginRenderPass({
        colorAttachments: [{
            view: context!.getCurrentTexture().createView(),
            loadOp: "clear",
            clearValue: { r: 0.0, g: 0.0, b: 0.2, a: 1.0 }, // Dark Blue Background
            storeOp: "store",
        }]
    });

    // 3. Draw the triangle
    pass.setPipeline(pipeline);
    pass.draw(3); // Draw 3 vertices
    pass.end();

    // 4. Submit commands to the GPU Queue
    device.queue.submit([encoder.finish()]);

    requestAnimationFrame(render);
}

// Start the loop
render();

```

---

## Part 4: Verification

1. Save `main.ts`.
2. Look at your browser window.
3. You should see a **Red Triangle** on a **Dark Blue Background**.

### Troubleshooting Tips for Class

* **White Screen?** Check the Console (F12) for errors.
* **"WebGPU not supported"?** Ensure they are using Chrome/Edge (latest) or Firefox Nightly.
* **Black Screen?** Ensure `context.configure` matches the `canvasFormat`.

---

**Next Step:** Would you like the detailed breakdown of **Class 2 (Textures & Procedural Art)** including the specific code logic for loading an image into a WebGPU texture?