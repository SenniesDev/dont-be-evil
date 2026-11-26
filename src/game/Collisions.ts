import {vec3} from "gl-matrix";

//krogla: sredisce + polmer
export interface Sphere{
    center: vec3;
    radius: number;
}

// navpicna kapsula x/Z sredisca, visina dna in vrha odseka, polmer
export interface Capsule {
    x: number;
    z: number;
    bottomY : number; // tocke odseka
    topY : number;
    radius: number
}

//ali se krogla in kapsula sekata
export function sphereVsCapsule(s: Sphere, c: Capsule): boolean {
    // najbilzja tocka odsekakapsule do središča klroga
    const closestY = Math.max(c.bottomY, Math.min(c.topY, s.center[1]));

    // razlika med središčem krogle in to točko
    const dx = s.center[0] - c.x;
    const dy = s.center[1] - closestY;
    const dz = s.center[2] - c.z;

    // krogla proti krogli s kvadratom razdalje
    const r = s.radius + c.radius;
    return dx * dx + dy * dy + dz * dz < r * r;
}

// Osno poravnan očrtan okvir (AABB): najmanjši in največji X, Y, Z
export interface AABB {
    min: vec3;
    max: vec3;
}

// Prosojnica 9: AABB proti AABB = prekrivanje na vseh treh oseh
export function aabbVsAabb(a: AABB, b: AABB): boolean {
    return a.min[0] <= b.max[0] && a.max[0] >= b.min[0]
        && a.min[1] <= b.max[1] && a.max[1] >= b.min[1]
        && a.min[2] <= b.max[2] && a.max[2] >= b.min[2];
}

// Prosojnica 31: os z najmanjšim prekrivanjem = smer razmika, prekrivanje = globina.
// Vrne [pomikX, pomikZ], za koliko premakniti a, da ne prekriva b (samo vodoravno).
export function pushOutXZ(a: AABB, b: AABB): [number, number] {
    const toPlusX  = b.max[0] - a.min[0];   // koliko premakniti v +X, da pride ven
    const toMinusX = a.max[0] - b.min[0];   // koliko premakniti v −X
    const toPlusZ  = b.max[2] - a.min[2];
    const toMinusZ = a.max[2] - b.min[2];

    const pushX = toPlusX < toMinusX ? toPlusX : -toMinusX;   // krajša pot po X
    const pushZ = toPlusZ < toMinusZ ? toPlusZ : -toMinusZ;   // krajša pot po Z

    // po osi z manjšim prekrivanjem
    return Math.abs(pushX) < Math.abs(pushZ) ? [pushX, 0] : [0, pushZ];
}

