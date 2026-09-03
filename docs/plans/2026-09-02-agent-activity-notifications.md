# Plan de implementación — actividad de agentes y notificaciones

**Estado:** En curso

**Creado:** 2026-09-02

**Progreso:** 10/11 tareas completadas

**Alcance:** Vista de ejecuciones de agentes, notificaciones nativas, ajustes de comportamiento y rediseño acordado de la interfaz.

**Implementación iniciada:** Sí

Este es el registro de ejecución de la funcionalidad. Debe actualizarse en el
mismo cambio que hace avanzar una tarea: marcar el checklist, registrar la
evidencia ROJA/VERDE y añadir una entrada al registro de progreso. Una tarea no
está completa solo porque exista su código.

## Leyenda de estados

- `[ ]` Pendiente
- `[~]` En curso
- `[x]` Completada y verificada
- `[!]` Bloqueada; el motivo debe constar en el registro de progreso

## Protocolo de trabajo

Para cada tarea de implementación:

1. Cambiar su marcador principal de `[ ]` a `[~]` antes de editar código de producción.
2. Escribir o ampliar primero las pruebas indicadas.
3. Ejecutar el comando de pruebas específico y registrar el fallo esperado como **evidencia ROJA**.
4. Implementar el comportamiento mínimo necesario para que pase.
5. Ejecutar el comando de pruebas específico y registrar el resultado como **evidencia VERDE**.
6. Refactorizar manteniendo las pruebas en verde.
7. Ejecutar la puerta de verificación de la tarea y registrar su resultado.
8. Marcar la tarea `[x]`, actualizar el progreso y añadir una entrada fechada al registro.

Las tareas exclusivamente documentales no necesitan una prueba fallida
artificial, pero sí completar su checklist de aceptación y validar sus enlaces.

## Decisiones de producto cerradas

- `Games` es la pestaña izquierda y la vista normal por defecto.
- `Agents` es la pestaña derecha.
- Si hay una partida en curso oculta, al reabrir el popover se vuelve a esa partida.
- Pulsar una notificación puede abrir `Agents`; nunca controla ni enfoca el terminal del agente.
- El menú `···` contiene `Add game` y `Settings`.
- No hay una acción `Reply` dentro de las filas.
- No hay una acción inferior `Choose a game` en la vista `Agents`.
- La apertura automática de juegos y las notificaciones nativas son interruptores independientes.
- Con ambos interruptores apagados, los juegos manuales y la vista `Agents` en directo siguen funcionando.
- Los subagentes no cuentan como ejecuciones independientes.
- `needs_user` siempre tiene prioridad sobre `working` para reclamar atención.
- Terminar cualquier ejecución de un agente principal pausa inmediatamente la partida, aunque otros agentes sigan trabajando.
- `SubagentStop` no pausa la partida ni altera los contadores.
- Si el popover ya está visible, Meanwaile no duplica el evento con una notificación del sistema.
- El sonido de las notificaciones está desactivado por defecto.
- Se elimina la tarjeta introductoria de `Settings`.
- El tiempo de inactividad y el puerto tienen tooltips de ayuda accesibles mediante teclado.

## Decisiones sobre datos y privacidad

- La identidad de sesión es el compuesto `(adapterId, sessionId)`, nunca solo `sessionId`.
- Las etiquetas de proyecto provienen del basename del `cwd` proporcionado por el adapter.
- Las rutas completas, prompts, transcripciones, entradas de herramientas y respuestas del asistente nunca se muestran en la interfaz ni se almacenan.
- Al principio, las ejecuciones terminadas solo se guardan en memoria, con un máximo de 20 registros.
- El historial de finalizaciones se reinicia al cerrar Meanwaile.
- Un registro sin eventos durante 24 horas caduca silenciosamente; la caducidad no se considera una finalización correcta ni genera una notificación.
- Los hooks sin ID de sesión utilizan una clave de respaldo limitada al adapter para evitar colisiones entre Claude y Codex.

## Política de idioma y textos de la aplicación

- Todo el texto visible dentro de Meanwaile se escribe en inglés.
- Este plan y la documentación de trabajo permanecen en español.
- Los mockups en español solo son referencia de disposición y jerarquía visual.
- Esta funcionalidad no añade internacionalización; los strings de producción se definen directamente en inglés.

**Textos principales de la vista**

- `Games`
- `Agents`
- `working`
- `needs you`
- `finished`
- `Finished recently`
- `Add game`
- `Settings`

**Textos principales de configuración**

- `Automation`
- `Open games automatically`
- `Notifications`
- `When an agent needs attention`
- `When an agent finishes`
- `Sound`
- `No sound`
- `Detection`
- `Idle time`
- `Port`
- `Active`
- `Save settings`

## Referencias de diseño acordadas

- Vista `Agents`: [main-05-agents-games-tabs-v3-agents-view.png](../design-concepts/agents-and-notifications/main-05-agents-games-tabs-v3-agents-view.png)
- `Settings`: [settings-05-compact-summary-v2-help.png](../design-concepts/agents-and-notifications/settings-05-compact-summary-v2-help.png)

Las imágenes expresan la jerarquía y la dirección visual, no el idioma final.
No autorizan a añadir controles falsos: deben omitirse las affordances sin
comportamiento definido.

## Arquitectura objetivo

```text
Claude/Codex hooks
        │
        ▼
   AgentAdapter
        │
        ▼
    AgentEvent
      ├────────► StateMachine ─────► detector de espera
      ├────────► política de interrupción ─► pausa y overlay del juego
      │
      └────────► ExecutionTracker ─► interfaz de `Agents`
                                  ├► servicio de notificaciones
                                  └► estado del tray
```

La máquina de estados agregada existente sigue siendo responsable de la
temporización y elegibilidad de la apertura automática. Una política de
interrupción separada pausa la partida ante `needs_user` o `task_finished` de
cualquier agente principal, incluso cuando no cambia el estado agregado porque
quedan otros agentes trabajando. El nuevo tracker es responsable de la
proyección por ejecución.

