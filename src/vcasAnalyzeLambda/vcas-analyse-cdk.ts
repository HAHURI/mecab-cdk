declare function require(x: string): any;
const neo4j = require('neo4j-driver').v1
const requestPromise = require('request-promise');
const parser = require('xml2json');
const driver = neo4j.driver(process.env.NEO4J_URL,neo4j.auth.basic(process.env.USER_NAME, process.env.USER_PASSWORD))

// type
export type HttpMethodEnum = 'GET'|'POST'
export type platformEnum = 'nicolive' | 'youtubelive' | 'twitcasting' | 'twitch' | 'showroom';
// interface
export interface Live { 
    id: number,
    title: string,
    description: string,
    thumbnail: string,
    url: string,
    platform: platformEnum,
    viewers: number,
    uniqueViewers: number,
    comments: number,
    nickname: string,
    studioMetadata: string,
    startedAt: number,
    endedAt: number,
    createdAt: number
}
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
        let liveList:{list:Live[]} = await getApiResponse(createApiOptions('GET', 'https://api.virtualcast.jp/channels/ja/archive/list?count=20&offsetId='+event.queryStringParameters.offsetId, 6000));
        for(let i =0; i<liveList.list.length; i++){
            console.log(liveList.list[i])
            var readTxResultPromise = await session.readTransaction(function (transaction:any) {
                var result = transaction.run('MATCH (live:Live { liveId:"' + liveList.list[i].id + '"}) RETURN live');
                return result;
            });
            console.log(readTxResultPromise.records.length)
            if (readTxResultPromise.records.length === 0) {
                if (liveList.list[i].url.match(/nicovideo/)) {
                    let niconama = await getResponse(createApiOptions('GET', 'http://namagome.com/come_dl.cgi/' + liveList.list[i].url.split('/')[4].replace(/[^0-9]/g, '') + '/xml', 6000));
                    let niconamaJson = JSON.parse(parser.toJson(niconama))
                    if (typeof niconamaJson.NiconamaComment.LiveInfo.LiveTitle === 'string'){
                        console.log(niconamaJson)
                    }else{
                        console.log('コメデータはなかったのです')
                    }
                }else {
                    console.log('ニコ生以外です')
                }
            } else {
                console.log('すでに登録済みです')
            }
        }
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

