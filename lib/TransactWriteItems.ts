import { JsonPath } from 'aws-cdk-lib/aws-stepfunctions';
import { CallAwsService } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Construct } from 'constructs';

export class TransactWriteItems extends Construct {
  public transactWriteItems: CallAwsService;

  constructor(scope: Construct, id: string, props: { tableName: string }) {
    super(scope, id);

    this.transactWriteItems = new CallAwsService(this, 'Transact Write Items', {
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
                  N: JsonPath.stringAt('$.TaskResult.newScores.newScorePlayerA')
                }
              },
              Key: {
                PK: JsonPath.objectAt('$.dynamodb.NewImage.Payload.M.PlayerA')
              },
              TableName: props.tableName
            }
          },
          {
            Update: {
              UpdateExpression: 'set ELO = :elo',
              ExpressionAttributeValues: {
                ':elo': {
                  N: JsonPath.stringAt('$.TaskResult.newScores.newScorePlayerB')
                }
              },
              Key: {
                PK: JsonPath.stringAt('$.dynamodb.NewImage.Payload.M.PlayerB')
              },
              TableName: props.tableName
            }
          }
        ]
      }
    });
  }
}
