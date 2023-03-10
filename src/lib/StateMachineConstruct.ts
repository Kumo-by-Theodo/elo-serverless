import { RemovalPolicy } from 'aws-cdk-lib';
import { LogGroup } from 'aws-cdk-lib/aws-logs';
import {
  IStateMachine,
  JsonPath,
  LogLevel,
  Map,
  Parallel,
  Pass,
  StateMachine,
  StateMachineType,
  Succeed
} from 'aws-cdk-lib/aws-stepfunctions';
import { Code, Function, Runtime } from 'aws-cdk-lib/aws-lambda';

import { Table } from 'aws-cdk-lib/aws-dynamodb';
import { Role } from 'aws-cdk-lib/aws-iam';
import {
  CallAwsService,
  LambdaInvoke
} from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Construct } from 'constructs';

export class StateMachineConstruct extends Construct {
  public stateMachine: IStateMachine;

  constructor(
    scope: Construct,
    id: string,
    props: { pipeRole: Role; table: Table }
  ) {
    super(scope, id);

    const transactGetItems = new CallAwsService(this, 'TransactGetItems', {
      service: 'dynamodb',
      action: 'transactGetItems',
      iamResources: ['arn:aws:states:::aws-sdk:dynamodb:transactGetItems'],
      parameters: {
        TransactItems: [
          {
            Get: {
              Key: {
                PK: JsonPath.objectAt('$.dynamodb.NewImage.Payload.M.PlayerA')
              },
              TableName: props.table.tableName
            }
          },
          {
            Get: {
              Key: {
                PK: JsonPath.objectAt('$.dynamodb.NewImage.Payload.M.PlayerB')
              },
              TableName: props.table.tableName
            }
          }
        ]
      },
      resultPath: JsonPath.stringAt('$.transactGetItems')
    });

    const formatTask = new Pass(this, 'Format for computes', {
      parameters: {
        winner: JsonPath.objectAt('$.dynamodb.NewImage.Payload.M.Result.N'),
        playerA: JsonPath.objectAt('$.dynamodb.NewImage.Payload.M.PlayerA.S'),
        playerB: JsonPath.objectAt('$.dynamodb.NewImage.Payload.M.PlayerB.S'),
        scorePlayerA: JsonPath.objectAt(
          '$.transactGetItems.Responses[0].Item.ELO.N'
        ),
        scorePlayerB: JsonPath.objectAt(
          '$.transactGetItems.Responses[1].Item.ELO.N'
        )
      }
    });

    const parallel = new Parallel(this, 'Parallel');

    const branchPlayerA = new LambdaInvoke(this, 'Compute score player A', {
      lambdaFunction: new Function(this, 'Compute A', {
        handler: 'index.handler',
        code: Code.fromInline(`
                  exports.handler = async ({scorePlayerA,scorePlayerB,winner}) => {
                    const scoreA = parseInt(scorePlayerA);
                    const scoreB = parseInt(scorePlayerB);
                    const P1 = 1 / (1 + 10 ** ((scoreB - scoreA) / 400));
                    const R1 = parseInt(winner);
                    const newScorePlayerA = Math.round(scoreA + 32 * (R1 - P1));
                    return newScorePlayerA.toString();
                  };
              `),
        runtime: Runtime.NODEJS_16_X
      }),
      resultSelector: {
        newScorePlayerA: JsonPath.stringAt('$.Payload')
      },
      resultPath: JsonPath.stringAt('$.ScoreResult')
    });

    const branchPlayerB = new LambdaInvoke(this, 'Compute score player B', {
      lambdaFunction: new Function(this, 'Compute B', {
        handler: 'index.handler',
        code: Code.fromInline(`
                  exports.handler = async ({scorePlayerA,scorePlayerB,winner}) => {
                    const scoreA = parseInt(scorePlayerA);
                    const scoreB = parseInt(scorePlayerB);
                    const P2 = 1 / (1 + 10 ** ((scoreA - scoreB) / 400));
                    const R2 = 1 - parseInt(winner);
                    const newScorePlayerB = Math.round(scoreB + 32 * (R2 - P2));
                    return newScorePlayerB.toString();
                  };
              `),
        runtime: Runtime.NODEJS_16_X
      }),
      resultSelector: {
        newScorePlayerB: JsonPath.stringAt('$.Payload')
      },
      resultPath: JsonPath.stringAt('$.ScoreResult')
    });

    const transactWriteItems = new CallAwsService(this, 'TransactWriteItems', {
      service: 'dynamodb',
      action: 'transactWriteItems',
      iamResources: ['arn:aws:states:::aws-sdk:dynamodb:transactWriteItems'],
      parameters: {
        TransactItems: [
          {
            Update: {
              UpdateExpression: 'set ELO = :elo',
              ExpressionAttributeValues: {
                ':elo': {
                  N: JsonPath.stringAt('$[0].ScoreResult.newScorePlayerA')
                }
              },
              Key: {
                PK: {
                  S: JsonPath.stringAt('$[0].playerA')
                }
              },
              TableName: props.table.tableName
            }
          },
          {
            Update: {
              UpdateExpression: 'set ELO = :elo',
              ExpressionAttributeValues: {
                ':elo': {
                  N: JsonPath.stringAt('$[1].ScoreResult.newScorePlayerB')
                }
              },
              Key: {
                PK: {
                  S: JsonPath.stringAt('$[1].playerB')
                }
              },
              TableName: props.table.tableName
            }
          }
        ]
      }
    });

    const mapStreamEvents = new Map(this, 'Map Stream Events', {
      itemsPath: JsonPath.stringAt('$')
    });

    mapStreamEvents
      .iterator(
        transactGetItems
          .next(formatTask)
          .next(parallel.branch(branchPlayerA, branchPlayerB))
          .next(transactWriteItems)
      )
      .next(new Succeed(this, 'Success'));

    this.stateMachine = new StateMachine(this, 'TargetExpressStateMachine', {
      definition: mapStreamEvents,
      stateMachineType: StateMachineType.EXPRESS,
      logs: {
        destination: new LogGroup(this, 'TargetLogs', {
          // to be removed at later stage
          removalPolicy: RemovalPolicy.DESTROY
        }),
        includeExecutionData: true,
        level: LogLevel.ALL
      }
    });

    this.stateMachine.grantStartSyncExecution(props.pipeRole);
  }
}
