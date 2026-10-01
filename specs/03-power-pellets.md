# SPEC 03 — Power pellets y modo asustado

> **Estado:** Approved
> **Depende de:** SPEC 01
> **Fecha:** 2026-10-01
> **Objetivo:** Cuatro power pellets en las esquinas activan el modo asustado fiel del arcade: fantasmas azules, lentos y erráticos, comestibles en cadena 200/400/800/1600, que regresan a la casa como ojos y reviven.

## Alcance

**Dentro:**

- `src/js/maze.js`: 4 power pellets en las celdas del original `(1,3)`, `(26,3)`, `(1,23)`, `(26,23)` — pasan de `.` a `o` en `MAZE_STR`; `parseTile` mapea `'o'` → 4; leyenda de celdas actualizada.
- `src/js/game.js`: comer pellet suma 50 y activa el modo asustado: `frightTicks = 360`, cadena a 0.
- Modo asustado (6 s): fantasmas azul oscuro, giro 180° forzado inmediato (solo fase `libre`), velocidad 0.05 (mitad), dirección aleatoria en cada cruce.
- Comer fantasma azul: 200/400/800/1600 según cadena; el fantasma pasa a fase `ojos` (solo ojos, velocidad 0.2), vuelve a la puerta, entra, revive y sale de nuevo por la rutina `saliendo` existente — revive sin asustado.
- Fantasmas en `casa`/`saliendo` también se pintan azules; comestibles solo fuera (Pac-Man no puede entrar).
- `src/js/render.js`: pellets como círculos grandes con radio pulsante (tick); fantasma asustado azul con cara de susto; parpadeo blanco/azul los últimos 2 s; fase `ojos` dibuja solo los ojos.
- `game.dotsRemaining` cuenta dots + pellets (244): hay que comer los 4 para ganar.
- `resetPositions` limpia `frightTicks`/`frightChain` (sin susto residual).
- `AGENTS.md`: actualizar líneas de "Celdas" (valor 4) y "Fantasmas" (fase `ojos`, modo asustado).

**Fuera de alcance (para specs futuros):**

- Popup de puntos y freeze al comer un fantasma.
- Duración del susto según nivel (no hay niveles).
- Ciclo scatter/chase, Elroy, frutas.

## Modelo de datos

```js
// maze.js — leyenda: '#' pared(1) · '.' dot(2) · ' ' vacío(0) · '-' puerta(3) · 'o' pellet(4)
function parseTile( ch ) { if ( ch === 'o' ) return 4; /* ... */ }

// game.js — constantes y estado nuevos
const FRIGHT_TICKS = 360;       // 6 s a 60 ticks/s (SPEC 02), nivel 1 del arcade
const FRIGHT_FLASH_TICKS = 120; // últimos 2 s: parpadeo blanco/azul
const FRIGHT_SPEED = 0.05;      // mitad de GHOST_SPEED
const EYES_SPEED = 0.2;         // 2× GHOST_SPEED; los ojos vuelan a la casa
const PELLET_POINTS = 50;

// createGame / game:
frightTicks: 0, // 0 = inactivo; cuenta atrás cada tick
frightChain: 0, // 0..3 → 200/400/800/1600

// ghost.phase: 'casa' | 'saliendo' | 'libre' | 'ojos' (nueva)
```

Convenciones:

- `dotsRemaining` cuenta `v === 2 || v === 4` en `createGame` y `movePacman` come ambos valores (pellet: 50 + susto).
- Pellet con susto ya activo: reinicia `frightTicks` a 360 y `frightChain` a 0.
- En `ojos`: `decideGhost` con objetivo fijo `(13|14, 11)` (sobre la puerta); al llegar, baja a `(13|14, 14)`, revive → `saliendo` (rutina existente lo saca) y NO asustado, aunque quede timer.
- Colisión con `ojos`: se atraviesan, sin efecto.
- Asustado elige dirección aleatoria uniforme entre las válidas no-opuestas (callejón → 180°), sin objetivo.

## Plan de implementación

