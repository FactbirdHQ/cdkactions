import { Construct } from 'constructs';
import * as fs from 'fs';
import { Stack, Workflow } from '#src/index.ts';
import { TestingApp } from '#test/utils.ts';

test('non-workflow children are ignored', () => {
  const app = TestingApp({ createValidateWorkflow: false });
  const stack = new Stack(app, 'stack');
  new Construct(stack, 'not_workflow');
  app.synth();
  expect(fs.readdirSync(app.outdir)).toHaveLength(0);
});

test('workflow manifest has metadata', () => {
  const app = TestingApp({ createValidateWorkflow: false });
  const stack = new Stack(app, 'stack');
  const workflow = new Workflow(stack, 'test', {
    name: 'Test',
    on: 'push',
  });
  app.synth();
  expect(fs.readdirSync(app.outdir)).toEqual([workflow.outputFile]);
  expect(fs.readFileSync(`${app.outdir}/${workflow.outputFile}`, 'utf-8')).toMatchSnapshot();
});
