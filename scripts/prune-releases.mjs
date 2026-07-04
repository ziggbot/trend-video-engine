// Delete run-* releases (and their tags) older than RETENTION_DAYS to cap storage.
// Requires the gh CLI with GH_TOKEN (available in GitHub Actions).
import { execFileSync } from 'child_process';

const RETENTION_DAYS = Number(process.env.RELEASE_RETENTION_DAYS || 30);
const cutoff = Date.now() - RETENTION_DAYS * 24 * 3600 * 1000;

let releases;
try {
  releases = JSON.parse(
    execFileSync('gh', ['release', 'list', '--limit', '200', '--json', 'tagName,createdAt'], { encoding: 'utf8' })
  );
} catch (err) {
  console.error('gh release list failed (is gh installed and authenticated?)', err.message);
  process.exit(0); // pruning is best-effort; never fail the pipeline for it
}

for (const rel of releases) {
  if (!rel.tagName.startsWith('run-')) continue;
  if (new Date(rel.createdAt).getTime() >= cutoff) continue;
  try {
    execFileSync('gh', ['release', 'delete', rel.tagName, '--cleanup-tag', '--yes'], { encoding: 'utf8' });
    console.log(`Pruned release ${rel.tagName}`);
  } catch (err) {
    console.error(`Failed to prune ${rel.tagName}: ${err.message}`);
  }
}