1. `maze.js`: `o` en las 4 celdas + `parseTile`. `game.js`: `dotsRemaining` cuenta 2 y 4; comer pellet (50, desaparece del grid). `render.js`: `drawDots` dibuja `v === 4` como círculo grande pulsante. Manual: 4 pellets grandes pulsando; comérselos suma 50 y el juego se gana solo con las 244 piezas.
2. `game.js`: modo asustado — `frightTicks`/`frightChain`, activación al comer pellet (y reinicio si ya activo), velocidad 0.05, giro 180° forzado en fase `libre`, rama aleatoria en `decideGhost`, cuenta atrás en `update`, `resetPositions` limpia el susto. `render.js`: fantasma azul con cara de susto. Manual: azules lentos y erráticos 6 s; pierden una vida → salen normales.
3. `game.js`: comer fantasmas — colisión con asustado: `200 * 2^chain`, `chain++`, fase `ojos` a `EYES_SPEED` con objetivo puerta; colisión con `ojos` sin efecto; al llegar a la casa revive → `saliendo` → `libre`. `render.js`: `ojos` dibuja solo los ojos. Manual: comer 2+ seguidos suma 200, 400...; el comido vuelve como ojos y sale normal.
4. `render.js`: parpadeo blanco/azul los últimos `FRIGHT_FLASH_TICKS`. Manual: en los últimos 2 s parpadean antes de volver a su color.
5. `AGENTS.md`: líneas "Celdas" (valor 4) y "Fantasmas" (fase `ojos`, modo asustado).

## Criterios de aceptación

- [ ] Al abrir `src/index.html` no hay errores en la consola.
- [ ] Se ven 4 pellets grandes en las esquinas, pulsando de tamaño.
- [ ] Comer un pellet suma 50 y lo borra del tablero.
- [ ] Al comerlo, los fantasmas se vuelven azul oscuro, invierten la marcha y van a mitad de velocidad de forma errática.
- [ ] Los fantasmas azules se pueden comer: 1º 200, 2º 400, 3º 800, 4º 1600 con el mismo pellet.
- [ ] El comido se ve como ojos, regresa a la casa, revive y vuelve a salir sin estar asustado.
- [ ] El susto dura 6 s y los últimos 2 s parpadean blanco/azul.
- [ ] Comer otro pellet con el susto activo reinicia los 6 s y la cadena.
- [ ] La victoria requiere las 244 piezas (dots + pellets).
- [ ] Tras perder una vida no queda susto residual: los fantasmas salen normales y escalonados.
- [ ] Sin regresiones: score, vidas, túnel, personalidades, ganar y perder funcionan igual.

## Decisiones

- **Sí:** fidelidad arcade en las 5 decisiones (susto completo, cadena + ojos, 6 s, parpadeos, victoria con 244). Elección explícita del usuario.
- **Sí:** valor de celda 4 (`'o'`). Sigue el patrón numérico del grid y la separación `MAZE` prístino / `game.grid`.
- **Sí:** posiciones `(1,3)`, `(26,3)`, `(1,23)`, `(26,23)`. Son las 4 energizers exactas del arcade ("cada esquina").
- **Sí:** timer + cadena globales en `game`, no flags por fantasma. Todos se calman a la vez, como el arcade; y revive-no-asustado cae solo.
- **Sí:** aleatorio uniforme en cruces, no la pseudo-tabla del arcade. Perceptiblemente equivalente, mucho menos código.
- **Sí:** `ojos` reutiliza `decideGhost` (objetivo puerta) y la fase `saliendo` para revivir y salir.
- **No:** popup de puntos + freeze al comer fantasma. Exigiría una mecánica de pausa que no existe; spec futuro si llega.
- **No:** duración por nivel. Sin niveles (ya anotado en 01 y 02).

## Riesgos

| Riesgo                                                            | Mitigación                                                                                  |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| El susto acaba justo al rozar un fantasma: vida perdida "injusta" | En `update` resolver colisiones antes de decrementar `frightTicks`.                         |
| Ojos atascados si el objetivo de la puerta no es transitable      | Manhattan ya funciona con objetivos en pared (SPEC 01); el descenso final es rutina propia. |
| Fantasma en `saliendo` azul comestible al salir con susto activo  | Esperado: igual que el arcade; solo comestible una vez fuera de la casa.                    |

## Qué **no** está en este spec

- Popup de puntos y freeze al comer fantasma.
- Duración del susto por nivel / niveles.
- Scatter/chase, Elroy, frutas.

Cada uno de esos, si llega, va en su propio spec.
