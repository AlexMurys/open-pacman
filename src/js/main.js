// main.js
// Bucle, teclado y pantallas. Usa createGame/update/draw (globals).

const canvas = document.getElementById( 'game' );
const ctx = canvas.getContext( '2d' );
const overlay = document.getElementById( 'overlay' );
const actionBtn = document.getElementById( 'action-btn' );

// Bucle de paso fijo: 60 ticks/s, independiente de los Hz del monitor.
const TICK_MS = 1000 / 60;
const MAX_DELTA_MS = 100; // clamp: descarta el exceso tras volver de segundo plano
let acc = 0;
let last = performance.now();
let tick = 0;

let game = createGame();

const KEY_DIR = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
};

document.addEventListener( 'keydown', ( e ) => {
  const dir = KEY_DIR[ e.key ];
  if ( !dir ) return;
  e.preventDefault();
  if ( game.state === 'playing' ) game.pacman.nextDir = dir;
} );

function showOverlay( title, cls, btnLabel ) {
  overlay.innerHTML =
    '<h1' + ( cls ? ' class="' + cls + '"' : '' ) + '>' + title + '</h1>' +
    '<button id="action-btn">' + btnLabel + '</button>';
  overlay.classList.add( 'show' );
  document.getElementById( 'action-btn' ).addEventListener( 'click', startGame );
}

function startGame() {
  game = createGame();
  game.state = 'playing';
  overlay.classList.remove( 'show' );
}

if ( actionBtn ) actionBtn.addEventListener( 'click', startGame );

function loop( now ) {
  const nowMs = typeof now === 'undefined' ? performance.now() : now;
  acc += Math.min( nowMs - last, MAX_DELTA_MS );
  last = nowMs;

  while ( acc >= TICK_MS ) {
    acc -= TICK_MS;
    tick++;
    if ( game.state === 'playing' ) {
      update( game );
      if ( game.state === 'won' ) showOverlay( 'GANASTE', 'win', 'Reiniciar' );
      else if ( game.state === 'lost' ) showOverlay( 'PERDISTE', 'lose', 'Reiniciar' );
    }
  }

  draw( ctx, game, tick );
  requestAnimationFrame( loop );
}

requestAnimationFrame( loop );
