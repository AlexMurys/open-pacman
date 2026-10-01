// game.js
// Estado y reglas. Depende de globals de maze.js: MAZE, TUNNEL_ROW,
// PACMAN_START, GHOST_STARTS.

const DIRS = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};
const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };

const PACMAN_SPEED = 0.125; // 1/8 celda/frame -> alinea cada 8 frames
const GHOST_SPEED = 0.1;    // 1/10 celda/frame
const PELLET_POINTS = 50;   // valor de un power pellet (celda 4)
// Modo asustado: 6 s a 60 ticks/s (SPEC 02), el nivel 1 del arcade.
const FRIGHT_TICKS = 360;
const FRIGHT_FLASH_TICKS = 120; // ultimos 2 s: parpadeo blanco/azul
const FRIGHT_SPEED = 0.05;      // mitad de GHOST_SPEED
const EYES_SPEED = 0.2;         // 2x GHOST_SPEED: los ojos vuelan a la casa
// Puntos del fantasma asustado segun la cadena: 200 * 2^frightChain.
const GHOST_BASE_POINTS = 200;
// Columna de la puerta segun el lado del que venga el fantasma.
function doorColumn( x ) {
  return x <= 13 ? 13 : 14;
}
// Clyde persigue mientras esta mas lejos de esto; a <= se retira a su esquina.
const CLYDE_SCORCH_DIST = 8;
// Salida de la pen: 1.5 s entre fantasma y fantasma (90 frames a 60 fps).
const GHOST_RELEASE_BASE = 90;
const GHOST_RELEASE_STEP = 90;
// Fila del pasillo de arriba: cuando el fantasma la alcanza ya esta libre.
const GHOST_EXIT_Y = 11;
// Interior de la pen: los fantasmas que esperan rebotan entre estas filas.
const PEN_TOP = 13;
const PEN_BOTTOM = 15;

// Crea una partida nueva. Copia MAZE (pristino) a game.grid para poder comer
// dots sin destruir el original, y reiniciar.
function createGame() {
  const grid = MAZE.map( ( row ) => row.slice() );
  // La celda de inicio de Pacman arranca sin dot.
  grid[ PACMAN_START.y ][ PACMAN_START.x ] = 0;

  let dots = 0;
  // Celdas 2 (dot) y 4 (power pellet) cuentan como piezas por comer.
  for ( const row of grid ) for ( const v of row ) if ( v === 2 || v === 4 ) dots++;

  return {
    state: 'start',
    score: 0,
    lives: 3,
    dotsRemaining: dots,
    grid,
    // Frames desde el (re)inicio; marca la salida escalonada de la pen.
    ghostClock: 0,
    // Modo asustado global (como el arcade): 0 = inactivo, si no cuenta atras.
    frightTicks: 0,
    // Cadena de fantasmas asustados comidos: 0..3 -> 200/400/800/1600.
    frightChain: 0,
    pacman: {
      x: PACMAN_START.x,
      y: PACMAN_START.y,
      dir: 'left',
      nextDir: null,
      speed: PACMAN_SPEED,
    },
    ghosts: GHOST_STARTS.map( ( g, i ) => ( {
      x: g.x,
      y: g.y,
      dir: 'up',
      speed: GHOST_SPEED,
      kind: g.kind,
      color: g.color,
      // phase: 'casa' (espera) -> 'saliendo' (por la puerta) -> 'libre'.
      phase: 'casa',
      releaseAt: GHOST_RELEASE_BASE + i * GHOST_RELEASE_STEP,
    } ) ),
  };
}

function aligned( v ) {
  return Math.abs( v - Math.round( v ) ) < 1e-3;
}

// Una celda es muro para el actor dado?
//   pacman: bloqueado por pared (1) y puerta (3)
//   ghost:  bloqueado solo por pared (1)
function isWall( grid, x, y, actor ) {
  if ( y < 0 || y >= grid.length ) return true;
  if ( x < 0 || x >= grid[ 0 ].length ) return true;
  const v = grid[ y ][ x ];
  if ( v === 1 ) return true;
  if ( v === 3 && actor === 'pacman' ) return true;
  return false;
}

// Puede el actor avanzar desde (x,y) en la direccion dir?
function canMove( grid, x, y, dir, actor ) {
  const d = DIRS[ dir ];
  if ( !d ) return false;
  const tx = x + d.x;
  const ty = y + d.y;
  // Tunel: salir por un borde en la fila del tunel siempre es valido.
  if ( ty === TUNNEL_ROW && ( tx < 0 || tx >= grid[ 0 ].length ) ) return true;
  return !isWall( grid, tx, ty, actor );
}

function wrapTunnel( a, width ) {
  if ( Math.round( a.y ) === TUNNEL_ROW ) {
    if ( a.x < 0 ) a.x += width;
    else if ( a.x >= width ) a.x -= width;
  }
}

