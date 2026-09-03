# Plan de implementación — actividad de agentes y notificaciones

**Estado:** En curso

**Creado:** 2026-09-02

**Progreso:** 5/11 tareas completadas

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

### [ ] T05 — Implementar la política de notificaciones nativas

**Objetivo:** Convertir las transiciones significativas del tracker en
notificaciones nativas deduplicadas con textos multiagente correctos.

**Nuevos archivos de producción**

- `src/notification-service.ts`
- `src/notification-copy.ts` si los textos y plurales justifican separarlo

**Nuevos archivos de pruebas**

- `tests/notification-service.test.ts`
- `tests/notification-copy.test.ts` si se separa

**Comportamiento requerido**

- [ ] No se muestra ninguna notificación cuando el interruptor principal está apagado.
- [ ] Se respetan `notifyNeedsUser` y `notifyFinished` de forma independiente.
- [ ] Los eventos de trabajo o reanudación no generan notificaciones.
- [ ] Los hooks duplicados no generan notificaciones duplicadas.
- [ ] La caducidad silenciosa de registros obsoletos no genera notificaciones.
- [ ] No se notifica cuando Electron indica que no existe soporte.
- [ ] `silent` respeta el ajuste de sonido.
- [ ] El texto de necesita-atención incluye agente y proyecto cuando están disponibles.
- [ ] El texto de finalización utiliza los contadores posteriores a retirar la ejecución terminada.
- [ ] Los textos en singular y plural son correctos.
- [ ] Los estados restantes mixtos mencionan los agentes activos que necesitan atención.
- [ ] Si el popup está visible, se suprime la notificación nativa.
- [ ] Al pulsar una notificación se abre la vista `Agents` y se destaca la ejecución; nunca se controla otra aplicación.

**Ejemplos de texto**

- `Claude · website needs your attention`
- `Waiting for confirmation or a response.`
- `Codex · meanwaile finished`
- `2 other agents are still working.`
- `3 agents remain active; 1 needs your attention.`

**Checklist TDD**

- [ ] ROJO: las pruebas unitarias cubren la matriz completa de políticas.
- [ ] VERDE: implementar detrás de una fachada inyectada para `Notification` de Electron.
- [ ] Refactorizar la generación de textos para separarla de los efectos de Electron.

**Puerta de verificación:** `npx vitest run tests/notification-service.test.ts tests/notification-copy.test.ts`

**Evidencias**

- Evidencia ROJA: _pendiente_
- Evidencia VERDE: _pendiente_
- Resultado de la puerta: _pendiente_

### [ ] T06 — Orquestar eventos, IPC, tray y permisos

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

- [ ] Cada evento de adapter llega tanto a `StateMachine` como a `ExecutionTracker`.
- [ ] Los snapshots del tracker se envían aunque no cambie el estado agregado de la aplicación.
- [ ] Cada `needs_user` o `task_finished` significativo de un agente principal envía una interrupción al juego aunque no cambie el estado agregado.
- [ ] Una finalización parcial pausa la partida y muestra cuántos agentes siguen trabajando.
- [ ] `SubagentStop` no genera interrupción, pausa ni notificación.
- [ ] `autoOpenGames: false` impide armar y disparar el temporizador de inactividad.
- [ ] La apertura manual de juegos ignora `autoOpenGames`.
- [ ] Pulsar una notificación abre `Agents`; los flujos normales del tray y la apertura automática abren `Games`.
- [ ] Una partida en curso tiene prioridad sobre el enrutado por defecto al reabrir.
- [ ] El tooltip del tray refleja los contadores de trabajando y necesita-atención.
- [ ] Los menús nativos dinámicos del tray se vuelven a asignar en Linux después de los cambios.
- [ ] Los errores de escucha del servidor local se capturan y muestran en lugar de indicar falsamente `Activo`.
- [ ] Las confirmaciones existentes al cambiar el puerto de Claude y Codex siguen funcionando.
- [ ] El preload expone métodos específicos, nunca `ipcRenderer` sin procesar.

**Checklist TDD**

