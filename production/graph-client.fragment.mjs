export class GraphClient { // Graphへの通信と認証更新を回数制限付きで扱います。
  constructor({getToken,fetcher=globalThis.fetch.bind(globalThis),sleep=ms=>new Promise(r=>setTimeout(r,ms))}){this.getToken=getToken;this.fetcher=fetcher;this.sleep=sleep;this.requests=0;} // ネイティブfetchの呼出元と従来の依存注入を維持します。
  safeUrl(path){const url=new URL(path.startsWith('https:')?path:GRAPH+path);ensure(url.origin==='https://graph.microsoft.com'&&!url.username&&!url.password&&url.pathname.startsWith('/v1.0/me/drive/'),'PATH','許可されていないGraph宛先です。');return url.href;} // Bearerを許可したGraphの本人領域以外へ送りません。
  async request(path,options={}){ // 端末保存には触れずクラウド要求だけを再試行します。
    const url=this.safeUrl(path),method=options.method||'GET';ensure(['GET','POST','PUT'].includes(method),'METHOD','削除や未定義の通信は禁止しています。'); // 既存の操作・宛先制限を維持します。
    let refreshed=false,forceNext=false;const repeatable=method==='GET'||method==='PUT'; // 作成POSTは応答不明時に自動で繰り返しません。
    for(let attempt=0;attempt<3;attempt++){ // HTTPの送信は初回を含め最大3回です。
      let token;try{token=await this.getToken({forceRefresh:forceNext});forceNext=false;}catch(error){throw connectionError(authCode(error));} // Worker越しでも通信・権限の分類を保持します。
      ensure(typeof token==='string'&&token,'AUTH','再接続が必要です。');let response,raw; // 空の認証情報を通信へ渡しません。
      try{this.requests++;response=await this.fetcher(url,{...options,method,headers:{...(options.headers||{}),Authorization:`Bearer ${token}`},credentials:'omit',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(25000)});if(response.ok&&response.status!==204)raw=await response.text();}catch(error){recordConnection('graph','NETWORK',attempt+1);if(repeatable&&attempt<2){await this.sleep(500*2**attempt);continue;}throw connectionError('NETWORK');} // 応答本文の中断も通信失敗とし同じ固定名・同じ内容でのみ再試行します。
      if(response.status===401){recordConnection('graph','AUTH',attempt+1,401);if(!refreshed){if(attempt===2)throw connectionError('AUTH_UNKNOWN');refreshed=true;forceNext=true;continue;}await this.getToken({interactionRequired:true});throw connectionError('AUTH');} // 401は一度だけ無言更新しそれでも失敗した時だけ再認証を要求します。
      if([429,500,502,503,504].includes(response.status)){recordConnection('graph',response.status===429?'RATE_LIMIT':'NETWORK',attempt+1,response.status);const wait=retryDelay(response.headers.get('Retry-After'));if(wait>60000)throw connectionError('RATE_LIMIT');if(repeatable&&attempt<2){await this.sleep(Math.max(500*2**attempt,wait));continue;}} // Retry-Afterを守り一時的なサーバー障害を制限付きで再試行します。
      if(response.status===404)return null; // 存在しないファイルという既存の意味を維持します。
      if(!response.ok){const codes={403:'PERMISSION',409:'CONFLICT',412:'CONFLICT',429:'RATE_LIMIT',500:'NETWORK',502:'NETWORK',503:'NETWORK',504:'NETWORK',507:'QUOTA'},code=codes[response.status]||'GRAPH';recordConnection('graph',code,attempt+1,response.status);if(['PERMISSION','NETWORK','RATE_LIMIT'].includes(code))throw connectionError(code);throw new LabError(code,`OneDriveへの${method==='GET'?'読込':'保存'}に失敗しました（${response.status}）。端末の変更は保持しています。`);} // 権限不足や競合を期限切れとして扱いません。
      recordConnection('graph','OK',attempt+1,response.status);if(response.status===204)return {}; // HTTP成功の証拠だけを残し保存確認は既存の読戻しに委ねます。
      ensure(byteLength(raw)<=8*LIMIT,'LIMIT','Graph応答が検証版の上限を超えています。');try{return JSON.parse(raw);}catch{throw new LabError('CORRUPT','Graph応答を読み取れません。');} // 容量と形式の検査は緩和しません。
    } // 回数上限に達した要求を終了します。
    throw connectionError('NETWORK'); // 無限再接続や無限再試行を行いません。
  } // Graph要求を閉じます。
  async children(id){const result=[];let path=`/me/drive/items/${encodeURIComponent(id)}/children`;const visited=new Set();while(path){ensure(!visited.has(path)&&visited.size<100,'LIMIT','一覧取得のページングが異常です。');visited.add(path);const page=await this.request(path);ensure(page&&Array.isArray(page.value),'CLOUD_MISSING','同期フォルダを取得できません。');result.push(...page.value);ensure(result.length<=10000,'LIMIT','検証版のファイル件数上限です。');path=page['@odata.nextLink']||null;}return result;} // 既存の一覧上限・循環検出をそのまま維持します。
  async readText(item){ // 事前認証URLへの要求にBearerを追加しません。
    ensure(item?.id,'MISSING','ファイルIDがありません。');const meta=await this.request(`/me/drive/items/${encodeURIComponent(item.id)}`);ensure(meta,'CLOUD_MISSING','ファイルが見つかりません。'); // Graph上の存在を先に確認します。
    ensure(!Number.isFinite(meta.size)||meta.size<=LIMIT,'LIMIT','この検証版で扱うファイルは2MiB以下です。');const target=meta['@microsoft.graph.downloadUrl'];ensure(typeof target==='string','DOWNLOAD','ダウンロード先を取得できません。');const url=new URL(target);ensure(url.protocol==='https:'&&!url.username&&!url.password,'PATH','安全なダウンロード先ではありません。'); // 既存の取得先・サイズ制限を保持します。
    for(let attempt=0;attempt<3;attempt++){ // 読込だけを最大3回試行します。
      let response,raw;try{response=await this.fetcher(url.href,{credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(25000)});if(response.ok)raw=await response.text();}catch{recordConnection('download','NETWORK',attempt+1);if(attempt<2){await this.sleep(500*2**attempt);continue;}throw connectionError('NETWORK');} // 本文読込中の通信切断も未完了として扱います。
      if([429,500,502,503,504].includes(response.status)&&attempt<2){const wait=retryDelay(response.headers.get('Retry-After'));if(wait>60000)throw connectionError('RATE_LIMIT');await this.sleep(Math.max(500*2**attempt,wait));continue;} // 一時的な配信障害にも待機上限を適用します。
      recordConnection('download',response.ok?'OK':'NETWORK',attempt+1,response.status);ensure(response.ok,'DOWNLOAD','ファイル取得に失敗しました。');ensure(byteLength(raw)<=LIMIT,'LIMIT','受信ファイルが大きすぎます。');return raw; // 内容検査を通過した読込だけを返します。
    } // ダウンロード再試行を閉じます。
  } // ファイル読込を閉じます。
} // Graphクライアントを閉じます。
