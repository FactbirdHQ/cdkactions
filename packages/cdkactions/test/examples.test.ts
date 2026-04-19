import * as fs from 'fs';
import * as path from 'path';

import type { App } from '#src/index.js';
import { TestingApp } from '#test/utils.js';

import { create as createNodeCiMatrix } from '../examples/01-nodejs-ci-matrix.js';
import { create as createDockerBuildPush } from '../examples/02-docker-build-push.js';
import { create as createMultiJobPipeline } from '../examples/03-multi-job-pipeline.js';
import { create as createScheduledCron } from '../examples/04-scheduled-cron.js';
import { create as createManualDispatch } from '../examples/05-manual-dispatch.js';
import { create as createReusableWorkflow } from '../examples/06-reusable-workflow.js';
import { create as createContainerServices } from '../examples/07-container-services.js';
import { create as createCompositeAction } from '../examples/08-composite-action.js';
import { create as createExpressionsConditions } from '../examples/09-expressions-conditions.js';
import { create as createCrossWorkflowDeps } from '../examples/10-cross-workflow-deps.js';
import { create as createPermissionsConcurrency } from '../examples/11-permissions-concurrency.js';
import { create as createMultiPlatformRunnerGroups } from '../examples/12-multi-platform-runner-groups.js';
import { create as createGithubPages } from '../examples/13-github-pages.js';
import { create as createEventCoverage } from '../examples/14-event-coverage.js';
import { create as createRunnerRegistry } from '../examples/15-runner-registry.js';
import { create as createTypedActionRefs } from '../examples/16-typed-action-refs.js';

function synthAndReadAll(createFn: (app?: App) => App) {
  const app = createFn(TestingApp({ createValidateWorkflow: false }));
  app.synth();
  const files = fs.readdirSync(app.outdir).sort();
  const result: Record<string, string> = {};
  for (const file of files) {
    result[file] = fs.readFileSync(path.join(app.outdir, file), 'utf-8');
  }
  return result;
}

test('01 - Node.js CI with Matrix', () => {
  expect(synthAndReadAll(createNodeCiMatrix)).toMatchSnapshot();
});

test('02 - Docker Build and Push', () => {
  expect(synthAndReadAll(createDockerBuildPush)).toMatchSnapshot();
});

test('03 - Multi-Job Pipeline with Dependencies', () => {
  expect(synthAndReadAll(createMultiJobPipeline)).toMatchSnapshot();
});

test('04 - Scheduled Workflow with Cron', () => {
  expect(synthAndReadAll(createScheduledCron)).toMatchSnapshot();
});

test('05 - Manual Dispatch with Typed Inputs', () => {
  expect(synthAndReadAll(createManualDispatch)).toMatchSnapshot();
});

test('06 - Reusable Workflow (workflow_call)', () => {
  expect(synthAndReadAll(createReusableWorkflow)).toMatchSnapshot();
});

test('07 - Container Job with Services', () => {
  expect(synthAndReadAll(createContainerServices)).toMatchSnapshot();
});

test('08 - Composite Action with Typed I/O', () => {
  expect(synthAndReadAll(createCompositeAction)).toMatchSnapshot();
});

test('09 - Typed Expressions and Conditions', () => {
  expect(synthAndReadAll(createExpressionsConditions)).toMatchSnapshot();
});

test('10 - Cross-Workflow Dependencies', () => {
  expect(synthAndReadAll(createCrossWorkflowDeps)).toMatchSnapshot();
});

test('11 - Full Permissions and Concurrency', () => {
  expect(synthAndReadAll(createPermissionsConcurrency)).toMatchSnapshot();
});

test('12 - Multi-Platform Build with Runner Groups', () => {
  expect(synthAndReadAll(createMultiPlatformRunnerGroups)).toMatchSnapshot();
});

test('13 - GitHub Pages Deployment', () => {
  expect(synthAndReadAll(createGithubPages)).toMatchSnapshot();
});

test('14 - Event Coverage: Discussions, Branch Protection, Merge Group', () => {
  expect(synthAndReadAll(createEventCoverage)).toMatchSnapshot();
});

test('15 - Central Runner Registry', () => {
  expect(synthAndReadAll(createRunnerRegistry)).toMatchSnapshot();
});

test('16 - Typed Action References', () => {
  expect(synthAndReadAll(createTypedActionRefs)).toMatchSnapshot();
});
