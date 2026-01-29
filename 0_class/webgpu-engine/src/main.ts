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
}else{
    console.log("GPU Adapter found:", adapter);
}

// 3. Device: The logical connection to the GPU
const device = await adapter.requestDevice();
console.log("GPU Device acquired:", device);

// Get the canvas element from the HTML
const canvas = document.querySelector("#gfx-main") as HTMLCanvasElement;

// 4. Context: The interface between WebGPU and the HTML Canvas
const context = canvas.getContext("webgpu");
console.log("WebGPU Context acquired:", context);


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


// 5. Configure the Context
const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
console.log("Preferred Canvas Format:", canvasFormat);

context!.configure({
    device: device,
    format: canvasFormat,
    alphaMode: "premultiplied",
});

const shaderCode = `
@vertex
fn vs_main(@builtin(vertex_index) vertexIndex : u32) -> @builtin(position) vec4f {
    // Hardcoded triangle vertices
    var pos = array<vec2f, 3>(
        vec2f( -0.0,  0.5), // Top Center
        vec2f(-0.5, -0.5),  // Bottom Left
        vec2f( 0.5, -0.5),  // Bottom Right
    );
    return vec4f(pos[vertexIndex], 0.0, 1.0);
}

@fragment
fn fs_main() -> @location(0) vec4f {
    return vec4f(1.0, 0.0, 0.0, 1.0);
}
`;

const shaderModule = device.createShaderModule({
    label: "Hardcoded Triangle Shaders",
    code: shaderCode,
});
console.log("Shader Module created:", shaderModule);

// 6. Create the Render Pipeline

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
        targets: [{ format: canvasFormat }],
    },
    primitive: {
        topology: "triangle-list",
    },
});

function render() {
    // 1. Create a Command Encoder to record GPU commands
    const encoder = device.createCommandEncoder();

    // 2. Start a Render Pass (clearing the screen)
    const pass = encoder.beginRenderPass({
        colorAttachments: [{
            view: context!.getCurrentTexture().createView(),
            loadOp: "clear",
            clearValue: { r: 0.0, g: 0.0, b: 0.5, a: 1.0 },//background
            storeOp: "store",
        }]
    });

    //3. Draw the triangle
    pass.setPipeline(pipeline);
    pass.draw(3);
    pass.end();

    //4. Submit commands to the GPU Queue
    device.queue.submit([encoder.finish()]);

    requestAnimationFrame(render);
}

// Start the loop
render();
