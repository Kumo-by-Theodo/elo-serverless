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

import { Table } from 'aws-cdk-lib/aws-dynamodb';
import { Role } from 'aws-cdk-lib/aws-iam';
import { CallAwsService } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Construct } from 'constructs';
import { DynamoUpdatePlayerItem } from './DynamoUpdatePlayerItem';
import { ComputeEloScoreConstruct } from './operations/ComputeEloScoreConstruct';
import { ComputeProbaConstruct } from './operations/ComputeProbaConstruct';
import { OneMinusXConstruct } from './operations/OneMinusXConstruct';

export class StateMachineConstruct extends Construct {
  public stateMachine: IStateMachine;

  constructor(
    scope: Construct,
    id: string,
    props: { pipeRole: Role; table: Table }
  ) {
    super(scope, id);

    const succeed = new Succeed(this, 'Succeed');

    const computeProbaConstruct = new ComputeProbaConstruct(
      this,
      'Compute Proba Of Victory'
    );

    const computeEloScorePlayerAConstruct = new ComputeEloScoreConstruct(
      this,
      'Compute Elo Score Player A',
      {
        player: 'Player A'
      }
    );

    const computeEloScorePlayerBConstruct = new ComputeEloScoreConstruct(
      this,
      'Compute Elo Score Player B',
      {
        player: 'Player B'
      }
    );

    const batchGetItem = new CallAwsService(this, 'BatchGetItem', {
      service: 'dynamodb',
      action: 'batchGetItem',
      iamResources: ['arn:aws:states:::aws-sdk:dynamodb:batchGetItem'],
      parameters: {
        RequestItems: {
          [props.table.tableName]: {
            Keys: [
              {
                PK: JsonPath.objectAt('$.dynamodb.NewImage.Payload.M.PlayerA')
              },
              {
                PK: JsonPath.objectAt('$.dynamodb.NewImage.Payload.M.PlayerB')
              }
            ]
          }
        }
      },
      resultSelector: {
        batchGetItem: JsonPath.stringAt(`$.Responses.${props.table.tableName}`)
      },
      resultPath: JsonPath.stringAt('$.TaskResult')
    });

    const mapStreamEvents = new Map(this, 'Map Stream Events', {
      itemsPath: JsonPath.stringAt('$')
    });

    const formatForScoreUpdate = new Pass(this, 'Format For Score Update', {
      parameters: {
        PlayerA: JsonPath.stringAt('$.dynamodb.NewImage.Payload.M.PlayerA'),
        PlayerB: JsonPath.stringAt('$.dynamodb.NewImage.Payload.M.PlayerB'),
        scorePlayerA: JsonPath.stringAt('$.TaskResult.batchGetItem[0].ELO.N'),
        scorePlayerB: JsonPath.stringAt('$.TaskResult.batchGetItem[1].ELO.N'),
        ProbabilityPlayerBWins: JsonPath.format(
          '{}',
          JsonPath.stringAt('$.Result.probability')
        ),
        winner: JsonPath.stringAt('$.dynamodb.NewImage.Payload.M.Result.N')
      }
    });

    const dynamoUpdatePlayerAItemConstruct = new DynamoUpdatePlayerItem(
      this,
      'Update PlayerA Score',
      {
        player: 'PlayerA',
        table: props.table
      }
    );
    const branchPlayerA = new OneMinusXConstruct(this, 'One Minus Proba', {
      xJsonPath: '$.ProbabilityPlayerBWins'
    }).oneMinusX
      .next(
        new Pass(this, 'Filter Params Branch Player A', {
          parameters: {
            player: JsonPath.stringAt('$.PlayerA'),
            score: JsonPath.stringAt('$.scorePlayerA'),
            winner: JsonPath.stringAt('$.winner'),
            proba: JsonPath.stringAt('$.resultOneMinusX.value')
          }
        })
      )
      .next(computeEloScorePlayerAConstruct.formatForComputeEloScore)
      .next(computeEloScorePlayerAConstruct.lambdaInvokeComputeEloScore)
      .next(dynamoUpdatePlayerAItemConstruct.dynamoUpdatePlayerItem);

    const dynamoUpdatePlayerBItemConstruct = new DynamoUpdatePlayerItem(
      this,
      'Update PlayerB Score',
      {
        player: 'PlayerB',
        table: props.table
      }
    );
    const branchPlayerB = new OneMinusXConstruct(this, 'One Minus Winner', {
      xJsonPath: '$.winner'
    }).oneMinusX
      .next(
        new Pass(this, 'Filter Params Branch Player B', {
          parameters: {
            player: JsonPath.stringAt('$.PlayerB'),
            score: JsonPath.stringAt('$.scorePlayerB'),
            winner: JsonPath.stringAt('$.resultOneMinusX.value'),
            proba: JsonPath.stringAt('$.ProbabilityPlayerBWins')
          }
        })
      )
      .next(computeEloScorePlayerBConstruct.formatForComputeEloScore)
      .next(computeEloScorePlayerBConstruct.lambdaInvokeComputeEloScore)
      .next(dynamoUpdatePlayerBItemConstruct.dynamoUpdatePlayerItem);

    const parallel = new Parallel(this, 'Parallel');

    mapStreamEvents
      .iterator(
        batchGetItem
          .next(computeProbaConstruct.lambdaInvokeComputeProbaOfVictory)
          .next(formatForScoreUpdate)
          .next(parallel.branch(branchPlayerA, branchPlayerB))
      )
      .next(succeed);

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
