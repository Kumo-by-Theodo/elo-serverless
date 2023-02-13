import { Construct } from 'constructs';
import { LambdaInvoke } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Code, Runtime, Function } from 'aws-cdk-lib/aws-lambda';
import { Pass, JsonPath } from 'aws-cdk-lib/aws-stepfunctions';

export class TenToPowerOfConstruct extends Construct {
  public formatForTenToPowerOf: Pass;
  public lambdaInvokeTenToPowerOf: LambdaInvoke;

  constructor(scope: Construct, id: string, props: { aJsonPath: string }) {
    super(scope, id);

    this.formatForTenToPowerOf = new Pass(this, 'Format For TenToPowerOf', {
      parameters: {
        a: JsonPath.stringAt('$.Payload'),
      },
    });

    const TenToPowerOf = new Function(this, 'TenToPowerOf', {
      handler: 'index.handler',
      code: Code.fromInline(`
              exports.handler = ({a}, _, callback) => {
                callback(null, 10**parseFloat(a));
              };
            `),
      runtime: Runtime.NODEJS_16_X,
    });

    this.lambdaInvokeTenToPowerOf = new LambdaInvoke(
      this,
      'Lambda Invoke TenToPowerOf',
      {
        lambdaFunction: TenToPowerOf,
      },
    );
  }
}
