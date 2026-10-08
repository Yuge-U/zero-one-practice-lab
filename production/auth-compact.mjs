import {CLIENT_ID,AUTHORITY,SCOPES} from './config.mjs'; // 既存の認証先と許可範囲を変更しません。
import {authCode,connectionError,recordConnection} from './core/connection.mjs'; // エラー分類と個人情報を含まない診断を共用します。
import {sha} from './core/model.mjs'; // 本人の保存領域を従来と同じ方法で識別します。
const LAST_SCOPE='zero-one-browser-lab-v02-last-scope',OFFLINE_SCOPE='zero-one-browser-lab-v02-offline-scope',REMEMBER='zero-one-practice-remember',INTENT='zero-one-practice-connect-intent'; // 既存キーは変更しません。
const validScope=value=>typeof value==='string'&&/^ms-[a-f0-9]{64}$/.test(value); // 本人領域以外を前回の記録にしません。
export class Auth { // Microsoftの標準キャッシュと本人操作を組み合わせます。
  constructor({msal=globalThis.msal,storage=globalThis.localStorage,session=globalThis.sessionStorage,location=globalThis.location,sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}){this.connectionListeners=new Set();this.authInitialized=false;this.connectingAuth=false;this.lastErrorCode=null;this.sleep=sleep;this.tokenFlight=null;this.signInFlight=null;this.client=null;this.account=null;this.msal=msal;this.storage=storage;this.session=session;this.offlineScope=null;this.initError=null;this.needsInteraction=false;this.cacheMode=null;this.redirectUri=new URL('./',location.href).href;} // URL・保存境界は維持します。
  connectionStatus(){return {state:this.connectingAuth?'connecting':this.initError?'error':this.needsInteraction?'auth':this.lastErrorCode==='PERMISSION'?'permission':this.lastErrorCode?'error':!this.authInitialized?'checking':this.account?'connected':'disconnected',username:this.account?.username||'',account:Boolean(this.account),detail:this.initError||''};}
  onStatusChange(listener){this.connectionListeners.add(listener);listener(this.connectionStatus());return()=>this.connectionListeners.delete(listener);}
  emitConnection(){for(const listener of this.connectionListeners)listener(this.connectionStatus());}
  remember(){return this.storage.getItem(REMEMBER)!=='0';} // 個人端末では接続を再利用し、設定から無効にできます。
  setRemember(value){this.storage.setItem(REMEMBER,value?'1':'0');} // トークン自体を独自に保存しません。
  config(mode){return {auth:{clientId:CLIENT_ID,authority:AUTHORITY,redirectUri:this.redirectUri,postLogoutRedirectUri:this.redirectUri},cache:{cacheLocation:mode},system:{allowPlatformBroker:false}};} // PKCEや認証の標準設定を維持します。
  choose(accounts,result=null){if(result?.account)return result.account;const previous=this.lastOfflineScope();if(previous)return accounts.find(account=>'ms-'+sha(CLIENT_ID+'|'+account.homeAccountId)===previous)||null;return accounts.length===1?accounts[0]:null;} // 他アプリの選択中アカウントへ勝手に切り替えません。
  async init(){this.initError=null;try{if(this.msal?.PublicClientApplication){const mode=this.remember()?'localStorage':'sessionStorage';this.client=new this.msal.PublicClientApplication(this.config(mode));this.cacheMode=mode;await this.client.initialize();const result=await this.client.handleRedirectPromise();this.account=this.choose(this.client.getAllAccounts(),result); // 有効な標準キャッシュを再利用します。
      if(!this.account&&!result&&mode==='localStorage'){const legacy=new this.msal.PublicClientApplication(this.config('sessionStorage'));await legacy.initialize();const account=this.choose(legacy.getAllAccounts());if(account){this.client=legacy;this.cacheMode='sessionStorage';this.account=account;}} // 旧版でサインイン済みの同じタブも引き継ぎ、トークンはコピーしません。
      if(this.account)this.client.setActiveAccount(this.account);}}catch(error){recordConnection('init',authCode(error));this.account=null;this.client=null;this.initError='Microsoftの接続を初期化できませんでした。保存済みの記録は保持しています。';} // 認証失敗で記録を初期化しません。
    if(this.account){this.storage.setItem(LAST_SCOPE,this.scope());this.session.removeItem(OFFLINE_SCOPE);}else{const previous=this.session.getItem(OFFLINE_SCOPE);if(validScope(previous)&&previous===this.lastOfflineScope())this.offlineScope=previous;}this.authInitialized=true;this.emitConnection();return this.account; // 認証と端末記録の利用を区別します。
  } // 初期化を閉じます。
  scope(){return this.account?'ms-'+sha(CLIENT_ID+'|'+this.account.homeAccountId):this.offlineScope||'guest-local';} // 同じ本人は従来のDBを使います。
  lastOfflineScope(){const scope=this.storage.getItem(LAST_SCOPE);return validScope(scope)?scope:null;} // 前回の本人領域だけを返します。
  selectOfflineScope(){if(this.account)throw new Error('サインイン中は現在の本人領域を使用してください。');const scope=this.lastOfflineScope();if(!scope)throw new Error('このブラウザで以前接続した保存領域がありません。');this.offlineScope=scope;this.session.setItem(OFFLINE_SCOPE,scope);return scope;} // 未認証の閲覧は従来どおり明示操作です。
  armConnection(){this.session.setItem(INTENT,JSON.stringify({at:Date.now(),scope:this.account?this.scope():null}));} // 接続ボタンから開始した一回だけの意思を保持します。
  consumeConnectionIntent(){let data;try{data=JSON.parse(this.session.getItem(INTENT)||'null');}catch{data=null;}this.session.removeItem(INTENT);const age=Date.now()-Number(data?.at);return Boolean(this.account&&data&&age>=0&&age<10*60*1000&&(!data.scope||data.scope===this.scope()));} // 再読込による再作成や別アカウントへの流用を防ぎます。
  clearConnectionIntent(){this.session.removeItem(INTENT);} // 中断した接続要求を破棄します。
  async signIn(options={}){if(this.signInFlight)return this.signInFlight;this.signInFlight=this.performSignIn(options);try{return await this.signInFlight;}catch(error){this.connectingAuth=false;this.lastErrorCode=authCode(error);this.emitConnection();recordConnection('redirect',authCode(error));this.signInFlight=null;throw connectionError(authCode(error));}} // 画面遷移が始まった後は重複リダイレクトせず失敗時だけ解除します。
  async performSignIn({chooseAccount=false}={}){if(!this.msal?.PublicClientApplication)throw new Error(this.initError||'Microsoft認証を準備できません。再読み込みしてください。');const mode=this.remember()?'localStorage':'sessionStorage';if(!this.client||this.cacheMode!==mode){this.client=new this.msal.PublicClientApplication(this.config(mode));await this.client.initialize();this.cacheMode=mode;}const hint=!chooseAccount&&this.account?.username?{loginHint:this.account.username}:{};this.connectingAuth=true;this.lastErrorCode=null;this.emitConnection();await this.client.loginRedirect({scopes:SCOPES,...hint,...(chooseAccount?{prompt:'select_account'}:{})});} // 通常接続では毎回のアカウント選択を強制しません。
  async token({forceRefresh=false,interactionRequired=false}={}){ // Graphの401だけがキャッシュを迂回した更新を要求します。
    if(interactionRequired){this.needsInteraction=true;this.emitConnection();recordConnection('token','AUTH');throw connectionError('AUTH');} // 更新後も401なら明示再接続を案内し自動遷移しません。
    if(this.needsInteraction||!this.client||!this.account)throw connectionError('AUTH'); // 本人操作待ちの状態で更新を繰り返しません。
    if(this.tokenFlight){const flight=this.tokenFlight;const value=await flight.promise;return forceRefresh&&!flight.forceRefresh?this.token({forceRefresh:true}):value;} // 同時更新を共有し必要な強制更新だけ直列化します。
    const client=this.client,account=this.account; // 更新中に別の本人へ切り替わった場合を検知します。
    const flight={forceRefresh,promise:null};this.tokenFlight=flight; // 添付とWorkerからの要求を一つにまとめます。
    flight.promise=(async()=>{for(let attempt=0;attempt<3;attempt++){ // 通信失敗の再試行は初回を含め最大3回です。
      try{const result=await client.acquireTokenSilent({account,scopes:SCOPES,forceRefresh}); // MSALの標準キャッシュと更新を使います。
        if(this.needsInteraction||client!==this.client||account!==this.account||!result.accessToken||(result.account&&result.account.homeAccountId!==account.homeAccountId))throw connectionError('AUTH'); // 本人不一致や空トークンを外へ渡しません。
        this.needsInteraction=false;this.lastErrorCode=null;this.emitConnection();recordConnection('token','OK',attempt+1);return result.accessToken; // 認証成功はクラウド保存成功とは独立して記録します。
      }catch(error){const code=authCode(error);recordConnection('token',code,attempt+1);if(code==='NETWORK'&&attempt<2){await this.sleep(500*2**attempt);continue;}this.needsInteraction=this.needsInteraction||code==='AUTH';this.lastErrorCode=code;this.emitConnection();throw connectionError(code);} // 一時通信だけを再試行し権限・設定障害では再認証を強制しません。
    }})(); // 一つの認証更新処理を開始します。
    try{return await flight.promise;}finally{if(this.tokenFlight===flight)this.tokenFlight=null;} // 失敗後も次の明示再試行を可能にします。
  } // 認証更新を閉じます。
  async signOut(){this.clearConnectionIntent();if(this.client&&this.account){this.storage.removeItem(LAST_SCOPE);this.session.removeItem(OFFLINE_SCOPE);await this.client.logoutRedirect({account:this.account});}} // 記録は消さず、明示した本人の認証だけを終了します。
} // 認証クラスを閉じます。
