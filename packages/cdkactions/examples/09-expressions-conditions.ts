import { App, Stack, Workflow, Job, RunnerLabel, and, eq, neq, not } from '#src/index.ts';

export function create(app?: App) {
  const _app = app ?? new App();
  const stack = new Stack(_app, 'expressions');

  const workflow = new Workflow(stack, 'expressions', {
    name: 'Expressions Demo',
    on: { push: { branches: ['main'] } },
  });

  new Job(workflow, 'deploy', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    if: (github) => and(eq(github.ref, 'refs/heads/main'), neq(github.actor, 'dependabot[bot]')),
    steps: [{ name: 'Deploy', run: 'echo deploying' }],
  });

  return _app;
}
