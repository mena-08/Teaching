@vertex
fn vs_main(
    @builtin(vertex_index) vid : u32   // Built-in input from the GPU
) -> @builtin(position) vec4f {        // Built-in output to the pipeline

    // We compute the vertex position in clip space
    let positions = array<vec2f, 3>(
        vec2f( 0.0,  0.5),
        vec2f(-0.5, -0.5),
        vec2f( 0.5, -0.5)
    );

    return vec4f(positions[vid], 0.0, 1.0);
}


@fragment
fn fs_main() -> @location(0) vec4f {   // Output color for one pixel
    return vec4f(1.0, 0.0, 0.0, 1.0);  // RGBA
}