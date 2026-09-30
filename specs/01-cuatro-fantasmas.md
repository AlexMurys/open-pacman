# SPEC 01 — Cuatro fantasmas con personalidad clásica

> **Estado:** Approved
> **Depende de:** ninguno
> **Fecha:** 2026-09-30
> **Objetivo:** Los cuatro fantasmas clásicos (Blinky, Pinky, Inky y Clyde) salen escalonados de la casa y cada uno persigue a Pac-Man con su propia táctica, siendo Blinky el agresivo directo.

## Alcance

**Dentro:**

- `GHOST_STARTS` pasa de 2 a 4 fantasmas en `src/js/maze.js`, cada uno con
  `kind` (nombre clásico) y `color` propio.
- `decideGhost` en `src/js/game.js` elige dirección minimizando distancia
  Manhattan a un **objetivo por kind** (blinky, pinky, inky, clyde).
- Salida escalonada automática: los 4 empiezan dentro de la casa y salen a
  1.5 s, 3 s, 4.5 s y 6 s (orden Blinky, Pinky, Inky, Clyde).
- Mientras esperan, rebotan verticalmente dentro de la casa.
- Tras perder una vida: reset completo, mismo patrón de salida escalonado.
- `src/js/render.js` pinta cada fantasma con `g.color` (adiós a `GHOST_COLORS`).
- Actualizar la línea de "Fantasmas" en `AGENTS.md` a los nuevos 4 kinds.

**Fuera de alcance (para specs futuros):**

- Ciclo scatter/chase.
- Modo asustado, power pellets y comer fantasmas.
- Aceleración "Elroy" de Blinky.
- Niveles y dificultad creciente.

## Modelo de datos

```js
// maze.js — GHOST_STARTS (4 entradas; kind = nombre clásico)
const GHOST_STARTS = [
  { x: 13, y: 14, kind: "blinky", color: "#ff0000" }, // rojo, agresivo
  { x: 12, y: 14, kind: "pinky", color: "#ffb8ff" }, // rosa
  { x: 15, y: 14, kind: "inky", color: "#00ffff" }, // cian
  { x: 14, y: 14, kind: "clyde", color: "#ffb852" }, // naranja
];
```

```js
// game.js — campos nuevos por fantasma y en game
// phase: 'casa' → 'saliendo' → 'libre'
ghost = { x, y, dir, speed, kind, color, phase: "casa", releaseAt: 90 };
game.ghostClock = 0; // frames desde el (re)inicio; se resetea en createGame y resetPositions
```

Convenciones:

- 1.5 s ≈ 90 frames a 60 fps: `releaseAt` = 90, 180, 270, 360 según el índice.
- Objetivos por kind (celdas, no hace falta que sean transitables):
  - `blinky`: celda de Pac-Man redondeada.
  - `pinky`: 4 celdas delante según `pacman.dir`; si mira `up`, 4 arriba + 4
    izquierda (bug fiel del arcade).
  - `inky`: punto `a` = 2 celdas delante de Pac-Man (mismo bug con `up`);
    objetivo = `2*a - celda de blinky` (vector Blinky→`a` doblado).
  - `clyde`: si distancia Manhattan a Pac-Man > 8 → Pac-Man; si ≤ 8 → esquina
    inferior izquierda, celda `(1, 29)`.
- Salida de la casa (`phase: 'saliendo'`): primero alinear horizontalmente en
  `y = 14` hacia la columna de puerta 13 o 14, luego subir hasta `y = 11`
  (fuera), y pasar a `phase: 'libre'`.

## Plan de implementación

1. `src/js/maze.js`: `GHOST_STARTS` con las 4 entradas nuevas. `src/js/game.js`
   (createGame) propaga `color`. `src/js/render.js`: `drawGhost` usa `g.color`,
   eliminar `GHOST_COLORS`. Manual: 4 fantasmas con colores clásicos dentro de
   la casa, sin errores en consola (conductas aún aleatorias).
