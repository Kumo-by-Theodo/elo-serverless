import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import {
  AttributeType,
  BillingMode,
  StreamViewType,
  Table
} from 'aws-cdk-lib/aws-dynamodb';
import { Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import {
  FilterCriteria,
  FilterRule,
  StartingPosition
} from 'aws-cdk-lib/aws-lambda';
import { ApiGatewayToDynamoDB } from '@aws-solutions-constructs/aws-apigateway-dynamodb';

import { CfnPipe } from 'aws-cdk-lib/aws-pipes';
import { Queue } from 'aws-cdk-lib/aws-sqs';

import { Construct } from 'constructs';
import { StateMachineConstruct } from './StateMachineConstruct';

export interface EloServerlessProps {}

const PK = 'PK';
const TABLE_NAME = 'EloServerlessDynamoDbTable';

export class EloServerless extends Construct {
  public table: Table;
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const dlq = new Queue(this, 'DLQ', {
      retentionPeriod: Duration.days(14)
    });

    const { dynamoTable } = new ApiGatewayToDynamoDB(
      this,
      'test-api-gateway-dynamodb-default',
      {
        dynamoTableProps: {
          tableName: TABLE_NAME,
          billingMode: BillingMode.PAY_PER_REQUEST,
          partitionKey: { name: PK, type: AttributeType.STRING },
          stream: StreamViewType.NEW_AND_OLD_IMAGES,
          // to be removed at later stage
          removalPolicy: RemovalPolicy.DESTROY
        },
        allowDeleteOperation: true,
        allowReadOperation: true,
        allowCreateOperation: true,
        createRequestTemplate: `{TableName: ${TABLE_NAME},Key: {'${PK}': {S: "$input.params(${PK})"}},ReturnValues: 'ALL_OLD'}`
      }
    );

    this.table = dynamoTable;

    const pipeRole = new Role(this, 'PipeRole', {
      assumedBy: new ServicePrincipal('pipes.amazonaws.com')
    });

    const stateMachineConstruct = new StateMachineConstruct(
      this,
      'TargetExpressStateMachine',
      { pipeRole, table: this.table }
    );
    this.table.grantReadWriteData(stateMachineConstruct.stateMachine);

    this.table.grantStreamRead(pipeRole);
    dlq.grantSendMessages(pipeRole);

    new CfnPipe(this, 'Pipe', {
      roleArn: pipeRole.roleArn,
      source: this.table.tableStreamArn as string,
      sourceParameters: {
        filterCriteria: {
          filters: [
            FilterCriteria.filter({ eventName: FilterRule.isEqual('INSERT') })
          ]
        },
        dynamoDbStreamParameters: {
          startingPosition: StartingPosition.TRIM_HORIZON,
          batchSize: 1,
          deadLetterConfig: {
            arn: dlq.queueArn
          },
          maximumRetryAttempts: 1
        }
      },
      target: stateMachineConstruct.stateMachine.stateMachineArn
    });
  }
}
