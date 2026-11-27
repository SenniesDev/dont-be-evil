import { RenderState } from "./RenderState.ts";
import { updateBuffers } from "./systems/BufferUpdateSystem.ts";
import { prepareRendering } from "./systems/PrepareRenderSystem.ts";
import { render } from "./systems/RenderSystem.ts";
import { computeTransforms } from "./systems/TransformSystem.ts";
import { animate as animateScene} from "./systems/AnimationSystem.ts";
import { createBuffers } from "./systems/BufferInitSystem.ts";
import { GLTFParser } from "./parsers/GLTFParser.ts";
import { Camera } from "./components/Camera.ts";
import { computeSkins } from "./systems/SkinningSystem.ts";
import type { Entity } from "./Entity.ts";
import { loadTerrain, getGroundHeight, isOnTerrain } from "./game/Terrain.ts";
import { loadPlayer, updatePlayer, getPlayerPosition, getPlayerYaw, resetPlayer } from "./game/Player.ts";
import { setupCamera, updateCamera } from "./game/CameraController.ts";
import { updateFps } from "./game/FpsCounter.ts";
import { setupStartScreen, isGameStarted } from "./game/StartScreen.ts";
import { loadTokens, updateTokens, resetTokens, allTokensCollected, getCollected, getTotal } from "./game/dataToken.ts";
import { updateTimer, isTimeUp, resetTimer } from "./game/Timer.ts"
import { loadCacti, touchingCactus } from "./game/Cactus.ts";
import { showEndScreen, setupEndScreen, isGameOver } from "./game/EndScreen.ts";
import { setupPopups, updatePopups, isPopupOpen, resetPopups } from "./game/Popups.ts";


// ------ Create sample scene ------ //

const gltfParser = new GLTFParser();
/* const gltfContent = await fetch("data/demo_scene.gltf").then((r) => r.text());
gltfParser.setJson(gltfContent, 'data/');

const scene = await gltfParser.parseScene(0);
if (!scene) {
    throw Error("Could not get GLTF scene!");
}
console.log(scene);
const icosphere = scene.getEntityByName('Icosphere');
if (icosphere) {
    playAnimation(scene, icosphere, 'IkosferaAkcija');
}

const cylinder = scene.getEntityByName('Okostje');
if (cylinder) {
    playAnimation(scene, cylinder, 'OkostjeAkcija')
}*/

const gltfContent = await fetch("data/little_guy.gltf").then((r) => r.text());
gltfParser.setJson(gltfContent, 'data/');
const scene = await gltfParser.parseScene(0);
if (!scene) {
    throw Error("Could not get GLTF scene!");
}
console.log(scene);

// ------ Remove the little guy (keep camera, floor, light) ------ //
const littleGuy = scene.getEntityByName('Okostje');
if (littleGuy) {
    const toRemove = scene.entities.filter((e) => {
        for (let p: Entity | null = e; p; p = p.parent) {
            if (p === littleGuy) return true;
        }
        return false;
    });
    for (const e of toRemove) {
        scene.removeEntity(e);
    }
}
// ------ Remove the old floor from little_guy.gltf ------ //
const oldFloor = scene.getEntityByName('Ravnina.004');
if (oldFloor) scene.removeEntity(oldFloor);

//---------Load the Dunes---------//
await loadTerrain(scene);

//--------Load the tokens--------//

await loadTokens(scene);

await loadCacti(scene);

// ------ Load the man (.glb) ------ //
await loadPlayer(scene);

// ------ Setup the camera ------ //
setupCamera(scene);

// ------ Initalize GPU/Rendering specific interfaces ------ //
if (!navigator.gpu) {
    throw Error("WebGPU not supported in this browser!");
}
const gpuAdapter = await navigator.gpu.requestAdapter();
if (!gpuAdapter) {
    throw Error("Could not get WebGPU adapter!");
}
const gpuDevice = await gpuAdapter.requestDevice();
gpuDevice.addEventListener('uncapturederror', (e) => console.error(e.error.message));
gpuDevice.lost.then((v) => {
    console.error(`GPU device lost: ${v.message} (${v.reason})`);
});

const canvas = document.querySelector('canvas');
if (!canvas) {
    throw Error("Could not find a canvas!");
}
canvas.addEventListener("click", () => canvas.requestPointerLock());

const renderState = new RenderState(gpuDevice, canvas);


// ------ Create and write all buffers ------ //
createBuffers(renderState, scene);


// ------ Prepare pipelines ------ //
await prepareRendering(renderState, scene);


// ------ Events ------ //
function resize() {
    if (!canvas) {
        return;
    }
    let width = canvas.clientWidth;
    let height = canvas.clientHeight;
    if (width === 0 || height === 0) {
        width = 1;
        height = 1;
    }

    let aspect = width / height;

    // Update the camera
    const cameraEntities = scene?.getEntitiesByComponent(Camera) ?? [];
    for (const cameraEntity of cameraEntities) {
        const camera = cameraEntity.getComponent(Camera)!;
        camera.aspect = aspect;
    }
    // Update the rendering textures
    renderState.updateRenderTextureSizes(width, height);
}

window.addEventListener('resize', (_) => resize());
resize();


// ------ Start game loop ------ //
let lastTime = performance.now();

function update(timestamp: number) {
    if (!scene) {
        return;
    }

    const dt = (timestamp - lastTime) / 1000;
    lastTime = timestamp;

    // --- FPS ---
    updateFps(dt);

    // --- igralec ---
    if (isGameStarted() && !isGameOver()) {
        updatePopups(dt);

        if(!isPopupOpen()){
            updatePlayer(dt);
            updateTokens(dt);
        }
        updateTimer(dt);

        const score = `Pobrani žetoni: ${getCollected()} / ${getTotal()}`;

        if (touchingCactus()) {
            showEndScreen(false, `Zaletel si se v kaktus.\n${score}`);
        } else if (isTimeUp()) {
            showEndScreen(false, `Uporabnik se je odjavil in internet je izginil.\nDobil si tožbo za 425 milijonov evrov.\n${score}`);
        } else if (allTokensCollected()) {
            showEndScreen(true, `Zbral si celoten digitalni profil uporabnika.\nGoogle ti je hvaležen.\n${score}`);
        }
    }
    updateCamera();

    // --- animacije ---
    animateScene(scene, dt);
    computeTransforms(scene);
    computeSkins(scene);
    updateBuffers(renderState, scene);

    render(renderState, scene);
    requestAnimationFrame(update);

}

setupStartScreen(canvas);
setupEndScreen(canvas, () => {
    resetPlayer();
    resetTokens();
    resetTimer();
    resetPopups();
});
requestAnimationFrame(update);