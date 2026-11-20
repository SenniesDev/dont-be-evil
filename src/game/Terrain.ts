import { vec3 } from "gl-matrix";
import type { Scene } from "../Scene.ts";
import { Transform } from "../components/Transform.ts";
import { Mesh } from "../components/Mesh.ts";
import { BasicMaterial } from "../data/Material.ts";
import { computeTransforms } from "../systems/TransformSystem.ts";
import { loadGlb } from "./loadGlb.ts";

const FLOATS_PER_VERTEX = 14;          // 11 brez barv oglišč, 14 z barvami
const terrainTris: vec3[][] = [];      // trikotniki dun v svetovnih koordinatah

// Naloži dune, jih pomanjša in pripravi trikotnike za hojo
export async function loadTerrain(scene: Scene) {
    await loadGlb("data/dunes.glb", scene);

    const dunes = scene.getEntityByName('Dunes_tile_1')!;
    const dunesTransform = dunes.getComponent(Transform)!;
    dunesTransform.scale = vec3.fromValues(0.01, 0.01, 0.01);
    dunesTransform.location = vec3.fromValues(0, 0, 0);

    // izračuna world matrix, da vemo, kje so dune v svetu
    computeTransforms(scene);

    const dunesMeshEntity = scene.getEntityByName('D_tile_1')!;
    const dunesMesh = dunesMeshEntity.getComponent(Mesh)!;
    const dunesWorld = dunesMeshEntity.getComponent(Transform)!.worldMatrix;
    const dunesPrims = dunesMesh.getPrimitivesByMaterial(BasicMaterial)!;

    for (const prim of [dunesPrims[1], dunesPrims[2]]) {   // skale + pesek, brez dreves
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
}

// Height of the terrain at the point (x, z); if there's no terrain there, return 0
export function getGroundHeight(x: number, z: number): number {
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

// Is there any dune triangle under the point (x, z)?
export function isOnTerrain(x: number, z: number): boolean {
    for (const [a, b, c] of terrainTris) {
        const d = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
        if (d === 0) continue;
        const w1 = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / d;
        const w2 = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / d;
        const w3 = 1 - w1 - w2;
        if (w1 >= 0 && w2 >= 0 && w3 >= 0) return true;   // found a triangle → it's terrain
    }
    return false;
}