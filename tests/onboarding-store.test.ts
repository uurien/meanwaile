import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  hasOnboarded,
  markOnboarded,
  hasOfferedHookBackfill,
  markHookBackfillOffered,
  hasOfferedCodexHookBackfill,
  markCodexHookBackfillOffered,
} from '../src/onboarding-store';

describe('onboarding-store', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'meanwaile-test-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('returns false when no onboarding file exists', () => {
    expect(hasOnboarded(dir)).toBe(false);
  });

  it('returns false when the file contains malformed JSON', () => {
    fs.writeFileSync(path.join(dir, 'onboarding.json'), 'not-json');
    expect(hasOnboarded(dir)).toBe(false);
  });

  it('returns false when onboarded is false or missing', () => {
    fs.writeFileSync(path.join(dir, 'onboarding.json'), JSON.stringify({ onboarded: false }));
    expect(hasOnboarded(dir)).toBe(false);

    fs.writeFileSync(path.join(dir, 'onboarding.json'), JSON.stringify({}));
    expect(hasOnboarded(dir)).toBe(false);
  });

  it('returns true after markOnboarded has been called', () => {
    markOnboarded(dir);
    expect(hasOnboarded(dir)).toBe(true);
  });

  it('creates the directory if it does not exist yet', () => {
    const nested = path.join(dir, 'nested', 'userData');
    markOnboarded(nested);
    expect(hasOnboarded(nested)).toBe(true);
  });

  it('preserves onboarded when markHookBackfillOffered runs afterwards', () => {
    markOnboarded(dir);
    markHookBackfillOffered(dir);
    expect(hasOnboarded(dir)).toBe(true);
    expect(hasOfferedHookBackfill(dir)).toBe(true);
  });

  it('preserves hookBackfillOffered when markOnboarded runs afterwards', () => {
    markHookBackfillOffered(dir);
    markOnboarded(dir);
    expect(hasOfferedHookBackfill(dir)).toBe(true);
    expect(hasOnboarded(dir)).toBe(true);
  });

  it('returns false for hasOfferedHookBackfill when no file exists', () => {
    expect(hasOfferedHookBackfill(dir)).toBe(false);
  });

  it('returns false for hasOfferedHookBackfill on malformed JSON', () => {
    fs.writeFileSync(path.join(dir, 'onboarding.json'), 'not-json');
    expect(hasOfferedHookBackfill(dir)).toBe(false);
  });

  it('tracks the Codex backfill flag independently from the Claude one', () => {
    markHookBackfillOffered(dir);
    expect(hasOfferedCodexHookBackfill(dir)).toBe(false);

    markCodexHookBackfillOffered(dir);
    expect(hasOfferedCodexHookBackfill(dir)).toBe(true);
    expect(hasOfferedHookBackfill(dir)).toBe(true);
  });

  it('returns false for hasOfferedCodexHookBackfill when no file exists', () => {
    expect(hasOfferedCodexHookBackfill(dir)).toBe(false);
  });

  it('returns false for hasOfferedCodexHookBackfill on malformed JSON', () => {
    fs.writeFileSync(path.join(dir, 'onboarding.json'), 'not-json');
    expect(hasOfferedCodexHookBackfill(dir)).toBe(false);
  });
});
