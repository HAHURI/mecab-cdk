declare function require(x: string): any;
const neo4j = require('neo4j-driver').v1
const requestPromise = require('request-promise');
const parser = require('xml2json');
const driver = neo4j.driver(process.env.NEO4J_URL,neo4j.auth.basic(process.env.USER_NAME, process.env.USER_PASSWORD))
const mecabUrl = process.env.MecabUrl ? process.env.MecabUrl : ''

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
export interface Chat{
    anonymity: number,
    date: number,
    mail: number,
    no: number,
    thread: number,
    user_id: string,
    vpos: number,
    locale: string,
    $t: string
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
        /**
         * <User> --Broadcast--→ <Live> ←--Comment:Count-- <User>
         * <User> --Count--→ <Word> --Count--→ <Live> ←--Broadcast-- <User>
         * <Comment> --typology-- <Comment> 
         * <Word> --typology-- <Word> 
         */
        for(let i =0; i<liveList.list.length; i++){
            let livedata = liveList.list[i]
            console.log(livedata)
            
            // Live
            var readTxResultPromise = await session.readTransaction(function (transaction:any) {
                var result = transaction.run('MATCH (live:Live { id:' + livedata.id + '}) RETURN live');
                return result;
            });
            if (readTxResultPromise.records.length === 0) {
                await session.run('CREATE (live:Live { id: '+livedata.id
                    +',title: "'+livedata.title.replace(/"/g,'&quot;')
                    +'",description: "'+livedata.description.replace(/"/g,'&quot;')
                    +'",thumbnail: "'+livedata.thumbnail.replace(/"/g,'&quot;')
                    +'",url: "'+livedata.url.replace(/"/g,'&quot;')
                    +'",platform: "'+livedata.platform
                    +'",nickname: "'+livedata.nickname.replace(/"/g,'&quot;')
                    +'",studioMetadata: "'+livedata.studioMetadata.toString
                    +'",viewers: {viewersParam},uniqueViewers: {uniqueViewersParam},comments: {commentsParam},startedAt: {startedAtParam},endedAt: {endedAtParam},createdAt: {createdAtParam}})',
                    { 
                        viewersParam: neo4j.int(livedata.viewers!==null? livedata.viewers: -1),
                        uniqueViewersParam: neo4j.int(livedata.uniqueViewers!==null? livedata.uniqueViewers: -1),
                        commentsParam: neo4j.int(livedata.comments!==null? livedata.comments: -1),
                        startedAtParam: neo4j.int(livedata.startedAt*1000),
                        endedAtParam: neo4j.int(livedata.endedAt*1000),
                        createdAtParam: neo4j.int(livedata.createdAt*1000)
                    }
                )
            }
            // titleとdescriptionをmecabに投げるならここ
            let wordAnalyze = await getApiResponse(createApiOptions(
                'POST',
                mecabUrl,
                6000,
                { type: 'neologd', words: [livedata.title,livedata.description] }
            ));
            console.log(wordAnalyze)


            // User,Edge
            const result = await when(livedata.platform)
                .on(v => v === 'nicolive', async () => await nicoliveFnc(livedata))
                .on(v => v === 'youtubelive', async () => await youtubeliveFnc(livedata))
                .on(v => v === 'twitcasting', async () => await twitcastingFnc(livedata))
                .on(v => v === 'twitch', async () => await twitchFnc(livedata))
                .on(v => v === 'showroom', async () => await otherFnc(livedata))
                .otherwise(async () => await otherFnc(livedata))
            console.log(result)
        }
    }    
}

// youtubelive: URLからチャンネルの判定が可能：ニックネームとチャンネルID
export async function youtubeliveFnc(livedata:Live):Promise<string>{
    var session = driver.session()
    const channelId = livedata.url.split('/')[4].split('?')[0]
    // node(User)
    var Neo4jUser = await session.readTransaction(function (transaction:any) {
        var result = transaction.run('MATCH (user:User { channelId: "'+ channelId +'"}) RETURN user');
        return result;
    });
    if (Neo4jUser.records.length === 0) {
        await session.run('CREATE (user:User {nickname: "'+livedata.nickname.replace(/"/g,'&quot;') + '", channelId: "'+ channelId +'"})')
    }
    // edge(User->Live)
    var Neo4jUserLiveEdge = await session.readTransaction(function (transaction:any) {
        var result = transaction.run('MATCH (:User { channelId: "'+ channelId +'"})-[r:Broadcast]->(:Live { id:' + livedata.id + '}) RETURN r');
        return result;
    });
    if (Neo4jUserLiveEdge.records.length === 0) {
        await session.run('MATCH (user:User { channelId: "'+ channelId +'"}) , (live:Live { id:' + livedata.id + '}) CREATE (user)-[:Broadcast]->(live)')
    }
    console.log('youtubelive id:'+livedata.id+'の処理が完了しました！')
    return '処理が完了しました！'
}
// twitcasting: URLからユーザの判定が可能：ニックネームとtwitcastingのID
export async function twitcastingFnc(livedata:Live):Promise<string>{
    var session = driver.session()
    const twitcastingId = livedata.url.split('/')[3]
    // node(User)
    var Neo4jUser = await session.readTransaction(function (transaction:any) {
        var result = transaction.run('MATCH (user:User { twitcastingId: "'+ twitcastingId +'"}) RETURN user');
        return result;
    });
    if (Neo4jUser.records.length === 0) {
        await session.run('CREATE (user:User {nickname: "'+livedata.nickname.replace(/"/g,'&quot;') + '", twitcastingId: "'+ twitcastingId +'"})')
    }
    // edge(User->Live)
    var Neo4jUserLiveEdge = await session.readTransaction(function (transaction:any) {
        var result = transaction.run('MATCH (:User { twitcastingId: "'+ twitcastingId +'"})-[r:Broadcast]->(:Live { id:' + livedata.id + '}) RETURN r');
        return result;
    });
    if (Neo4jUserLiveEdge.records.length === 0) {
        await session.run('MATCH (user:User { twitcastingId: "'+ twitcastingId +'"}) , (live:Live { id:' + livedata.id + '}) CREATE (user)-[:Broadcast]->(live)')
    }
    console.log('twitcasting id:'+livedata.id+'の処理が完了しました！')
    return '処理が完了しました！'
}
// twitch: URLからユーザの判定が可能：ニックネームとtwitchのID
export async function twitchFnc(livedata:Live):Promise<string>{
    var session = driver.session()
    const twitchId = livedata.url.split('/')[3]
    // node(User)
    var Neo4jUser = await session.readTransaction(function (transaction:any) {
        var result = transaction.run('MATCH (user:User { twitchId: "'+ twitchId +'"}) RETURN user');
        return result;
    });
    if (Neo4jUser.records.length === 0) {
        await session.run('CREATE (user:User {nickname: "'+livedata.nickname.replace(/"/g,'&quot;') + '", twitchId: "'+ twitchId +'"})')
    }
    // edge(User->Live)
    var Neo4jUserLiveEdge = await session.readTransaction(function (transaction:any) {
        var result = transaction.run('MATCH (:User { twitchId: "'+ twitchId +'"})-[r:Broadcast]->(:Live { id:' + livedata.id + '}) RETURN r');
        return result;
    });
    if (Neo4jUserLiveEdge.records.length === 0) {
        await session.run('MATCH (user:User { twitchId: "'+ twitchId +'"}) , (live:Live { id:' + livedata.id + '}) CREATE (user)-[:Broadcast]->(live)')
    }
    console.log('twitch id:'+livedata.id+'の処理が完了しました！')
    return '処理が完了しました！'
}
// showroom: URLからユーザの判定はできない：ニックネームのみ
export async function otherFnc(livedata:Live):Promise<string>{
    var session = driver.session()
    // node(User)
    var Neo4jUser = await session.readTransaction(function (transaction:any) {
        var result = transaction.run('MATCH (user:User { liveId: '+ livedata.id +'}) RETURN user');
        return result;
    });
    if (Neo4jUser.records.length === 0) {
        await session.run('CREATE (user:User {nickname: "'+livedata.nickname.replace(/"/g,'&quot;') + '", liveId: "'+ livedata.id +'"})')
    }
    // edge(User->Live)
    var Neo4jUserLiveEdge = await session.readTransaction(function (transaction:any) {
        var result = transaction.run('MATCH (:User { liveId: "'+ livedata.id +'"})-[r:Broadcast]->(:Live { id:' + livedata.id + '}) RETURN r');
        return result;
    });
    if (Neo4jUserLiveEdge.records.length === 0) {
        await session.run('MATCH (user:User { liveId: "'+ livedata.id +'"}) , (live:Live { id:' + livedata.id + '}) CREATE (user)-[:Broadcast]->(live)')
    }
    console.log('showroom id:'+livedata.id+'の処理が完了しました！')
    return '処理が完了しました！'
}
// nicolive: URLからユーザ判定できない：次の取得ができなかったらニックネームのみ、できたらニックネームと情報
export async function nicoliveFnc(livedata:Live):Promise<string>{
    var session = driver.session()
    
    // 生米保管庫からXMLを取得する
    // mecabでテキストデータを解析する
    // neo4jに解析結果を保存する
    /** user,lived,comment,word
     * NiconamaComment.PlayerStatus.Stream
     *      OwnerId,OwnerName,DefaultCommunity
     * NiconamaComment.LiveCommentDataArray.chat[]
     *      anonymity,date,mail,no,thread,user_id,vpos,locale,$t
     */
    let niconama = await getResponse(createApiOptions('GET', 'http://namagome.com/come_dl.cgi/' + livedata.url.split('/')[4].replace(/[^0-9]/g, '') + '/xml', 6000));
    let niconamaJson = JSON.parse(parser.toJson(niconama))
    if (typeof niconamaJson.NiconamaComment.LiveInfo.LiveTitle === 'string'){
        console.log(niconamaJson)
        const ownerId = niconamaJson.NiconamaComment.PlayerStatus.Stream.OwnerId
        // node(User)
        var Neo4jUser = await session.readTransaction(function (transaction:any) {
            var result = transaction.run('MATCH (user:User { ownerId: "'+ ownerId +'"}) RETURN user');
            return result;
        });
        if (Neo4jUser.records.length === 0) {
            await session.run('CREATE (user:User {nickname: "'+livedata.nickname.replace(/"/g,'&quot;') + '", ownerId: "'+ ownerId +'", OwnerName: "'+ niconamaJson.NiconamaComment.PlayerStatus.Stream.OwnerName.replace(/"/g,'&quot;') +'"})')
        }
        // edge(User->Live)
        var Neo4jUserLiveEdge = await session.readTransaction(function (transaction:any) {
            var result = transaction.run('MATCH (:User { ownerId: "'+ ownerId +'"})-[r:Broadcast]->(:Live { id:' + livedata.id + '}) RETURN r');
            return result;
        });
        if (Neo4jUserLiveEdge.records.length === 0) {
            await session.run('MATCH (user:User { ownerId: "'+ ownerId +'"}) , (live:Live { id:' + livedata.id + '}) CREATE (user)-[:Broadcast{DefaultCommunity:'+niconamaJson.NiconamaComment.PlayerStatus.Stream.DefaultCommunity+'}]->(live)')
        }
        // TODO: コメントデータ解析
        let comments:{ [key:string]: any; } = {}
        for(let i=0; niconamaJson.NiconamaComment.LiveCommentDataArray.chat.length; i++){
            let chat:Chat = niconamaJson.NiconamaComment.LiveCommentDataArray.chat[i]
            if (comments[chat.user_id]) {
                comments[chat.user_id].push(chat)
            }else{
                comments[chat.user_id] = new Array()
                comments[chat.user_id].push(chat)
            }
            // mecabに投げるならここ
        }
        Object.keys(comments).forEach(function (key) {
            // Userを確認。存在しなかったらnodeを追加。特殊ユーザや匿名はわかるようにしておく。comments[key]

            // Commentのedgeを追加。数値：コメント数。文字数。平均文字数。

        });
        console.log('nicolive(コメントあり) id:'+livedata.id+'の処理が完了しました！')
        return '処理が完了しました！'
    }else{
        // node(User)
        var Neo4jUser = await session.readTransaction(function (transaction:any) {
            var result = transaction.run('MATCH (user:User { liveId: '+ livedata.id +'}) RETURN user');
            return result;
        });
        if (Neo4jUser.records.length === 0) {
            await session.run('CREATE (user:User {nickname: "'+livedata.nickname.replace(/"/g,'&quot;') + '", liveId: "'+ livedata.id +'"})')
        }
        // edge(User->Live)
        var Neo4jUserLiveEdge = await session.readTransaction(function (transaction:any) {
            var result = transaction.run('MATCH (:User { liveId: "'+ livedata.id +'"})-[r:Broadcast]->(:Live { id:' + livedata.id + '}) RETURN r');
            return result;
        });
        if (Neo4jUserLiveEdge.records.length === 0) {
            await session.run('MATCH (user:User { liveId: "'+ livedata.id +'"}) , (live:Live { id:' + livedata.id + '}) CREATE (user)-[:Broadcast]->(live)')
        }
        console.log('nicolive(コメントなし) id:'+livedata.id+'の処理が完了しました！')
        return '処理が完了しました！'
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


type ChainedWhen<T, R> = {
    on: <A>(pred: (v: T) => boolean, fn: () => A) => ChainedWhen<T, R | A>;
    otherwise: <A>(fn: () => A) => R | A;
};

const match = <T, R>(val: any): ChainedWhen<T, R> => ({
    on: <A>(pred: (v: T) => boolean, fn: () => A) => match<T, R | A>(val),
    otherwise: <A>(fn: () => A): A | R => val
});

const chain = <T, R>(val: T): ChainedWhen<T, R> => ({
    on: <A>(pred: (v: T) => boolean, fn: () => A) =>
    pred(val) ? match(fn()) : chain<T, A | R>(val),
    otherwise: <A>(fn: () => A) => fn()
});

const when = <T>(val: T) => ({
    on: <A>(pred: (v: T) => boolean, fn: () => A) =>
    pred(val) ? match<T, A>(fn()) : chain<T, A>(val)
});