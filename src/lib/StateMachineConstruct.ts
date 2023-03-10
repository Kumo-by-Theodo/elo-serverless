import { RemovalPolicy } from 'aws-cdk-lib';
import { LogGroup } from 'aws-cdk-lib/aws-logs';
import {
  IStateMachine,
  JsonPath,
  LogLevel,
  Map,
  StateMachine,
  StateMachineType,
  Succeed
} from 'aws-cdk-lib/aws-stepfunctions';

import { Table } from 'aws-cdk-lib/aws-dynamodb';
import { Role } from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { ComputeEloScores } from './ComputeEloScores';
import { TransactGetItems } from './TransactGetItems';
import { TransactWriteItems } from './TransactWriteItems';

export class StateMachineConstruct extends Construct {
  public stateMachine: IStateMachine;

  constructor(
    scope: Construct,
    id: string,
    props: { pipeRole: Role; table: Table }
  ) {
    super(scope, id);

    const mapStreamEvents = new Map(this, 'Map Stream Events', {
      itemsPath: JsonPath.stringAt('$')
    });

    const transactGetItemsTask = new TransactGetItems(
      this,
      'Transact Get Items Task',
      { tableName: props.table.tableName }
    );

    const computeEloScoresTask = new ComputeEloScores(
      this,
      'Compute ELO scores Task'
    );

    const transactWriteItemsTask = new TransactWriteItems(
      this,
      'Transact Write Items Task',
      { tableName: props.table.tableName }
    );

    mapStreamEvents
      .iterator(
        transactGetItemsTask.transactGetItems
          .next(computeEloScoresTask.computeEloScores)
          .next(transactWriteItemsTask.transactWriteItems)
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