## Matriz de aceptación

| Juegos automáticos | Notificaciones | Comportamiento requerido |
|---|---|---|
| Sí | No | Oferta actual de una sola comprobación de inactividad; sin notificaciones nativas |
| No | Sí | Nunca abre juegos automáticamente; notifica los eventos habilitados de agentes |
| Sí | Sí | Abre juegos y notifica, salvo que el popover ya comunique el evento |
| No | No | Sin interrupciones automáticas; permanecen disponibles los juegos manuales y la vista `Agents` |

## Tareas de ejecución

### [x] T00 — Establecer y registrar la línea base

**Objetivo:** Demostrar que el repositorio está en verde antes de desarrollar la
funcionalidad y registrar el comportamiento inicial que no debe sufrir regresiones.

**Acciones**

- [x] Ejecutar `npm test`.
- [x] Ejecutar `npm run build`.
- [x] Ejecutar `npm run test:e2e` cuando el entorno local permita las pruebas de interfaz de Electron.
- [x] Registrar el número de pruebas correctas y cualquier fallo preexistente.
- [x] Comprobar `git status --short` y distinguir los cambios previos del usuario de los cambios de esta funcionalidad.

**Puerta de verificación:** La suite unitaria existente y la compilación TypeScript
pasan, o todos los fallos previos quedan documentados antes de continuar.

**Evidencias**

- Pruebas unitarias iniciales: `npm test` descubre por error copias dentro de
  `.claude/worktrees` y termina con 12 archivos fallidos externos al árbol de
  esta rama (85 archivos y 1411 pruebas correctas). La suite propia, ejecutada
  como `npm test -- --exclude '.claude/**'`, pasa: 31 archivos y 531 pruebas.
- Compilación inicial: `npm run build` pasa sin errores.
- E2E inicial: dentro del sandbox falla por `listen EPERM` y por no poder lanzar
  Electron; repetida fuera del sandbox, pasa con 3 de 3 pruebas.
- Notas del árbol de trabajo: antes de iniciar solo existía `docs/` sin seguir,
  creado para esta funcionalidad. No había cambios previos del usuario en
  archivos versionados.

### [x] T01 — Actualizar el contrato de producto antes del código

**Objetivo:** Eliminar la contradicción entre la antigua promesa «Sin
notificaciones» y el nuevo comportamiento de producto aprobado.

**Archivos**

- `PRODUCT_BRIEF.md` (fuente local ignorada deliberadamente por Git)
- `AGENTS.md`
- `CONTRIBUTING.md`

**Checklist de aceptación**

- [x] Sustituir «Sin notificaciones» por notificaciones silenciosas, configurables y dirigidas por eventos.
- [x] Documentar las cuatro combinaciones de ajustes.
- [x] Definir los contadores de activos, trabajando, necesita-atención y terminados recientemente.
- [x] Indicar que los subagentes no cuentan.
- [x] Definir que una finalización parcial de un agente principal pausa el juego y muestra el recuento restante.
- [x] Conservar «sin integraciones», el funcionamiento local y la ausencia de analítica de productividad.
- [x] Documentar la política de historial transitorio y privacidad.

**Puerta de verificación:** Los tres documentos coinciden entre sí y con las
decisiones cerradas anteriores.

**Evidencias**

- Revisión del contrato: `rg` confirma que ya no quedan prohibiciones generales
  de notificaciones en `AGENTS.md`, `CONTRIBUTING.md` ni `PRODUCT_BRIEF.md`.
  Los tres recogen notificaciones locales configurables, exclusión de
  subagentes, pausa por finalización principal y límites de privacidad. El
  product brief se mantiene como fuente local ignorada por Git; no se fuerza su
  incorporación al repositorio.

### [x] T02 — Ampliar el contrato de eventos independiente del adapter

**Objetivo:** Proporcionar una identidad de ejecución estable y metadatos de
presentación seguros sin filtrar fuera de los adapters payloads específicos de
Claude o Codex.

**Archivos de producción**

- `src/adapters/types.ts`
- `src/adapters/claude-code.ts`
- `src/adapters/codex.ts`

**Archivos de pruebas**

- `tests/adapters/claude-code.test.ts`
- `tests/adapters/codex.test.ts`

**Campos esperados del evento**

- `adapterId`
- `sessionId`
- `agentName`
- `projectName`, derivado del basename de `cwd`
- `timestamp`
- tipo de evento existente

**Checklist TDD**

- [x] ROJO: las pruebas de adapters exigen `adapterId` y un `projectName` saneado.
- [x] ROJO: las pruebas cubren `cwd` ausente o malformado y `session_id` ausente.
- [x] ROJO: las pruebas conservan la regla de que `SubagentStop` no finaliza al padre.
- [x] VERDE: implementar una extracción segura compartida del basename o un parseo local equivalente.
- [x] VERDE: pasan todas las pruebas de adapters.
- [x] Refactorizar sin exponer los payloads sin procesar de los hooks.

**Puerta de verificación:** `npx vitest run tests/adapters`

**Evidencias**

- Evidencia ROJA: 6 fallos esperados en adapters por `adapterId` ausente y
  `session_id` numérico sin filtrar; 1 fallo adicional demuestra que la máquina
  mezclaba dos adapters con el mismo `sessionId`.
- Evidencia VERDE: extracción compartida de strings y basename, eventos con
  `adapterId` obligatorio y clave compuesta también en la máquina de estados.
- Resultado de la puerta: 4 archivos y 74 pruebas correctas con
  `npx vitest run tests/adapters tests/state-machine.test.ts --exclude '.claude/**'`;
  `npm run build` correcto.

### [x] T03 — Construir el tracker por ejecución

**Objetivo:** Producir el snapshot de ejecuciones activas y recientes que
necesitan la interfaz, las notificaciones y el tray sin cambiar la semántica del
estado agregado existente.

**Nuevo archivo de producción**

- `src/execution-tracker.ts`

**Nuevo archivo de pruebas**

