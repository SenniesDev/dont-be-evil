
const TIME_LIMIT = 120;

const timerElement = document.getElementById('timer');
let remaining = TIME_LIMIT;
let timeUp = false;
let running = true;

export function updateTimer(dt: number) {
    
    if(!running) return;

    remaining -= dt;

    if(remaining <= 0){
        remaining = 0;
        running = false;
        timeUp = true;
        console.log("ČAC JE POTEKEL");
    }

    if(timerElement){
        timerElement.textContent = `Čas: ${formatTime(remaining)}`;
    }
}

export function stopTimer(){
    running = false;
}

export function isTimeUp() {
    return timeUp;
}

export function getRemainningTime() {
    return remaining;
}

function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const mm = m < 10 ? "0" + m : "" + m;
    const ss = s < 10 ? "0" + s : "" + s;
    return `${mm}:${ss}`;
}

// Za novo igro: poln čas
export function resetTimer() {
    remaining = TIME_LIMIT;
    running = true;
    timeUp = false;
    if (timerElement) {
        timerElement.textContent = `Čas: ${formatTime(remaining)}`;
        timerElement.style.color = "white";
    }
}