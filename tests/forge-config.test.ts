import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('forge.config', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

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

  it('signs ad-hoc and skips notarization without Apple credentials', async () => {
    delete process.env.APPLE_TEAM_ID;
    const mod = await import('../forge.config.js');
    const config = mod.default ?? mod;
    expect(config.packagerConfig.osxSign.identity).toBe('-');
    expect(config.packagerConfig.osxSign.identityValidation).toBe(false);
    expect(config.packagerConfig.osxNotarize).toBeUndefined();
  });

  it('signs with the real identity and notarizes when Apple credentials are present', async () => {
    process.env.APPLE_TEAM_ID = 'ABCDE12345';
    process.env.APPLE_API_KEY_PATH = '/tmp/AuthKey.p8';
    process.env.APPLE_API_KEY_ID = 'KEYID';
    process.env.APPLE_API_ISSUER = 'ISSUER';
    const mod = await import('../forge.config.js');
    const config = mod.default ?? mod;
    expect(config.packagerConfig.osxSign.identity).toBeUndefined();
    expect(config.packagerConfig.osxNotarize).toEqual({
      appleApiKey: '/tmp/AuthKey.p8',
      appleApiKeyId: 'KEYID',
      appleApiIssuer: 'ISSUER',
    });
  });
});
