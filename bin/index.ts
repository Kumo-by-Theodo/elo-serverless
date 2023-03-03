import { App, Stack } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { EloServerless } from '../src/lib/CoreConstruct';

class EloStack extends Stack {
  constructor(scope: Construct, id: string) {
    super(scope, id);
    new EloServerless(this, 'EloServerless');
  }
}

const app = new App();
new EloStack(app, 'EloStack');
