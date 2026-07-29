import * as fs from 'fs';
import * as path from 'path';

export interface WindowPosition {
  x: number;
  y: number;
}

function filePath(userDataDir: string): string {
  return path.join(userDataDir, 'window-position.json');
}

export function readPosition(userDataDir: string): WindowPosition | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath(userDataDir), 'utf8')) as Partial<WindowPosition>;
    if (typeof parsed.x !== 'number' || typeof parsed.y !== 'number') return null;
    return { x: parsed.x, y: parsed.y };
  } catch {
    return null;
  }
}

export function savePosition(userDataDir: string, position: WindowPosition): void {
  fs.mkdirSync(userDataDir, { recursive: true });
  fs.writeFileSync(filePath(userDataDir), JSON.stringify(position, null, 2));
}
