let gameOver = false;

const screen = document.getElementById('end-screen');
const title = document.getElementById('end-title');
const text = document.getElementById('end-text');
const button = document.getElementById('restart-button');

// Pokaže končni zaslon in ustavi igro
export function showEndScreen(won: boolean, message: string) {
    gameOver = true;
    if (title) title.textContent = won ? "ČESTITKE!" : "KONEC IGRE";
    if (text) text.textContent = message;
    if (screen) {
        screen.classList.toggle('won', won);   // zelen ali rdeč naslov
        screen.style.display = 'flex';
    }
    document.exitPointerLock();                // sprosti miško, da lahko klikneš gumb
}

// Gumb "Igraj znova": skrije zaslon in pokliče funkcijo, ki ponastavi igro
export function setupEndScreen(canvas: HTMLCanvasElement, onRestart: () => void) {
    button?.addEventListener('click', () => {
        if (screen) screen.style.display = 'none';
        onRestart();
        gameOver = false;
        canvas.requestPointerLock();           // spet zakleni miško
    });
}

export function isGameOver() {
    return gameOver;
}

