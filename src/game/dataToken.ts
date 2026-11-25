import { vec3, quat } from "gl-matrix";
import type { Scene } from "../Scene.ts";
import type { Entity } from "../Entity.ts";
import { Transform } from "../components/Transform.ts";
import { playAnimation, pauseAnimation, resetAnimation } from "../systems/AnimationSystem.ts";
import { isKeyDown, consumeMouseDX } from "../systems/InputSystem.ts";
import { loadGlb } from "./loadGlb.ts";
import { getGroundHeight, isOnTerrain } from "./Terrain.ts";
import { computeTransforms } from "../systems/TransformSystem.ts";
import { getPlayerPosition } from "./Player.ts";
import { stopTimer } from "./Timer.ts";


const NUM_TOKENS = 3;
const TOKEN_SCALE = 0.3;
const FLOATING = 1.0;
const SPAWN_RAD = 60;
const MIN_DIST_PALYER = 9;
const MIN_DIST_TOKENS = 10; 
const MAX_TRIES = 100;

const tokens: Entity[] = [];

const PICKUP_RAD = 1.5 // kako blizu more igralec priti da collecta token 
const SPIN_SPEED = 2 // kako hitro se token vrti 

let tokenScene : Scene;    // Scene za odstranjevanje tokenov
let collected = 0; // koliko tokenov ima player
let total = 0; // koliko tokenov je bilo na startu 
let spin = 0; // trenutni  spin  kot
const counterElement = document.getElementById('tokens');

export async function loadTokens(scene: Scene) {
    tokenScene = scene;

    const positions = randomPosition();

    for(const pos of positions){

        const entities = await loadGlb("data/token.gltf", scene);

        const token =  entities.find((e) => e.parent === null);
        if(!token) throw Error("token.gltf has no object");
        
        const tokenTransform = token.getComponent(Transform)!;
        tokenTransform.scale = vec3.fromValues(TOKEN_SCALE, TOKEN_SCALE, TOKEN_SCALE);
        tokenTransform.location = pos;

        tokens.push(token);
    }

    console.log(`Placed ${tokens.length} tokens`);

    total = tokens.length; // koliko je vseh tokenov
    updateCounter();
}

// POišče pozicije mest ker so tokeni

function randomPosition(): vec3[] {
    const result: vec3[] = [];

    for(let tries = 0; tries < MAX_TRIES && result.length < NUM_TOKENS; tries++){
        const x = (Math.random() * 2 - 1) * SPAWN_RAD;
        const z = (Math.random() * 2 - 1) * SPAWN_RAD;

        if(!isOnTerrain(x, z)) continue;
        if(Math.hypot(x, z) < MIN_DIST_PALYER) continue;

        let tooClose = false;
        for(const p of result){
            const dist = Math.hypot(p[0] - x, p[2] - z);
            if(dist < MIN_DIST_TOKENS){
                tooClose = true;
                break;
            }
        }

        if(tooClose) continue;

        const y = getGroundHeight(x, z) + FLOATING;
        result.push(vec3.fromValues(x, y, z));

    }

    return result;
}

export function updateTokens(dt: number) {
    const p = getPlayerPosition(); // dobi igralčevo pozicijo vec3(X; Y Z)(leco/desno, visina, naprej, nazaj)

    for(let i  = tokens.length - 1 ; i >= 0; i--){//nazaj ker odstranjujemo elemente iz seznama 
        const token = tokens[i];
        const loc = token.getComponent(Transform)!.location;

        // razdalje med igralcem in zetonom (p je polozaj igralcevih nog)
        const dx = loc[0] - p[0];
        const dy = loc[1] - p[1]; // +1 ce hocem da se racuna blizina njegovih prsi 
        const dz = loc[2] - p[2];

        if(Math.hypot(dx, dy, dz) < PICKUP_RAD){
            tokenScene.removeEntity(token); // se ne rise vec
            tokens.splice(i, 1);
            collected++;
            updateCounter();

            if(collected === total){
                console.log("ALL TOKENS COLLECTED");
                stopTimer();
            }
        }
    }    
}

function updateCounter() {
    if(counterElement) counterElement.textContent = `Žetoni: ${collected} / ${total}`;
}

export function getCollected() {
    return collected;
}