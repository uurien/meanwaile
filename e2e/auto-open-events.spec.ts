import { test, expect } from '@playwright/test';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright-core';
import * as fs from 'fs';
import * as http from 'http';
import * as net from 'net';
import * as os from 'os';
import * as path from 'path';

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Could not reserve a local port'));
        return;
      }
      server.close((error) => error ? reject(error) : resolve(address.port));
    });
  });
}

function postHook(port: number, payload: Record<string, unknown>): Promise<number> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const request = http.request({
      hostname: '127.0.0.1',
      port,
      path: '/hook/codex',
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(body),
      },
    }, (response) => {
      response.resume();
      response.once('end', () => resolve(response.statusCode ?? 0));
    });
    request.once('error', reject);
    request.end(body);
  });
}

async function popoverIsVisible(electronApp: ElectronApplication): Promise<boolean> {
  return electronApp.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows().some((window) => !window.isDestroyed() && window.isVisible()),
  );
}

test.describe('auto-open with real agent event sequences', () => {
  let electronApp: ElectronApplication | undefined;
  let popover: Page;
  let userDataDir: string;
  let port: number;

  test.beforeAll(async () => {
    port = await freePort();
    userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'meanwaile-auto-open-e2e-'));
    fs.writeFileSync(
      path.join(userDataDir, 'onboarding.json'),
      JSON.stringify({ onboarded: true, hookBackfillOffered: true, codexHookBackfillOffered: true }),
    );
    fs.writeFileSync(
      path.join(userDataDir, 'settings.json'),
      JSON.stringify({ httpPort: port, autoOpenDelaySeconds: 0.05 }),
    );

    const electronEnv = { ...process.env };
    delete electronEnv.ELECTRON_RUN_AS_NODE;
    electronApp = await electron.launch({
      args: [path.join(__dirname, '..', 'dist', 'main.js'), `--user-data-dir=${userDataDir}`],
      env: { ...electronEnv, MEANWAILE_E2E: '1' },
    });
    popover = await electronApp.firstWindow();

    await electronApp.evaluate(({ powerMonitor }) => {
      powerMonitor.getSystemIdleTime = () => 3600;
    });
    await expect.poll(async () => {
      try {
        return await postHook(port, { hook_event_name: 'Unknown' });
      } catch {
        return 0;
      }
    }).toBe(200);
  });

  test.afterAll(async () => {
    await electronApp?.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  });

  test('ignores background completions and keeps a manual dismissal final for the turn', async () => {
    if (!electronApp) throw new Error('Electron did not launch');
    expect(await postHook(port, {
      hook_event_name: 'UserPromptSubmit',
      session_id: 'synthetic-child',
      prompt: '<task-notification>\n<status>completed</status>\n</task-notification>',
    })).toBe(200);
    await popover.waitForTimeout(800);
    expect(await popoverIsVisible(electronApp)).toBe(false);

    expect(await postHook(port, {
      hook_event_name: 'UserPromptSubmit',
      session_id: 'parent',
      prompt: 'Run the real task',
    })).toBe(200);
    expect(await postHook(port, {
      hook_event_name: 'SubagentStop',
      session_id: 'parent',
      agent_id: 'child',
    })).toBe(200);
    await expect.poll(() => popoverIsVisible(electronApp)).toBe(true);

    expect(await postHook(port, {
      hook_event_name: 'PermissionRequest',
      session_id: 'parent',
    })).toBe(200);
    await popover.evaluate(() => window.meanwaile.close());
    await expect.poll(() => popoverIsVisible(electronApp)).toBe(false);

    expect(await postHook(port, {
      hook_event_name: 'PreToolUse',
      session_id: 'parent',
    })).toBe(200);
    await popover.waitForTimeout(800);
    expect(await popoverIsVisible(electronApp)).toBe(false);

    expect(await postHook(port, {
      hook_event_name: 'UserPromptSubmit',
      session_id: 'parent',
      prompt: 'A new real prompt starts a new offer window',
    })).toBe(200);
    await expect.poll(() => popoverIsVisible(electronApp)).toBe(true);

    expect(await postHook(port, {
      hook_event_name: 'Stop',
      session_id: 'parent',
    })).toBe(200);
  });
});
