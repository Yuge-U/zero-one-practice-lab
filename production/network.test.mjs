import test from 'node:test'; // Nodeの標準テストを使用します。
import assert from 'node:assert/strict'; // 実際の呼出元と結果を検査します。
import {GraphClient,GRAPH} from '../web/core/graph.mjs'; // 配信する通信コードそのものを読みます。
test('default fetch is bound to globalThis, not the GraphClient',async()=>{ // ブラウザのネイティブAPIと同じ呼出元検査を再現します。
 const original=globalThis.fetch;let calls=0; // 元の実装を確実に復元できるよう保持します。
 try{globalThis.fetch=function(url,options){assert.equal(this,globalThis);assert.equal(url,GRAPH+'/me/drive/special/approot');assert.equal(options.redirect,'error');assert.equal(options.credentials,'omit');assert.equal(options.headers.Authorization,'Bearer synthetic');calls++;return Promise.resolve(new Response('{"id":"root"}'));}; // グローバル以外からの呼出を拒否します。
 const client=new GraphClient({getToken:async()=>'synthetic'});assert.equal((await client.request('/me/drive/special/approot')).id,'root');assert.equal(calls,1); // 既定の通信経路で成功することを要求します。
 }finally{globalThis.fetch=original;} // テスト用の差替えを残しません。
}); // 呼出元の回帰試験を閉じます。
test('injected fetch still works and keeps redirect/token boundaries',async()=>{ // 模擬処理の注入互換性を保ちます。
 const client=new GraphClient({getToken:async()=>'synthetic',fetcher:async(url,options)=>{assert.equal(options.redirect,'error');assert.equal(options.headers.Authorization,'Bearer synthetic');return new Response('{}');}}); // 本人トークンは使いません。
 assert.deepEqual(await client.request('/me/drive/special/approot'),{}); // 注入した処理も従来通り使えます。
}); // 注入試験を閉じます。
test('unapproved origins fail before requesting a token',async()=>{ // 呼出元の修正で許可範囲を広げないことを確認します。
 let calls=0;const client=new GraphClient({getToken:async()=>{calls++;return 'synthetic';}}); // 認証要求の発生も数えます。
 await assert.rejects(client.request('https://example.invalid/v1.0/me/drive/root'),{code:'PATH'});assert.equal(calls,0); // 禁止宛先へ通信しません。
}); // 通信先の境界試験を閉じます。
test('HTTP permission failures remain distinct from transport failures',async()=>{ // 権限不足を回線エラーに置き換えません。
 const client=new GraphClient({getToken:async()=>'synthetic',fetcher:async()=>new Response('{}',{status:403})}); // 合成の403応答を用意します。
 await assert.rejects(client.request('/me/drive/special/approot'),{code:'PERMISSION'}); // 従来の安全な分類を維持します。
}); // エラー分類試験を閉じます。
test('preauthenticated download never receives the Graph bearer token',async()=>{ // ファイル取得時のトークン漏出を防ぎます。
 const seen=[];const client=new GraphClient({getToken:async()=>'synthetic',fetcher:async(url,options)=>{seen.push({url,options});return url.startsWith(GRAPH)?new Response(JSON.stringify({id:'file',size:2,'@microsoft.graph.downloadUrl':'https://download.example.invalid/file'})):new Response('{}');}}); // 合成のメタ情報と本文を返します。
 assert.equal(await client.readText({id:'file'}),'{}');assert.equal(seen.length,2);assert.equal(seen[1].options.headers,undefined);assert.equal(seen[1].options.credentials,'omit'); // 事前認証URLへBearerやCookieを付けません。
}); // 取得経路の境界試験を閉じます。
