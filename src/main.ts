import { RenderState } from "./RenderState.ts";
import { updateBuffers } from "./systems/BufferUpdateSystem.ts";
import { prepareRendering } from "./systems/PrepareRenderSystem.ts";
import { render } from "./systems/RenderSystem.ts";
import { computeTransforms } from "./systems/TransformSystem.ts";
import { animate as animateScene, playAnimation, pauseAnimation, resetAnimation } from "./systems/AnimationSystem.ts";
import { createBuffers } from "./systems/BufferInitSystem.ts";
import { GLTFParser } from "./parsers/GLTFParser.ts";
import { Camera } from "./components/Camera.ts";
import { computeSkins } from "./systems/SkinningSystem.ts";
import { KeyframeAnimations } from "./components/KeyframeAnimation.ts";
import { vec3, quat } from "gl-matrix";
import { Transform, TransformType } from "./components/Transform.ts";
import type { Entity } from "./Entity.ts";
import { isKeyDown, consumeMouseDX, consumeMouseDY } from "./systems/InputSystem.ts";
import { Mesh } from "./components/Mesh.ts";
import { BasicMaterial } from "./data/Material.ts";


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

//---------Load the Dunes---------//
const dunesParser = new GLTFParser();
const dunesContent = await fetch("data/dunes.glb").then((r) => r.arrayBuffer());
await dunesParser.setBinary(new Uint8Array(dunesContent));
const dunesScene = await dunesParser.parseScene(0);
if(!dunesScene) throw Error("Could not load dunes.glb!!!");

for(const entity of dunesScene.entities){
    scene.addEntity(entity);
}

const dunes = scene.getEntityByName('Dunes_tile_1')!;
const dunesTransform = dunes.getComponent(Transform)!;
dunesTransform.scale = vec3.fromValues(0.01, 0.01, 0.01);
dunesTransform.location =vec3.fromValues(0, 0, 0);

// zracuna kje je nad in kje je pod skratka kje se lčahko hodi in kje ne
computeTransforms(scene);

const FLOATS_PER_VERTEX = 14;
const terrainTris: vec3[][] = [];

const dunesMeshEntity = scene.getEntityByName('D_tile_1')!;
const dunesMesh = dunesMeshEntity.getComponent(Mesh)!;
const dunesWorld = dunesMeshEntity.getComponent(Transform)!.worldMatrix;
const dunesPrims = dunesMesh.getPrimitivesByMaterial(BasicMaterial)!;

for (const prim of [dunesPrims[1], dunesPrims[2]]) {   // rocks + sand, no trees
    const v = prim.vertices;
    const idx = prim.indices;
    const toWorld = (i: number) => {
        const p = vec3.fromValues(
            v[i * FLOATS_PER_VERTEX],
            v[i * FLOATS_PER_VERTEX + 1],
            v[i * FLOATS_PER_VERTEX + 2]);
        return vec3.transformMat4(p, p, dunesWorld);
    };
    for (let t = 0; t < idx.length; t += 3) {
        terrainTris.push([toWorld(idx[t]), toWorld(idx[t + 1]), toWorld(idx[t + 2])]);
    }
}

// Height of the terrain at the point (x, z); if there's no terrain there, return 0
function getGroundHeight(x: number, z: number): number {
    let best = -Infinity;
    for (const [a, b, c] of terrainTris) {
        // barycentric coordinates in the XZ plane
        const d = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
        if (d === 0) continue;
        const w1 = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / d;
        const w2 = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / d;
        const w3 = 1 - w1 - w2;
        if (w1 < 0 || w2 < 0 || w3 < 0) continue;      // point is not inside this triangle
        const y = w1 * a[1] + w2 * b[1] + w3 * c[1];    // interpolated height
        if (y > best) best = y;                          // the highest surface wins
    }
    return best === -Infinity ? 0 : best;
}

// ------ Load the man (.glb) ------ //
const manParser = new GLTFParser();
const manBuffer: ArrayBuffer = await fetch("data/man.glb").then((r) => r.arrayBuffer());
await manParser.setBinary(new Uint8Array(manBuffer));
const manScene = await manParser.parseScene(0);
if (!manScene) throw Error("Could not load man.glb!");

for (const entity of manScene.entities) {
    scene.addEntity(entity);
}


const player = scene.getEntityByName('RootNode')!;

if (!player) throw Error("No player 'RootNode' in scene!");
const playerTransform = player.getComponent(Transform)!;
playerTransform.location = vec3.fromValues(0, 0, 0);
playerTransform.scale = vec3.fromValues(0.5, 0.5, 0.5);
let playerYaw = 0;                       // direction he faces (radians)

let cameraPitch = 0.4; /// omejiotve premika kamere
const MIN_PITCH = -0.2;
const MAX_PITCH = 1.3;

const IDLE = 'HumanArmature|Man_Idle';
const WALK = 'HumanArmature|Man_Walk';
const RUN = 'HumanArmature|Man_Run';
const JUMP = "HumanArmature|Man_Jump";

let currentAnim = IDLE;
playAnimation(scene, player, IDLE);

