import { RemovalPolicy } from 'aws-cdk-lib';
import { LogGroup } from 'aws-cdk-lib/aws-logs';
import {
  IStateMachine,
  JsonPath,
  StateMachine,
  LogLevel,
  StateMachineType,
  Pass,
  Map,
  Succeed,
} from 'aws-cdk-lib/aws-stepfunctions';

import { Construct } from 'constructs';
import { Role } from 'aws-cdk-lib/aws-iam';
import { CallAwsService } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import { ComputeEloScoreConstruct } from './operations/ComputeEloScoreConstruct';

export class StateMachineConstruct extends Construct {
  public stateMachine: IStateMachine;

  constructor(
    scope: Construct,
    id: string,
    props: { pipeRole: Role; table: Table },
  ) {
    super(scope, id);

    const succeed = new Succeed(this, 'Succeed');

    const parsePayload = new Pass(this, 'Parse Payload', {
      parameters: {
        payloadEvent: JsonPath.stringToJson(
          JsonPath.stringAt('$.dynamodb.NewImage.Payload.S'),
        ),
      },
    });

    const computeELOScoreConstruct = new ComputeEloScoreConstruct(
      this,
      'Compute ELO Score',
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
                PK: JsonPath.objectAt('$.payloadEvent.PlayerA'),
              },
              {
                PK: JsonPath.objectAt('$.payloadEvent.PlayerB'),
              },
            ],
          },
        },
      },
      resultSelector: {
        batchGetItem: JsonPath.stringAt(`$.Responses.${props.table.tableName}`),
      },
      resultPath: JsonPath.stringAt('$.TaskResult'),
    });

    const mapStreamEvents = new Map(this, 'Map Stream Events', {
      itemsPath: JsonPath.stringAt('$'),
    });

    const formatForScoreUpdate = new Pass(this, 'Format For Score Update', {
      parameters: {
        PlayerA: JsonPath.stringAt('$.payloadEvent.PlayerA'),
        scorePlayerA: JsonPath.stringAt('$.FormattedInput.scorePlayerA'),
        PlayerB: JsonPath.stringAt('$.payloadEvent.PlayerB'),
        scorePlayerB: JsonPath.stringAt('$.FormattedInput.scorePlayerB'),
        ProbabilityPlayerBWins: JsonPath.stringAt('$.EloScoreResult.result'),
        winner: JsonPath.stringAt('$.payloadEvent.Result.N'),
      },
    });

    mapStreamEvents
      .iterator(
        parsePayload
          .next(batchGetItem)
          .next(computeELOScoreConstruct.formatForComputeEloScore)
          .next(computeELOScoreConstruct.lambdaInvokeComputeEloScore)
          .next(formatForScoreUpdate),
      )
      .next(succeed);

    this.stateMachine = new StateMachine(this, 'TargetExpressStateMachine', {
      definition: mapStreamEvents,
      stateMachineType: StateMachineType.EXPRESS,
      logs: {
        destination: new LogGroup(this, 'TargetLogs', {
          // to be removed at later stage
          removalPolicy: RemovalPolicy.DESTROY,
        }),
        includeExecutionData: true,
        level: LogLevel.ALL,
      },
    });

    this.stateMachine.grantStartSyncExecution(props.pipeRole);
  }
}
