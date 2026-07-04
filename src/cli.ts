import { runPipeline } from './orchestrator/run';
import { loadManifest, saveManifest, transitionPackage } from './orchestrator/manifest';

function parseArgs(argv: string[]) {
  const args = [...argv];
  const command = args.shift();
  const flags: Record<string, string | boolean> = {};
  const positional: string[] = [];
  while (args.length) {
    const a = args.shift()!;
    if (a.startsWith('--')) {
      const key = a.slice(2);
      if (args.length && !args[0].startsWith('--')) {
        flags[key] = args.shift()!;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(a);
    }
  }
  return { command, flags, positional };
}

async function main() {
  const { command, flags, positional } = parseArgs(process.argv.slice(2));

  if (command === 'run') {
    const outcome = await runPipeline({
      channels: typeof flags.channels === 'string' ? flags.channels.split(',').map((s) => s.trim()) : undefined,
      resume: typeof flags.resume === 'string' ? flags.resume : undefined,
      mock: flags.mock === true
    });
    console.log(JSON.stringify(outcome, null, 2));
    process.exitCode = outcome.packages > 0 || outcome.status === 'completed' ? 0 : 1;
    return;
  }

  if (command === 'approve') {
    const [runId, pkgId] = positional;
    if (!runId || !pkgId) {
      console.error('Usage: cli approve <runId> <pkgId> --approve|--reject [--note "..."]');
      process.exitCode = 2;
      return;
    }
    const decision = flags.approve ? 'approved' : flags.reject ? 'rejected' : null;
    if (!decision) {
      console.error('Pass --approve or --reject');
      process.exitCode = 2;
      return;
    }
    const manifest = await loadManifest(runId);
    const pkg = manifest.packages[pkgId];
    if (!pkg) {
      console.error(`Package ${pkgId} not found in run ${runId}`);
      process.exitCode = 1;
      return;
    }
    transitionPackage(pkg, decision);
    pkg.approval = {
      mode: 'manual',
      by: process.env.GITHUB_ACTOR || process.env.USER || 'unknown',
      at: new Date().toISOString(),
      ...(typeof flags.note === 'string' ? { note: flags.note } : {})
    };
    await saveManifest(manifest);
    console.log(`${pkgId}: ${decision}`);
    return;
  }

  console.error('Usage: cli <run|approve> [options]');
  process.exitCode = 2;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
