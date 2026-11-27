import type { Scene } from "../Scene.ts";
import { Transform } from "../components/Transform.ts";
import { vec3 } from "gl-matrix";
import { isOnTerrain, randomPointOnMap } from "./Terrain.ts";
import { placeModel } from "./Obstacles.ts";
import { getTokens } from "./dataToken.ts";
import { getPlayerAABB } from "./Player.ts";
import { aabbVsAabb } from "./Collisions.ts";
import type { AABB } from "./Collisions.ts";


const CACTUS_MODEL = "data/cactus.gltf";
const CACTUS_SCALE = 0.6;
const NUM_CAC = 60;             // more cacti, because the area is ~25× larger
const MAP_MARGIN = 10;
const MIN_DIST_START = 10;
const MIN_DIST_TOKENS = 6;
const MIN_DIST_CACTI = 15;
const MAX_TRIES = 3000;
const HITBOX_SHRINK = 0.15;               // AABB malo zmanjšamo, da je trk "pošten"

const cacti: AABB[] = [];

export async function loadCacti(scene: Scene){
    const tokenPosition = getTokens().map((t) => t.getComponent(Transform)!.location);
    const placed : [number, number][] = [];

    for(let tries = 0; tries < MAX_TRIES && placed.length < NUM_CAC; tries++){
        const [x, z] = randomPointOnMap(MAP_MARGIN);

        if(!isOnTerrain(x, z)) continue;
        if(Math.hypot(x, z) < MIN_DIST_START) continue;

        if(tokenPosition.some((p) => Math.hypot(p[0] - x, p[2] -z) < MIN_DIST_TOKENS)) continue;
        if(placed.some(([cx, cz]) => Math.hypot(cx - x, cz -z) < MIN_DIST_CACTI)) continue;

        const box = await placeModel(scene, CACTUS_MODEL, x, z, CACTUS_SCALE);
        cacti.push(shrink(box, HITBOX_SHRINK));
        placed.push([x, z]);

    }

    console.log("Placed cacti");
}

// poklice vsako slicico dotik kaktusa = nova igra

// Ali se dino trenutno dotika kateregakoli kaktusa?
export function touchingCactus(): boolean {
    const me = getPlayerAABB();
    for (const box of cacti) {
        if (aabbVsAabb(me, box)) return true;
    }
    return false;
}

//zmanša aabb po x in z na vsaki strani 
function shrink(box: AABB, amount: number) : AABB {
    return{
        min: vec3.fromValues(box.min[0]+ amount, box.min[1], box.min[2] +amount),
        max: vec3.fromValues(box.max[0] - amount, box.max[1], box.max[2] - amount),
    }
}



