class Cube {
  constructor(x = 0, y = 0, z = 0, xw = 0.2, yw = 0.2, zw = 0.2) {
    this.x = x;
    this.y = y;
    this.z = z + 0.5;
    this.xw = xw;
    this.yw = yw;
    this.zw = zw;
    this.vertices = [
      { x: x + xw, y: y + yw, z: z + zw + 0.5 },
      { x: x - xw, y: y + yw, z: z + zw + 0.5 },
      { x: x + xw, y: y - yw, z: z + zw + 0.5 },
      { x: x - xw, y: y - yw, z: z + zw + 0.5 },
      { x: x + xw, y: y + yw, z: z - zw + 0.5 },
      { x: x - xw, y: y + yw, z: z - zw + 0.5 },
      { x: x + xw, y: y - yw, z: z - zw + 0.5 },
      { x: x - xw, y: y - yw, z: z - zw + 0.5 }];
  }
  rotate(xa = 0, ya = 0, za = 0) {
    const cosX = Math.cos(xa), sinX = Math.sin(xa);
    const cosY = Math.cos(ya), sinY = Math.sin(ya);
    const cosZ = Math.cos(za), sinZ = Math.sin(za);


    for (let v of this.vertices) {
      // Translate the vertex to the origin by subtracting the center
      let tx = v.x - this.x;
      let ty = v.y - this.y;
      let tz = v.z - this.z;

      // Apply rotation around X-axis
      let y = ty * cosX - tz * sinX;
      let z = ty * sinX + tz * cosX;
      ty = y;
      tz = z;


      // Apply rotation around Y-axis
      let x = tx * cosY + tz * sinY;
      z = -tx * sinY + tz * cosY;
      tx = x;
      tz = z;

      // Apply rotation around Z-axis
      x = tx * cosZ - ty * sinZ;
      y = tx * sinZ + ty * cosZ;

      // Translate the vertex back to its original position
      v.x = x + this.x;
      v.y = y + this.y;
      v.z = z + this.z;
    }
  }
  getVertices() {
    const indices = [
      0, 1, 2, 1, 2, 3,  // Front face
      4, 5, 6, 5, 6, 7,  // Back face
      1, 5, 7, 1, 7, 3,  // Left face
      0, 4, 6, 0, 6, 2,  // Right face
      0, 1, 5, 0, 5, 4,  // Top face
      2, 3, 7, 2, 7, 6   // Bottom face
    ];

    let vertexArray = [];
    for (let i of indices) {
      vertexArray.push(this.vertices[i].x, this.vertices[i].y, this.vertices[i].z);
    }

    return new Float32Array(vertexArray);
  }
  getEdges() {
    const edges = [
      0, 1, 0, 2, 2, 3, 3, 1, // Front edges  
      4, 5, 5, 7, 6, 7, 6, 4, // Back edges
      0, 4, 1, 5, 2, 6, 3, 7 // Connecting edges
    ];

    let edgeArray = [];
    for (let i of edges) {
      edgeArray.push(this.vertices[i].x, this.vertices[i].y, this.vertices[i].z);
    }

    return new Float32Array(edgeArray);
  }
}


async function initWebGPU() {
  if (!navigator.gpu) {//browser doesnt support WebGPU
    throw new Error("WebGPU not supported on this browser.");
  }


  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {//hardware doesn't support WebGPU
    throw new Error("No appropriate GPUAdapter found.");
  }
  const canvas = document.getElementById("canvas"); // canvas element from html
  const device = await adapter.requestDevice();
  const context = canvas.getContext("webgpu");
  const canvasFormat = navigator.gpu.getPreferredCanvasFormat();//format is the actual data format used for the best results in the gpu
  context.configure({
    device: device,
    format: canvasFormat,
  });

  const cube = new Cube()
  cube.rotate(Math.PI / 4, Math.PI / 3, Math.PI / 4)


  // Create the buffers once
  const vertexBuffer = createVertexBuffer(device, cube.getVertices());
  const edgeBuffer = createEdgeBuffer(device, cube.getEdges());

  // Set up pipelines
  const cellShaderModule = createCellShaderModule(device);
  const edgeShaderModule = createEdgeShaderModule(device);
  const cellPipeline = createCellPipeline(device, canvasFormat, cellShaderModule);
  const edgePipeline = createEdgePipeline(device, canvasFormat, edgeShaderModule);

  setInterval((cube, device, context, vertexBuffer, edgeBuffer, cellPipeline, edgePipeline) => {
    cube.rotate(0, Math.PI / 10)
    // Call renderCube to actually render it on the canvas
    device.queue.writeBuffer(vertexBuffer, 0, cube.getVertices());
    device.queue.writeBuffer(edgeBuffer, 0, cube.getEdges());
    renderCube(device, context, vertexBuffer, edgeBuffer, cellPipeline, edgePipeline, cube.getVertices(), cube.getEdges());
  }, 100, cube, device, context, vertexBuffer, edgeBuffer, cellPipeline, edgePipeline);

}