- `tests/execution-tracker.test.ts`

**Comportamiento requerido**

- [x] El primer `prompt_submitted` o `work_resumed` crea una ejecución trabajando.
- [x] Los eventos repetidos del mismo estado actualizan las marcas de tiempo sin duplicar registros.
- [x] `needs_user` mueve únicamente la ejecución correspondiente a necesita-atención.
- [x] `task_finished` mueve únicamente la ejecución correspondiente al historial reciente.
- [x] Los eventos de finalización duplicados no duplican historial ni notificaciones.
- [x] Los contadores distinguen trabajando, necesita-atención, activos y terminados.
- [x] Dos adapters con el mismo ID de sesión permanecen diferenciados.
- [x] Dos sesiones del mismo proyecto permanecen diferenciadas.
- [x] Los ID de sesión ausentes quedan limitados a su adapter.
- [x] El historial reciente se ordena del más nuevo al más antiguo y tiene un máximo de 20.
- [x] Los registros obsoletos caducan silenciosamente después de 24 horas.
- [x] El tracker informa de si un evento provocó una transición significativa.

**Checklist TDD**

- [x] ROJO: crear la suite completa del comportamiento anterior.
- [x] VERDE: implementar el tracker mínimo.
- [x] Refactorizar la creación del snapshot para devolver datos inmutables.

**Puerta de verificación:** `npx vitest run tests/execution-tracker.test.ts tests/state-machine.test.ts`

**Evidencias**

- Evidencia ROJA: la suite nueva falla al importar el módulo inexistente
  `src/execution-tracker.ts`.
- Evidencia VERDE: 17/17 pruebas del tracker y cobertura del archivo al 100 %
  en statements, branches, functions y lines.
- Resultado de la puerta: 34/34 pruebas correctas entre tracker y máquina de
  estados; regresión propia completa 563/563 y `npm run build` correcto.

### [x] T04 — Ampliar la configuración y migrar a los usuarios existentes

**Objetivo:** Persistir los dos comportamientos principales independientes y
los detalles de notificaciones sin romper los archivos `settings.json` existentes.

**Archivo de producción**

- `src/settings-store.ts`

**Archivo de pruebas**

- `tests/settings-store.test.ts`

**Nuevos ajustes**

```ts
interface AppSettings {
  httpPort: number;
  autoOpenDelaySeconds: number;
  autoOpenGames: boolean;
  notificationsEnabled: boolean;
  notifyNeedsUser: boolean;
  notifyFinished: boolean;
  notificationSound: 'none' | 'system';
}
```

**Política de migración y valores por defecto**

- Ajustes existentes o ausentes: `autoOpenGames: true`.
- Ajustes existentes o ausentes: `notificationsEnabled: false`.
- Las preferencias de eventos notificables se activan por defecto, pero quedan inertes detrás del interruptor principal.
- El sonido utiliza `none` por defecto.
- Los campos desconocidos se ignoran; los campos conocidos no válidos se rechazan o reciben un valor seguro según la distinción existente entre lectura y validación.

**Checklist TDD**

- [x] ROJO: los archivos antiguos de dos campos migran al modelo completo.
- [x] ROJO: se validan todos los booleanos y valores de sonido.
- [x] ROJO: el ciclo lectura/escritura conserva todos los campos.
- [x] ROJO: se validan las cuatro combinaciones de comportamiento.
- [x] VERDE: implementar valores por defecto, migración, serialización y validación.

**Puerta de verificación:** `npx vitest run tests/settings-store.test.ts`

**Evidencias**

- Evidencia ROJA: 12/24 pruebas fallan por ausencia de los nuevos campos,
  migración, validación de booleanos y enum de sonido.
- Evidencia VERDE: lectura defensiva por campo, migración de archivos antiguos,
  serialización completa y validación de las cuatro combinaciones.
- Resultado de la puerta: 27/27 pruebas correctas y cobertura de
  `src/settings-store.ts` al 100 % en statements, branches, functions y lines;
  `npm run build` correcto.

### [x] T05 — Implementar la política de notificaciones nativas

**Objetivo:** Convertir las transiciones significativas del tracker en
notificaciones nativas deduplicadas con textos multiagente correctos.

**Nuevos archivos de producción**

- `src/notification-service.ts`
- `src/notification-copy.ts` si los textos y plurales justifican separarlo

**Nuevos archivos de pruebas**

- `tests/notification-service.test.ts`
- `tests/notification-copy.test.ts` si se separa

**Comportamiento requerido**

- [x] No se muestra ninguna notificación cuando el interruptor principal está apagado.
- [x] Se respetan `notifyNeedsUser` y `notifyFinished` de forma independiente.
- [x] Los eventos de trabajo o reanudación no generan notificaciones.
- [x] Los hooks duplicados no generan notificaciones duplicadas.
- [x] La caducidad silenciosa de registros obsoletos no genera notificaciones.
- [x] No se notifica cuando Electron indica que no existe soporte.
- [x] `silent` respeta el ajuste de sonido.
- [x] El texto de necesita-atención incluye agente y proyecto cuando están disponibles.
- [x] El texto de finalización utiliza los contadores posteriores a retirar la ejecución terminada.
- [x] Los textos en singular y plural son correctos.
- [x] Los estados restantes mixtos mencionan los agentes activos que necesitan atención.
- [x] Si el popup está visible, se suprime la notificación nativa.
- [x] Al pulsar una notificación se abre la vista `Agents` y se destaca la ejecución; nunca se controla otra aplicación.

**Ejemplos de texto**

- `Claude · website needs your attention`
- `Waiting for confirmation or a response.`
- `Codex · meanwaile finished`
- `2 other agents are still working.`
- `3 agents remain active; 1 needs your attention.`

**Checklist TDD**

- [x] ROJO: las pruebas unitarias cubren la matriz completa de políticas.
- [x] VERDE: implementar detrás de una fachada inyectada para `Notification` de Electron.
- [x] Refactorizar la generación de textos para separarla de los efectos de Electron.

