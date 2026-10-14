import type { Construct } from 'constructs';
import { dedent } from 'ts-dedent';

import { checkoutV7, createGithubAppTokenV3, downloadArtifactV8, uploadArtifactV7 } from '#src/actions.ts';
import { and, eq, expr, secrets } from '#src/expressions.ts';
import { Job, type StepConfig } from '#src/job.ts';
import { RunnerLabel } from '#src/nominal.ts';
import { Workflow } from '#src/workflow.ts';

const checkout = checkoutV7.pinned('3d3c42e5aac5ba805825da76410c181273ba90b1', 'v7.0.1');
const appToken = createGithubAppTokenV3.pinned('64ab729a6294000f5aa4a4bc0b73d1f32bc45510', 'v3.3.0');
const uploadArtifact = uploadArtifactV7.pinned('cf430e030ddbb5b0abf93d22962f4752f3646cd9', 'v7.0.2');
const downloadArtifact = downloadArtifactV8.pinned('9000827ccba6bdab643e8b6fd33ac0654aef8333', 'v8.0.2');

const ARTIFACT_NAME = 'action-pin-sync';
const ARTIFACT_DIR = `${expr<string>('runner.temp')}/${ARTIFACT_NAME}`;
const FROM_DEPENDABOT = and(
  eq(expr<string>('github.event.pull_request.user.login'), 'dependabot[bot]'),
  eq(expr<string>('github.actor'), 'dependabot[bot]'),
  eq(expr<string>('github.event.pull_request.head.repo.full_name'), expr<string>('github.repository')),
);

