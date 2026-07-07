import { describe, it, expect } from 'vitest';

describe('forge.config', () => {
  it('exports packagerConfig with app name and icon', async () => {
    const mod = await import('../forge.config.js');
    const config = mod.default ?? mod;
    expect(config.packagerConfig.name).toBe('Meanwaile');
    expect(config.packagerConfig.icon).toBeTruthy();
  });

  it('exports makers array', async () => {
    const mod = await import('../forge.config.js');
    const config = mod.default ?? mod;
    expect(Array.isArray(config.makers)).toBe(true);
    expect(config.makers.length).toBeGreaterThan(0);
  });
});