**Puerta de verificación:** `npx vitest run tests/notification-service.test.ts tests/notification-copy.test.ts`

**Evidencias**

- Evidencia ROJA: las dos suites nuevas fallan al importar
  `notification-service` y `notification-copy`, todavía inexistentes.
- Evidencia VERDE: fachada de plataforma inyectable, política independiente de
  Electron y copy separado con plurales y resumen posterior a la finalización.
- Resultado de la puerta: 20/20 pruebas focalizadas y cobertura al 100 % de
  ambos módulos; regresión propia 597/597 y `npm run build` correcto.

### [x] T06 — Orquestar eventos, IPC, tray y permisos

**Objetivo:** Conectar el tracker y las notificaciones con el proceso principal,
preservando el detector de espera de una sola comprobación y la frontera segura
con el renderer.

**Archivos de producción**

- `src/main.ts`
- `src/preload.ts`
- nuevo `src/window-router.ts` opcional si el enrutado de vistas deja de ser trivial

**Archivos de pruebas**

- `tests/main.test.ts`
- `tests/preload.test.ts`
- `tests/main-dev-mode.test.ts` cuando el comportamiento de ventanas difiera en desarrollo

**Superficie IPC necesaria**

- Obtener el snapshot actual de ejecuciones.
- Suscribirse a los cambios del snapshot de ejecuciones.
- Abrir el popover en `Games` o `Agents`.
- Leer el estado de soporte y permisos de notificaciones.
- Solicitar permiso mediante una API de alcance limitado cuando la plataforma lo requiera.
- Leer el estado real del servidor local para la pantalla de `Settings`.

**Comportamiento de orquestación requerido**

- [x] Cada evento de adapter llega tanto a `StateMachine` como a `ExecutionTracker`.
- [x] Los snapshots del tracker se envían aunque no cambie el estado agregado de la aplicación.
- [x] Cada `needs_user` o `task_finished` significativo de un agente principal envía una interrupción al juego aunque no cambie el estado agregado.
- [x] Una finalización parcial pausa la partida y muestra cuántos agentes siguen trabajando (IPC `agent-interruption` con `transition`, `execution` y `counts`; el overlay lo pinta T07).
- [x] `SubagentStop` no genera interrupción, pausa ni notificación (los adapters ya lo descartan antes de `handleAgentEvent`).
- [x] `autoOpenGames: false` impide armar y disparar el temporizador de inactividad.
- [x] La apertura manual de juegos ignora `autoOpenGames`.
- [x] Pulsar una notificación abre `Agents`; los flujos normales del tray y la apertura automática abren `Games`.
- [x] Una partida en curso tiene prioridad sobre el enrutado por defecto al reabrir: `showPopover` solo emite `popover-view`; la prioridad de la partida se resuelve en el popover (T07).
- [x] El tooltip del tray refleja los contadores de trabajando y necesita-atención.
- [x] Los menús nativos dinámicos del tray se vuelven a asignar en Linux después de los cambios (`refreshTray` vuelve a llamar `tray.setContextMenu()` cuando `shouldPersistContextMenu`).
- [x] Los errores de escucha del servidor local se capturan y muestran en lugar de indicar falsamente `Activo` (`serverStatus` `starting | active | error`, `httpServer.on('error')`).
- [x] Las confirmaciones existentes al cambiar el puerto de Claude y Codex siguen funcionando (suites previas intactas).
- [x] El preload expone métodos específicos, nunca `ipcRenderer` sin procesar (test «never exposes ipcRenderer itself»).

**Superficie IPC entregada**

- `activity-get` (snapshot actual) y evento `activity-change` (suscripción vía `onActivityChange`).
- `open-popover` + `popover-view-get` + evento `popover-view` para el enrutado `Games` / `Agents`.
- `notifications-status` → `{ supported }`. Electron no expone API de solicitud de permiso de notificaciones (confirmado en el handoff); la lectura de soporte es la API de alcance limitado disponible.
- `server-status` → `starting | active | error` para la pantalla de `Settings`.
- Evento `agent-interruption` para la política de pausa del juego.

**Checklist TDD**

- [x] ROJO: ampliar los mocks de Electron con `Notification` y los nuevos contratos IPC.
- [x] ROJO: cubrir que una finalización parcial pausa el juego mientras otro agente sigue trabajando.
- [x] ROJO: cubrir las cuatro combinaciones de comportamiento (interruptores independientes de juegos automáticos y notificaciones).
- [x] ROJO: cubrir el enrutado al pulsar notificaciones y la supresión con el popover visible.
- [x] VERDE: conectar servicios e IPC.
- [x] Refactorizar `main.ts` si es necesario para mantener la política comprobable (`refreshTray` extraído; fachada `notificationPlatform` para aislar Electron).

**Puerta de verificación:** `npx vitest run tests/main.test.ts tests/preload.test.ts tests/main-dev-mode.test.ts`

**Evidencias**

- Evidencia ROJA: tras ampliar mocks (`Notification`, `server.on`, `DEFAULT_SETTINGS`
  completo, `validateSettings` completo) y añadir las suites T06, `npx vitest run
  tests/main.test.ts tests/preload.test.ts` falla con 10 pruebas nuevas rojas en
  `main.test.ts` (activity-change, agent-interruption, notificación nativa,
  enrutado, `popover-view-get`, tooltip del tray, `activity-get`, `server-status`,
  `notifications-status`) y 9 en `preload.test.ts` (métodos IPC ausentes). Sin
  regresiones en las suites previas.
- Evidencia VERDE: `main.ts` alimenta `ExecutionTracker` en cada evento, emite
  `activity-change`, `agent-interruption` y notificaciones nativas deduplicadas
  vía fachada inyectable, enruta `Games`/`Agents`, refleja contadores en el
  tooltip, expone `serverStatus` y las nuevas APIs IPC; `preload.ts` expone
  métodos concretos sin `ipcRenderer`. Puerta 3 archivos / 145 pruebas correctas.
