import { Code, Function, Runtime } from 'aws-cdk-lib/aws-lambda';
import { JsonPath, Pass } from 'aws-cdk-lib/aws-stepfunctions';
import { LambdaInvoke } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Construct } from 'constructs';

export class InverseConstruct extends Construct {
  public formatForInverse: Pass;
  public lambdaInvokeInverse: LambdaInvoke;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.formatForInverse = new Pass(this, 'Format For Inverse', {
      parameters: {
        a: JsonPath.stringAt('$.Payload')
      }
    });

    const inverse = new Function(this, 'Inverse', {
      handler: 'index.handler',
      code: Code.fromInline(`
              exports.handler = ({a}, _, callback) => {
                callback(null, 1/parseInt(a));
              };
            `),
      runtime: Runtime.NODEJS_16_X
    });

    this.lambdaInvokeInverse = new LambdaInvoke(this, 'Lambda Invoke Inverse', {
      lambdaFunction: inverse
    });
  }
}