export interface DependabotActionPinSyncProps {
  /** Files or globs, relative to the repository root, that pin actions for the generated workflows. */
  readonly sources: readonly string[];
  /** Regenerates the workflows, such as `bun run synth:workflows`. */
  readonly synthCommand: string;
  /** Invokes the cdkactions CLI after `setupSteps`. Defaults to `npx --no cdkactions`. */
  readonly cliCommand?: string;
  /** Install what `cliCommand` and `synthCommand` need, such as Bun and the dependencies. */
  readonly setupSteps?: readonly StepConfig[];
  /** Defaults to `.github/workflows`. */
  readonly workflowsDir?: string;
  /** The secret holding the GitHub App's client ID. Defaults to `APP_ID`. */
  readonly appIdSecret?: string;
  /** The secret holding the GitHub App's private key. Defaults to `APP_PEM`. */
  readonly appPrivateKeySecret?: string;
  /** Repositories the app token covers. Defaults to the current repository. */
  readonly repositories?: readonly string[];
  readonly runsOn?: RunnerLabel;
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/** Matches a glob the way `fs.globSync` does: `**\/` spans zero or more directories. */
export function globToRegExpSource(glob: string): string {
  let source = '';
  for (let index = 0; index < glob.length; index++) {
    const char = glob[index];
    if (glob.startsWith('**/', index)) {
      source += '(.*/)?';
      index += 2;
    } else if (glob.startsWith('**', index)) {
      source += '.*';
      index += 1;
    } else if (char === '*') {
      source += '[^/]*';
    } else if (char === '?') {
      source += '[^/]';
    } else {
      source += char.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  return `^${source}$`;
}

/**
 * Carries Dependabot's github-actions bumps from the generated workflows into the TypeScript
 * source, so the next synth keeps them.
 *
 * `regenerate` runs the pull request's code (setup, the CLI and the synth) with a read-only token,
 * no secrets and no persisted credentials, and uploads only the rewritten source files. `push` runs
 * none of the pull request's code: it mints the app token and writes those files to the head branch
 * through the contents API, so the commit is signed and re-runs CI. Both run only when Dependabot
 * opened the pull request, triggered this run, and pushed the head to this repository, so a person's
 * push to a Dependabot branch never reaches the app token.
 */
export class DependabotActionPinSync extends Workflow {
  public constructor(scope: Construct, id: string, props: DependabotActionPinSyncProps) {
    const workflowsDir = props.workflowsDir ?? '.github/workflows';
    super(scope, id, {
      name: 'Carry Dependabot action bumps into the workflow source',
      on: {
        pullRequest: {
          types: ['opened', 'synchronize', 'reopened'],
          paths: [`${workflowsDir}/**`],
        },
      },
      permissions: { contents: 'read' },
    });

    const runsOn = props.runsOn ?? RunnerLabel.UBUNTU_LATEST;
    const regenerate = addRegenerateJob(this, props, workflowsDir, runsOn);
    addPushJob(this, props, regenerate, runsOn);
  }
}

function addRegenerateJob(
  workflow: Workflow,
  props: DependabotActionPinSyncProps,
  workflowsDir: string,
  runsOn: RunnerLabel,
): Job {
  const cliCommand = props.cliCommand ?? 'npx --no cdkactions';
  const sources = props.sources.map(shellQuote).join(' ');
  const sourcePathspecs = props.sources.map((source) => shellQuote(`:(glob)${source}`)).join(' ');

  return new Job(workflow, 'regenerate', {
    runsOn,
    if: FROM_DEPENDABOT,
    permissions: { contents: 'read' },
    outputs: {
      changed: expr<string>('steps.changes.outputs.changed'),
      artifactId: expr<string>('steps.upload.outputs.artifact-id'),
    },
    steps: [
      checkout({
        id: 'checkout',
        with: {
          ref: expr<string>('github.event.pull_request.head.sha'),
          persistCredentials: false,
          fetchDepth: 0,
        },
      }),
      ...(props.setupSteps ?? []),
      {
        name: 'Carry the bumps into the source',
        env: { BASE_SHA: expr<string>('github.event.pull_request.base.sha') },
        run: `${cliCommand} sync-action-pins --base "$BASE_SHA" --workflows ${shellQuote(workflowsDir)} ${sources}`,
      },
      { name: 'Synthesize', run: props.synthCommand },
      {
        name: 'Check the source reproduces the workflows',
        run: `git diff --exit-code -- ${shellQuote(workflowsDir)}`,
      },
      {
        id: 'changes',
        name: 'Collect the changed source files',
        run: dedent`
            git diff --name-only -z -- ${sourcePathspecs} > "$RUNNER_TEMP/changed-sources"
            if [ ! -s "$RUNNER_TEMP/changed-sources" ]; then
              echo "changed=false" >> "$GITHUB_OUTPUT"
              exit 0
            fi
            mkdir -p "$RUNNER_TEMP/${ARTIFACT_NAME}/files"
            cp "$RUNNER_TEMP/changed-sources" "$RUNNER_TEMP/${ARTIFACT_NAME}/paths"
            xargs -0 cp --parents -t "$RUNNER_TEMP/${ARTIFACT_NAME}/files" < "$RUNNER_TEMP/changed-sources"
            echo "changed=true" >> "$GITHUB_OUTPUT"`,
      },
      uploadArtifact({
        id: 'upload',
        if: eq(expr<string>('steps.changes.outputs.changed'), 'true'),
        with: {
          name: ARTIFACT_NAME,
          path: ARTIFACT_DIR,
          ifNoFilesFound: 'error',
          includeHiddenFiles: true,
          retentionDays: 1,
        },
      }),
    ],
  });
}

function addPushJob(
  workflow: Workflow,
  props: DependabotActionPinSyncProps,
  regenerate: Job,
  runsOn: RunnerLabel,
): void {
  const token = appToken({
    id: 'app-token',
    with: {
      clientId: secrets[props.appIdSecret ?? 'APP_ID'],
      privateKey: secrets[props.appPrivateKeySecret ?? 'APP_PEM'],
      permissionContents: 'write',
      ...(props.repositories !== undefined && { repositories: props.repositories.join(',') }),
    },
  });

  new Job(workflow, 'push', {
    runsOn,
    needs: regenerate.id,
    if: and(FROM_DEPENDABOT, eq(expr<string>('needs.regenerate.outputs.changed'), 'true')),
    permissions: {},
    steps: [
      token,
      downloadArtifact({
        id: 'download',
        with: {
          artifactIds: expr<string>('needs.regenerate.outputs.artifactId'),
          path: ARTIFACT_DIR,
        },
      }),
      {
        name: 'Write the source files to the pull request branch',
        env: {
          GH_TOKEN: token.outputs.token,
          REPOSITORY: expr<string>('github.repository'),
          HEAD_REF: expr<string>('github.event.pull_request.head.ref'),
          HEAD_SHA: expr<string>('github.event.pull_request.head.sha'),
          SOURCE_PATTERN: props.sources.map(globToRegExpSource).join('|'),
        },
        run: dedent`
            set -euo pipefail
            root="$RUNNER_TEMP/${ARTIFACT_NAME}"
            expected_head="$HEAD_SHA"
            while IFS= read -r -d '' file; do
              case "$file" in
                /* | ../* | */../* | */.. | ..) echo "::error::Refusing path $file"; exit 1 ;;
              esac
              if ! printf '%s' "$file" | grep -Eq "$SOURCE_PATTERN"; then
                echo "::error::$file is not one of the configured sources"; exit 1
              fi
              if [ ! -f "$root/files/$file" ] || [ -L "$root/files/$file" ]; then
                echo "::error::$file is not a regular file in the artifact"; exit 1
              fi
              head=$(gh api "repos/$REPOSITORY/git/ref/heads/$HEAD_REF" --jq .object.sha)
              if [ "$head" != "$expected_head" ]; then
                echo "::error::$HEAD_REF moved to $head after $expected_head; not overwriting it"; exit 1
              fi
              blob=$(gh api "repos/$REPOSITORY/contents/$file?ref=$expected_head" --jq .sha)
              expected_head=$(gh api -X PUT "repos/$REPOSITORY/contents/$file" \\
                -f message="chore(deps): carry action bumps into the workflow source" \\
                -f content="$(base64 -w0 "$root/files/$file")" \\
                -f branch="$HEAD_REF" \\
                -f sha="$blob" \\
                --jq .commit.sha)
              echo "Wrote $file in $expected_head"
            done < "$root/paths"`,
      },
    ],
  });
}
