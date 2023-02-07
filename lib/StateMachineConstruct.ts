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
  TaskInput,
} from 'aws-cdk-lib/aws-stepfunctions';

import { Construct } from 'constructs';
import { Role } from 'aws-cdk-lib/aws-iam';
import {
  DynamoAttributeValue,
  DynamoGetItem,
  LambdaInvoke,
} from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import { Code, Runtime, Function } from 'aws-cdk-lib/aws-lambda';

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

    const transformToArray = new Pass(this, 'Transform To Array', {
      parameters: {
        playersArray: JsonPath.array(
          JsonPath.stringAt('$.payloadEvent.PlayerA.S'),
          JsonPath.stringAt('$.payloadEvent.PlayerB.S'),
        ),
      },
    });

    const subtraction = new Pass(this, 'Subtract Scores', {
      parameters: {
        diff: JsonPath.mathAdd(
          JsonPath.numberAt('$.firstRanking'),
          JsonPath.numberAt('$.secondRanking'),
        ),
      },
    });

    const transformPayload = new Pass(this, 'Transform Payload', {
      parameters: {
        firstRanking: JsonPath.stringToJson(
          JsonPath.format('-{}', JsonPath.stringAt('$[0].Item.ELO.N')),
        ),
        secondRanking: JsonPath.stringToJson(
          JsonPath.stringAt('$[1].Item.ELO.N'),
        ),
      },
    });

    const dynamodbGetItem = new DynamoGetItem(this, 'Dynamo Get Item', {
      key: {
        PK: DynamoAttributeValue.fromString(JsonPath.stringAt('$')),
      },
      table: props.table,
    });

    const computeELOScore = new Function(this, 'Compute ELO Score', {
      handler: 'index.handler',
      code: Code.fromInline(`
              exports.handler = ({diff}, _, callback) => {
                callback(null, 1 / (1+10**(diff/400)));
              };
            `),
      runtime: Runtime.NODEJS_16_X,
    });
    const lambdaInvokeComputeELOScore = new LambdaInvoke(
      this,
      'Lambda Invoke Compute ELO Score',
      {
        lambdaFunction: computeELOScore,
      },
    );

    // Inner map
    const mapGetItems = new Map(this, 'Map Get Items', {
      itemsPath: JsonPath.stringAt('$.playersArray'),
    });

    // Outer map
    const mapStreamEvents = new Map(this, 'Map Stream Events', {
      itemsPath: JsonPath.stringAt('$'),
    });

    mapStreamEvents
      .iterator(
        parsePayload
          .next(transformToArray)
          .next(
            mapGetItems
              .iterator(dynamodbGetItem)
              .next(transformPayload)
              .next(subtraction)
              .next(lambdaInvokeComputeELOScore),
          ),
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
