declare function require(x: string): any;
const neo4j = require('neo4j-driver')
const requestPromise = require('request-promise');
const parser = require('xml2json');
const driver = neo4j.driver(process.env.NEO4J_URL,neo4j.auth.basic(process.env.USER_NAME, process.env.USER_PASSWORD))

// type
export type HttpMethodEnum = 'GET'|'POST'

// interface
export interface HttpOptions { 
    method: HttpMethodEnum,
    uri: string,
    timeout: number,
    body?: { [key:string]: any; },
    qs?: { [key:string]: string; },
    headers?: { [key:string]: string; }
}

export async function handler(event: any): Promise<any> {
    return VcasAnalyzeLambda.hello(event);
}
 
export class VcasAnalyzeLambda {
 
    public static async hello(event: any): Promise<any> {
        // 想定するリクエスト
        let offsetId = event.queryStringParameters.offsetId
        // neo4jに登録があるかを確認する
        var session = driver.session()
        var readTxResultPromise = session.readTransaction(function(transaction:any) {
            var result = transaction.run(
              'MATCH (live:Live { id:'+offsetId+'}) RETURN live'
            )
            return result
        })
        readTxResultPromise
        .then(function(result:any) {
            session.close()
            console.log(result.records)
            return result;
        })
        .catch(function(error:any) {
            console.log(error)
            return error;
        })
        // 生米保管庫からXMLを取得する
        // mecabでテキストデータを解析する
        // neo4jに解析結果を保存する
    }    
}




// 共通関数
export function createApiOptions(
    method:HttpMethodEnum, // httpメソッド
    uri:string, // url
    timeout:number, // timeout時間
    body?:{ [key:string]: any; }, // postの場合に必要
    qs?:{ [key:string]: string; }, // getの場合に必要
    headers?:{ [key:string]: string; } // headersがあるなら必要
):HttpOptions{
  return { 
      method: method,
      uri: uri,
      timeout: timeout,
      body: body, 
      qs: qs,
      headers: headers
    }
}

export function getApiResponse(options:HttpOptions): any{
    return new Promise((resolve, reject) => {
        requestPromise(options)
        .then((response:any) => {
            resolve(JSON.parse(response))
        })
        .catch((error: any) => {
            console.log(error)
            reject(error);
        }); 
    })
}