2. `src/js/game.js`: refactor de `decideGhost` — extraer `ghostTarget( game, g )`
   y elegir siempre la dirección que minimiza Manhattan al objetivo. De momento
   todos apuntan a la celda de Pac-Man (blinky queda definido). Manual: los 4
   acosan directo.
3. `src/js/game.js`: objetivo de `pinky` (4 delante + bug de `up`). Manual:
   Pinky corta el paso por delante de Pac-Man.
4. `src/js/game.js`: objetivo de `inky` (usa la posición de blinky). Manual:
   Inky flanquea mientras Blinky acosa.
5. `src/js/game.js`: objetivo de `clyde` (retirada a `(1, 29)` a ≤ 8 celdas).
   Manual: Clyde huye de Pac-Man cuando se acercan.
6. `src/js/game.js`: fases `casa | saliendo | libre`, `game.ghostClock`,
   liberación a `releaseAt` y rutina de salida (alinear + subir por la puerta).
   Manual: los 4 salen escalonados cada ~1.5 s.
7. `src/js/game.js`: rebote vertical en fase `casa` y reset completo en
   `resetPositions` (posiciones, fases y `ghostClock`). Manual: al perder una
   vida, los 4 vuelven a la casa y repiten la salida escalonada.
8. `AGENTS.md`: actualizar la línea de "Fantasmas" con los 4 kinds y las fases.

## Criterios de aceptación

- [ ] Al abrir `src/index.html` no hay errores en la consola.
- [ ] Se ven 4 fantasmas: rojo, rosa, cian y naranja.
- [ ] Blinky acosa directamente a Pac-Man en todo momento.
- [ ] Pinky apunta 4 celdas delante de la dirección de Pac-Man.
- [ ] Con Pac-Man mirando arriba, Pinky apunta arriba + izquierda.
- [ ] Inky flanquea: su objetivo depende de la posición de Blinky.
- [ ] Clyde se retira a la esquina inferior izquierda al estar a ≤ 8 celdas.
- [ ] Las salidas ocurren a ~1.5 s, 3 s, 4.5 s y 6 s, en orden Blinky → Clyde.
- [ ] Los fantasmas en espera rebotan verticalmente dentro de la casa.
- [ ] Tras perder una vida, los 4 vuelven a la casa y repiten la salida.
- [ ] Sin regresiones: score, vidas, túnel, ganar y perder funcionan igual.

## Decisiones

- **Sí:** conductas clásicas del arcade (objetivo por kind + Manhattan).
  Es el estándar del juego y encaja con el `hunter` ya existente.
- **Sí:** salida por tiempo (1.5 s), elegida por el usuario frente a por dots.
- **Sí:** bug fiel de Pinky (y de Inky) con `up`. Elección explícita del usuario.
- **Sí:** `kind` = nombre clásico. El nombre es la conducta; se acabó el
  'hunter'/'random' de AGENTS.md.
- **Sí:** reloj en frames (90 frames = 1.5 s). Coherente con velocidades por
  frame que ya usa el juego.
- **No:** scatter/chase, modo asustado y Elroy. Cada uno merece su propio spec.
- **No:** conservar el kind `random`. Nadie lo defiende ya.

## Riesgos

| Riesgo                                                           | Mitigación                                                                   |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| rAF a 120 Hz doblaría la velocidad del reloj                     | Aceptado: todo el juego ya corre por frames, no por tiempo real.             |
| Fantasmas en columnas 12/15 no alinean con la puerta de 2 celdas | La fase `saliendo` alinea horizontalmente antes de subir.                    |
| Objetivos dentro de paredes                                      | Esperado: Manhattan mide distancia, no alcanzabilidad (igual que el arcade). |

## Qué **no** está en este spec

- Ciclo scatter/chase.
- Modo asustado / power pellets / comer fantasmas.
- Aceleración "Elroy".
- Niveles y dificultad creciente.

Cada uno de esos, si llega, va en su propio spec.
