import { vec3 } from "gl-matrix";
import type { Scene } from "../Scene.ts";
import type { Entity } from "../Entity.ts";
import { Transform } from "../components/Transform.ts";
import { Mesh } from "../components/Mesh.ts";
import { computeTransforms } from "../systems/TransformSystem.ts";
import { loadGlb } from "./loadGlb.ts";
import { getGroundHeight } from "./Terrain.ts";
import type { AABB } from "./Collisions.ts";

const FLOATS_PER_VERTEX = 14;      // enako kot v Terrain.ts
const obstacles: AABB[] = [];      // AABB vseh ovir (statične, izračunamo enkrat)

// Naloži model kot oviro, ga postavi na tla v (x, z) in izračuna njegov AABB
export async function loadObstacle(scene: Scene, path: string, x: number, z: number, scale: number) {
    const entities = await loadGlb(path, scene);
    const root = entities.find((e) => e.parent === null);
    if (!root) throw Error(`${path} has no root object!`);

    const t = root.getComponent(Transform)!;
    t.scale = vec3.fromValues(scale, scale, scale);
    t.location = vec3.fromValues(x, 0, z);
    computeTransforms(scene);

    // dno modela postavimo točno na pesek
    const before = computeAABB(entities);
    const lift = getGroundHeight(x, z) - before.min[1];
    t.location = vec3.fromValues(x, lift, z);
    computeTransforms(scene);

    obstacles.push(computeAABB(entities));
}

// AABB iz vseh oglišč modela v svetovnih koordinatah
function computeAABB(entities: Entity[]): AABB {
    const min = vec3.fromValues(Infinity, Infinity, Infinity);
    const max = vec3.fromValues(-Infinity, -Infinity, -Infinity);
    const p = vec3.create();

    for (const e of entities) {
        const mesh = e.getComponent(Mesh);
        const transform = e.getComponent(Transform);
        if (!mesh || !transform) continue;

        for (const prims of mesh.primitives.values()) {
            for (const prim of prims) {
                const v = prim.vertices;
                for (let i = 0; i < v.length; i += FLOATS_PER_VERTEX) {
                    vec3.set(p, v[i], v[i + 1], v[i + 2]);
                    vec3.transformMat4(p, p, transform.worldMatrix);   // v svet (skala, rotacija, položaj)
                    vec3.min(min, min, p);
                    vec3.max(max, max, p);
                }
            }
        }
    }
    return { min, max };
}

export function getObstacles() {
    return obstacles;
}