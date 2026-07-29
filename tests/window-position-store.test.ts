import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { readPosition, savePosition } from '../src/window-position-store';

describe('window-position-store', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'meanwaile-test-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('returns null when no position file exists', () => {
    expect(readPosition(dir)).toBeNull();
  });

  it('returns null when the file contains malformed JSON', () => {
    fs.writeFileSync(path.join(dir, 'window-position.json'), 'not-json');
    expect(readPosition(dir)).toBeNull();
  });

  it('returns null when the stored position is missing x or y', () => {
    fs.writeFileSync(path.join(dir, 'window-position.json'), JSON.stringify({ x: 42 }));
    expect(readPosition(dir)).toBeNull();
  });

  it('returns the saved position after savePosition has been called', () => {
    savePosition(dir, { x: 120, y: 340 });
    expect(readPosition(dir)).toEqual({ x: 120, y: 340 });
  });

  it('creates the directory if it does not exist yet', () => {
    const nested = path.join(dir, 'nested', 'userData');
    savePosition(nested, { x: 5, y: 6 });
    expect(readPosition(nested)).toEqual({ x: 5, y: 6 });
  });

  it('overwrites a previously saved position', () => {
    savePosition(dir, { x: 1, y: 2 });
    savePosition(dir, { x: 9, y: 8 });
    expect(readPosition(dir)).toEqual({ x: 9, y: 8 });
  });
});
