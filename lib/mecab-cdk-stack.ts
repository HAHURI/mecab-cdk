import * as lambda  from '@aws-cdk/aws-lambda';
import cdk = require('@aws-cdk/core');
import { Duration } from '@aws-cdk/core';

export class MecabCdkStack extends cdk.Stack {
  public readonly handler: lambda.Function;
  public readonly version: string;
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const lambdaLayer = new lambda.LayerVersion(this,'LambdaLayer',{
      code: lambda.Code.asset('layer')
      compatibleRuntimes: [lambda.Runtime.NODEJS_10_X]
    })
    
    const MecabLambda = new lambda.Function(this, 'MecabLambda', {
        code: lambda.Code.asset('src/lambda'),
        handler: 'mecab-cdk.handler',
        runtime: lambda.Runtime.NODEJS_10_X,
        timeout: Duration.seconds(180),
        environment: {
            REGION: 'ap-northeast-1'
        },
        layers: [lambdaLayer],
        memorySize: 256
    });
    const MecabLambdaVersion = new lambda.Version(this,'MecabLambdaVersion',{
      lambda: MecabLambda,
      description: 'メモ'
    })
  }
}

const app = new cdk.App();
new MecabCdkStack(app, 'MecabCdkApp');
app.synth();