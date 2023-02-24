# Welcome to your CDK TypeScript Construct Library project

You should explore the contents of this project. It demonstrates a CDK Construct Library that includes a construct (`EloServerless`)
which contains an Amazon SQS queue that is subscribed to an Amazon SNS topic.

The construct defines an interface (`EloServerlessProps`) to configure the visibility timeout of the queue.

## Setup

The `src/lib` folder contains the CDK code used to deploy the `EloServerless` stack. The `src/test` folder defines the integration test that interacts with the `EloServerless` stack to check that it behaves as expected.
To setup your development environment:

- Run `pnpm run build` to transpile the content of the `test` folder
- Run `pnpm cdk bootstrap aws://<YOUR_AWS_SSO_ACCOUNT_ID>/eu-west-1 --profile <YOUR_AWS_PROFILE>` to deploy a bootstrap stack (if you don't have one already)
- Run `pnpm cdk deploy --app 'node dist/test/integ.elo.js' --all --profile <YOUR_AWS_PROFILE>` to deploy and test the `EloServerless` stack

_Note: to build and redeploy your stack, you can use the `DEVELOPER_ID=<YOUR_AWS_PROFILE> pnpm run deploy-stack` that executes the `deploy-stack` command from package.json. It removes the content of the dist folder, build the new files and deploy the cdk stack. Don't forget to `aws sso --profile <YOUR_AWS_PROFILE>` before._
