declare function require(x: string): any;
const exec = require('child_process').exec;
const MeCab = require('mecab-async');
const fs = require('fs');
const mecab = new MeCab();

export async function handler(event: any): Promise<any> {
    return MeCabLambda.hello(event);
}
 
export class MeCabLambda {
 
    public static async hello(event: any): Promise<any> {
        let dic = event.queryStringParameters.type? event.queryStringParameters.type: 'ipadic'
        if(dic==='neologd'){
            mecab.command = '/var/task/local/bin/mecab -d /tmp/root/neologd';
            try {
                fs.accessSync('/tmp/root/neologd');
            } catch(e) {
                await new Promise((resolve, reject) => {
                    exec('unzip -d /tmp/ /opt/nodejs/neologd.zip', (err:any, stdout:any, stderr:any) => {
                        if (err) {
                            console.error(err);
                            reject(err);
                        }
                        console.log(stdout);
                        resolve(stdout);
                    });
                });
            }
        }else{
            dic = 'ipadic'
            mecab.command = '/var/task/local/bin/mecab -d /opt/nodejs/ipadic';
        }
        let text = event.queryStringParameters.text? event.queryStringParameters.text: 'これはテストだよ！queryにtype="ipadic/neologd"を指定して、text="(形態素解析したい文字列)"を入れてGETで叩いてね。'
        const res = mecab.parseSync(normalize(text));
        const response = {
            statusCode: 200,
            body: JSON.stringify({type:dic, 'response':res, text:text})
        };
        return response;
    }    
}

function normalize(text:string) {
  return text.normalize("NFKC").toLowerCase();
}