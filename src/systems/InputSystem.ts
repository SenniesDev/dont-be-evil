const keys = new Set<string>();
window.addEventListener("keydown", (e) => keys.add(e.code));
window.addEventListener("keyup",   (e) => keys.delete(e.code));
// tipkovnica
export function isKeyDown(code: string) {
    return keys.has(code);
}


// miska

let mouseDX = 0;
let mouseDY = 0;

window.addEventListener("mousemove", (e) => {
    if(document.pointerLockElement){
        mouseDX += e.movementX;
        mouseDY += e.movementY;
    }
});

export function consumeMouseDX(){
    const dx = mouseDX;
    mouseDX = 0;
    return dx;
}

export function consumeMouseDY(){
    const dy = mouseDY;
    mouseDY = 0;
    return dy;
}