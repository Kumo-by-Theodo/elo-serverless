import { Construct } from 'constructs';
import { LambdaInvoke } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Code, Runtime, Function } from 'aws-cdk-lib/aws-lambda';
import { JsonPath, Pass } from 'aws-cdk-lib/aws-stepfunctions';

export class ComputeEloScoreConstruct extends Construct {
  public formatForComputeEloScore: Pass;
  public lambdaInvokeComputeEloScore: LambdaInvoke;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.formatForComputeEloScore = new Pass(
      this,
      'Format For Compute ELO Score',
      {
        parameters: {
          scorePlayerA: JsonPath.stringAt('$.TaskResult.batchGetItem[0].ELO.N'),
          scorePlayerB: JsonPath.stringAt('$.TaskResult.batchGetItem[1].ELO.N'),
        },
        resultPath: '$.FormattedInput',
      },
    );

    const computeELOScore = new Function(this, 'Compute ELO Score', {
      handler: 'index.handler',
      code: Code.fromInline(`
                exports.handler = ({scorePlayerA, scorePlayerB}, _, callback) => {
                  callback(null, 1 / (1 + 10 ** ((parseInt(scorePlayerA) - parseInt(scorePlayerB)) / 400)));
                };
              `),
      runtime: Runtime.NODEJS_16_X,
    });

    this.lambdaInvokeComputeEloScore = new LambdaInvoke(
      this,
      'Lambda Invoke Compute Elo Score',
      {
        lambdaFunction: computeELOScore,
        inputPath: JsonPath.stringAt('$.FormattedInput'),
        resultSelector: { result: JsonPath.stringAt('$.Payload') },
        resultPath: '$.EloScoreResult',
      },
    );
  }
}
