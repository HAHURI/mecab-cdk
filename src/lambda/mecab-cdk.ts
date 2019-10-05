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
        mecab.command = '/var/task/local/bin/mecab -d /opt/nodejs/ipadic';
        const ipadicres = mecab.parseSync(normalize("初音ミクさんと東方Projectをうまく認識できないipadicは雑魚。"));
        mecab.command = '/var/task/local/bin/mecab -d /tmp/root/neologd';
        const neologdres = mecab.parseSync(normalize("初音ミクさんと東方Projectをうまく認識できないipadicは雑魚。"));
        const response = {
            statusCode: 200,
            body: JSON.stringify({'ipadic': ipadicres,'neologd':neologdres})
        };
        return response;
    }    
}

function normalize(text:string) {
  return text.normalize("NFKC").toLowerCase();
}