// Function to create and return the vertex buffer
function createVertexBuffer(device, vertices) {
  const vertexBuffer = device.createBuffer({//creates a buffer (memory gpu can access)
    label: "Cell vertices",// give it name, good for error messages
    size: vertices.byteLength,// set the size of the buffer, very important as its immutable
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,// sets the useage flags | means both flags are active so its used for both
  });
  device.queue.writeBuffer(vertexBuffer, 0, vertices);
  return vertexBuffer;
}

// Function to create and return the edge buffer
function createEdgeBuffer(device, edges) {
  const edgeBuffer = device.createBuffer({
    label: "Edge vertices",
    size: edges.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(edgeBuffer, 0, edges);
  return edgeBuffer;
}

// Function to create the cell shader module
function createCellShaderModule(device) {
  return device.createShaderModule({
    label: "Cell shader",
    code: `
      @vertex
      fn vertexMain(@location(0) pos: vec3f) -> @builtin(position) vec4f {
        return vec4f(pos, 1);
      }
      @fragment
      fn fragmentMain() -> @location(0) vec4f {
        return vec4f(.74, 0.14, 0, 1); // (Red, Green, Blue, Alpha)
      }
    `
  });
}

// Function to create the edge shader module
function createEdgeShaderModule(device) {
  return device.createShaderModule({
    label: "Edge shader",
    code: `
      @vertex
      fn vertexMain(@location(0) pos: vec3f) -> @builtin(position) vec4f {
        return vec4f(pos, 1);
      }
      @fragment
      fn fragmentMain() -> @location(0) vec4f {
        return vec4f(0, 0, 0, 1); // Black for the outline
      }
    `
  });
}

// Function to create the cell render pipeline
function createCellPipeline(device, canvasFormat, cellShaderModule) {
  return device.createRenderPipeline({
    label: "Cell pipeline",
    layout: "auto",
    vertex: {
      module: cellShaderModule,
      entryPoint: "vertexMain",
      buffers: [{
        arrayStride: 12,
        attributes: [{
          format: "float32x3",
          offset: 0,
          shaderLocation: 0,
        }]
      }]
    },
    fragment: {
      module: cellShaderModule,
      entryPoint: "fragmentMain",
      targets: [{ format: canvasFormat }]
    }
  });
}

// Function to create the edge render pipeline
function createEdgePipeline(device, canvasFormat, edgeShaderModule) {
  return device.createRenderPipeline({//controls data and shaders to create the geometry and such
    label: "Edge pipeline",//name
    layout: "auto",
    primitive: {
      topology: "line-list",//means it draws lines instead of triangles
    },
    vertex: {//controls data and shaders to create the geometry and such
      module: edgeShaderModule,
      entryPoint: "vertexMain",
      buffers: [{//buffer layout -> layout of that data in the buffer to tell the gpu how to read it
        arrayStride: 12, //how many points of data to skip for each data point (3d point in this case) so float (4)*3(cause its 3d)
        attributes: [{ //a list of attributes in this case there is only a point so its much simpler, but it can be used to give it a direction vector or color too
          format: "float32x3", //vec3<f32> the data type
          offset: 0,//offset from the start of the datapoint, in this case its 0 cause there is no additional data
          shaderLocation: 0,// Position, see vertex shader (value is between 0 and 15)
        }]
      }]
    },
    fragment: {
      module: edgeShaderModule,
      entryPoint: "fragmentMain",
      targets: [{ format: canvasFormat }]
    }
  });
}

// Function that actually performs the render operation
function renderCube(device, context, vertexBuffer, edgeBuffer, cellPipeline, edgePipeline, vertices, edges) {
  const encoder = device.createCommandEncoder();//used to record commands to the gpu
  const pass = encoder.beginRenderPass({//every pass starts with this
    colorAttachments: [{
      view: context.getCurrentTexture().createView(),//returns a texture with a pixel width and height matching the canvas's width and height attributes and format
      loadOp: "clear", //clears previously drawn stuff if i understand right
      clearValue: { r: 0.16, g: 0, b: 0.31, a: 1 },//the color in which it clears
      storeOp: "store",//not sure
    }],
  });

  // Render cube faces
  pass.setPipeline(cellPipeline);
  pass.setVertexBuffer(0, vertexBuffer);
  pass.draw(vertices.length / 3);  // 6 vertices for cube faces

  // Render edges (outline)
  pass.setPipeline(edgePipeline);
  pass.setVertexBuffer(0, edgeBuffer);
  pass.draw(edges.length / 3);  // Number of lines (edges)

  pass.end();
  const commandBuffer = encoder.finish();//basically a record of the commmands and is used to send to the gpu
  device.queue.submit([commandBuffer]);//sends the buffer to the queue
  device.queue.submit([encoder.finish()]);//activates the queue i think?

  console.log("Rendering completed");
}

function show() {
}

window.addEventListener("load", initWebGPU);
