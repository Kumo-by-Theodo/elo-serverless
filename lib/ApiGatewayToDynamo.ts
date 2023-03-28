import { Construct } from 'constructs';

import { Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';

import {
  AwsIntegration,
  RestApi,
  PassthroughBehavior,
  Cors
} from 'aws-cdk-lib/aws-apigateway';

import { Table } from 'aws-cdk-lib/aws-dynamodb';

export class ApiGatewayToDynamo extends Construct {
  constructor(scope: Construct, id: string, props: { table: Table }) {
    super(scope, id);

    // RestApi
    const restApi = new RestApi(this, 'ApiDynamoRestApi', {
      defaultCorsPreflightOptions: {
        allowOrigins: Cors.ALL_ORIGINS,
        allowMethods: Cors.ALL_METHODS
      }
    });
    const playerResource = restApi.root.addResource('player');
    const gameResource = restApi.root.addResource('game');

    // Allow the RestApi to access DynamoDb by assigning this role to the integration
    const integrationRole = new Role(this, 'IntegrationRole', {
      assumedBy: new ServicePrincipal('apigateway.amazonaws.com')
    });
    props.table.grantReadWriteData(integrationRole);

    const integrationResponseParameters = {
      'method.response.header.Access-Control-Allow-Headers':
        "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent'",
      'method.response.header.Access-Control-Allow-Origin': "'*'",
      'method.response.header.Access-Control-Allow-Credentials': "'false'",
      'method.response.header.Access-Control-Allow-Methods':
        "'OPTIONS,GET,PUT,POST,DELETE'"
    };
    const methodResponseParameters = {
      'method.response.header.Access-Control-Allow-Headers': true,
      'method.response.header.Access-Control-Allow-Methods': true,
      'method.response.header.Access-Control-Allow-Credentials': true,
      'method.response.header.Access-Control-Allow-Origin': true
    };

    // POST Players to Dynamodb
    const putPlayerIntegration = new AwsIntegration({
      service: 'dynamodb',
      action: 'PutItem',
      options: {
        passthroughBehavior: PassthroughBehavior.WHEN_NO_TEMPLATES,
        credentialsRole: integrationRole,
        requestTemplates: {
          'application/json': JSON.stringify({
            TableName: props.table.tableName,
            Item: {
              PK: { S: "$input.path('$.PK')" },
              ELO: { N: "$input.path('$.ELO')" }
            }
          })
        },
        integrationResponses: [
          {
            statusCode: '200',
            responseParameters: integrationResponseParameters
          }
        ]
      }
    });
    playerResource.addMethod('POST', putPlayerIntegration, {
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: methodResponseParameters
        }
      ]
    });

    // POST Game to DynamoDb
    const putGameIntegration = new AwsIntegration({
      service: 'dynamodb',
      action: 'PutItem',
      options: {
        passthroughBehavior: PassthroughBehavior.WHEN_NO_TEMPLATES,
        credentialsRole: integrationRole,
        requestTemplates: {
          'application/json': JSON.stringify({
            TableName: props.table.tableName,
            Item: {
              PK: { S: "$input.path('$.PK')" },
              Payload: {
                M: {
                  PlayerA: { S: "$input.path('$.Payload.PlayerA')" },
                  PlayerB: { S: "$input.path('$.Payload.PlayerB')" },
                  Result: { N: "$input.path('$.Payload.Result')" }
                }
              }
            }
          })
        },
        integrationResponses: [
          {
            statusCode: '200',
            responseParameters: integrationResponseParameters
          }
        ]
      }
    });

    gameResource.addMethod('POST', putGameIntegration, {
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: methodResponseParameters
        }
      ]
    });
  }
}
