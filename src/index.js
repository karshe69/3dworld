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
    this.faceBuffers = []
    this.edgeBuffers = []
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
  getEdges() {
    const indices = [
      [0, 1], [0, 2], [2, 3], [3, 1], // Front edges  
      [4, 5], [5, 7], [6, 7], [6, 4], // Back edges
      [0, 4], [1, 5], [2, 6], [3, 7] // Connecting edges
    ];

    let vertexArray = [];
    for (let i = 0; i < indices.length; i++) {
      vertexArray.push([])
      for (let j of indices[i]) {
        vertexArray[i].push(this.vertices[j].x, this.vertices[j].y, this.vertices[j].z);
      }
      vertexArray[i] = new Float32Array(vertexArray[i])
    }
    return vertexArray;
  }
  getFaces() {
    const indices = [
      [0, 1, 2, 1, 2, 3],  // Front face
      [4, 5, 6, 5, 6, 7],  // Back face
      [1, 5, 7, 1, 7, 3],  // Left face
      [0, 4, 6, 0, 6, 2],  // Right face
      [0, 1, 5, 0, 5, 4],  // Top face
      [2, 3, 7, 2, 7, 6]   // Bottom face
    ];

    let vertexArray = [];
    for (let i = 0; i < indices.length; i++) {
      vertexArray.push([])
      for (let j of indices[i]) {
        vertexArray[i].push(this.vertices[j].x, this.vertices[j].y, this.vertices[j].z);
      }
      vertexArray[i] = new Float32Array(vertexArray[i])
    }
    return vertexArray;
  }
  initiateFaceForRender(device, canvasFormat) {
    const faceShaderModule = createFaceShaderModule(device);
    let faces = this.getFaces()
    this.facePipeline = createPipeline(device, canvasFormat, faceShaderModule, "face pipeline",)
    for (let i = 0; i < faces.length; i++) {
      this.faceBuffers.push(createBuffer(device, faces[i], "Face vertices" + i))
    }
  }
  initiateEdgeForRender(device, canvasFormat) {
    const edgeShaderModule = createEdgeShaderModule(device);
    let edges = this.getEdges()
    this.edgePipeline = createPipeline(device, canvasFormat, edgeShaderModule, "Edge pipeline", "line-list");
    for (let i = 0; i < edges.length; i++) {
      this.edgeBuffers.push(createBuffer(device, edges[i], "edge vertices" + i))
    }
  }
  faceRender(device) {
    let toRenderArray = []
    let faces = this.getFaces()
    for (let i = 0; i < this.faceBuffers.length; i++) {
      device.queue.writeBuffer(this.faceBuffers[i], 0, faces[i]);
      toRenderArray.push([this.faceBuffers[i], 6, this.facePipeline])
    }
    return toRenderArray
  }
  edgeRender(device) {
    let toRenderArray = []
    let edges = this.getEdges()
    for (let i = 0; i < this.edgeBuffers.length; i++) {
      device.queue.writeBuffer(this.edgeBuffers[i], 0, edges[i]);
      toRenderArray.push([this.edgeBuffers[i], 2, this.edgePipeline])
    }
    return toRenderArray
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
  cube.rotate(Math.PI / 4, Math.PI / 5, Math.PI / 4)
  const cube2 = new Cube(0, 0, 0, 0.1, 0.1, 0.1)
  cube2.initiateFaceForRender(device, canvasFormat)
  cube2.initiateEdgeForRender(device, canvasFormat)


  // Set up both pipelines and buffers for both faces and edges of the cube
  cube.initiateFaceForRender(device, canvasFormat)
  cube.initiateEdgeForRender(device, canvasFormat)
  const toRender = []//1: buffer, 2: amount of vertices, 3: pipeline

  setInterval((device, context, toRender, cube, cube2) => {
    cube.rotate(Math.PI / 1000, Math.PI / 300, Math.PI / 950)
    cube2.rotate(Math.PI / 1000, Math.PI / 300, Math.PI / 950)
    toRender.push(...cube.faceRender(device))
    toRender.push(...cube2.faceRender(device))
    toRender.push(...cube.edgeRender(device))
    toRender.push(...cube2.edgeRender(device))
    // Call render to actually render it on the canvas
    render(device, context, toRender);
  }, 10, device, context, toRender, cube, cube2);

}

// Function to create and return the buffer
function createBuffer(device, vertices, name) {
  const vertexBuffer = device.createBuffer({//creates a buffer (memory gpu can access)
    label: name,// give it name, good for error messages
    size: vertices.byteLength,// set the size of the buffer, very important as its immutable
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,// sets the useage flags | means both flags are active so its used for both
  });
  device.queue.writeBuffer(vertexBuffer, 0, vertices);
  return vertexBuffer;
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
        return vec4f(0.40, 0.60, 0.70, 1); // Black for the outline
      }
    `
  });
}

// Function to create the cell shader module
function createFaceShaderModule(device) {
  return device.createShaderModule({
    label: "Cell shader",
    code: `
      @vertex
      fn vertexMain(@location(0) pos: vec3f) -> @builtin(position) vec4f {
        return vec4f(pos, 1);
      }
      @fragment
      fn fragmentMain() -> @location(0) vec4f {
        return vec4f(.74, 0.24, 0.5, 1); // (Red, Green, Blue, Alpha)
      }
    `
  });
}

// Function to create a render pipeline
function createPipeline(device, canvasFormat, shaderModule, name, topology = "triangle-list") {
  return device.createRenderPipeline({//controls data and shaders to create the geometry and such
    label: name,//name
    layout: "auto",
    primitive: {
      topology: topology,//means it draws lines instead of triangles
    },
    vertex: {//controls data and shaders to create the geometry and such
      module: shaderModule,
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
      module: shaderModule,
      entryPoint: "fragmentMain",
      targets: [{ format: canvasFormat }]
    }
  });
}

// Function that actually performs the render operation
function render(device, context, toRender) {
  const encoder = device.createCommandEncoder();//used to record commands to the gpu
  const pass = encoder.beginRenderPass({//every pass starts with this
    colorAttachments: [{
      view: context.getCurrentTexture().createView(),//returns a texture with a pixel width and height matching the canvas's width and height attributes and format
      loadOp: "clear", //clears previously drawn stuff if i understand right
      clearValue: { r: 0.16, g: 0, b: 0.31, a: 1 },//the color in which it clears
      storeOp: "store",//not sure
    }],
  });

  //render everything thats been committed to the toRender Array!!
  let currentRender
  while (toRender.length > 0) {
    currentRender = toRender.shift()
    pass.setPipeline(currentRender[2])
    pass.setVertexBuffer(0, currentRender[0])
    pass.draw(currentRender[1]); // 6 vertices for
  }

  pass.end();
  const commandBuffer = encoder.finish();//basically a record of the commmands and is used to send to the gpu
  device.queue.submit([commandBuffer]);//sends the buffer to the queue
  device.queue.submit([encoder.finish()]);//activates the queue i think?

  console.log("Rendering completed");
}

window.addEventListener("load", initWebGPU);
