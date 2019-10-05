import * as lambda  from '@aws-cdk/aws-lambda';
import cdk = require('@aws-cdk/core');
import { Duration } from '@aws-cdk/core';
import { RestApi, Integration, LambdaIntegration, Resource,
  MockIntegration, PassthroughBehavior, EmptyModel } from "@aws-cdk/aws-apigateway"


export class MecabCdkStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const neologdLayer = new lambda.LayerVersion(this,'NeologdLayer',{
      code: lambda.Code.asset('neologdLayer'),
      compatibleRuntimes: [lambda.Runtime.NODEJS_8_10]
    })
    const ipadicLayer = new lambda.LayerVersion(this,'IpadicLayer',{
      code: lambda.Code.asset('ipadicLayer'),
      compatibleRuntimes: [lambda.Runtime.NODEJS_8_10]
    })
    
    const MecabLambda = new lambda.Function(this, 'MecabLambda', {
        code: lambda.Code.asset('src/lambda'),
        handler: 'mecab-cdk.handler',
        runtime: lambda.Runtime.NODEJS_8_10,
        timeout: Duration.seconds(180),
        environment: {
            LD_LIBRARY_PATH: '/var/task/local/lib',
            MECABRC: '/var/task/local/etc/mecabrc'
        },
        layers: [neologdLayer,ipadicLayer],
        memorySize: 256
    });
    const MecabLambdaVersion = new lambda.Version(this,'MecabLambdaVersion',{
      lambda: MecabLambda,
      description: 'メモ'
    })

    // API Gateway 作成
    const restApi: RestApi = new RestApi(this, "MecabAPI", {
      restApiName: "MecabAPI", // API名
      description: "Deployed by CDK" // 説明
    })
    // Integration 作成
    const integration: Integration = new LambdaIntegration(MecabLambda)
    // リソースの作成
    const getResouse: Resource = restApi.root.addResource("get")
    // メソッドの作成
    getResouse.addMethod("GET", integration)
    getResouse.addMethod("POST", integration)
    // CORS対策でOPTIONSメソッドを作成
    getResouse.addMethod("OPTIONS", new MockIntegration({
      integrationResponses: [{
        statusCode: "200",
        responseParameters: {
          "method.response.header.Access-Control-Allow-Headers":
            "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent'",
          "method.response.header.Access-Control-Allow-Origin": "'*'",
          "method.response.header.Access-Control-Allow-Credentials": "'false'",
          "method.response.header.Access-Control-Allow-Methods": "'OPTIONS,GET,PUT,POST,DELETE'",
        }
      }],
      passthroughBehavior: PassthroughBehavior.NEVER,
      requestTemplates: {
        "application/json": "{\"statusCode\": 200}"
      }
    }), {
      methodResponses: [{
        statusCode: "200",
        responseParameters: {
          "method.response.header.Access-Control-Allow-Headers": true,
          "method.response.header.Access-Control-Allow-Origin": true,
          "method.response.header.Access-Control-Allow-Credentials": true,
          "method.response.header.Access-Control-Allow-Methods": true,
        },
        responseModels: {
          "application/json": new EmptyModel()
        },
      }]
    });
  }
}

const app = new cdk.App();
new MecabCdkStack(app, 'MecabCdkApp');
app.synth();