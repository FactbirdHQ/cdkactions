import { readdirSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, test, expect } from 'bun:test';
import { App } from '@factbird/cdkactions';
import { extractEvents } from '#src/event-extractor.ts';
import { runActDryRun } from '#src/act-runner.ts';

interface ExampleModule {
  create?: (app?: App) => App;
}

const EXAMPLES_DIR = join(import.meta.dirname, '../../cdkactions/examples');

const SKIP_FILES = new Set([
  '17-type-level-tests.ts',
  // act can't resolve local reusable workflow references from a temp dir
  '06-reusable-workflow.ts',
  // act's schema doesn't support command/entrypoint on service containers
  '07-container-services.ts',
]);

const exampleFiles = readdirSync(EXAMPLES_DIR)
  .filter((f: string) => f.endsWith('.ts') && !SKIP_FILES.has(f))
  .sort();

describe('act dry-run validation', () => {
  for (const file of exampleFiles) {
    describe(file, () => {
      test('all events pass act --dryrun', async () => {
        const mod: ExampleModule = await import(join(EXAMPLES_DIR, file));
        if (!mod.create) {
          return;
        }

        const outdir = mkdtempSync(join(tmpdir(), 'cdkactions-act-'));
        const app = mod.create(new App({ outdir, createValidateWorkflow: false }));
        app.synth();

        const yamlFiles = readdirSync(outdir).filter((f: string) => f.endsWith('.yaml') || f.endsWith('.yml'));
        expect(yamlFiles.length).toBeGreaterThan(0);

        for (const yamlFile of yamlFiles) {
          const workflowPath = join(outdir, yamlFile);
          const events = extractEvents(workflowPath);

          for (const event of events) {
            const result = runActDryRun(workflowPath, event);
            if (!result.parsedSuccessfully) {
              throw new Error(
                `act --dryrun failed for ${file} → ${yamlFile} (event: ${event})\n` +
                  `Exit code: ${result.exitCode}\n` +
                  `stderr: ${result.stderr}\n` +
                  `stdout: ${result.stdout}`,
              );
            }
          }
        }
      });
    });
  }
});
