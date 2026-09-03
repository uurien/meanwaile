# Handoff — actividad de agentes y notificaciones

## Estado exacto

- Rama: `feat/agent-activity-notifications`
- Plan fuente: `docs/plans/2026-09-02-agent-activity-notifications.md`
- Completadas y verificadas: T00–T05.
- En curso: T06. Solo se ha cambiado su marcador y añadido la entrada de inicio;
  todavía no hay pruebas ni código de producción de T06.
- Última regresión propia: 34 archivos, 597 pruebas correctas.
- Última compilación: `npm run build`, correcta.
- `npm test` sin exclusiones descubre copias bajo `.claude/worktrees`; usar
  `npm test -- --exclude '.claude/**'` para la suite de esta rama.

## Commits ya creados

```text
a2dee7d docs: plan agent activity and notifications
235b7c3 docs: define agent activity notifications
070483e feat: identify agent executions safely
0cd1a5a feat: track concurrent agent executions
a7f667c feat: add notification preferences
a8f7658 feat: add native notification policy
```

## Lo implementado

- `AgentEvent` incluye `adapterId` obligatorio y `projectName` seguro derivado
  únicamente del basename de `cwd`.
- La máquina de estados diferencia `(adapterId, sessionId)`.
- `ExecutionTracker` proyecta ejecuciones activas y recientes, deduplica,
  cuenta estados, limita el historial a 20 y caduca registros tras 24 horas.
- Los ajustes incluyen juegos automáticos, notificaciones, preferencias por
  evento y sonido; los archivos antiguos migran conservando el comportamiento.
- `NotificationService` y `notification-copy` están aislados de Electron,
  cubiertos al 100 % y generan textos multiagente en inglés.

## Siguiente trabajo: T06

Seguir literalmente el checklist de T06 en el plan y mantener RED → GREEN.
La integración prevista es:

1. Ampliar primero `tests/main.test.ts`, `tests/preload.test.ts` y, si procede,
   `tests/main-dev-mode.test.ts`.
2. Añadir `Notification` al mock de Electron. Los mocks actuales de
   `DEFAULT_SETTINGS` todavía tienen solo los dos campos antiguos y deben pasar
   al modelo completo.
3. En `main.ts`, enviar cada evento válido tanto a `StateMachine` como a una
   instancia de `ExecutionTracker`. Emitir `activity-change` en cada evento,
   aunque el estado agregado no cambie.
4. Para cada transición significativa `needs_user` o `finished`, emitir un IPC
   `agent-interruption` con ejecución y contadores. Esto debe ocurrir también
   cuando termina un agente principal y otro sigue trabajando.
5. Conectar `NotificationService` mediante una fachada de Electron:
   `Notification.isSupported()`, `new Notification({ title, body, silent })`,
   evento `click` y `show()`. El clic abre la vista `Agents`; si el popover ya
   está visible, el servicio ya suprime la notificación.
6. Hacer que `autoOpenGames: false` impida armar y disparar el timer, sin afectar
   aperturas manuales.
7. Mantener una ruta pendiente del popover (`games`, `agents` y, si se modela,
   `game`). Apertura normal y automática: `Games`; clic de notificación:
   `Agents`; una partida en curso gana al default normal al reabrir.
8. Exponer por preload APIs específicas para snapshot/suscripción, interrupción,
   ruta, soporte de notificaciones y estado real del servidor. Nunca exponer
   `ipcRenderer` directamente.
9. Capturar `error` del servidor HTTP y exponer `starting | active | error` para
   que Settings no muestre falsamente `Active`.
10. Actualizar tooltip y menú del tray con los contadores; después de cambios
    dinámicos, volver a llamar `tray.setContextMenu()` en Linux.

## Decisiones que no se deben reabrir

- Todo el texto visible de la app va en inglés.
- `Games` va a la izquierda y es la vista normal por defecto; `Agents`, a la derecha.
- Menú `···`: `Add game` y `Settings`.
- Sin botón `Reply` y sin botón inferior `Choose a game` en `Agents`.
- Terminar cualquier agente principal pausa la partida aunque queden otros
  trabajando. `SubagentStop` no pausa, no notifica y no altera contadores.
- Juegos automáticos y notificaciones son independientes; ambas opciones pueden
  estar apagadas sin deshabilitar juegos manuales ni la vista en directo.
- Settings no lleva tarjeta introductoria; `Idle time` y `Port` llevan ayuda
  accesible mediante icono de interrogación y tooltip.
- No mostrar ni almacenar rutas completas, prompts, transcripciones, tool input
  ni respuestas del asistente.

## Notas del entorno

- `PRODUCT_BRIEF.md` existe como fuente local ignorada por `.gitignore`; se
  actualizó localmente en T01, pero deliberadamente no se forzó su versionado.
- Para E2E de Electron puede hacer falta ejecución fuera del sandbox por el
  puerto local y la GUI.
- La documentación actual de Electron confirma `Notification.isSupported()`,
  las opciones `title`, `body` y `silent`, `show()` y el evento `click`. En macOS
  las notificaciones empaquetadas requieren firma para funcionar correctamente.
- Hacer un commit independiente al terminar cada tarea T06–T10 y actualizar en
  ese mismo commit el progreso, las evidencias RED/VERDE y el registro del plan.

## Comandos de reanudación

```bash
git switch feat/agent-activity-notifications
git status --short --branch
npm test -- --exclude '.claude/**'
npm run build
```