const setAnimation = (name: string) => {
    if(name === currentAnim) return;
    pauseAnimation(scene, player, currentAnim);
    resetAnimation(scene, player, name);
    playAnimation(scene, player, name);
    currentAnim = name;
};

const JUMP_SPEED = 6; //histros skoka gor
const GRAVITY = 15;  // hitrost skoka dol 
//const GROUND_Y = 0 // visina tal
let velocityY = 0 // trenutna hitrost skoka 
let onGround = true; 

const cameraEntity = scene.getEntitiesByComponent(Camera)[0];
const cameraTransform = cameraEntity.getComponent(Transform)!;
cameraTransform.transformType = TransformType.LookAt;   // camera always looks at a target
cameraTransform.up = vec3.fromValues(0, 1, 0);          // glTF is Y-up (default here is Z!)
cameraEntity.getComponent(Camera)!.fovy = Math.PI / 3; // 60°
cameraEntity.getComponent(Camera)!.far = 1000; // far se podalša za 1000 enot


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

// ------ FPS counter ------ //
const fpsElement = document.getElementById('fps');
let fpsFrames = 0;   // frames counted since last update of the text
let fpsTime = 0;     // time passed since last update of the text


function update(timestamp: number) {
    if (!scene) {
        return;
    }


    const dt = (timestamp - lastTime) / 1000;
    lastTime = timestamp;

    // --- FPS ---
    fpsFrames++;
    fpsTime += dt;
    if (fpsTime >= 0.5) {                       // update text twice per second
        const fps = Math.round(fpsFrames / fpsTime);
        if (fpsElement) fpsElement.textContent = `FPS: ${fps}`;
        fpsFrames = 0;
        fpsTime = 0;
    }

    const mouseSensitivity = 0.003;
    playerYaw -= consumeMouseDX() * mouseSensitivity;
    cameraPitch += consumeMouseDY() * mouseSensitivity;
    cameraPitch = Math.max(MIN_PITCH, Math.min(MAX_PITCH, cameraPitch));

    // --- player movement (W/S = forward/back, A/D = turn) ---
    // --- player movement (W/S = forward/back, A/D = sideways) ---

    const isRunning = isKeyDown("ShiftLeft");
    const walkSpeed = 2;
    const runSpeed = 5;
    const moveSpeed = isRunning ? runSpeed : walkSpeed

    const forward = vec3.fromValues(Math.sin(playerYaw), 0, Math.cos(playerYaw));
    const right   = vec3.fromValues(-Math.cos(playerYaw), 0, Math.sin(playerYaw));

    const move = vec3.create();
    if (isKeyDown("KeyW")) vec3.add(move, move, forward);
    if (isKeyDown("KeyS")) vec3.sub(move, move, forward);
    if (isKeyDown("KeyD")) vec3.add(move, move, right);
    if (isKeyDown("KeyA")) vec3.sub(move, move, right);

    const isMoving = vec3.length(move) > 0;

    // horizontalno premikanje 
    if(isMoving){
        vec3.normalize(move, move);
        playerTransform.location = vec3.scaleAndAdd(vec3.create(), playerTransform.location,
        move, moveSpeed * dt);
    }

    // skakanje 
    if(isKeyDown("Space") && onGround){
        velocityY = JUMP_SPEED;
        onGround =false;
    }
    const loc = playerTransform.location;
    const groundY = getGroundHeight(loc[0], loc[2]);

    if (onGround) {
        // walking: feet always on the dune surface
        playerTransform.location = vec3.fromValues(loc[0], groundY, loc[2]);
    } else {
        // in the air: gravity, and landing when he reaches the ground
        velocityY -= GRAVITY * dt;
        let y = loc[1] + velocityY * dt;
        if (y <= groundY) {
            y = groundY;
            velocityY = 0;
            onGround = true;
        }
        playerTransform.location = vec3.fromValues(loc[0], y, loc[2]);
    }

    if(!onGround)                   setAnimation(JUMP);
    else if (isMoving && isRunning) setAnimation(RUN);
    else if (isMoving)              setAnimation(WALK);
    else                            setAnimation(IDLE);



    playerTransform.rotation = quat.setAxisAngle(quat.create(), [0, 1, 0], playerYaw);

    // --- follow camera (behind and above the player) ---
    const camDistance = 4;
    const p = playerTransform.location;
    const target = vec3.fromValues(p[0], p[1] + 1, p[2]);   // his chest

    const horizontal = Math.cos(cameraPitch) * camDistance;  // how far behind
    const vertical   = Math.sin(cameraPitch) * camDistance;  // how high above the chest

    cameraTransform.location = vec3.fromValues(
        target[0] - forward[0] * horizontal,
        target[1] + vertical,
        target[2] - forward[2] * horizontal
    );
    cameraTransform.target = target;

    const camLoc = cameraTransform.location;
    const minY = getGroundHeight(camLoc[0], camLoc[2]) + 0.5;
    if(camLoc[1] < minY){
        cameraTransform.location = vec3.fromValues(camLoc[0], minY, camLoc[2]);
    }

    animateScene(scene, dt);
    computeTransforms(scene);
    computeSkins(scene);
    updateBuffers(renderState, scene);

    render(renderState, scene);

    requestAnimationFrame(update);
}

requestAnimationFrame(update);