- Resultado de la puerta: `npx vitest run tests/main.test.ts tests/preload.test.ts
  tests/main-dev-mode.test.ts` → 3 archivos, 145 pruebas correctas. Regresión
  propia `npm test -- --exclude '.claude/**'` → 34 archivos, 624 pruebas
  correctas (597 → 624). `npm run build` correcto. Cobertura global 100 %
  (statements/branches/functions/lines), `main.ts` y `preload.ts` al 100 %.

### [x] T07 — Construir el popover de `Games`/`Agents`

**Objetivo:** Implementar la interfaz principal acordada sin reescribir el
carrusel existente ni el comportamiento del host de juegos.

**Archivos de producción**

- `src/popover/index.html`
- `src/popover/popover.css`
- `src/popover/popover.js`
- nuevo `src/popover/agents-view.js` opcional

**Archivos de pruebas**

- `tests/popover/popover.test.ts`
- nuevo `tests/popover/agents-view.test.ts` opcional

**Comportamiento requerido**

- [x] `Games` está a la izquierda y aparece seleccionado en una apertura normal.
- [x] `Agents` está a la derecha y muestra el snapshot más reciente (`getActivity` al cargar + `onActivityChange`).
- [x] `Games` reutiliza la implementación actual del hub/carrusel (sin cambios en `carousel.js`).
- [x] Los contadores muestran trabajando, necesita-atención y terminados recientemente.
- [x] Las ejecuciones que necesitan atención se ordenan antes que las que trabajan (orden defensivo también en la vista).
- [x] Las ejecuciones recientes se ordenan de la más nueva a la más antigua.
- [x] Si falta el proyecto, se muestra el nombre del agente sin puntuación extraña (`agentLabel`).
- [x] Los estados vacíos están diseñados y probados (`agents-empty`, `agents-recent-empty`).
- [x] No existe el botón `Reply`.
- [x] No existe una llamada a la acción inferior para juegos.
- [x] No hay cheurones sin explicación ni affordances desplegables falsas (el único menú es `···`).
- [x] `···` abre un menú accesible con `Add game` y `Settings` (`role=menu`/`menuitem`, `aria-haspopup`, `aria-expanded`, Escape y clic externo lo cierran).
- [x] Abrir un juego oculta las pestañas y conserva el comportamiento existente de pausa y reanudación (39 pruebas previas intactas).
- [x] `needs_user` y `task_finished` de cualquier agente principal pausan inmediatamente el iframe y muestran el overlay (`onAgentInterruption`).
- [x] El overlay de una finalización parcial indica el agente terminado y cuántos siguen trabajando (singular/plural).
- [x] Continuar después de la pausa siempre requiere una acción explícita del usuario (clic en Continue; nunca auto-reanuda).
- [x] Volver desde un juego lleva a `Games` (`goHome` → `selectTab('games')`).
- [x] El enrutado desde notificaciones selecciona y enfoca la fila de `Agents` correspondiente (`highlightExecutionId` + `focusHighlightedRow`).
- [x] Funcionan la navegación por teclado (flechas entre pestañas, roving `tabindex`), Escape y los estados ARIA.

**Checklist TDD**

- [x] ROJO: añadir pruebas DOM para navegación, orden, contadores, menú, estados vacíos y enrutado.
- [x] VERDE: implementar HTML semántico y comportamiento.
- [x] Refactorizar el código del renderer en funciones de vista pequeñas (`agents-view.js` como módulo puro reutilizable).

**Puerta de verificación:** `npx vitest run tests/popover`

**Puerta visual:** Comparar una captura local con la referencia acordada de
`Agents` a 440×540 píxeles lógicos en macOS; verificar que Windows/Linux no recortan.

**Evidencias**

- Evidencia ROJA: `tests/popover/agents-view.test.ts` falla al no resolver el
  módulo `src/popover/agents-view.js`; tras crearlo y añadir las suites T07 a
  `tests/popover/popover.test.ts`, la suite falla por `window.meanwaile.getActivity
  is not a function` y luego por los contratos de pestañas/menú/overlay/enrutado
  aún sin implementar.
- Evidencia VERDE: `agents-view.js` (módulo puro de proyección segura) + `index.html`
  con barra de pestañas `Games`/`Agents`, panel `#agents-screen` y menú `···`
  (`Add game` / `Settings`); `popover.js` cablea `getActivity`/`onActivityChange`,
  `onAgentInterruption` (pausa + overlay con recuento restante), `onPopoverView`
  (enrutado con prioridad de partida en curso) y la navegación por teclado. Las
  39 pruebas previas del popover siguen verdes.
- Resultado de la puerta: `npx vitest run tests/popover` → 3 archivos, 112 pruebas
  correctas (`agents-view` 19, `popover` 76, `carousel` 17). Regresión propia
  `npm test -- --exclude '.claude/**'` → 35 archivos, 671 pruebas. `npm run build`
  correcto. Cobertura 100 % en `agents-view.js`, `popover.js` y `carousel.js`.
- Ruta de la captura: _pendiente de la verificación visual manual del usuario._

### [x] T08 — Construir la ventana de configuración rediseñada

**Objetivo:** Implementar la dirección de configuración elegida y las cuatro
combinaciones de comportamiento con ayuda contextual accesible.

**Archivos de producción**

- `src/settings/index.html`
- `src/settings/settings.css`
- `src/settings/settings.js`
- `src/main.ts` para las dimensiones finales de `BrowserWindow`

**Archivos de pruebas**

- `tests/settings/settings.test.ts`
- `tests/main.test.ts`

**Comportamiento requerido**

