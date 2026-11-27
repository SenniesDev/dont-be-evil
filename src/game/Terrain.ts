import { vec3 } from "gl-matrix";
import type { Scene } from "../Scene.ts";
import { Transform } from "../components/Transform.ts";
import { Mesh } from "../components/Mesh.ts";
import { BasicMaterial } from "../data/Material.ts";
import { computeTransforms } from "../systems/TransformSystem.ts";
import { loadGlb } from "./loadGlb.ts";

const FLOATS_PER_VERTEX = 14;          // 11 brez barv oglišč, 14 z barvami
const terrainTris: vec3[][] = [];      // trikotniki dun v svetovnih koordinatah

const CELL_SIZE = 10; // velikost celice - tipična velikost trikotnika 
let gridMinX = 0; // levi rob mreže
let gridMinZ = 0;  // spodnji rob mreze 
let gridCols = 0;  // st celic v smeri x
let gridRows = 0;  // st celic v smeri z
let grid: number[][] = [];


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

    buildGrid();
}

function buildGrid() {
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;

    for(const tri of terrainTris){
        for(const p of tri){
            minX = Math.min(minX, p[0]);
            maxX = Math.max(maxX, p[0]);
            minZ = Math.min(minZ, p[2]);
            maxZ = Math.max(maxZ, p[2]);
        }
    }

    gridMinX = minX;
    gridMinZ = minZ;
    gridCols = Math.floor((maxX - minX) / CELL_SIZE) + 1;
    gridRows = Math.floor((maxZ - minZ) / CELL_SIZE) + 1; 

    // prazne celice
    grid = [];
    for(let i = 0; i < gridCols * gridRows; i++){
        grid.push([]);
    }

    // vsak trikotnik v vse celice ki jih prekriva njegov AABB
    for(let i = 0; i< terrainTris.length; i++){
        const[a, b, c] = terrainTris[i];

        const x0 = Math.min(a[0], b[0], c[0]);
        const x1 = Math.max(a[0], b[0], c[0]);
        const z0 = Math.min(a[2], b[2], c[2]);
        const z1 = Math.max(a[2], b[2], c[2]);

        for(let cz = cellZ(z0); cz <= cellZ(z1); cz++){
            for(let cx = cellX(x0); cx <= cellX(x1); cx++ ){
                grid[cz * gridCols + cx].push(i);
            }
        }
    }
    console.log(`Terrain grid: ${gridCols} x ${gridRows} cells,
         ${terrainTris.length} triangles`);

}

function cellX(x: number) : number {
    return Math.floor((x - gridMinX) / CELL_SIZE);
}

function cellZ(z: number) : number  {
    return Math.floor((z - gridMinZ) / CELL_SIZE);
}

// groba detekcija: indeksi trikotnikov ki so morda pod tocko (x , z) ali null ce tocke ni v trikotniku
function trianglesAt(x: number, z: number): number[] {
    const cx = cellX(x);
    const cz = cellZ(z);

    if(cx < 0 || cz < 0 || cx >= gridCols || cz >= gridRows) return[]; //izven terena 

    return grid[cz * gridCols + cx];
}

//FINA DETEKCIJA : visina trikotnika v tocki (x, z), ali null, ce tocka ni v trikotniku 

function heightInTriangle(tri: vec3[], x: number, z: number): number | null{
    const[a, b, c] = tri;
    const d = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
    if(d === 0) return null;
    const w1 = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / d;
    const w2 = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / d;
    const w3 = 1 - w1 - w2;
    if (w1 < 0 || w2 < 0 || w3 < 0) return null;       // točka ni v trikotniku
    return w1 * a[1] + w2 * b[1] + w3 * c[1];           // interpolirana višina
}

// Height of the terrain at the point (x, z); if there's no terrain there, return 0
export function getGroundHeight(x: number, z: number): number {
    let best = -Infinity;
    for(const i of trianglesAt(x, z)) {
        const y = heightInTriangle(terrainTris[i], x, z);
        if(y !== null && y > best) best = y;
    }
    return best === -Infinity ? 0 : best;
}

// Is there any dune triangle under the point (x, z)?
export function isOnTerrain(x: number, z: number): boolean {
    for(const i of trianglesAt(x, z)){
        if(heightInTriangle(terrainTris[i], x, z) !== null) return true;
    }
    return false;
}

// Naključna točka (x, z) kjerkoli na terenu, z odmikom od roba
export function randomPointOnMap(margin: number): [number, number] {
    const maxX = gridMinX + gridCols * CELL_SIZE;
    const maxZ = gridMinZ + gridRows * CELL_SIZE;
    const x = gridMinX + margin + Math.random() * (maxX - gridMinX - 2 * margin);
    const z = gridMinZ + margin + Math.random() * (maxZ - gridMinZ - 2 * margin);
    return [x, z];
}