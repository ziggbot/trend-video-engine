import { describe, it, expect } from 'vitest';
import { transitionPackage } from '../../src/orchestrator/manifest.js';
import { PackageEntry } from '../../src/types/manifest.js';

function pkg(status: PackageEntry['status']): PackageEntry {
  return {
    pkgId: 'test--short--abcd',
    channelId: 'test',
    kind: 'short',
    platforms: ['tiktok'],
    status,
    dir: 'output/x',
    publish: { publisher: 'manual', results: {} }
  };
}

describe('transitionPackage', () => {
  it('allows the happy path rendered→packaged→approved→published', () => {
    const p = pkg('rendered');
    transitionPackage(p, 'packaged');
    transitionPackage(p, 'approved');
    transitionPackage(p, 'published');
    expect(p.status).toBe('published');
  });

  it('allows the manual gate packaged→pending_approval→approved', () => {
    const p = pkg('packaged');
    transitionPackage(p, 'pending_approval');
    transitionPackage(p, 'approved');
    expect(p.status).toBe('approved');
  });

  it('rejects illegal transitions', () => {
    expect(() => transitionPackage(pkg('rendered'), 'published')).toThrow(/Illegal/);
    expect(() => transitionPackage(pkg('published'), 'approved')).toThrow(/Illegal/);
    expect(() => transitionPackage(pkg('rejected'), 'approved')).toThrow(/Illegal/);
  });
});
