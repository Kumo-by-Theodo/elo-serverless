import { App, Duration, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { EloServerless } from '../index';
import { ExpectedResult, IntegTest } from '@aws-cdk/integ-tests-alpha';
import { marshall } from '@aws-sdk/util-dynamodb';
import type {
  PutItemCommandInput,
  TransactWriteItemsInput,
  BatchGetItemInput
} from '@aws-sdk/client-dynamodb';
import { Table } from 'aws-cdk-lib/aws-dynamodb';

class StackUnderTest extends Stack {
  public table: Table;
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);
    const eloServerless = new EloServerless(this, 'EloServerless');
    this.table = eloServerless.table;
  }
}

const app = new App();
const stackUnderTest = new StackUnderTest(app, 'StackUnderTest', {});
const test = new IntegTest(app, 'EloIntegTest', {
  testCases: [stackUnderTest]
});

const playerAPK = 'PLAYER#Fred';
const addPlayerA: PutItemCommandInput = {
  TableName: stackUnderTest.table.tableName,
  Item: marshall({
    PK: playerAPK,
    ELO: 1405
  })
};
const playerBPK = 'PLAYER#Antoine';
const addPlayerB: PutItemCommandInput = {
  TableName: stackUnderTest.table.tableName,
  Item: marshall({
    PK: playerBPK,
    ELO: 1645
  })
};

const addGameResult: PutItemCommandInput = {
  TableName: stackUnderTest.table.tableName,
  Item: marshall({
    PK: 'GAME#1',
    Payload: {
      PlayerA: playerAPK,
      PlayerB: playerBPK,
      /**
       * 1 if PlayerA wins against PlayerB
       * 0.5 if their is a tie
       * 0 if Player B wins against PlayerA
       */
      Result: 1
    }
  })
};

const transaction: TransactWriteItemsInput = {
  TransactItems: [addPlayerA, addPlayerB, addGameResult].map(
    putItemOperation => ({ Put: putItemOperation })
  )
};

const getPlayerElos: BatchGetItemInput = {
  RequestItems: {
    'StackUnderTest-EloServerlessTable73304A80-11YJONDY1TYSN': {
      Keys: [playerAPK, playerBPK].map(playerKey => ({ PK: { S: playerKey } }))
    }
  }
};

test.assertions
  .awsApiCall('DynamoDB', 'transactWriteItems', transaction)
  .provider.addToRolePolicy({
    Effect: 'Allow',
    Action: ['dynamodb:PutItem'],
    Resource: ['*']
  });

test.assertions
  .awsApiCall('DynamoDB', 'batchGetItem', getPlayerElos)
  .expect(
    ExpectedResult.objectLike({
      Responses: {
        'StackUnderTest-EloServerlessTable73304A80-11YJONDY1TYSN': [
          {
            PK: {
              S: 'PLAYER#Antoine'
            },
            ELO: {
              N: '1619'
            }
          },
          {
            PK: {
              S: 'PLAYER#Fred'
            },
            ELO: {
              N: '1431'
            }
          }
        ]
      },
      UnprocessedKeys: {}
    })
  )
  .waitForAssertions({ totalTimeout: Duration.minutes(1) });