- [ ] ROJO: ampliar los mocks de Electron con `Notification` y los nuevos contratos IPC.
- [ ] ROJO: cubrir que una finalización parcial pausa el juego mientras otro agente sigue trabajando.
- [ ] ROJO: cubrir las cuatro combinaciones de comportamiento.
- [ ] ROJO: cubrir el enrutado al pulsar notificaciones y la supresión con el popover visible.
- [ ] VERDE: conectar servicios e IPC.
- [ ] Refactorizar `main.ts` si es necesario para mantener la política comprobable.

**Puerta de verificación:** `npx vitest run tests/main.test.ts tests/preload.test.ts tests/main-dev-mode.test.ts`

**Evidencias**

- Evidencia ROJA: _pendiente_
- Evidencia VERDE: _pendiente_
- Resultado de la puerta: _pendiente_

### [ ] T07 — Construir el popover de `Games`/`Agents`

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

- [ ] `Games` está a la izquierda y aparece seleccionado en una apertura normal.
- [ ] `Agents` está a la derecha y muestra el snapshot más reciente.
- [ ] `Games` reutiliza la implementación actual del hub/carrusel.
- [ ] Los contadores muestran trabajando, necesita-atención y terminados recientemente.
- [ ] Las ejecuciones que necesitan atención se ordenan antes que las que trabajan.
- [ ] Las ejecuciones recientes se ordenan de la más nueva a la más antigua.
- [ ] Si falta el proyecto, se muestra el nombre del agente sin puntuación extraña.
- [ ] Los estados vacíos están diseñados y probados.
- [ ] No existe el botón `Reply`.
- [ ] No existe una llamada a la acción inferior para juegos.
- [ ] No hay cheurones sin explicación ni affordances desplegables falsas.
- [ ] `···` abre un menú accesible con `Add game` y `Settings`.
- [ ] Abrir un juego oculta las pestañas y conserva el comportamiento existente de pausa y reanudación.
- [ ] `needs_user` y `task_finished` de cualquier agente principal pausan inmediatamente el iframe y muestran el overlay.
- [ ] El overlay de una finalización parcial indica el agente terminado y cuántos siguen trabajando.
- [ ] Continuar después de la pausa siempre requiere una acción explícita del usuario.
- [ ] Volver desde un juego lleva a `Games`.
- [ ] El enrutado desde notificaciones selecciona y enfoca la fila de `Agents` correspondiente.
- [ ] Funcionan la navegación por teclado, el orden de foco, Escape y los estados ARIA.

**Checklist TDD**

- [ ] ROJO: añadir pruebas DOM para navegación, orden, contadores, menú, estados vacíos y enrutado.
- [ ] VERDE: implementar HTML semántico y comportamiento.
- [ ] Refactorizar el código del renderer en funciones de vista pequeñas si es necesario.

**Puerta de verificación:** `npx vitest run tests/popover`

**Puerta visual:** Comparar una captura local con la referencia acordada de
`Agents` a 440×540 píxeles lógicos en macOS; verificar que Windows/Linux no recortan.

**Evidencias**

- Evidencia ROJA: _pendiente_
- Evidencia VERDE: _pendiente_
- Resultado de la puerta: _pendiente_
- Ruta de la captura: _pendiente_

### [ ] T08 — Construir la ventana de configuración rediseñada

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

- [ ] Eliminar la tarjeta introductoria.
- [ ] Mostrar `Open games automatically` y `Notifications` como interruptores independientes.
- [ ] Deshabilitar, pero conservar, el valor de inactividad cuando los juegos automáticos estén apagados.
- [ ] Deshabilitar, pero conservar, los detalles de notificaciones cuando estas estén apagadas.
- [ ] Permitir configurar necesita-atención, finalización y sonido.
- [ ] Mostrar junto al puerto el estado real del servidor.
- [ ] Conservar la validación al guardar y la confirmación de actualización de hooks al cambiar el puerto.
- [ ] Mostrar iconos de ayuda junto al tiempo de inactividad y el puerto.
- [ ] Los tooltips se abren con hover y foco de teclado y se cierran con blur o Escape.
- [ ] Los tooltips utilizan `aria-describedby` y no bloquean los controles.
- [ ] La disposición coincide con el diseño seleccionado sin la tarjeta introductoria eliminada.

