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
        var session = driver.session();        
        let liveList = getApiResponse(createApiOptions('GET','https://api.virtualcast.jp/channels/ja/archive/list',60,undefined,{count:'20',offsetId:event.queryStringParameters.offsetId}))
        let res = liveList.list.forEach(async function(live:any){
            // neo4jに登録があるかを確認する
            var readTxResultPromise = await session.readTransaction(function (transaction:any) {
                var result = transaction.run('MATCH (live:Live { liveId:"' + live.id + '"}) RETURN live');
                return result;
            });
            if(readTxResultPromise.records.length===0){
                if(live.url.match(/nicovideo/)){
                    let niconama = getResponse(createApiOptions('GET','http://namagome.com/come_dl.cgi/'+live.url.split('/')[-1]+'/xml',60))
                    console.log(niconama)
                    console.log(parser.toJson(niconama))
                    return ''
                } else {
                    return ''
                }    
            }else{
                return 'すでに登録済みです'
            }
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
export function getResponse(options:HttpOptions): any{
    return new Promise((resolve, reject) => {
        requestPromise(options)
        .then((response:any) => {
            resolve(response)
        })
        .catch((error: any) => {
            console.log(error)
            reject(error);
        }); 
    })
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
