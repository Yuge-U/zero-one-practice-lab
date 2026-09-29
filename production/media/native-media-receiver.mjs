import {createServer} from 'node:https'; // 合成Graphだけを受信するテスト用TLSサーバーです。
import {createServer as createProxyServer} from 'node:http'; // 元のHTTPSオリジンを維持するテスト用CONNECT受付です。
import {connect} from 'node:net'; // 接続先は同じ実行環境のループバックに固定します。
import {mkdtemp,readFile,rm} from 'node:fs/promises'; // 一回限りの証明書を管理します。
import {join} from 'node:path'; // 検証用一時領域を指定します。
import {tmpdir} from 'node:os'; // 本人ファイルとは別の領域を使います。
import {execFileSync} from 'node:child_process'; // テスト用の短期自己署名証明書を生成します。
import assert from 'node:assert/strict'; // 受信した要求と実バイトを検査します。
export async function nativeMediaReceiver(receive){ // 公開アプリのfetch・TLS・CSPを変更しません。
  const directory=await mkdtemp(join(tmpdir(),'practice-media-tls-')),key=join(directory,'key.pem'),cert=join(directory,'cert.pem'),events=[],errors=[],sockets=new Set(); // 証明書は配信物や証拠ZIPに含めません。
  execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,'-days','1','-subj','/CN=graph.microsoft.com'],{stdio:'ignore',timeout:30000}); // 合成コンテキスト内だけで使う証明書です。
  const server=createServer({key:await readFile(key),cert:await readFile(cert)},async(req,res)=>{ // ブラウザが元のGraphオリジン宛てに送った実ボディを受信します。
    const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'PUT, OPTIONS','Access-Control-Allow-Headers':'authorization, content-type, cache-control, pragma','Content-Type':'application/json','Cache-Control':'no-store'}; // 本人認証を使わない合成応答のCORS設定です。
    if(req.method==='OPTIONS'){events.push({method:'OPTIONS'});res.writeHead(204,headers);res.end();return;} // 元のオリジンのまま標準プリフライトへ応答します。
    try{const target=new URL(req.url,'https://graph.microsoft.com');const match=/\/items\/media:\/(M_[a-f0-9]{64}\.bin):\/content$/.exec(decodeURIComponent(target.pathname));assert(match);assert.equal(req.method,'PUT');assert.equal(req.headers.authorization,'Bearer synthetic-media-token');assert.equal(target.searchParams.get('@microsoft.graph.conflictBehavior'),'fail');const chunks=[];let size=0;for await(const part of req){size+=part.length;assert(size<=50000000);chunks.push(part);}events.push({method:'PUT',name:match[1],size});const reply=await receive(match[1],Buffer.concat(chunks));res.writeHead(reply.status,headers);res.end(JSON.stringify(reply.body));}catch(error){errors.push(error.message);if(!res.headersSent)res.writeHead(500,headers);res.end(JSON.stringify({error:'SYNTHETIC_RECEIVER_FAILED'}));} // 取得できない本文を期待値で埋めず、失敗は証拠に残します。
  }); // 任意のファイルや実Graphへ転送する機能はありません。
  await new Promise((done,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',done);}); // TLS受信先を外部に公開しません。
  const proxy=createProxyServer((req,res)=>{res.writeHead(403);res.end();}); // 通常の転送要求は拒否します。
  proxy.on('connect',(req,client,head)=>{ // ブラウザのCONNECT先が合成Graphであることを確認します。
    if(req.url!=='graph.microsoft.com:443'){errors.push('Unexpected CONNECT destination');client.end('HTTP/1.1 403 Forbidden\r\n\r\n');return;} // 他の外部サービスへ中継しません。
    events.push({method:'CONNECT',host:req.url});const upstream=connect(server.address().port,'127.0.0.1');sockets.add(client);sockets.add(upstream); // 実際の接続先は固定したテストTLSサーバーのみです。
    client.on('close',()=>{sockets.delete(client);upstream.destroy();});upstream.on('close',()=>{sockets.delete(upstream);client.destroy();});client.on('error',()=>upstream.destroy());upstream.on('error',()=>client.destroy()); // 切断後にソケットを残しません。
    upstream.once('connect',()=>{client.write('HTTP/1.1 200 Connection Established\r\n\r\n');if(head.length)upstream.write(head);client.pipe(upstream);upstream.pipe(client);}); // 元のURL・本文・TLSレコードを変えず人工受信先に届かせます。
  }); // システム全体のプロキシ設定は変更しません。
  await new Promise((done,reject)=>{proxy.once('error',reject);proxy.listen(0,'127.0.0.1',done);}); // ランダムなループバックポートを使います。
  return {proxy:{server:`http://127.0.0.1:${proxy.address().port}`,bypass:'127.0.0.1,localhost,yuge-u.github.io'},events,errors,async close(){for(const socket of sockets)socket.destroy();server.closeAllConnections();proxy.closeAllConnections();await Promise.all([new Promise(done=>server.close(done)),new Promise(done=>proxy.close(done))]);await rm(directory,{recursive:true,force:true});}}; // ブラウザ終了後に試験用の接続と証明書を解放します。
} // テスト専用の受信処理を閉じます。
