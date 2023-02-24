import { Construct } from 'constructs';
import { LambdaInvoke } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Code, Runtime, Function } from 'aws-cdk-lib/aws-lambda';
import { Pass, JsonPath } from 'aws-cdk-lib/aws-stepfunctions';

export class MultiplyConstruct extends Construct {
  public formatForMultiply: Pass;
  public lambdaInvokeMultiply: LambdaInvoke;

  constructor(
    scope: Construct,
    id: string,
    props: { aJsonPath: string; multiplier: number }
  ) {
    super(scope, id);

    this.formatForMultiply = new Pass(this, 'Format For Multiply', {
      parameters: {
        a: JsonPath.stringAt('$.Payload')
      }
    });

    const multiply = new Function(this, 'Multiply', {
      handler: 'index.handler',
      code: Code.fromInline(`
              exports.handler = ({a}, _, callback) => {
                callback(null, parseInt(a)*${props.multiplier});
              };
            `),
      runtime: Runtime.NODEJS_16_X
    });

    this.lambdaInvokeMultiply = new LambdaInvoke(
      this,
      'Lambda Invoke Multiply',
      {
        lambdaFunction: multiply
      }
    );
  }
}
