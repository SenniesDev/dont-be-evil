import { vec3, quat } from "gl-matrix";
import type { Scene } from "../Scene.ts";
import type { Entity } from "../Entity.ts";
import { Transform } from "../components/Transform.ts";
import { playAnimation, pauseAnimation, resetAnimation } from "../systems/AnimationSystem.ts";
import { isKeyDown, consumeMouseDX } from "../systems/InputSystem.ts";
import { loadGlb } from "./loadGlb.ts";
import { getGroundHeight, isOnTerrain } from "./Terrain.ts";

// ------ Nastavitve ------ //
const IDLE = 'HumanArmature|Man_Idle';
const WALK = 'HumanArmature|Man_Walk';
const RUN  = 'HumanArmature|Man_Run';
const JUMP = 'HumanArmature|Man_Jump';

const WALK_SPEED = 5;
const RUN_SPEED = 10;
const JUMP_SPEED = 6;          // hitrost skoka gor
const GRAVITY =10;            // kako hitro pade nazaj dol
const MOUSE_SENSITIVITY = 0.003;

// ------ Stanje igralca (samo za to datoteko) ------ //
let scene: Scene;
let player: Entity;
let playerTransform: Transform;
let yaw = 0;                   // smer, v katero gleda (radiani)
let velocityY = 0;             // trenutna hitrost skoka
let onGround = true;
let currentAnim = IDLE;

// Naloži možička in ga postavi na začetek
export async function loadPlayer(s: Scene) {
    scene = s;
    await loadGlb("data/man.glb", scene);

    const root = scene.getEntityByName('RootNode');
    if (!root) throw Error("No player 'RootNode' in scene!");
    player = root;

    playerTransform = player.getComponent(Transform)!;
    playerTransform.location = vec3.fromValues(0, 0, 0);
    playerTransform.scale = vec3.fromValues(0.5, 0.5, 0.5);

    playAnimation(scene, player, IDLE);
}

function setAnimation(name: string) {
    if (name === currentAnim) return;
    pauseAnimation(scene, player, currentAnim);
    resetAnimation(scene, player, name);
    playAnimation(scene, player, name);
    currentAnim = name;
}

// Pokliče se vsako sličico: miška, gibanje, skok, animacija
export function updatePlayer(dt: number) {
    // --- obračanje z miško (levo/desno) ---
    yaw -= consumeMouseDX() * MOUSE_SENSITIVITY;

    // --- smer premikanja ---
    const isRunning = isKeyDown("ShiftLeft");
    const moveSpeed = isRunning ? RUN_SPEED : WALK_SPEED;

    const forward = vec3.fromValues(Math.sin(yaw), 0, Math.cos(yaw));
    const right   = vec3.fromValues(-Math.cos(yaw), 0, Math.sin(yaw));

    const move = vec3.create();
    if (isKeyDown("KeyW")) vec3.add(move, move, forward);
    if (isKeyDown("KeyS")) vec3.sub(move, move, forward);
    if (isKeyDown("KeyD")) vec3.add(move, move, right);
    if (isKeyDown("KeyA")) vec3.sub(move, move, right);

    const isMoving = vec3.length(move) > 0;

    // --- horizontalno premikanje (samo po dunah) ---
    if (isMoving) {
        vec3.normalize(move, move);
        const step = moveSpeed * dt;
        const loc = playerTransform.location;

        let newX = loc[0] + move[0] * step;
        let newZ = loc[2] + move[2] * step;

        // X in Z preverimo posebej, da drsi ob robu, namesto da se zatakne
        if (!isOnTerrain(newX, loc[2])) newX = loc[0];
        if (!isOnTerrain(newX, newZ))   newZ = loc[2];

        playerTransform.location = vec3.fromValues(newX, loc[1], newZ);
    }

    // --- skakanje in višina tal ---
    if (isKeyDown("Space") && onGround) {
        velocityY = JUMP_SPEED;
        onGround = false;
    }

    const loc = playerTransform.location;
    const groundY = getGroundHeight(loc[0], loc[2]);

    if (onGround) {
        // hoja: noge vedno na površini dun
        playerTransform.location = vec3.fromValues(loc[0], groundY, loc[2]);
    } else {
        // v zraku: gravitacija in pristanek, ko doseže tla
        velocityY -= GRAVITY * dt;
        let y = loc[1] + velocityY * dt;
        if (y <= groundY) {
            y = groundY;
            velocityY = 0;
            onGround = true;
        }
        playerTransform.location = vec3.fromValues(loc[0], y, loc[2]);
    }

    // --- animacija ---
    if (!onGround)                  setAnimation(JUMP);
    else if (isMoving && isRunning) setAnimation(RUN);
    else if (isMoving)              setAnimation(WALK);
    else                            setAnimation(IDLE);

    playerTransform.rotation = quat.setAxisAngle(quat.create(), [0, 1, 0], yaw);
}

// Kamera rabi te podatke, da ve, kam naj gleda
export function getPlayerPosition() {
    return playerTransform.location;
}

export function getPlayerYaw() {
    return yaw;
}