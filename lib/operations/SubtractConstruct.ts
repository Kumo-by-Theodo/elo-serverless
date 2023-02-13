import { Construct } from 'constructs';
import { LambdaInvoke } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Code, Runtime, Function } from 'aws-cdk-lib/aws-lambda';
import { JsonPath, Pass } from 'aws-cdk-lib/aws-stepfunctions';

export class SubtractConstruct extends Construct {
  public formatForSubtraction: Pass;
  public lambdaInvokeSubtract: LambdaInvoke;

  constructor(
    scope: Construct,
    id: string,
    props: { aJsonPath: string; bJsonPath: string },
  ) {
    super(scope, id);

    this.formatForSubtraction = new Pass(this, 'Format For Subtraction', {
      parameters: {
        a: JsonPath.stringAt(props.aJsonPath),
        b: JsonPath.stringAt(props.bJsonPath),
      },
    });

    const subtract = new Function(this, 'Subtract', {
      handler: 'index.handler',
      code: Code.fromInline(`
                exports.handler = ({a,b}, _, callback) => {
                  callback(null, parseInt(a)-parseInt(b));
                };
              `),
      runtime: Runtime.NODEJS_16_X,
    });

    this.lambdaInvokeSubtract = new LambdaInvoke(
      this,
      'Lambda Invoke Subtract',
      {
        lambdaFunction: subtract,
      },
    );
  }
}
