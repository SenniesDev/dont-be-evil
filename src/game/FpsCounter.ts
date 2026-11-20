const fpsElement = document.getElementById('fps');
let fpsFrames = 0;   // frames since the last text update
let fpsTime = 0;     // time since the last text update

// Called every frame; updates the text twice per second
export function updateFps(dt: number) {
    fpsFrames++;
    fpsTime += dt;
    if (fpsTime >= 0.5) {
        const fps = Math.round(fpsFrames / fpsTime);
        if (fpsElement) fpsElement.textContent = `FPS: ${fps}`;
        fpsFrames = 0;
        fpsTime = 0;
    }
}