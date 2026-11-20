import { GLTFParser } from "../parsers/GLTFParser.ts";
import type { Scene } from "../Scene.ts";

// Naloži .glb datoteko in vse njene entitete doda v podano sceno
export async function loadGlb(path: string, scene: Scene) {
    const parser = new GLTFParser();
    const buffer = await fetch(path).then((r) => r.arrayBuffer());
    await parser.setBinary(new Uint8Array(buffer));
    const glbScene = await parser.parseScene(0);
    if (!glbScene) throw Error(`Could not load ${path}!`);

    for (const entity of glbScene.entities) {
        scene.addEntity(entity);
    }
}