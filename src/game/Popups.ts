// ------ Nastavitve ------ //
const FIRST_DELAY = 15;     // prvo okno po 15 s
const MIN_DELAY = 20;       // nato vsakih 20–40 s
const MAX_DELAY = 40;

// ------ Stanje ------ //
const popupElement = document.getElementById('popup');
let open = false;
let nextIn = FIRST_DELAY;   // čez koliko sekund pride naslednje okno
let canvasRef: HTMLCanvasElement | null = null;

export function setupPopups(canvas: HTMLCanvasElement) {
    canvasRef = canvas;
}

// Pokliče se vsako sličico, ko igra teče
export function updatePopups(dt: number) {
    if (open) return;
    nextIn -= dt;
    if (nextIn <= 0) showRandomPopup();
}

export function isPopupOpen() {
    return open;
}

// Za novo igro: zapri okno, odštevanje od začetka
export function resetPopups() {
    closePopup(false);
    nextIn = FIRST_DELAY;
}

// ------ Odpiranje in zapiranje ------ //

function showRandomPopup() {
    const kinds = [showCookies, showTerms, showCaptcha];
    const pick = kinds[Math.floor(Math.random() * kinds.length)];
    pick();

    open = true;
    if (popupElement) popupElement.style.display = 'flex';
    document.exitPointerLock();          // sprosti miško, da lahko klikaš
}

function closePopup(relock = true) {
    open = false;
    if (popupElement) {
        popupElement.style.display = 'none';
        popupElement.innerHTML = '';
    }
    nextIn = MIN_DELAY + Math.random() * (MAX_DELAY - MIN_DELAY);
    if (relock && canvasRef) canvasRef.requestPointerLock();   // nazaj v igro
}

function setContent(html: string) {
    if (popupElement) popupElement.innerHTML = `<div id="popup-card">${html}</div>`;
}

function el(id: string) {
    return document.getElementById(id) as HTMLElement;
}

// ------ 1. Piškotki ------ //
function showCookies() {
    setContent(`
        <h2>Piškotki</h2>
        <p>Ta stran uporablja piškotke za boljšo uporabniško izkušnjo
           (in za prodajo vaših podatkov oglaševalcem).</p>
        <button id="pp-accept">Sprejmi vse</button>
        <button id="pp-reject" class="popup-secondary">Zavrni</button>
        <p id="pp-msg" class="popup-msg"></p>
    `);
    el('pp-accept').onclick = () => closePopup();
    el('pp-reject').onclick = () => {
        el('pp-msg').textContent = 'Zavrnitev trenutno ni na voljo.';
    };
}

// ------ 2. Pogoji uporabe ------ //
function showTerms() {
    const legalText = 'Uporabnik se strinja, da lahko ponudnik zbira, hrani, obdeluje in deli vse osebne podatke za nedoločen čas. '.repeat(25);
    setContent(`
        <h2>Pogoji uporabe</h2>
        <div class="popup-scroll">${legalText}</div>
        <label><input type="checkbox" id="pp-check"> Prebral sem in se strinjam s pogoji</label><br>
        <button id="pp-accept" disabled>Sprejmi</button>
    `);
    const check = el('pp-check') as HTMLInputElement;
    const accept = el('pp-accept') as HTMLButtonElement;
    check.onchange = () => { accept.disabled = !check.checked; };   // gumb deluje šele s kljukico
    accept.onclick = () => closePopup();
}

// ------ 3. Captcha ------ //
function showCaptcha() {
    const code = randomCode(5);
    setContent(`
        <h2>Ali si robot?</h2>
        <p>Prepiši kodo:</p>
        <div class="captcha-code">${code}</div>
        <input id="pp-input" type="text" maxlength="5" autocomplete="off">
        <br><button id="pp-accept">Potrdi</button>
        <p id="pp-msg" class="popup-msg"></p>
    `);
    const input = el('pp-input') as HTMLInputElement;
    const msg = el('pp-msg');
    input.focus();

    const tryCode = () => {
        if (input.value.trim().toUpperCase() === code) {
            closePopup();
        } else {
            msg.textContent = 'Napačna koda, poskusi znova.';
            input.value = '';
            input.focus();
        }
    };
    el('pp-accept').onclick = tryCode;
    input.onkeydown = (e) => { if (e.key === 'Enter') tryCode(); };
    input.oninput = () => { msg.textContent = ''; };   // napaka izgine, ko začneš tipkati
}

// Naključna koda brez podobnih znakov (0/O, 1/I)
function randomCode(length: number): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = '';
    for (let i = 0; i < length; i++) {
        s += chars[Math.floor(Math.random() * chars.length)];
    }
    return s;
}