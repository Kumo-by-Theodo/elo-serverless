import { Construct } from 'constructs';
import {
  DynamoAttributeValue,
  DynamoUpdateItem,
} from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { JsonPath } from 'aws-cdk-lib/aws-stepfunctions';
import { Table } from 'aws-cdk-lib/aws-dynamodb';

export class DynamoUpdatePlayerItem extends Construct {
  public dynamoUpdatePlayerItem: DynamoUpdateItem;

  constructor(
    scope: Construct,
    id: string,
    props: {
      table: Table;
      player: string;
    },
  ) {
    super(scope, id);

    this.dynamoUpdatePlayerItem = new DynamoUpdateItem(
      this,
      `Update ${props.player} Score`,
      {
        table: props.table,
        key: {
          PK: DynamoAttributeValue.fromString(JsonPath.stringAt('$.player.S')),
        },
        expressionAttributeValues: {
          ':elo': DynamoAttributeValue.numberFromString(
            JsonPath.stringAt('$.EloScoreResult.result'),
          ),
        },
        updateExpression: 'SET ELO = :elo',
      },
    );
  }
}
