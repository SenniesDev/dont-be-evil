import { GLTFParser } from "../parsers/GLTFParser.ts";
import type { Scene } from "../Scene.ts";

// Naloži .glb ali .gltf datoteko in vse njene entitete doda v podano sceno
export async function loadGlb(path: string, scene: Scene) {
    const parser = new GLTFParser();

    if (path.endsWith(".gltf")) {
        // .gltf = JSON besedilo + ločen .bin v isti mapi
        const json = await fetch(path).then((r) => r.text());
        const folder = path.substring(0, path.lastIndexOf("/") + 1);   // "data/token.gltf" → "data/"
        await parser.setJson(json, folder);
    } else {
        // .glb = vse v eni binarni datoteki
        const buffer = await fetch(path).then((r) => r.arrayBuffer());
        await parser.setBinary(new Uint8Array(buffer));
    }

    const glbScene = await parser.parseScene(0);
    if (!glbScene) throw Error(`Could not load ${path}!`);

    for (const entity of glbScene.entities) {
        scene.addEntity(entity);
    }
    return glbScene.entities;
}