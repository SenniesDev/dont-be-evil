import { vec3 } from "gl-matrix";
import type { Scene } from "../Scene.ts";
import { Camera } from "../components/Camera.ts";
import { Transform, TransformType } from "../components/Transform.ts";
import { consumeMouseDY } from "../systems/InputSystem.ts";
import { getGroundHeight } from "./Terrain.ts";
import { getPlayerPosition, getPlayerYaw } from "./Player.ts";

// ------ Nastavitve ------ //
const CAM_DISTANCE = 4;            // razdalja kamere od igralca
const CHEST_HEIGHT = 1;            // kamera gleda v prsi, ne v noge
const MIN_PITCH = -0.2;            // malo pod igralcem
const MAX_PITCH = 1.3;             // skoraj od zgoraj (~75°)
const MIN_ABOVE_GROUND = 0.5;      // kamera ne gre v dune
const MOUSE_SENSITIVITY = 0.003;

// ------ Stanje kamere (samo za to datoteko) ------ //
let cameraTransform: Transform;
let pitch = 0.4;                   // kot kamere nad obzorjem (radiani)

// Poišče kamero v sceni in jo nastavi
export function setupCamera(scene: Scene) {
    const cameraEntity = scene.getEntitiesByComponent(Camera)[0];
    if (!cameraEntity) throw Error("No camera in scene!");

    cameraTransform = cameraEntity.getComponent(Transform)!;
    cameraTransform.transformType = TransformType.LookAt;   // kamera vedno gleda v tarčo
    cameraTransform.up = vec3.fromValues(0, 1, 0);          // glTF je Y-up

    const camera = cameraEntity.getComponent(Camera)!;
    camera.fovy = Math.PI / 3;     // 60°
    camera.far = 1000;             // vidi do 1000 enot daleč
}

// Pokliče se vsako sličico, PO updatePlayer
export function updateCamera() {
    // --- miška gor/dol ---
    pitch += consumeMouseDY() * MOUSE_SENSITIVITY;
    pitch = Math.max(MIN_PITCH, Math.min(MAX_PITCH, pitch));

    // --- kam gleda igralec ---
    const yaw = getPlayerYaw();
    const forward = vec3.fromValues(Math.sin(yaw), 0, Math.cos(yaw));

    // --- kamera na krogli okoli igralca ---
    const p = getPlayerPosition();
    const target = vec3.fromValues(p[0], p[1] + CHEST_HEIGHT, p[2]);

    const horizontal = Math.cos(pitch) * CAM_DISTANCE;   // kako daleč zadaj
    const vertical   = Math.sin(pitch) * CAM_DISTANCE;   // kako visoko nad prsmi

    let camX = target[0] - forward[0] * horizontal;
    let camY = target[1] + vertical;
    let camZ = target[2] - forward[2] * horizontal;

    // --- kamera ne sme v dune ---
    const minY = getGroundHeight(camX, camZ) + MIN_ABOVE_GROUND;
    if (camY < minY) camY = minY;

    cameraTransform.location = vec3.fromValues(camX, camY, camZ);
    cameraTransform.target = target;
}