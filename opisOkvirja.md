# Opis kode: ogrodje za igro (TypeScript + WebGPU)

## Kako je ogrodje zasnovano (ECS)
Ogrodje uporablja vzorec **Entity–Component–System**:
- **Entiteta** (`Entity`) je "prazen" predmet v igri: igralec, kamera, tla, luč ...
- **Komponente** dajejo entiteti lastnosti: položaj (`Transform`), model (`Mesh`), kamero (`Camera`), animacijo ...
- **Sistemi** so funkcije, ki se vsako sličico sprehodijo čez vse entitete in nekaj naredijo: izračunajo položaje, animirajo, narišejo.
- **Scena** (`Scene`) je seznam vseh entitet.

---

## Korenska mapa (`rgti-game-framework-main/`)
| Datoteka/mapa | Kaj je |
|---|---|
| `index.html` | Spletna stran z `<canvas>`, na katerega se riše igra. Tu je tudi CSS (npr. za sliko v ozadju). Naloži `src/main.ts`. |
| `package.json` | Seznam knjižnic (`gl-matrix`, `vite`, `typescript`) in ukazi, npr. `npm run dev` za zagon. |
| `tsconfig.json` | Nastavitve TypeScripta. |
| `data/` | Modeli in teksture: `little_guy.gltf` + `.bin`, `demo_scene.gltf/.glb`, `man.glb` (trenutno se ne uporablja), `textures/` (slike `.jpg`). |
| `node_modules/` | Nameščene knjižnice. Ne spreminjaš. |
| `opisOkvirja/` | Ta opis. |

---

## `src/`: vsa koda

### Glavne datoteke
| Datoteka | Kaj dela |
|---|---|
| **`main.ts`** ⭐ | **Vstopna točka igre. Tu delaš največ sprememb.** Naloži model, nastavi igralca in kamero, inicializira WebGPU, ustvari medpomnilnike in požene glavno zanko `update()`. |
| `Entity.ts` | Razred `Entity`: `addComponent`, `getComponent`, `removeComponent` in `parent` (za hierarhijo, npr. kosti). |
| `Scene.ts` | Razred `Scene`: `addEntity`, `removeEntity`, `getEntityByName("Okostje")`, `getEntitiesByComponent(Camera)`. |
| `Component.ts` | Prazen vmesnik, ki ga implementirajo vse komponente. |
| `RenderState.ts` | Hrani vse za risanje: GPU napravo, canvas, globinsko teksturo in teksture materialov. Tu je `context.configure(...)` (za prosojno ozadje dodaš `alphaMode`). |
| `Utils.ts` | Pomožne funkcije: `createTempTexture` (tekstura z 1 pikslom), `createCube` (se ne uporablja) in tipi. |

### `src/components/`: lastnosti entitet
| Datoteka | Kaj hrani |
|---|---|
| **`Transform.ts`** ⭐ | Položaj (`location`), rotacijo (`rotation`), velikost (`scale`). Pri kameri v načinu `LookAt` tudi `target` in `up`. **Vrednost vedno nastavi v celoti** (`t.location = ...`), sicer se sprememba ne upošteva. |
| `Camera.ts` | Perspektiva kamere: vidni kot `fovy`, razmerje `aspect`, `near`/`far`. |
| `Mesh.ts` | 3D model, sestavljen iz primitivov. |
| `KeyframeAnimation.ts` | Animacije iz Blenderja (npr. `dance`). |
| `ProceduralAnimation.ts` | Animacije, napisane s kodo (funkcija, ki se kliče vsako sličico). |
| `Skin.ts` | Okostje: katere kosti premikajo model. |
| `Light.ts` | Luč (naloži se, a je trenutni renderer ne uporablja). |

### `src/data/`: podatki, ki niso komponente
| Datoteka | Kaj je |
|---|---|
| `Primitive.ts` | Oglišča (11 števil na oglišče: položaj, normala, UV, tangenta), indeksi in material. |
| `Material.ts` | `BasicMaterial`: tekstura in barva. |

### `src/parsers/`: nalaganje modelov
| Datoteka | Kaj dela |
|---|---|
| `GLTFParser.ts` | Prebere `.gltf` (`setJson`) ali `.glb` (`setBinary`) in iz njega ustvari `Scene` z entitetami, kamero, animacijami in okostjem. |
| `GLTFData.ts` | TypeScript tipi za glTF format. |

