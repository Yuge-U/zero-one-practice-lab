import {createServer} from 'node:https'; // テスト専用TLS受信先を使用します。
import {mkdtemp,readFile} from 'node:fs/promises'; // 一時証明書を検証専用の領域へ作ります。
import {join} from 'node:path'; // 一時領域のパスを固定します。
import {tmpdir} from 'node:os'; // 利用者とは無関係なテスト用領域を使います。
import {execFileSync} from 'node:child_process'; // 自己署名の試験証明書だけを生成します。
import assert from 'node:assert/strict'; // 実際に届いたサイズと要求を検証します。
export async function nativeMediaReceiver(receive){ // PlaywrightのBlob本文表示に依存せずHTTP本体を受け取ります。
  const directory=await mkdtemp(join(tmpdir(),'practice-media-tls-')),key=join(directory,'key.pem'),cert=join(directory,'cert.pem'); // 一時証明書は公開物に含めません。
  execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,'-days','1','-subj','/CN=localhost'],{stdio:'ignore'}); // ループバック試験だけで使う証明書を作ります。
  const server=createServer({key:await readFile(key),cert:await readFile(cert)},async(req,res)=>{ // 本番のGraphや証明書設定は変更しません。
    const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'PUT, OPTIONS','Access-Control-Allow-Headers':'authorization, content-type','Content-Type':'application/json'}; // 合成トークンによるテスト通信を許可します。
    if(req.method==='OPTIONS'){res.writeHead(204,headers);res.end();return;} // ブラウザの標準CORS確認へ応答します。
    try{const target=new URL(req.url,'https://127.0.0.1');const match=/\/items\/media:\/(M_[a-f0-9]{64}\.bin):\/content$/.exec(decodeURIComponent(target.pathname));assert(match);assert.equal(req.method,'PUT');assert.equal(req.headers.authorization,'Bearer synthetic-media-token');assert.equal(target.searchParams.get('@microsoft.graph.conflictBehavior'),'fail');const chunks=[];let size=0;for await(const part of req){size+=part.length;assert(size<=50_000_000);chunks.push(part);}const reply=await receive(match[1],Buffer.concat(chunks));res.writeHead(reply.status,headers);res.end(JSON.stringify(reply.body));}catch(error){res.writeHead(500,headers);res.end(JSON.stringify({error:'SYNTHETIC_RECEIVER_FAILED',message:error.message}));} // 実際の通信バイト以外を成功した添付として使いません。
  }); // 一般のファイルや任意URLへの中継は行いません。
  await new Promise(done=>server.listen(0,'127.0.0.1',done)); // 外部ネットワークへ公開せずループバックだけで受けます。
  return {url:`https://127.0.0.1:${server.address().port}`,close:()=>new Promise(done=>{server.close(done);server.closeAllConnections();})}; // ケース終了時に受信先を閉じます。
} // 模擬Graph受信の補助を閉じます。