function movePacman( game ) {
  const p = game.pacman;
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( p.x ) && aligned( p.y ) ) {
    p.x = Math.round( p.x );
    p.y = Math.round( p.y );

    // Aplicar giro pendiente si es posible.
    if ( p.nextDir && canMove( grid, p.x, p.y, p.nextDir, 'pacman' ) ) {
      p.dir = p.nextDir;
      p.nextDir = null;
    }
    // Comer dot o power pellet.
    const cell = grid[ p.y ][ p.x ];
    if ( cell === 2 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += 10;
      game.dotsRemaining--;
    } else if ( cell === 4 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += PELLET_POINTS;
      game.dotsRemaining--;
      // El pellet calma a todos los fantasmas y reinicia la cadena.
      game.frightTicks = FRIGHT_TICKS;
      game.frightChain = 0;
    }
    // Si no puede seguir, se detiene en la celda.
    if ( !canMove( grid, p.x, p.y, p.dir, 'pacman' ) ) return;
  }

  const d = DIRS[ p.dir ];
  p.x += d.x * p.speed;
  p.y += d.y * p.speed;
  wrapTunnel( p, width );
}

// Punto 'a' del arcade: N celdas por delante de Pac-Man segun su direccion.
// Incluye el bug fiel del arcade: mirando arriba, anade N celdas tambien a la
// izquierda.
function aheadOfPacman( game, cells ) {
  const p = game.pacman;
  const d = DIRS[ p.dir ];
  return {
    x: Math.round( p.x ) + d.x * cells - ( p.dir === 'up' ? cells : 0 ),
    y: Math.round( p.y ) + d.y * cells,
  };
}

// Celda objetivo de un fantasma, segun su kind. Se usa para elegir la direccion
// que minimiza la distancia Manhattan. Blinky va directo a Pac-Man; pinky
// corta por delante; inky flanquea usando la posicion de blinky; clyde se
// retira cuando se acercan.
function ghostTarget( game, g ) {
  const p = game.pacman;
  const px = Math.round( p.x );
  const py = Math.round( p.y );

  // Ojos: van derecho a la puerta de la pen, sobre ella.
  if ( g.phase === 'ojos' ) return { x: doorColumn( g.x ), y: GHOST_EXIT_Y };

  if ( g.kind === 'pinky' ) return aheadOfPacman( game, 4 );
  if ( g.kind === 'inky' ) {
    // Objetivo = 2*a - blinky, el vector Blinky->a duplicado.
    const a = aheadOfPacman( game, 2 );
    const blinky = game.ghosts[ 0 ]; // GHOST_STARTS[0] es blinky
    return {
      x: 2 * a.x - Math.round( blinky.x ),
      y: 2 * a.y - Math.round( blinky.y ),
    };
  }
  if ( g.kind === 'clyde' ) {
    const dist = Math.abs( g.x - px ) + Math.abs( g.y - py );
    return dist > CLYDE_SCORCH_DIST ? { x: px, y: py } : { x: 1, y: 29 };
  }
  return { x: px, y: py };
}

function decideGhost( game, g ) {
  const grid = game.grid;

  const options = Object.keys( DIRS ).filter(
    ( dir ) => dir !== OPPOSITE[ g.dir ] && canMove( grid, g.x, g.y, dir, 'ghost' )
  );
  // Sin salida (callejon): permitir el giro de 180.
  const choices = options.length ? options : [ '' + OPPOSITE[ g.dir ] ];

  // Asustado: direccion aleatoria uniforme entre las validas, sin objetivo.
  // Los ojos no se asustan: van a la puerta.
  if ( game.frightTicks > 0 && g.phase !== 'ojos' ) {
    g.dir = choices[ Math.floor( Math.random() * choices.length ) ];
    return;
  }

  const target = ghostTarget( game, g );
  let best = choices[ 0 ];
  let bestDist = Infinity;
  for ( const dir of choices ) {
    const d = DIRS[ dir ];
    const nx = g.x + d.x;
    const ny = g.y + d.y;
    const dist = Math.abs( nx - target.x ) + Math.abs( ny - target.y );
    if ( dist < bestDist ) {
      bestDist = dist;
      best = dir;
    }
  }
  g.dir = best;
}

// Rutina de salida de la pen: alinear en la columna de la puerta (13 o 14) y
// subir por ella hasta el pasillo de arriba.
function moveGhostLeaving( g ) {
  const doorX = g.x <= 13 ? 13 : 14;
  if ( aligned( g.x ) ) g.x = Math.round( g.x );
  if ( aligned( g.y ) ) g.y = Math.round( g.y );

  if ( g.x !== doorX ) {
    g.dir = g.x < doorX ? 'right' : 'left';
    g.x += DIRS[ g.dir ].x * g.speed;
    return;
  }
  if ( g.y > GHOST_EXIT_Y ) {
    g.dir = 'up';
    g.y -= g.speed;
    return;
  }
  g.phase = 'libre';
}

