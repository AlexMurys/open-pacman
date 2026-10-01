// render.js
// Dibujo arcade sobre canvas. Usa game.grid (no MAZE) para reflejar dots comidos.

const TILE = 20;
const WALL_COLOR = '#2121ff';
const DOOR_COLOR = '#ffb8ff';
const DOT_COLOR = '#ffb897';
const PELLET_COLOR = '#ffb897';
const FRIGHT_COLOR = '#2121ff'; // azul oscuro del arcade
const FRIGHT_FLASH_COLOR = '#fff'; // blanco del parpadeo final
// game.js es el duenno de los ticks del susto; se leen de ahi para no duplicar
// las constantes. Los scripts comparten ambito global, asi que los alias llevan
// otro nombre: redeclarar 'const FRIGHT_TICKS' aqui seria un SyntaxError.
const FRIGHT_TOTAL = window.FRIGHT_TICKS;
const FLASH_TICKS = window.FRIGHT_FLASH_TICKS;
// Parpadeo blanco/azul del tramo final: 2 ticks de blanco, 5 de azul.
const FLASH_WHITE_TICKS = 2;
const FLASH_BLUE_TICKS = 5;
const FLASH_PERIOD = FLASH_WHITE_TICKS + FLASH_BLUE_TICKS;

function cellCenter( x, y ) {
  return { cx: x * TILE + TILE / 2, cy: y * TILE + TILE / 2 };
}

// Paredes estilo arcade: lineas finas redondeadas que conectan los centros
// de celdas-pared adyacentes. Produce el trazado continuo del original.
function drawWalls( ctx, grid ) {
  const H = grid.length;
  const W = grid[ 0 ].length;
  ctx.strokeStyle = WALL_COLOR;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for ( let y = 0; y < H; y++ ) {
    for ( let x = 0; x < W; x++ ) {
      if ( grid[ y ][ x ] !== 1 ) continue;
      const { cx, cy } = cellCenter( x, y );
      // Conectar solo hacia derecha y abajo evita trazos duplicados.
      if ( x + 1 < W && grid[ y ][ x + 1 ] === 1 ) {
        ctx.moveTo( cx, cy );
        ctx.lineTo( cx + TILE, cy );
      }
      if ( y + 1 < H && grid[ y + 1 ][ x ] === 1 ) {
        ctx.moveTo( cx, cy );
        ctx.lineTo( cx, cy + TILE );
      }
      // Celda-pared aislada (sin vecino): punto corto para que se vea.
      const lone =
        ( x + 1 >= W || grid[ y ][ x + 1 ] !== 1 ) &&
        ( x - 1 < 0 || grid[ y ][ x - 1 ] !== 1 ) &&
        ( y + 1 >= H || grid[ y + 1 ][ x ] !== 1 ) &&
        ( y - 1 < 0 || grid[ y - 1 ][ x ] !== 1 );
      if ( lone ) {
        ctx.moveTo( cx - 3, cy );
        ctx.lineTo( cx + 3, cy );
      }
    }
  }
  ctx.stroke();
}

function drawDoor( ctx, grid ) {
  const H = grid.length;
  const W = grid[ 0 ].length;
  ctx.strokeStyle = DOOR_COLOR;
  ctx.lineWidth = 3;
  ctx.beginPath();
  for ( let y = 0; y < H; y++ ) {
    for ( let x = 0; x < W; x++ ) {
      if ( grid[ y ][ x ] !== 3 ) continue;
      const px = x * TILE;
      const py = y * TILE + TILE / 2;
      ctx.moveTo( px, py );
      ctx.lineTo( px + TILE, py );
    }
  }
  ctx.stroke();
}

// Dots pequenos (celda 2) y power pellets (celda 4) como circulos grandes cuyo
// radio late con el frame.
function drawDots( ctx, grid, frame ) {
  for ( let y = 0; y < grid.length; y++ ) {
    for ( let x = 0; x < grid[ 0 ].length; x++ ) {
      const v = grid[ y ][ x ];
      if ( v !== 2 && v !== 4 ) continue;
      const { cx, cy } = cellCenter( x, y );
      if ( v === 4 ) {
        const pulse = ( Math.sin( frame * 0.15 ) * 0.5 + 0.5 ) * 2 + 4;
        ctx.fillStyle = PELLET_COLOR;
        ctx.beginPath();
        ctx.arc( cx, cy, pulse, 0, Math.PI * 2 );
        ctx.fill();
        continue;
      }
      ctx.fillStyle = DOT_COLOR;
      ctx.beginPath();
      ctx.arc( cx, cy, 2.5, 0, Math.PI * 2 );
      ctx.fill();
    }
  }
}

