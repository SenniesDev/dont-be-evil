let started = false;

// Called after the game has loaded: enables the Play button
export function setupStartScreen(canvas: HTMLCanvasElement) {
    const screen = document.getElementById('start-screen');
    const button = document.getElementById('play-button') as HTMLButtonElement | null;
    if (!screen || !button) {
        started = true;            // no menu in the HTML → start straight away
        return;
    }

    button.disabled = false;
    button.textContent = 'Igraj';

    button.addEventListener('click', () => {
        screen.style.display = 'none';     // hide the menu
        started = true;
        canvas.requestPointerLock();       // lock the mouse right away
    });

    window.addEventListener('keydown', (e) => {
        if (e.code === 'Enter' && !started) button.click();
    });
}

export function isGameStarted() {
    return started;
}