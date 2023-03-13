import { Code, Function, Runtime } from 'aws-cdk-lib/aws-lambda';
import { JsonPath, TaskInput } from 'aws-cdk-lib/aws-stepfunctions';
import { LambdaInvoke } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Construct } from 'constructs';

export class ComputeEloScores extends Construct {
  public computeEloScores: LambdaInvoke;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const computeNewScores = new Function(this, 'Compute New Scores', {
      handler: 'index.handler',
      code: Code.fromInline(`
                  exports.handler = async ({scorePlayerA,scorePlayerB,winner}) => {
                    const scoreA = parseInt(scorePlayerA);
                    const scoreB = parseInt(scorePlayerB);
                    const P1 = 1 / (1 + 10 ** ((scoreB - scoreA) / 400));
                    const R1 = parseInt(winner);
                    const P2 = 1 / (1 + 10 ** ((scoreA - scoreB) / 400));
                    const R2 = 1 - parseInt(winner);
                    const newScorePlayerB = Math.round(scoreB + 32 * (R2 - P2)).toString();
                    const newScorePlayerA = Math.round(scoreA + 32 * (R1 - P1)).toString();
                    return {newScorePlayerA, newScorePlayerB}
                  };
              `),
      runtime: Runtime.NODEJS_16_X
    });

    this.computeEloScores = new LambdaInvoke(this, `Compute ELO Scores`, {
      lambdaFunction: computeNewScores,
      payload: TaskInput.fromObject({
        winner: JsonPath.objectAt('$.dynamodb.NewImage.Payload.M.Result.N'),
        playerA: JsonPath.objectAt('$.dynamodb.NewImage.Payload.M.PlayerA.S'),
        playerB: JsonPath.objectAt('$.dynamodb.NewImage.Payload.M.PlayerB.S'),
        scorePlayerA: JsonPath.objectAt(
          '$.transactGetItems.Responses[0].Item.ELO.N'
        ),
        scorePlayerB: JsonPath.objectAt(
          '$.transactGetItems.Responses[1].Item.ELO.N'
        )
      }),
      resultSelector: {
        newScores: JsonPath.stringAt('$.Payload')
      },
      resultPath: JsonPath.stringAt('$.TaskResult')
    });
  }
}
