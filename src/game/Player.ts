import { vec3, quat } from "gl-matrix";
import type { Scene } from "../Scene.ts";
import type { Entity } from "../Entity.ts";
import { Transform } from "../components/Transform.ts";
import { isKeyDown, consumeMouseDX } from "../systems/InputSystem.ts";
import { loadGlb } from "./loadGlb.ts";
import { getGroundHeight, isOnTerrain } from "./Terrain.ts";
import type { Capsule, AABB } from "./Collisions.ts";
import { aabbVsAabb, pushOutXZ } from "./Collisions.ts";
import { getObstacles } from "./Obstacles.ts";
// ------ Nastavitve ------ //

const WALK_SPEED = 15;
const TURN_SPEED = 5;
const RUN_SPEED = 25;
const JUMP_SPEED = 25;          // hitrost skoka gor
const GRAVITY = 50;            // kako hitro pade nazaj dol
const MAX_SLOPE_DEG = 35; // najbolj strmo kar lahko prehodi 
const MAX_SLOPE= Math.tan(MAX_SLOPE_DEG * Math.PI / 180);
const PROBE = 0.5 // koliko naprej merimo 
const PLAYER_RADIUS = 0.9;
const PLAYER_HEIGHT = 2.5;

// ------ Stanje igralca (samo za to datoteko) ------ //
let scene: Scene;
let player: Entity;
let playerTransform: Transform;
let yaw = 0;                   // smer, v katero gleda (radiani)
let velocityY = 0;             // trenutna hitrost skoka
let onGround = true;

// Naloži možička in ga postavi na začetek
export async function loadPlayer(s: Scene){
    scene = s;
    const entities = await loadGlb("data/dino.gltf", scene);

    const root = entities.find((e) => e.parent === null);

    if(!root) throw Error("dino.gltf has no root object");
    player = root;

    playerTransform = player.getComponent(Transform)!;
    playerTransform.location = vec3.fromValues(0, 0, 0);
    playerTransform.scale = vec3.fromValues(1,1,1);
}



function tooSteep(fromX: number, fromZ: number, toX: number, toZ:number): boolean {
    const dx = toX - fromX;
    const dz = toZ - fromZ;
    const dist = Math.hypot(dx, dz);
    if(dist === 0) return false;  // ne premika se ni klanca

    const aheadX = fromX + (dx / dist) * PROBE;
    const aheadZ = fromZ + (dz / dist) * PROBE;

    const rise = getGroundHeight(aheadX, aheadZ) - getGroundHeight(fromX,fromZ)
    return rise/PROBE > MAX_SLOPE;
}

// Pokliče se vsako sličico: miška, gibanje, skok, animacija
export function updatePlayer(dt: number) {
    //-------turning with A/D--------------//
    if(isKeyDown("KeyA")) yaw += TURN_SPEED * dt;
    if(isKeyDown("KeyD")) yaw -= TURN_SPEED * dt;

    //--------speed : Shift = faster ------//
    const isRunning = isKeyDown("ShiftLeft");
    const moveSpeed = isRunning ? RUN_SPEED : WALK_SPEED;

    //-------- always forward in the direction he is facin ------//
    const forward = vec3.fromValues(Math.sin(yaw), 0, Math.cos(yaw));
    const step = moveSpeed * dt;
    const loc = playerTransform.location

    let newX = loc[0] + forward[0] * step;
    let newZ = loc[2] + forward[2] * step;

    //------ X in z preverimo posebej , da drsi ob robu, namesto da se zatakne 
    if(!isOnTerrain(newX, loc[2])) newX = loc[0];
    if(!isOnTerrain(newX, newZ)) newZ = loc[2];

    //----- toSteep korak ne velja

    if(tooSteep(loc[0], loc[2], newX, newZ)){
        newX = loc[0];
        newZ = loc[2];
    }

    playerTransform.location = vec3.fromValues(newX, loc[1], newZ);

        // --- trki z ovirami: AABB proti AABB, odziv = razmik ---
    for (const box of getObstacles()) {
        const me = getPlayerAABB();
        if (aabbVsAabb(me, box)) {
            const [pushX, pushZ] = pushOutXZ(me, box);
            const l = playerTransform.location;
            playerTransform.location = vec3.fromValues(l[0] + pushX, l[1], l[2] + pushZ);
        }
    }

    // --- skakanje in višina tal ---
    if (isKeyDown("Space") && onGround) {
        velocityY = JUMP_SPEED;
        onGround = false;
    }

    const loc2 = playerTransform.location;
    const groundY = getGroundHeight(loc2[0], loc2[2]);

    if (onGround) {
        // hoja: noge vedno na površini dun
        playerTransform.location = vec3.fromValues(loc2[0], groundY, loc2[2]);
    } else {
        // v zraku: gravitacija in pristanek, ko doseže tla
        velocityY -= GRAVITY * dt;
        let y = loc[1] + velocityY * dt;
        if (y <= groundY) {
            y = groundY;
            velocityY = 0;
            onGround = true;
        }
        playerTransform.location = vec3.fromValues(loc2[0], y, loc2[2]);
    }
    playerTransform.rotation = quat.setAxisAngle(quat.create(), [0, 1, 0], yaw - Math.PI/2);
}

// Kamera rabi te podatke, da ve, kam naj gleda
export function getPlayerPosition() {
    return playerTransform.location;
}

export function getPlayerYaw() {
    return yaw;
}

export function getPlayerCapsule(): Capsule {
    const p = playerTransform.location;
    return{
        x: p[0],
        z: p[2],
        bottomY: p[1] + PLAYER_RADIUS,
        topY: p[1] + PLAYER_HEIGHT - PLAYER_RADIUS,
        radius: PLAYER_RADIUS
    }
}

// AABB igralca: škatla okoli njegove kapsule
function getPlayerAABB(): AABB {
    const p = playerTransform.location;
    return {
        min: vec3.fromValues(p[0] - PLAYER_RADIUS, p[1],                 p[2] - PLAYER_RADIUS),
        max: vec3.fromValues(p[0] + PLAYER_RADIUS, p[1] + PLAYER_HEIGHT, p[2] + PLAYER_RADIUS),
    };
}