// Ojos de un fantasma comido: recorre el pasillo con decideGhost hasta la
// puerta, baja al interior de la pen y revive como 'saliendo' (sin asustado,
// aunque el timer siga vivo: el susto lo decide el estado global, no el fase).
function moveGhostEyes( game, g ) {
  const doorX = doorColumn( g.x );

  if ( aligned( g.x ) && aligned( g.y ) ) {
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );
    if ( g.x === doorX && g.y === GHOST_EXIT_Y ) {
      // Descenso final a la pen: rutina propia, el grid no deja bajar por la pared.
      g.x = doorX;
      g.y = PEN_BOTTOM - 1;
      g.dir = 'down';
      g.phase = 'saliendo';
      return;
    }
    decideGhost( game, g );
    if ( !canMove( game.grid, g.x, g.y, g.dir, 'ghost' ) ) return;
  }

  const d = DIRS[ g.dir ];
  g.x += d.x * g.speed;
  g.y += d.y * g.speed;
  wrapTunnel( g, game.grid[ 0 ].length );
}

// Espera dentro de la pen: rebote vertical entre el techo y el fondo.
function moveGhostBouncing( g ) {
  if ( aligned( g.y ) ) g.y = Math.round( g.y );
  if ( g.y <= PEN_TOP ) g.dir = 'down';
  if ( g.y >= PEN_BOTTOM ) g.dir = 'up';
  g.y += DIRS[ g.dir ].y * g.speed;
}

function moveGhost( game, g ) {
  const grid = game.grid;
  const width = grid[ 0 ].length;

  // Se reasigna cada tick: los ojos vuelan, el susto va a mitad, y al terminar
  // el susto todo vuelve a GHOST_SPEED.
  if ( g.phase === 'ojos' ) g.speed = EYES_SPEED;
  else if ( game.frightTicks > 0 ) g.speed = FRIGHT_SPEED;
  else g.speed = GHOST_SPEED;

  if ( g.phase === 'casa' ) {
    // Espera su turno de salida.
    if ( game.ghostClock >= g.releaseAt ) {
      g.phase = 'saliendo';
      return;
    }
    moveGhostBouncing( g );
    return;
  }
  if ( g.phase === 'saliendo' ) {
    moveGhostLeaving( g );
    return;
  }

  if ( g.phase === 'ojos' ) {
    moveGhostEyes( game, g );
    return;
  }

  if ( aligned( g.x ) && aligned( g.y ) ) {
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );
    // Al activarse o reiniciarse el susto, los fantasmas libres invierten la
    // marcha al instante (frightTicks == FRIGHT_TICKS marca el tick de activacion).
    if ( game.frightTicks === FRIGHT_TICKS && g.phase === 'libre' ) {
      g.dir = OPPOSITE[ g.dir ];
    }
    decideGhost( game, g );
    if ( !canMove( grid, g.x, g.y, g.dir, 'ghost' ) ) return;
  }

  const d = DIRS[ g.dir ];
  g.x += d.x * g.speed;
  g.y += d.y * g.speed;
  wrapTunnel( g, width );
}

function resetPositions( game ) {
  const p = game.pacman;
  p.x = PACMAN_START.x;
  p.y = PACMAN_START.y;
  p.dir = 'left';
  p.nextDir = null;
  game.ghostClock = 0;
  // Sin susto residual: los fantasmas salen normales y escalonados.
  game.frightTicks = 0;
  game.frightChain = 0;
  game.ghosts.forEach( ( g, i ) => {
    g.x = GHOST_STARTS[ i ].x;
    g.y = GHOST_STARTS[ i ].y;
    g.dir = 'up';
    g.phase = 'casa';
    g.speed = GHOST_SPEED;
  } );
}

function collides( a, b ) {
  return Math.abs( a.x - b.x ) < 0.5 && Math.abs( a.y - b.y ) < 0.5;
}

function update( game ) {
  movePacman( game );
  game.ghostClock++;
  game.ghosts.forEach( ( g ) => moveGhost( game, g ) );

  for ( const g of game.ghosts ) {
    if ( !collides( game.pacman, g ) ) continue;

    if ( g.phase === 'ojos' ) continue; // los ojos se atraviesan, sin efecto
    // Asustado: solo comestible ya fuera de la casa. Mientras esta en
    // 'casa'/'saliendo' se pinta azul pero no se come (Pac-Man no entra en la
    // pen) y, por si acaso, tampoco mata.
    if ( game.frightTicks > 0 ) {
      if ( g.phase === 'libre' ) {
        game.score += GHOST_BASE_POINTS * Math.pow( 2, game.frightChain );
        game.frightChain = Math.min( game.frightChain + 1, 3 );
        g.phase = 'ojos';
        g.dir = 'up';
      }
      continue;
    }

    game.lives--;
    if ( game.lives <= 0 ) {
      game.state = 'lost';
      return;
    }
    resetPositions( game );
    break;
  }

  // La cuenta atras del susto va al final: si un pellet se come en este tick, los
  // fantasmas ya han actuado asustados y el timer baja a FRIGHT_TICKS - 1.
  if ( game.frightTicks > 0 ) game.frightTicks--;

  if ( game.dotsRemaining <= 0 ) game.state = 'won';
}

window.createGame = createGame;
window.update = update;
window.DIRS = DIRS;
// render.js los necesita para el parpadeo final del modo asustado.
window.FRIGHT_TICKS = FRIGHT_TICKS;
window.FRIGHT_FLASH_TICKS = FRIGHT_FLASH_TICKS;