**Textos exactos de los tooltips**

- `Idle time`: `Meanwaile checks whether you have been away from your keyboard and mouse for this long before opening a game.`
- `Port`: `The local port Meanwaile uses to receive events from your agents. Change it only if there is a conflict.`

**Checklist TDD**

- [ ] ROJO: la configuración carga y muestra cada valor nuevo.
- [ ] ROJO: el envío contiene el objeto completo de ajustes.
- [ ] ROJO: los estados dependientes deshabilitados conservan sus valores.
- [ ] ROJO: se cubre el comportamiento de los tooltips con ratón y teclado.
- [ ] ROJO: el fallo del servidor y los errores al guardar son visibles.
- [ ] VERDE: implementar la ventana rediseñada.
- [ ] Refactorizar estilos y lógica del renderer manteniendo las pruebas en verde.

**Puerta de verificación:** `npx vitest run tests/settings/settings.test.ts tests/settings-store.test.ts tests/main.test.ts`

**Puerta visual:** Comparar una captura local con la referencia de configuración
acordada; verificar que el escalado estándar de texto no recorta contenido.

**Evidencias**

- Evidencia ROJA: _pendiente_
- Evidencia VERDE: _pendiente_
- Resultado de la puerta: _pendiente_
- Ruta de la captura: _pendiente_

### [ ] T09 — Probar la integración entre funcionalidades y las regresiones

**Objetivo:** Verificar que la actividad multiagente, las notificaciones, los
juegos, la configuración y la galería funcionan conjuntamente.

**Escenarios automatizados**

- [ ] Claude y Codex trabajan simultáneamente en proyectos distintos.
- [ ] Dos sesiones utilizan el mismo proyecto.
- [ ] Una termina mientras otra trabaja: actualizar contadores, notificar las restantes y pausar el juego.
- [ ] Una necesita atención mientras otra trabaja: actualizar contadores, notificar y pausar el juego.
- [ ] Termina la última ejecución: actualizar contadores, notificar y pausar el juego.
- [ ] Los hooks duplicados `Notification`/`PermissionRequest`/`Stop` son idempotentes.
- [ ] `SubagentStop` no altera los contadores principales.
- [ ] Las combinaciones de `Settings` coinciden con la matriz de aceptación.
- [ ] Instalar o eliminar desde la galería sigue actualizando la pestaña `Games`.
- [ ] Los cambios de puerto conservan las confirmaciones para actualizar hooks instalados.
- [ ] Siguen funcionando el cierre del popover y la supresión de la apertura automática de una sola comprobación.

**Puerta automatizada completa**

- [ ] `npm test`
- [ ] `npm run build`
- [ ] `npm run test:e2e`

**Evidencias**

- Suite unitaria: _pendiente_
- Compilación: _pendiente_
- E2E: _pendiente_

### [ ] T10 — Validar el comportamiento empaquetado y finalizar la documentación

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

- [ ] Documentar los ajustes y sus valores por defecto.
- [ ] Documentar permisos de notificaciones y limitaciones de plataforma.
- [ ] Documentar el historial local transitorio y sus límites de privacidad.
- [ ] Actualizar las capturas después de implementar, no con conceptos generados.
- [ ] Eliminar o etiquetar claramente los diseños reemplazados.
- [ ] Comprobar todos los enlaces de documentación.
- [ ] Confirmar que no se añadió telemetría, almacenamiento de prompts ni control de terminales.

**Puerta de verificación:** Todas las filas manuales pasan o tienen una limitación
aceptada explícitamente; toda la documentación coincide con el comportamiento entregado.

**Evidencias**

- Paquete/versión de macOS: _pendiente_
- Paquete/versión de Windows: _pendiente_
- Paquete/versión de Ubuntu: _pendiente_
- Limitaciones aceptadas: _pendiente_

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
