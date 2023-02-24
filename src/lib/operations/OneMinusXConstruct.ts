import { Construct } from 'constructs';
import { LambdaInvoke } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Code, Runtime, Function } from 'aws-cdk-lib/aws-lambda';
import { JsonPath } from 'aws-cdk-lib/aws-stepfunctions';

export class OneMinusXConstruct extends Construct {
  public oneMinusX: LambdaInvoke;

  constructor(scope: Construct, id: string, props: { xJsonPath: string }) {
    super(scope, id);

    this.oneMinusX = new LambdaInvoke(
      this,
      `Lambda Invoke OneMinusX ${props.xJsonPath}`,
      {
        lambdaFunction: new Function(this, 'OneMinusX', {
          handler: 'index.handler',
          code: Code.fromInline(`
                  exports.handler = (x, _, callback) => {
                    callback(null, 1-parseFloat(x));
                  };
                `),
          runtime: Runtime.NODEJS_16_X
        }),
        inputPath: JsonPath.stringAt(props.xJsonPath),
        resultSelector: {
          value: JsonPath.stringAt('$.Payload')
        },
        resultPath: JsonPath.stringAt('$.resultOneMinusX')
      }
    );
  }
}
