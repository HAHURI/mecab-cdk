declare function require(x: string): any;
const exec = require('child_process').exec;
const MeCab = require('mecab-async');
const fs = require('fs');
const mecab = new MeCab();
mecab.command = '/var/task/lambda_neologd/local/bin/mecab -d /opt/neologd/';

export async function handler(event: any): Promise<any> {
    return MeCab.hello(event);
}
 
export class MeCabLambda {
 
    public static async hello(event: any): Promise<any> {
        try {
            fs.accessSync('/tmp/neologd');
        } catch(e) {
            console.log("ダメっぽい")
        }
        const res = mecab.parseSync(normalize("僕の名前はラルセイです。"));
        const response = {
            statusCode: 200,
            body: JSON.stringify(['Hello', res])
        };
        return response;
    }    
}

function normalize(text:string) {
  return text.normalize("NFKC").toLowerCase();
}