import { Construct } from 'constructs';
import { LambdaInvoke } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { TaskInput } from 'aws-cdk-lib/aws-stepfunctions';
import { Code, Runtime, Function } from 'aws-cdk-lib/aws-lambda';
import { JsonPath } from 'aws-cdk-lib/aws-stepfunctions';

export class ComputeProbaConstruct extends Construct {
  public lambdaInvokeComputeProbaOfVictory: LambdaInvoke;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const computeProbaOfVictory = new Function(
      this,
      'Compute Proba Of Victory',
      {
        handler: 'index.handler',
        code: Code.fromInline(`
                exports.handler = ({scorePlayerA, scorePlayerB}, _, callback) => {
                  callback(null, 1 / (1 + 10 ** ((parseInt(scorePlayerA) - parseInt(scorePlayerB)) / 400)));
                };
              `),
        runtime: Runtime.NODEJS_16_X
      }
    );

    this.lambdaInvokeComputeProbaOfVictory = new LambdaInvoke(
      this,
      'Lambda Invoke Compute Proba Of Victory',
      {
        payload: TaskInput.fromObject({
          scorePlayerA: JsonPath.stringAt(
            '$.TaskResult.transactGetItems[0].Item.ELO.N'
          ),
          scorePlayerB: JsonPath.stringAt(
            '$.TaskResult.transactGetItems[1].Item.ELO.N'
          )
        }),
        lambdaFunction: computeProbaOfVictory,
        resultSelector: {
          probability: JsonPath.stringAt('$.Payload')
        },
        resultPath: '$.Result'
      }
    );
  }
}