- [x] Eliminar la tarjeta introductoria (no existe ninguna `.intro-card` en el nuevo HTML; prueba explícita).
- [x] Mostrar `Open games automatically` y `Notifications` como interruptores independientes (`role="switch"`).
- [x] Deshabilitar, pero conservar, el valor de inactividad cuando los juegos automáticos estén apagados (`applyDependentState`; el valor permanece en el DOM).
- [x] Deshabilitar, pero conservar, los detalles de notificaciones cuando estas estén apagadas.
- [x] Permitir configurar necesita-atención, finalización y sonido (`No sound` / `System sound`).
- [x] Mostrar junto al puerto el estado real del servidor (`getServerStatus` → `Active` / `Starting…` / `Unavailable`).
- [x] Conservar la validación al guardar (el proceso principal la aplica) y la confirmación de actualización de hooks al cambiar el puerto (`applySettings` intacto).
- [x] Mostrar iconos de ayuda junto al tiempo de inactividad y el puerto.
- [x] Los tooltips se abren con hover y foco de teclado y se cierran con blur o Escape.
- [x] Los tooltips utilizan `aria-describedby`, `role="tooltip"` y `pointer-events: none` para no bloquear los controles.
- [x] La disposición se agrupa en `Automation` / `Notifications` / `Detection`, sin tarjeta introductoria.

**Textos exactos de los tooltips**

- `Idle time`: `Meanwaile checks whether you have been away from your keyboard and mouse for this long before opening a game.`
- `Port`: `The local port Meanwaile uses to receive events from your agents. Change it only if there is a conflict.`

**Checklist TDD**

- [x] ROJO: la configuración carga y muestra cada valor nuevo.
- [x] ROJO: el envío contiene el objeto completo de ajustes.
- [x] ROJO: los estados dependientes deshabilitados conservan sus valores.
- [x] ROJO: se cubre el comportamiento de los tooltips con ratón y teclado.
- [x] ROJO: el estado del servidor no reclama `Active` cuando no procede; los errores al guardar son visibles.
- [x] VERDE: implementar la ventana rediseñada (HTML/CSS/JS + dimensiones `380×560` en `main.ts`).
- [x] Refactorizar estilos y lógica del renderer manteniendo las pruebas en verde.

**Puerta de verificación:** `npx vitest run tests/settings/settings.test.ts tests/settings-store.test.ts tests/main.test.ts`

**Puerta visual:** Comparar una captura local con la referencia de configuración
acordada; verificar que el escalado estándar de texto no recorta contenido.

**Evidencias**

- Evidencia ROJA: tras reescribir `tests/settings/settings.test.ts` al modelo
  completo y añadir la aserción de dimensiones a `tests/main.test.ts`, fallan 14
  pruebas (13 de la página de ajustes: grupos, interruptores, deshabilitado con
  valor conservado, estado del servidor, tooltips, envío completo; 1 de
  `main.test.ts`: tamaño de la ventana). Las 2 pruebas sin cambios de semántica
  (error de validación, cierre con Cancel) siguen verdes.
- Evidencia VERDE: `index.html` rediseñado en tres grupos con interruptores
  `role="switch"`, sub-controles anidados, `select` de sonido, icono de ayuda con
  tooltip `aria-describedby` y fila de estado del servidor; `settings.js` carga y
  serializa el objeto completo, aplica el deshabilitado dependiente conservando
  valores, resuelve el estado del servidor y cablea los tooltips (hover/focus →
  abre; blur/Escape → cierra); `main.ts` abre la ventana a `380×560`.
- Resultado de la puerta: `npx vitest run tests/settings/settings.test.ts
  tests/settings-store.test.ts tests/main.test.ts` → 3 archivos, 160 pruebas
  correctas. Regresión propia `npm test -- --exclude '.claude/**'` → 35 archivos,
  684 pruebas. `npm run build` correcto. Cobertura 100 % (incluye `settings.js`).
- Ruta de la captura: _pendiente de la verificación visual manual del usuario._

### [x] T09 — Probar la integración entre funcionalidades y las regresiones

**Objetivo:** Verificar que la actividad multiagente, las notificaciones, los
juegos, la configuración y la galería funcionan conjuntamente.

**Escenarios automatizados** (`tests/main-integration.test.ts`, registro de módulos
propio para arrancar con `StateMachine`/`ExecutionTracker` limpios)

- [x] Claude y Codex trabajan simultáneamente en proyectos distintos (dos ejecuciones activas con `adapterId`/`projectName` correctos).
- [x] Dos sesiones utilizan el mismo proyecto (ids distintos, mismo `projectName`).
- [x] Una termina mientras otra trabaja: `working` baja a 1, `agent-interruption` `finished`, notificación `1 other agent is still working.`
- [x] Una necesita atención mientras otra trabaja: `needsUser` sube, `agent-interruption` `needs_user`, notificación `… needs your attention`.
- [x] Termina la última ejecución: contadores a cero, interrupción `finished`, notificación `No other agents are active.`, tooltip del tray de vuelta a `Meanwaile`.
- [x] Los hooks duplicados `Notification`/`Stop` son idempotentes (una sola interrupción y una sola notificación por evento).
- [x] `SubagentStop` no emite `activity-change`, interrupción ni notificación, y no mueve los contadores.
- [x] Las cuatro combinaciones de `Settings` coinciden con la matriz: el timer de una sola comprobación se arma solo con `autoOpenGames`; la notificación se muestra solo con `notificationsEnabled`.
- [x] Instalar desde la galería sigue enviando `games-changed` al popover.
- [x] Un cambio de puerto sigue confirmando antes de reescribir un hook de Claude instalado.
- [x] Cerrar el popover suprime la apertura automática de una sola comprobación durante el resto del turno.

**Puerta automatizada completa**

- [x] `npm test` (como `npm test -- --exclude '.claude/**'`, ver T00).
- [x] `npm run build`
- [x] `npm run test:e2e`

**Evidencias**

- Suite unitaria: `npm test -- --exclude '.claude/**'` → 36 archivos, 698 pruebas
  correctas. Cobertura global 100 % (statements/branches/functions/lines).
- Compilación: `npm run build` (`tsc`) correcto.
- E2E: `npm run test:e2e` → 3/3 pruebas correctas
  (`auto-open-events.spec.ts` ×2, `tray-popover-position.spec.ts` ×1).

### [~] T10 — Validar el comportamiento empaquetado y finalizar la documentación

