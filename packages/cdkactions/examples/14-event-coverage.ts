import { App, Stack, Workflow, Job, RunnerLabel } from '#@/index.js';

export function create(app?: App) {
  const _app = app ?? new App();
  const stack = new Stack(_app, 'events');

  const discussion = new Workflow(stack, 'discussion-bot', {
    name: 'Discussion Bot',
    on: {
      discussion: { types: ['created', 'answered', 'unanswered', 'category_changed'] },
      discussionComment: { types: ['created'] },
    },
  });

  new Job(discussion, 'handle', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [{ name: 'Handle', run: 'echo "Discussion event"' }],
  });

  const branchRules = new Workflow(stack, 'branch-rules', {
    name: 'Branch Protection Audit',
    on: {
      branchProtectionRule: { types: ['created', 'edited', 'deleted'] },
    },
  });

  new Job(branchRules, 'audit', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [{ name: 'Audit', run: 'echo "Branch rule changed"' }],
  });

  const mergeQueue = new Workflow(stack, 'merge-queue', {
    name: 'Merge Queue CI',
    on: { mergeGroup: { types: ['checks_requested'] } },
  });

  new Job(mergeQueue, 'ci', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [{ name: 'CI', run: 'echo "Merge queue check"' }],
  });

  return _app;
}
