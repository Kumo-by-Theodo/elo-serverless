import { Construct } from 'constructs';
import { LambdaInvoke } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Code, Runtime, Function } from 'aws-cdk-lib/aws-lambda';
import { JsonPath, Pass } from 'aws-cdk-lib/aws-stepfunctions';

export class ComputeProbaConstruct extends Construct {
  public formatForComputeProbaOfVictory: Pass;
  public lambdaInvokeComputeProbaOfVictory: LambdaInvoke;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.formatForComputeProbaOfVictory = new Pass(
      this,
      'Format For Compute Proba Of Victory',
      {
        parameters: {
          scorePlayerA: JsonPath.stringAt('$.TaskResult.batchGetItem[0].ELO.N'),
          scorePlayerB: JsonPath.stringAt('$.TaskResult.batchGetItem[1].ELO.N'),
        },
        resultPath: '$.FormattedInput',
      },
    );

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
        runtime: Runtime.NODEJS_16_X,
      },
    );

    this.lambdaInvokeComputeProbaOfVictory = new LambdaInvoke(
      this,
      'Lambda Invoke Compute Proba Of Victory',
      {
        lambdaFunction: computeProbaOfVictory,
        inputPath: JsonPath.stringAt('$.FormattedInput'),
        resultSelector: { result: JsonPath.stringAt('$.Payload') },
        resultPath: '$.ProbaResult',
      },
    );
  }
}