**Objetivo:** Demostrar el comportamiento nativo fuera de los mocks y entregar
una funcionalidad documentada.

**Matriz manual por plataforma**

| Escenario | Aplicación firmada de macOS | Windows 10/11 | Ubuntu `.deb` |
|---|---:|---:|---:|
| Permiso y soporte de notificaciones | [ ] | [ ] | [ ] |
| Notificación de necesita-atención | [ ] | [ ] | [ ] |
| Notificación de finalización y plurales | [ ] | [ ] | [ ] |
| Comportamiento sin sonido y sonido por defecto | [ ] | [ ] | [ ] |
| Pulsar una notificación abre `Agents` | [ ] | [ ] | [ ] |
| Estado y menú del tray | [ ] | [ ] | [ ] |
| Tooltips de configuración y acceso por teclado | [ ] | [ ] | [ ] |
| `Games` por defecto y reanudación de partida | [ ] | [ ] | [ ] |

**Archivos de documentación**

- `README.md`
- `PRODUCT_BRIEF.md`
- `AGENTS.md`
- `CONTRIBUTING.md`

**Checklist de aceptación**

- [x] Documentar los ajustes y sus valores por defecto (`README.md` sección Settings; `AGENTS.md` «Settings model»).
- [x] Documentar permisos de notificaciones y limitaciones de plataforma (`README.md` sección Notifications: opt-in, local, silencioso, suprimido con popup visible, clic → `Agents`, firma requerida en macOS empaquetado, degradación si el SO no soporta).
- [x] Documentar el historial local transitorio y sus límites de privacidad (`README.md` «The popup: Games and Agents»; `AGENTS.md` «Execution tracker»: en memoria, máximo 20, se borra al salir, solo `agentName`/`projectName`/timestamps).
- [ ] Actualizar las capturas después de implementar, no con conceptos generados. — **pendiente del usuario** (requiere ejecutar la app).
- [x] Eliminar o etiquetar claramente los diseños reemplazados (los mockups viven en `docs/design-concepts/`; el plan ya indica que son referencia de disposición, no de idioma ni de affordances).
- [x] Comprobar todos los enlaces de documentación (`CODE_SIGNING.md`, `AGENTS.md`, `CONTRIBUTING.md`, `scripts/setup-hooks.sh` existen; `README.md` verificado).
- [x] Confirmar que no se añadió telemetría, almacenamiento de prompts ni control de terminales (`grep` de telemetría/analítica en `src/` sin resultados; el tracker solo guarda campos saneados; el clic de notificación solo abre `Agents`).

**Puerta de verificación:** Todas las filas manuales pasan o tienen una limitación
aceptada explícitamente; toda la documentación coincide con el comportamiento entregado.

**Estado:** La mitad documental está completa y es coherente entre `README.md`,
`AGENTS.md` y `CONTRIBUTING.md`. La matriz manual por plataforma y las capturas
requieren hardware del usuario (app firmada de macOS, Windows, `.deb` de Ubuntu)
y quedan pendientes de su prueba final; hasta entonces T10 permanece en curso.

**Evidencias**

- Paquete/versión de macOS: _pendiente de la prueba manual del usuario._
- Paquete/versión de Windows: _pendiente de la prueba manual del usuario._
- Paquete/versión de Ubuntu: _pendiente de la prueba manual del usuario._
- Limitaciones aceptadas: notificaciones empaquetadas en macOS requieren firma
  (los DMG de release lo están); posicionamiento del popover en Wayland sin
  resolver (ya documentado en `AGENTS.md`/`README.md`).

## Definición de terminado

La funcionalidad solo está terminada cuando se cumple todo lo siguiente:

- [ ] T00–T10 están marcadas como completadas.
- [ ] Cada tarea de implementación contiene evidencia ROJA y VERDE.
- [ ] `npm test`, `npm run build` y `npm run test:e2e` pasan en la revisión final.
- [ ] Las cuatro combinaciones de comportamiento superan las pruebas automatizadas.
- [ ] Los flujos acordados de `Agents` y `Settings` pasan la revisión visual.
- [ ] Las notificaciones se han probado en aplicaciones firmadas/empaquetadas en las plataformas compatibles.
- [ ] La documentación de producto y contribución ya no contradice la funcionalidad.
- [ ] Ningún payload sin procesar, ruta completa, prompt, transcripción o entrada de herramienta llega a la interfaz del renderer.
- [ ] No se sobrescribió ningún cambio ajeno del usuario.

## Registro de progreso

Añadir entradas sin reescribir el historial.

