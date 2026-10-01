# SPEC 02 — Velocidad estable: bucle a paso fijo de 60 ticks/s

> **Estado:** Approved
> **Depende de:** ninguno
> **Fecha:** 2026-10-01
> **Objetivo:** El juego corre a ritmo constante de 60 ticks por segundo en cualquier monitor (incluidos los de 120 Hz), manteniendo las velocidades y tiempos actuales.

## Por qué existe este spec

`main.js` ejecuta `update()` en cada `requestAnimationFrame`, que corre al Hz del
monitor. En pantallas ProMotion (120 Hz) todo el juego se mueve al doble de la
velocidad diseñada, porque el modelo entero (velocidades por frame, `releaseAt`,
animación de boca) está calibrado a 60 fps. SPEC 01 ya lo anotó como riesgo
aceptado; este spec lo resuelve.

## Alcance

**Dentro:**

- `src/js/main.js`: bucle de paso fijo — acumulador de tiempo real que ejecuta
  `update()` exactamente 60 veces por segundo, independiente de los Hz del monitor.
- La boca de Pac-Man pasa del contador `frame` de rAF al reloj de ticks (`draw`
  recibe el tick; `render.js` no cambia).
- El reloj de ticks avanza siempre (también en `start`/`won`/`lost`), para que la
  boca siga animada en pantallas de espera, igual que hoy.
- Clamp del delta acumulado (≤ 100 ms por rAF) para evitar el espiral de muerte
  tras una pestaña en segundo plano.
- `AGENTS.md`: actualizar la línea de "Movimiento" documentando el paso fijo.
- Velocidades intactas: `PACMAN_SPEED` 0.125, `GHOST_SPEED` 0.1, `releaseAt`
  90/180/270/360 — a 60 ticks/s conservan su significado actual.

**Fuera de alcance (para specs futuros):**

- Dificultad creciente / reducir velocidades.
- Multiplicador global de velocidad (`SPEED_SCALE`).
- Pausa del juego (visibilitychange / tecla).

## Modelo de datos

```js
// main.js — estado del bucle (nuevo; reemplaza a `let frame = 0`)
const TICK_MS = 1000 / 60; // 16.666 ms por tick
let acc = 0; // acumulador de tiempo real (ms)
let last = performance.now(); // marca del rAF anterior
let tick = 0; // reloj del juego (pasa a `draw`)
```

Convenciones:

- 1 tick = 1/60 s. `update()` y `game.ghostClock` siguen contando ticks; nada
  cambia en `game.js`.
- El clamp descarta el exceso de tiempo, no lo compensa: volver de segundo plano
  no dispara una ráfaga de updates.

## Plan de implementación

1. `src/js/main.js`: sustituir el bucle por el acumulador — delta con clamp a
   100 ms, `while ( acc >= TICK_MS ) { tick++; if ( playing ) update + overlays }`,
   y `draw( ctx, game, tick )` una vez por rAF. Manual: abrir `src/index.html` —
   ritmo idéntico al actual a 60 Hz, boca animada, sin errores en consola.
2. `AGENTS.md`: actualizar la línea de "Movimiento" — paso fijo de 60 ticks/s,
   velocidades por tick, no por frame de rAF.

## Criterios de aceptación

- [ ] Al abrir `src/index.html` no hay errores en la consola.
- [ ] En monitor de 120 Hz, Pac-Man cruza una celda en ~0.133 s (8 ticks), no
      ~0.066 s.
- [ ] En monitor de 60 Hz el ritmo es idéntico al de la versión anterior.
- [ ] Las salidas de fantasmas siguen separadas ~1.5 s (90 ticks) en cualquier
      monitor.
- [ ] La boca se abre/cierra al mismo ritmo en cualquier monitor.
- [ ] Tras >10 s en segundo plano y volver, no hay ráfaga de updates (el clamp
      descarta el exceso).
- [ ] Sin regresiones: score, vidas, túnel, ganar, perder y reset de fantasmas
      funcionan igual.

## Decisiones

- **Sí:** paso fijo de 60 ticks/s con acumulador en `main.js`. Arregla la causa
  raíz (rAF al Hz del monitor) sin tocar `game.js`.
- **Sí:** mantener las velocidades actuales. A 60 ticks/s conservan su valor de
  diseño; el problema era el monitor, no los valores.
- **Sí:** boca ligada al reloj de ticks (vía el contador que `main.js` pasa a
  `draw`). `render.js` intacto.
- **Sí:** clamp del delta a 100 ms. Sin él, volver de segundo plano ejecutaría
  cientos de updates de golpe.
- **No:** velocidades en celdas/segundo con delta-time. Rompería la alineación
  por celda (tolerancia 1e-3) y obligaría a reabrir todo `game.js`.
- **No:** multiplicador global (`SPEED_SCALE`). Fuera de alcance; dificultad es
  otro spec.

## Riesgos

| Riesgo                                                   | Mitigación                                                       |
| -------------------------------------------------------- | ---------------------------------------------------------------- |
| Monitor muy rápido (240 Hz): ticks espaciados entre rAFs | Aceptado: `draw()` corre en cada rAF; el movimiento es por ticks |
| Pestaña en segundo plano acumula segundos                | Clamp del delta a 100 ms por rAF                                 |

## Qué **no** está en este spec

- Dificultad creciente / niveles (spec futuro ya anotado en 01).
- Multiplicador global de velocidad.
- Pausa del juego.

Cada uno de esos, si llega, va en su propio spec.
