import { Construct } from 'constructs';
import { LambdaInvoke } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Code, Runtime, Function } from 'aws-cdk-lib/aws-lambda';

export class ComputeEloScoreConstruct extends Construct {
  public lambdaInvokeComputeEloScore: LambdaInvoke;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const computeELOScore = new Function(this, 'Compute ELO Score', {
      handler: 'index.handler',
      code: Code.fromInline(`
                exports.handler = ({diff}, _, callback) => {
                  callback(null, 1 / (1+10**(diff/400)));
                };
              `),
      runtime: Runtime.NODEJS_16_X,
    });

    this.lambdaInvokeComputeEloScore = new LambdaInvoke(
      this,
      'Lambda Invoke Compute Elo Score',
      {
        lambdaFunction: computeELOScore,
      },
    );
  }
}
