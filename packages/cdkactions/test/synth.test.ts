import type { Construct } from 'constructs';
import * as fs from 'fs';
import { secrets } from '#@/expressions.js';
import type { Expression } from '#@/expressions.js';
import { CheckoutJob } from '#@/library.js';
import { RunnerLabel } from '#@/nominal.js';
import { Stack } from '#@/stack.js';
import { Workflow } from '#@/workflow.js';
import { TestingApp } from '#$/utils.js';

test('complicated stack', () => {
  class MyStack extends Stack {
    constructor(scope: Construct, name: string) {
      super(scope, name);

      const build = new Workflow(this, 'build', {
        name: 'Build',
        on: ['push', 'fork', 'pullRequest'],
        defaults: {
          run: {
            workingDirectory: '~/',
          },
          env: {
            key: 'value',
          },
        },
      });
      new CheckoutJob(build, 'build', {
        runsOn: RunnerLabel.UBUNTU_LATEST,
        steps: [
          {
            name: 'Cache',
            uses: 'actions/cache@v2',
            with: {
              path: '**/files',
              key: "v0-${{ hashFiles('Dockerfile') }}",
            },
          },
          {
            name: 'Build docker',
            uses: 'docker/build-push-action@v1',
            with: {
              repository: 'example/image',
              path: 'path/to/Dockerfile',
              username: secrets.DOCKER_USERNAME,
              password: secrets.DOCKER_PASSWORD,
              push: "${{ github.ref == 'refs/heads/master' }}",
              tags: 'latest,${{ github.sha }}',
            },
            continueOnError: false,
          },
        ],
        continueOnError: false,
      });

      new Workflow(this, 'deploy', {
        name: 'Deploy',
        on: {
          push: {
            branches: ['master'],
          },
        },
      });

      const schedule = new Workflow(this, 'schedule', {
        name: 'Cron',
        on: {
          schedule: [
            {
              cron: '*/15 * * * *',
            },
          ],
        },
      });
      new CheckoutJob(schedule, 'matrix', {
        runsOn: '${{ matrix.os }}' as Expression<string>,
        strategy: {
          matrix: {
            os: ['macos-latest', 'windows-latest', 'ubuntu-latest'],
            node: [4, 6, 8, 10],
          } as const,
          include: [{ os: 'windows-latest', node: 4 }],
        },
        steps: [],
      });
    }
  }

  const app = TestingApp({ createValidateWorkflow: false });
  new MyStack(app, 'abc');

  app.synth();
  expect(fs.readdirSync(app.outdir).sort()).toEqual([
    'cdkactions_build.yaml',
    'cdkactions_deploy.yaml',
    'cdkactions_schedule.yaml',
  ]);

  expect(fs.readFileSync(`${app.outdir}/cdkactions_build.yaml`, 'utf-8')).toMatchSnapshot();
  expect(fs.readFileSync(`${app.outdir}/cdkactions_deploy.yaml`, 'utf-8')).toMatchSnapshot();
  expect(fs.readFileSync(`${app.outdir}/cdkactions_schedule.yaml`, 'utf-8')).toMatchSnapshot();
});
