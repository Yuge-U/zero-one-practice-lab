import {chromium,webkit} from 'playwright'; // 二つの実ブラウザで既定のネイティブfetchを検査します。
import http from 'node:http'; // 合成ハーネスだけをローカル配信します。
import {readFile,writeFile,mkdir,mkdtemp} from 'node:fs/promises'; // 合成結果と公開コードだけを扱います。
import {resolve,join,sep} from 'node:path'; // 読取範囲を限定します。
import {tmpdir} from 'node:os'; // プロファイルを個別に用意します。
import {createHash} from 'node:crypto'; // 再現対象の版を固定します。
import assert from 'node:assert/strict'; // 期待した失敗と修正後の成功を両方検査します。
const root=process.cwd(),results=[],errors=[];let hits=[],failure=null,folder=false,marker=null; // 個人データを含まない試験状態です。
const old=await readFile(join(root,'baseline-web/core/graph.mjs'),'utf8');assert.equal(createHash('sha256').update(old).digest('hex'),'baa222cecad1e02aa3769a7d2fd8a55d39459002882674ae76c8ffcfc8508ed1'); // 実際の旧公開版を再現します。
const probe=async function({version,action}){ // WindowとWorkerで同じ公開コードを実行します。
 const {GraphClient,OneDriveCloud}=await import('/'+version+'/core/graph.mjs'); // beforeとafterの通信実装を読みます。
 const client=new GraphClient({getToken:async()=>'synthetic-not-a-real-token'}); // fetch自体は差し替えません。
 try{if(action==='download')return {ok:true,text:await client.readText({id:'marker'})}; // メタ情報と署名済みURL取得を通します。
 if(action==='forbidden')return {ok:true,value:await client.request('https://outside.example.invalid/v1.0/me/drive/root')}; // 不許可の宛先を検査します。
 if(action==='open'){const values=new Map();const repo={meta:key=>values.get(key),setMeta:(key,value)=>values.set(key,value)};const scope='ms-'+'a'.repeat(64);const cloud=new OneDriveCloud(client,scope,repo);await cloud.open(true);await cloud.open(false);return {ok:true,known:values.get('cloudFolderId'),ready:Boolean(cloud.marker)};} // 実際の接続処理を合成クラウドで往復させます。
 return {ok:true,value:await client.request('/me/drive/special/approot')}; // 通常の接続開始経路です。
 }catch(error){return {ok:false,code:error.code||error.name,message:error.message};} // 本人のURLやトークンは収録しません。
}; // 共通の実行関数を閉じます。
const server=http.createServer(async(req,res)=>{ // 固定公開ソースと合成ハーネスだけを配信します。
 try{const path=new URL(req.url,'http://127.0.0.1').pathname;if(path==='/'){res.setHeader('Content-Type','text/html');return res.end('<!doctype html><title>Native Graph transport regression</title>');} // 実アプリの認証は行いません。
 if(path==='/probe.js'){res.setHeader('Content-Type','text/javascript');return res.end('const probe='+probe.toString()+';self.onmessage=async e=>self.postMessage(await probe(e.data));');} // Workerでもネイティブfetchを使います。
 const match=/^\/(before|after)\/(core\/[\w-]+\.mjs)$/.exec(path);assert(match);const base=resolve(root,match[1]==='before'?'baseline-web':'web');const file=resolve(base,match[2]);assert(file.startsWith(base+sep)); // 任意のファイルを配信しません。
 res.setHeader('Content-Type','text/javascript');res.end(await readFile(file)); // バイトを変更せずモジュールを返します。
 }catch{res.writeHead(404);res.end('Not found');} // 範囲外は拒否します。
}); // ハーネス配信を閉じます。
await new Promise(done=>server.listen(0,'127.0.0.1',done));const origin='http://127.0.0.1:'+server.address().port; // クリーンなローカルURLを取得します。
async function record(engine,name,fn){try{const evidence=await fn();results.push({engine,name,pass:true,evidence});}catch(error){results.push({engine,name,pass:false,error:error.message});}} // 全ケースを実行して実際の合否を残します。
try{for(const [engine,type]of [['chromium',chromium],['webkit',webkit]]){ // WebKitを省略せず比較します。
 const home=await mkdtemp(join(tmpdir(),'zero-one-native-'));const context=await type.launchPersistentContext(join(home,'profile'),{headless:true,env:{...process.env,HOME:home,CFFIXED_USER_HOME:home,XDG_DATA_HOME:join(home,'data'),XDG_CACHE_HOME:join(home,'cache'),XDG_CONFIG_HOME:join(home,'config')}}); // 他の端末やプロファイルと分離します。
 await context.route('**/*',async route=>{ // ネイティブfetchの後段だけで合成Microsoft応答を返します。
 const request=route.request(),url=new URL(request.url());if(url.origin===origin)return route.continue(); // ローカルの公開モジュールは実配信します。
 const headers=request.headers();hits.push({host:url.hostname,path:url.pathname,method:request.method(),bearer:headers.authorization==='Bearer synthetic-not-a-real-token',cookie:Boolean(headers.cookie)}); // 本人の資格情報は取得せず真偽だけ記録します。
 if(!['graph.microsoft.com','download.example.invalid'].includes(url.hostname))return route.abort(); // 外部への実通信は行いません。
 if(failure==='network')return route.abort('failed');if(typeof failure==='number')return route.fulfill({status:failure,contentType:'application/json',body:'{}',headers:{'Access-Control-Allow-Origin':'*'}}); // エラー分類用の合成応答です。
 let value;if(url.hostname==='download.example.invalid')return route.fulfill({status:200,contentType:'application/json',body:marker||'{"synthetic":true}',headers:{'Access-Control-Allow-Origin':'*'}}); // 署名済みURL取得もネイティブfetchまで実行します。
 if(url.pathname.endsWith('/special/approot'))value={id:'root',folder:{}}; // 接続先のアプリ領域を返します。
 else if(url.pathname.endsWith('/items/root/children')){if(request.method()==='POST'){folder=true;value={id:'folder',folder:{}};}else value={value:folder?[{id:'folder',name:'ZERO_ONE_PRACTICE_LAB_V02',folder:{}}]:[]};} // 専用フォルダの作成と再接続を再現します。
 else if(url.pathname.endsWith('/items/folder/children'))value={value:marker?[{id:'marker',name:'store.marker.data',file:{}}]:[]}; // 識別ファイルの有無を返します。
 else if(url.pathname.endsWith(':/content')&&request.method()==='PUT'){marker=request.postData();value={id:'marker',name:'store.marker.data',file:{}};} // テストメモリ内にだけ識別情報を保持します。
 else if(url.pathname.endsWith('/items/marker'))value={id:'marker',size:(marker||'{}').length,'@microsoft.graph.downloadUrl':'https://download.example.invalid/marker'}; // 実装どおりの取得先を用意します。
 else return route.fulfill({status:404,contentType:'application/json',body:'{}',headers:{'Access-Control-Allow-Origin':'*'}}); // 未定義の要求を成功で隠しません。
 return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(value),headers:{'Access-Control-Allow-Origin':'*'}}); // ブラウザが解釈するHTTP応答として返します。
 }); // ネットワーク層の合成を終えます。
 const page=await context.newPage();page.on('pageerror',error=>errors.push({engine,message:error.message}));await page.goto(origin); // 未捕捉エラーも合否へ含めます。
 const execute=async(realm,version,action='request')=>{hits=[];if(realm==='window')return page.evaluate(probe,{version,action});return page.evaluate(({version,action})=>new Promise((resolve,reject)=>{const worker=new Worker('/probe.js',{type:'module'});const timeout=setTimeout(()=>{worker.terminate();reject(new Error('Worker probe timed out'));},15000);worker.onmessage=e=>{clearTimeout(timeout);worker.terminate();resolve(e.data);};worker.onerror=()=>{clearTimeout(timeout);worker.terminate();reject(new Error('Worker probe failed'));};worker.postMessage({version,action});}),{version,action});}; // 実装をWindowとWorkerの両方から呼びます。
 for(const realm of ['window','worker']){ // 旧版の欠陥と修正後を対照させます。
 await record(engine,realm+' original native fetch rejects before request',async()=>{failure=null;const result=await execute(realm,'before');assert.equal(result.ok,false);assert.equal(result.code,'NETWORK');assert.equal(hits.length,0);return result;}); // 通信前失敗であることを確認します。
 await record(engine,realm+' fixed native fetch reaches HTTP',async()=>{const result=await execute(realm,'after');assert.equal(result.ok,true);assert.equal(result.value.id,'root');assert.equal(hits.length,1);assert.equal(hits[0].bearer,true);return {httpRequests:hits.length};}); // 模擬fetchではなくネイティブAPIの通過を要求します。
 } // WindowとWorkerの対照を終えます。
 await record(engine,'worker download uses native fetch without bearer',async()=>{marker=null;const result=await execute('worker','after','download');assert.equal(result.ok,true);assert.equal(result.text,'{"synthetic":true}');assert.equal(hits.length,2);assert.equal(hits[1].bearer,false);assert.equal(hits[1].cookie,false);return {requests:hits};}); // ファイル取得でも呼出元と認証境界を検査します。
 await record(engine,'worker preserves HTTP 403 permission classification',async()=>{failure=403;const result=await execute('worker','after');assert.equal(result.code,'PERMISSION');assert.equal(hits.length,1);failure=null;return result;}); // 権限エラーを適切に区別します。
 await record(engine,'worker preserves true network failure',async()=>{failure='network';const result=await execute('worker','after');assert.equal(result.code,'NETWORK');assert.equal(hits.length,3);failure=null;return result;}); // 実際の通信失敗を成功に見せません。
 await record(engine,'worker rejects unapproved origin before HTTP',async()=>{failure=null;const result=await execute('worker','after','forbidden');assert.equal(result.code,'PATH');assert.equal(hits.length,0);return result;}); // 宛先制限を維持します。
 await record(engine,'worker opens and reopens app folder with native transport',async()=>{failure=null;folder=false;marker=null;const result=await execute('worker','after','open');assert.equal(result.ok,true);assert.equal(result.known,'folder');assert.equal(result.ready,true);assert.equal(hits.filter(x=>x.method==='POST').length,1);assert.equal(hits.filter(x=>x.method==='PUT').length,1);assert(hits.filter(x=>x.host==='download.example.invalid').every(x=>!x.bearer&&!x.cookie));return {requests:hits};}); // 元の失敗箇所を実際の接続クラスで検査します。
 await context.close(); // 合成ブラウザを終了します。
}}finally{server.closeAllConnections();await new Promise(done=>server.close(done));await mkdir('reports/network',{recursive:true});await writeFile('reports/network/results.json',JSON.stringify({results,errors,passed:results.length===18&&results.every(x=>x.pass)&&errors.length===0,nativeFetch:true,networkResponses:'Playwright route fixtures; not real Microsoft',realMicrosoft:false,physicalIPhone:false},null,2));} // 未実行を合格にせず証拠を残します。
assert.equal(results.length,18);assert(results.every(x=>x.pass),JSON.stringify(results.filter(x=>!x.pass)));assert.equal(errors.length,0);console.log('18 native-fetch regression expectations passed; actual Microsoft sign-in and personal OneDrive not tested.'); // 合成環境の結果だけを報告します。
