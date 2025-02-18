async function initWebGPU() {
    if (!navigator.gpu) {//browser doesnt support WebGPU
        throw new Error("WebGPU not supported on this browser.");
      }


    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {//hardware doesn't support WebGPU
        throw new Error("No appropriate GPUAdapter found.");
      }

    const canvas = document.getElementById("canvas"); // canvas element from html
    const context = canvas.getContext("webgpu");
    const canvasFormat = navigator.gpu.getPreferredCanvasFormat();//format is the actual data format used for the best results in the gpu
    context.configure({
    device: device,
    format: canvasFormat,
    });
}



window.addEventListener("load", initWebGPU);