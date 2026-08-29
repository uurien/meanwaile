import { describe, it, expect } from 'vitest';
import config from '../vitest.config';

describe('vitest.config', () => {
  it('excludes installed game bundles, which ship their own non-Vitest test files', () => {
    const exclude = config.test?.exclude ?? [];
    expect(exclude).toContain('games/**');
  });

  it('excludes packaged app output, which contains duplicate tests and Playwright specs', () => {
    const exclude = config.test?.exclude ?? [];
    expect(exclude).toContain('out/**');
  });
});
