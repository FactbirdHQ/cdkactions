// import dedent from 'ts-dedent';

import { App, Stack } from 'cdkactions';
import type { Construct } from 'constructs';

export class MyStack extends Stack {
  constructor(scope: Construct, name: string) {
    super(scope, name);

    // define workflows here
  }
}

const app = new App();
new MyStack(app, '{{ $base }}');
app.synth();
