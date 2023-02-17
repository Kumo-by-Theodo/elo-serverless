import { Code, Function, Runtime } from 'aws-cdk-lib/aws-lambda';
import { JsonPath, Pass } from 'aws-cdk-lib/aws-stepfunctions';
import { LambdaInvoke } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Construct } from 'constructs';

export class ComputeEloScoreConstruct extends Construct {
  public formatForComputeEloScore: Pass;
  public lambdaInvokeComputeEloScore: LambdaInvoke;

  constructor(
    scope: Construct,
    id: string,
    props: {
      player: string;
    }
  ) {
    super(scope, id);

    this.formatForComputeEloScore = new Pass(
      this,
      `Format For Compute ELO Score ${props.player}`,
      {
        parameters: {
          score: JsonPath.stringAt('$.score'),
          proba: JsonPath.numberAt('$.proba'),
          winner: JsonPath.stringAt('$.winner')
        },
        resultPath: '$.FormattedInput'
      }
    );

    // hasWon = 1 if player has won, else 0
    // K = 32 is fixed for now
    const computeELOScore = new Function(
      this,
      `Compute ELO Score ${props.player}`,
      {
        handler: 'index.handler',
        code: Code.fromInline(`
                exports.handler = ({score, proba, winner}, _, callback) => {
                  callback(null, Math.round(parseInt(score) + 32 * (parseInt(winner) - proba)));
                };
              `),
        runtime: Runtime.NODEJS_16_X
      }
    );

    this.lambdaInvokeComputeEloScore = new LambdaInvoke(
      this,
      `Lambda Invoke Compute Elo Score ${props.player}`,
      {
        lambdaFunction: computeELOScore,
        inputPath: JsonPath.stringAt('$.FormattedInput'),
        resultSelector: {
          result: JsonPath.format('{}', JsonPath.stringAt('$.Payload'))
        },
        resultPath: '$.EloScoreResult'
      }
    );
  }
}
