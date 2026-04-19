import { App, Stack, Workflow, Job, RunnerLabel, expression } from '#@/index.js';

const { github, eq, neq, contains, startsWith, not, and, success, failure, always, cancelled } = expression;

export function create(app?: App) {
  const _app = app ?? new App();
  const stack = new Stack(_app, 'expressions');

  const workflow = new Workflow(stack, 'expressions', {
    name: 'Expressions Demo',
    on: { push: { branches: ['main'] } },
  });

  const isMain = eq(github.ref, 'refs/heads/main');
  const isDocChange = contains(github.eventName, 'docs/');
  const isNotFork = not(eq(github.eventName, 'pull_request_target'));
  const runOnFailure = failure();
  const runAlways = always();

  const deployCondition = and(isMain, not(eq(github.actor, 'dependabot[bot]')));

  new Job(workflow, 'deploy', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    if: deployCondition,
    steps: [{ name: 'Deploy', run: 'echo deploying' }],
  });

  return _app;
}
