# AGENTS.md — 05-open-pacman

Juego PacMan en vanilla JS/HTML/CSS. Sin `package.json`, sin build, sin bundler, sin tests ni linter: no busques ni intentes ejecutar `npm run ...`. La verificación es manual, abriendo `src/index.html` en el navegador y revisando la consola.

Este repo existe para practicar **Spec Driven Development**: las features se definen como specs antes de escribir código.

## Flujo de trabajo (spec-driven)

- Feature nueva → `/spec <descripción>` → genera `specs/NN-slug.md` en estado `Draft` (numeración secuencial desde 01, kebab-case). La primera vez siembra `specs/.spec-config.yml` (`AutoCreateBranch: true` por defecto); si ya existe, no la toques.
- El paso `Draft` → `Approved` lo hace el humano editando el spec; nunca lo marques tú.
- Implementar → `/spec-impl NN-slug` → valida estado `Approved` (o `Aprobado`/equivalente), crea branch `spec-NN-slug` e implementa paso a paso, pausando tras cada paso para revisión del diff. Nunca committea: los commits son decisión explícita del usuario.
- Si un spec depende de otro (`Depends on:`), verifica que el referenciado exista en `specs/`.
- Las skills viven en `.agents/skills/{spec,spec-impl}` y están pineadas en `skills-lock.json` (fuente `klerith/fernando-skills`). No las edites a mano.

## Arquitectura (no obvia desde los nombres de archivo)

- Entrada: `src/index.html`. Funciona con `file://` — no hace falta dev server.
- Scripts classic (NO ES modules), en orden estricto en `index.html`: `maze.js` → `game.js` → `render.js` → `main.js`. Se comunican por globals en `window` (`window.MAZE`, `window.createGame`, `window.update`, `window.draw`, `window.DIRS`). No introduzcas `import`/`export` sin un spec que lo justifique.
- `maze.js` define constantes prístinas: `MAZE` (28×31, strings parseadas a números), `TUNNEL_ROW`, `PACMAN_START`, `GHOST_STARTS`.
- `game.js` copia `MAZE` a `game.grid` para comer dots sin destruir el original (permite reiniciar). `render.js` dibuja desde `game.grid`, nunca desde `MAZE` — así los dots comidos desaparecen. Mantén esa separación.
- Celdas: 0 vacío · 1 pared · 2 dot · 3 puerta de la casa. Pacman bloquea con 1 y 3; los fantasmas solo con 1.
- Coordenadas: celda (x,y), origen arriba-izquierda, x∈[0,27], y∈[0,30]; `TILE = 20` px → canvas 560×620.
- Movimiento: posiciones fraccionales con velocidad en celdas/frame (Pacman 0.125, fantasma 0.1); los giros solo se aplican alineado a la celda (tolerancia 1e-3). El túnel (fila `TUNNEL_ROW`) envuelve horizontalmente.
- Partida: estados `start | playing | won | lost`. Fantasmas: 4 kinds clásicos (`blinky` | `pinky` | `inky` | `clyde`), cada uno con su objetivo y su `color` en `GHOST_STARTS`; eligen la dirección no-opuesta que minimiza la distancia Manhattan a su objetivo (giro 180° solo en callejón). Fases: `casa` (espera, rebota verticalmente) → `saliendo` (se alinea en la columna de la puerta 13/14 y sube hasta `y = 11`) → `libre`. La salida escalonada la marca `game.ghostClock` (frames): `releaseAt` = 90/180/270/360 según el índice.

## Convenciones

- Idioma: español en comentarios, UI, README y specs (usa las palabras de estado del template: `Draft/Approved/Implemented` o sus equivalentes en español, pero consistente).
- Estilo JS del repo: comillas simples, espacios dentro de paréntesis `( arg )`, punto y coma. Sigue el estilo existente sin linter que lo fuerce.
- Git: branch base `main`; branches de specs `spec-NN-slug`.
