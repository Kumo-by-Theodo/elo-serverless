import { JsonPath } from 'aws-cdk-lib/aws-stepfunctions';
import { CallAwsService } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Construct } from 'constructs';

export class TransactGetItems extends Construct {
  public transactGetItems: CallAwsService;

  constructor(scope: Construct, id: string, props: { tableName: string }) {
    super(scope, id);

    this.transactGetItems = new CallAwsService(this, 'Transact Get Items', {
      service: 'dynamodb',
      action: 'transactGetItems',
      iamResources: ['arn:aws:states:::aws-sdk:dynamodb:transactGetItems'],
      parameters: {
        TransactItems: [
          {
            Get: {
              Key: {
                PK: JsonPath.objectAt('$.PlayerA')
              },
              TableName: props.tableName
            }
          },
          {
            Get: {
              Key: {
                PK: JsonPath.objectAt('$.PlayerB')
              },
              TableName: props.tableName
            }
          }
        ]
      },
      inputPath: JsonPath.stringAt('$.dynamodb.NewImage.Payload.M'),
      resultPath: JsonPath.stringAt('$.transactGetItems')
    });
  }
}