function drawPacman( ctx, p, frame ) {
  const { cx, cy } = cellCenter( p.x, p.y );
  let rot = 0;
  if ( p.dir === 'right' ) rot = 0;
  else if ( p.dir === 'down' ) rot = Math.PI / 2;
  else if ( p.dir === 'left' ) rot = Math.PI;
  else if ( p.dir === 'up' ) rot = -Math.PI / 2;

  // Boca animada: abre/cierra con el frame.
  const open = ( Math.sin( frame * 0.3 ) * 0.5 + 0.5 ) * 0.28 + 0.02;

  ctx.fillStyle = '#ffff00';
  ctx.beginPath();
  ctx.moveTo( cx, cy );
  ctx.arc( cx, cy, TILE / 2 - 1, rot + open * Math.PI, rot - open * Math.PI );
  ctx.closePath();
  ctx.fill();
}

// Par de ojos mirando segun direccion, centrado en (cx,cy). Compartido por el
// fantasma normal y la fase 'ojos'.
function drawEyes( ctx, cx, cy, ghostDir ) {
  const dir = DIRS[ ghostDir ] || { x: 0, y: 0 };
  const ex = dir.x * 1.6;
  const ey = dir.y * 1.6;
  for ( const off of [ -3.5, 3.5 ] ) {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc( cx + off, cy, 3, 0, Math.PI * 2 );
    ctx.fill();
    ctx.fillStyle = '#0000bb';
    ctx.beginPath();
    ctx.arc( cx + off + ex, cy + ey, 1.5, 0, Math.PI * 2 );
    ctx.fill();
  }
}

// Color del susto, segun el estado global del juego. En los ultimos
// FRIGHT_FLASH_TICKS (2 s) parpadea blanco/azul antes de volver a su color.
function ghostPaint( game, g ) {
  if ( game.frightTicks <= 0 ) return g.color;
  if ( game.frightTicks > FLASH_TICKS ) return FRIGHT_COLOR;
  // Dentro del tramo final, el offset se toma desde el arranque del susto para
  // que el parpadeo sea continuo en vez de depender del tick de activacion.
  const phase = ( FRIGHT_TOTAL - game.frightTicks ) % FLASH_PERIOD;
  return phase < FLASH_WHITE_TICKS ? FRIGHT_FLASH_COLOR : FRIGHT_COLOR;
}

function drawGhost( ctx, game, g ) {
  const { cx, cy } = cellCenter( g.x, g.y );

  // Fase ojos: solo el par de ojos, mirando en la direccion de vuelo.
  if ( g.phase === 'ojos' ) {
    drawEyes( ctx, cx, cy, g.dir );
    return;
  }

  const r = TILE / 2 - 1;
  const top = cy - r;
  const bottom = cy + r;
  const left = cx - r;
  const right = cx + r;

  const scared = game.frightTicks > 0;

  ctx.fillStyle = ghostPaint( game, g );
  ctx.beginPath();
  ctx.arc( cx, cy - 1, r, Math.PI, 0, false ); // cabeza
  ctx.lineTo( right, bottom );
  // falda ondulada (3 picos)
  ctx.lineTo( right - r * 0.66, bottom - 4 );
  ctx.lineTo( cx, bottom );
  ctx.lineTo( left + r * 0.66, bottom - 4 );
  ctx.lineTo( left, bottom );
  ctx.closePath();
  ctx.fill();

  if ( scared ) {
    // Cara de susto: dos ojos blancos con la pupila minima y la boca en zigzag.
    for ( const off of [ -3.5, 3.5 ] ) {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc( cx + off, cy - 1, 2.5, 0, Math.PI * 2 );
      ctx.fill();
      ctx.fillStyle = '#0000bb';
      ctx.beginPath();
      ctx.arc( cx + off, cy - 1, 1, 0, Math.PI * 2 );
      ctx.fill();
    }
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo( cx - 4, cy + 4 );
    ctx.lineTo( cx - 2, cy + 2 );
    ctx.lineTo( cx, cy + 4 );
    ctx.lineTo( cx + 2, cy + 2 );
    ctx.lineTo( cx + 4, cy + 4 );
    ctx.closePath();
    ctx.fill();
    return;
  }

  // ojos mirando segun direccion
  drawEyes( ctx, cx, cy - 1, g.dir );
}

function drawHUD( ctx, game, W ) {
  ctx.fillStyle = '#fff';
  ctx.font = '14px "Courier New", monospace';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillText( 'SCORE ' + game.score, 8, 4 );
  ctx.textAlign = 'right';
  ctx.fillText( 'VIDAS ' + game.lives, W * TILE - 8, 4 );
}

function draw( ctx, game, frame ) {
  const grid = game.grid;
  const W = grid[ 0 ].length;
  const H = grid.length;

  ctx.fillStyle = '#000';
  ctx.fillRect( 0, 0, W * TILE, H * TILE );

  drawWalls( ctx, grid );
  drawDoor( ctx, grid );
  drawDots( ctx, grid, frame );
  drawPacman( ctx, game.pacman, frame );
  game.ghosts.forEach( ( g ) => drawGhost( ctx, game, g ) );
  drawHUD( ctx, game, W );
}

window.draw = draw;