### `src/systems/`: kar se zgodi vsako sličico ali ob zagonu
| Datoteka | Kdaj | Kaj dela |
|---|---|---|
| **`InputSystem.ts`** ⭐ | ves čas | **Dodali smo jo mi.** Beleži pritisnjene tipke, `isKeyDown("KeyW")`. |
| `BufferInitSystem.ts` | ob zagonu | Ustvari GPU medpomnilnike za vse entitete (`createBuffers`). |
| `PrepareRenderSystem.ts` | ob zagonu | Pripravi teksture in renderer (`prepareRendering`). |
| `AnimationSystem.ts` | vsako sličico | Posodobi animacije. Vsebuje tudi `playAnimation`, `pauseAnimation`, `resetAnimation`. |
| `TransformSystem.ts` | vsako sličico | Izračuna končni (svetovni) položaj vsake entitete, upošteva starše. |
| `SkinningSystem.ts` | vsako sličico | Izračuna matrike kosti za modele z okostjem. |
| `BufferUpdateSystem.ts` | vsako sličico | Pošlje nove podatke (položaje, kamero) na grafično kartico. |
| `RenderSystem.ts` | vsako sličico | Nariše sceno. **Tu je barva ozadja** (`clearValue`). |

### `src/renderers/` in `src/shaders/`
| Datoteka | Kaj dela |
|---|---|
| `renderers/UnlitRenderer.ts` | Nastavi WebGPU cevovod (pipeline) in nariše vse modele. Ločeno obravnava modele z okostjem. |
| `shaders/Unlit.wgsl` | Shader (koda za grafično kartico): izračuna položaj na zaslonu in pobarva s teksturo. Brez senčenja in luči. |

---

## Kaj se zgodi, ko zaženeš igro (`main.ts`)
**Ob zagonu (enkrat):**
1. Naloži `data/little_guy.gltf` in iz njega ustvari `scene`.
2. Poišče igralca (`Okostje`) in kamero, ki jo preklopi v `LookAt` z vidnim kotom 60°.
3. Inicializira WebGPU (adapter, naprava, canvas).
4. `createBuffers` in `prepareRendering`. **Vse entitete morajo biti v sceni pred tem korakom!**
5. Nastavi `resize` za spremembo velikosti okna.

**Vsako sličico (`update()`):**
1. Izračuna `dt`, čas od prejšnje sličice.
2. **Premik igralca**: W/S naprej in nazaj, A/D levo in desno.
3. **Kamera** se postavi za igralca in gleda vanj.
4. `animateScene` → `computeTransforms` → `computeSkins` → `updateBuffers` → `render`.
5. `requestAnimationFrame(update)` ponovi zanko.

---

## Kje kaj spremeniš (hitri pregled)
| Želiš ... | Datoteka | Kje |
|---|---|---|
| hitrost igralca | `main.ts` | `moveSpeed` v `update()` |
| razdaljo in višino kamere | `main.ts` | `camDistance`, `camHeight` |
| vidni kot kamere | `main.ts` | `fovy = Math.PI / 3` |
| začetni položaj igralca | `main.ts` | `playerTransform.location = ...` |
| smer, v katero gleda igralec | `main.ts` | `let playerYaw = 0;` |
| tipke | `main.ts` | `isKeyDown("KeyW")` ... |
| drug model | `main.ts` | `fetch("data/....gltf")` in `getEntityByName(...)` |
| animacijo | `main.ts` | `playAnimation(scene, player, 'ime')` |
| barvo ozadja | `RenderSystem.ts` | `clearValue` |
| sliko v ozadju | `RenderState.ts` + `RenderSystem.ts` + `index.html` | `alphaMode`, prosojen `clearValue`, CSS `background-image` |
| izgled modelov (shader) | `shaders/Unlit.wgsl` | funkcija `fragment` |

---

## Spremembe, ki smo jih naredili
- **Nova datoteka `src/systems/InputSystem.ts`**: branje tipkovnice.
- **`main.ts`**:
  - igralec `Okostje` se premika z WASD;
  - kamera mu sledi od zadaj;
  - odstranjen je ples (`dance`);
  - odstranjena je koda za kocko in za moža (`man.glb`).
- **Izbrisana `src/Cube.ts`**.