| Fecha | Tarea | Estado | Evidencia / decisión |
|---|---|---|---|
| 2026-09-02 | Plan | Creado | Checklist de ejecución creado; la implementación no ha comenzado. |
| 2026-09-02 | Plan | Corregido | Documento normalizado a español; solo permanecen en inglés identificadores técnicos, nombres de archivos y comandos. |
| 2026-09-02 | Copy de producto | Corregido | Se establece inglés para todos los textos visibles de la aplicación; los mockups en español quedan como referencia exclusivamente visual. |
| 2026-09-02 | Pausa multiagente | Corregido | La finalización de cualquier agente principal pausa la partida; `SubagentStop` continúa ignorándose. |
| 2026-09-02 | T00 | En curso | Rama `feat/agent-activity-notifications` creada; comienza la verificación de la línea base. |
| 2026-09-02 | T00 | Completada | Suite propia 531/531, compilación correcta y E2E 3/3. Se documenta que el comando unitario sin exclusión también descubre worktrees de `.claude`. |
| 2026-09-02 | T01 | En curso | Comienza la eliminación de las contradicciones sobre notificaciones en el contrato del producto y de contribución. |
| 2026-09-02 | T01 | Completada | `AGENTS.md`, `CONTRIBUTING.md` y el product brief local coinciden en modos, contadores, pausa principal, privacidad y exclusión de subagentes. |
| 2026-09-03 | T02 | En curso | Comienza la ampliación TDD de `AgentEvent` con identidad de adapter y nombre de proyecto saneado. |
| 2026-09-03 | T02 | Completada | Los adapters emiten identidad estable y solo el basename seguro; la máquina diferencia sesiones iguales de adapters distintos. Puerta 74/74 y build correctos. |
| 2026-09-03 | T03 | En curso | Comienza la suite TDD del tracker de ejecuciones activas y finalizaciones recientes. |
| 2026-09-03 | T03 | Completada | Tracker puro con identidad compuesta, transiciones deduplicadas, contadores, historial máximo de 20 y caducidad silenciosa; puerta 34/34. |
| 2026-09-03 | T04 | En curso | Comienza la migración TDD de ajustes para separar juegos automáticos y notificaciones. |
| 2026-09-03 | T04 | Completada | Ajustes migrados sin romper el formato antiguo; los cuatro modos, preferencias por evento y sonido quedan validados. Puerta 27/27. |
| 2026-09-03 | T05 | En curso | Comienza la matriz TDD de política, copy multiagente y clic de notificaciones nativas. |
| 2026-09-03 | T05 | Completada | Política opt-in, silenciosa, deduplicada y suprimida con popup visible; textos multiagente y clic hacia `Agents` cubiertos. Puerta 20/20. |
| 2026-09-03 | T06 | En curso | Comienza la integración TDD de tracker, interrupciones, notificaciones, routing, tray, IPC y estado del servidor. |
| 2026-09-03 | T06 | Checkpoint | Trabajo pausado antes de escribir pruebas o producción de T06; contexto de continuación en `2026-09-03-agent-activity-handoff.md`. |
| 2026-09-03 | T06 | Completada | `main.ts`/`preload.ts` orquestan `ExecutionTracker` + `NotificationService` tras una fachada Electron inyectable: `activity-change`, `agent-interruption`, notificaciones deduplicadas y suprimidas con popover visible, enrutado `Games`/`Agents`, contadores en el tooltip, `serverStatus` y APIs IPC concretas sin `ipcRenderer`. `SubagentStop` sigue sin efecto. Puerta 145/145, regresión 624/624, build y cobertura 100 % correctos. |
| 2026-09-03 | T07 | En curso | Comienza el popover `Games`/`Agents` con TDD: primero `agents-view.js` como módulo puro, luego la integración en `popover.js`. |
| 2026-09-03 | T07 | Completada | `agents-view.js` (proyección segura, sin rutas/prompts/transcripciones), pestañas `Games`/`Agents` con `Games` por defecto, menú `···` (`Add game`/`Settings`), overlay de interrupción multiagente con recuento restante y enrutado de notificaciones con prioridad de partida en curso. Sin `Reply` ni CTA inferior. Puerta `tests/popover` 112/112, regresión 671/671, build y cobertura 100 %. Puerta visual pendiente de la prueba manual final. |
| 2026-09-03 | T08 | En curso | Comienza la reescritura TDD de la ventana de ajustes al modelo completo (interruptores independientes, sonido, estado del servidor, tooltips de ayuda). |
| 2026-09-03 | T08 | Completada | Ventana de ajustes rediseñada en `Automation`/`Notifications`/`Detection`: interruptores independientes, sub-controles que se deshabilitan conservando su valor, `select` de sonido, estado real del servidor junto al puerto y tooltips accesibles (`aria-describedby`, hover/focus/blur/Escape) con los textos exactos. `main.ts` abre la ventana a `380×560`. Puerta 160/160, regresión 684/684, build y cobertura 100 %. Puerta visual pendiente de la prueba manual final. |
| 2026-09-03 | T09 | Completada | `tests/main-integration.test.ts` cubre concurrencia Claude+Codex, sesiones del mismo proyecto, finalización parcial/última, `needs_user`, idempotencia de hooks, exclusión de `SubagentStop`, la matriz de ajustes y las regresiones de galería/puerto/supresión. Puerta completa: `npm test` 698/698, `npm run build` y `npm run test:e2e` 3/3 correctos; cobertura 100 %. |
| 2026-09-03 | T10 | En curso | Mitad documental completada: `README.md` (intro, estado, popup `Games`/`Agents`, Settings con valores por defecto, Notifications, privacidad del historial), `AGENTS.md` (secciones «Execution tracker», «Notification service», «Settings model») y `CONTRIBUTING.md` (ya coherente desde T01). Enlaces verificados; sin telemetría/almacenamiento de prompts/control de terminal. Pendiente: matriz manual por plataforma y capturas (hardware del usuario). |

## Registro de decisiones

Registrar cualquier cambio en las decisiones cerradas antes de implementarlo.

| ID | Fecha | Decisión | Motivo |
|---|---|---|---|
| D-001 | 2026-09-02 | Mantener separados `StateMachine` y `ExecutionTracker`. | Las actualizaciones por ejecución no deben cambiar la semántica agregada de temporización del juego. |
| D-002 | 2026-09-02 | Mantener en memoria las finalizaciones recientes, con un máximo de 20. | Aporta contexto reciente sin convertir Meanwaile en un dashboard persistente de actividad. |
| D-003 | 2026-09-02 | Usar solo el basename del `cwd` proporcionado por el adapter. | Ofrece una etiqueta útil del proyecto minimizando la exposición de rutas locales. |
| D-004 | 2026-09-02 | No contar `SubagentStop` como ejecución principal. | Padre e hijo comparten contexto de sesión y, de otro modo, se inflarían los contadores o se finalizaría incorrectamente al padre. |
| D-005 | 2026-09-02 | Pulsar una notificación solo abre `Agents`. | Meanwaile no puede controlar de forma fiable y portable el terminal de origen. |
| D-006 | 2026-09-02 | Todo el copy visible de la aplicación permanece en inglés. | El plan se documenta en español, pero los textos de producto no deben heredarlo. |
| D-007 | 2026-09-02 | `task_finished` de cualquier agente principal pausa la partida, aunque queden otros trabajando. | Cada finalización es un evento relevante para el usuario; solo los subagentes quedan excluidos. |
