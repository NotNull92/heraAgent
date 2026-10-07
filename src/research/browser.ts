import {chromium,type Browser,type BrowserContext,type Page} from 'playwright';
import {access} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {execFile} from 'node:child_process';
import {createRequire} from 'node:module';
import {promisify} from 'node:util';
import {childEnvironment} from '../codex/launcher.js';
import {rejectRepositoryHome} from '../paths.js';
import {HeraError} from '../errors.js';
import {publicUrl,startPublicProxy} from './proxy.js';
import {ResearchQueue,retryAt,type ResearchResult} from './queue.js';

const SEARCH='https://html.duckduckgo.com/html/';
export const challengeText=(text:string)=>/anomaly\.js|challenge-form|unusual traffic|verify (?:that )?you are human|prove you.re human|complete the (?:following )?captcha|bots use duckduckgo|로봇이 아님|비정상적인 트래픽/i.test(text);
export async function installBrowser(home:string){
  await rejectRepositoryHome(dirname(chromium.executablePath()));
  const cli=join(dirname(createRequire(import.meta.url).resolve('playwright/package.json')),'cli.js');
  await promisify(execFile)(process.execPath,[cli,'install','chromium','--no-remove'],{env:{...childEnvironment(home,home),...(process.env.PLAYWRIGHT_BROWSERS_PATH?{PLAYWRIGHT_BROWSERS_PATH:process.env.PLAYWRIGHT_BROWSERS_PATH}:{})},windowsHide:true,timeout:300000,maxBuffer:1024*1024});
  await access(chromium.executablePath());
}
export class ResearchBrowser {
  readonly queue=new ResearchQueue();private browser:Browser|undefined;private context:BrowserContext|undefined;private page:Page|undefined;
  private proxy:Awaited<ReturnType<typeof startPublicProxy>>|undefined;private state:Awaited<ReturnType<BrowserContext['storageState']>>|undefined;
  private challenge:{url:string;key:string;search:boolean}|undefined;private manual=false;private closed=false;
  private opening:Promise<Page>|undefined;
  constructor(private readonly home:string){}
  status(){return {...this.queue.status(),manualBrowser:this.manual,captchaPending:!!this.challenge};}
  private async open(headed=false){
    if(this.closed)throw new Error('Research closed');if(this.page)return this.page;
    this.opening??=this.launch(headed).finally(()=>{this.opening=undefined;});return this.opening;
  }
  private async launch(headed:boolean){
    await rejectRepositoryHome(dirname(chromium.executablePath()));
    try{await access(chromium.executablePath());}catch{throw new HeraError('BROWSER_SETUP_REQUIRED','먼저 /research setup 또는 hera research setup으로 무료 Chromium을 설치하세요.',4);}
    this.proxy??=await startPublicProxy();
    this.browser=await chromium.launch({headless:!headed,channel:'chromium',chromiumSandbox:true,proxy:{server:this.proxy.url,bypass:'<-loopback>'},args:['--disable-quic','--force-webrtc-ip-handling-policy=disable_non_proxied_udp'],env:childEnvironment(this.home,this.home)});
    this.context=await this.browser.newContext({javaScriptEnabled:headed,acceptDownloads:false,serviceWorkers:'block',...(this.state?{storageState:this.state}:{})});
    await this.context.route('**/*',async route=>{
      const request=route.request();try{publicUrl(request.url());}catch{await route.abort();return;}
      if(!['GET','HEAD',...(headed?['POST']:[])].includes(request.method())){await route.abort();return;}
      if(!headed&&['image','media','font','script'].includes(request.resourceType())){await route.abort();return;}
      await route.continue();
    });
    this.page=await this.context.newPage();this.page.on('popup',popup=>void popup.close());this.page.on('dialog',dialog=>void dialog.dismiss());this.page.on('download',download=>void download.cancel());
    this.page.setDefaultTimeout(5000);this.page.setDefaultNavigationTimeout(20000);return this.page;
  }
  private async snapshot(page:Page,url:string,search:boolean):Promise<ResearchResult>{
    const title=await page.title();const body=await page.locator('body').innerText();
    const result={url:page.url(),retrievedAt:new Date().toISOString(),title:title.slice(0,300)};
    if(challengeText(title+'\n'+body)||await page.locator('#challenge-form,form[action*="anomaly.js"],iframe[src*="recaptcha"],iframe[src*="hcaptcha"]').count())return {...result,status:'captcha',message:'검색 중단: /research open에서 직접 인증 후 /research resume. 자동 재시도하지 마세요.'};
    if(search){
      const links=await page.locator('.result').evaluateAll(nodes=>nodes.slice(0,10).map(node=>({title:node.querySelector('.result__a')?.textContent?.trim()??'',url:node.querySelector('.result__a')?.getAttribute('href')??'',snippet:node.querySelector('.result__snippet')?.textContent?.trim()??''})));
      const clean=links.flatMap(link=>{try{const target=new URL(link.url,SEARCH);const url=publicUrl(target.searchParams.get('uddg')??target.href).href;return [{title:link.title.slice(0,200),url,snippet:link.snippet.slice(0,500)}];}catch{return [];}}).slice(0,3);
      return clean.length?{...result,status:'ok',links:clean}:{...result,status:'error',message:'검색 결과를 확인하지 못했습니다. 차단 또는 페이지 형식 변경일 수 있습니다. 자동 재시도 없음.'};
    }
    // Text only: no screenshot/DOM dump, scripts, downloads or model-provided JS.
    const text=await page.locator('body').evaluate(body=>{const copy=body.cloneNode(true) as HTMLElement;copy.querySelectorAll('script,style,nav,header,footer,aside,noscript').forEach(node=>node.remove());return (copy.textContent??'').replace(/\s+/g,' ').trim().slice(0,100000);});
    return {...result,status:'ok',text};
  }
  private read(url:string,search:boolean,key:string){return this.queue.run(key,new URL(url).origin,async()=>{
    if(this.challenge)return {status:'captcha',url:this.challenge.url,retrievedAt:new Date().toISOString(),message:'먼저 /research open 및 /research resume으로 보류된 인증을 해결하세요.'};
    const page=await this.open();
    try{
      const response=await page.goto(url,{waitUntil:'domcontentloaded'});const status=response?.status();
      const base={url,retrievedAt:new Date().toISOString()};
      if(status===429)return {...base,status:'rate_limited',retryAt:new Date(retryAt(await response!.headerValue('retry-after'))).toISOString(),message:'요청 제한. 지정 시각 이후 사용자 요청으로 재시도하며 자동 반복하지 않습니다.'};
      if(status===403){const result=await this.snapshot(page,url,search);if(result.status==='captcha'){this.challenge={url,key,search};return result;}return {...base,status:'blocked',message:'접속 거부. 이 사이트의 자동 요청을 중단했습니다.'};}
      if(!status||status>=400)return {...base,status:'error',message:'페이지 읽기 실패. 자동 재시도 없음.'};
      const result=await this.snapshot(page,url,search);if(result.status==='captcha')this.challenge={url,key,search};return result;
    }catch{return {status:'error',url,retrievedAt:new Date().toISOString(),message:'브라우저 요청 실패 또는 취소. 공개 HTTPS 주소와 연결 상태를 확인하세요. 자동 재시도 없음.'};}
  });}
  search(query:string){const normalized=query.trim().replace(/\s+/g,' ');const url=new URL(SEARCH);url.searchParams.set('q',normalized);return this.read(url.href,true,'search:'+normalized);}
  async fetch(value:string,offset=0,maxCharacters=3000){const url=publicUrl(value).href;const result=await this.read(url,false,'fetch:'+url);return {...result,...(result.text?{text:result.text.slice(offset,offset+maxCharacters),offset,totalCharacters:result.text.length}:{})};}
  async openChallenge(){
    if(this.queue.status().queued)throw new Error('진행 중인 검색이 끝난 뒤 인증 브라우저를 여세요.');
    if(!this.challenge)throw new Error('보류된 CAPTCHA가 없습니다.');if(this.manual)return;
    this.state=await this.context?.storageState();await this.closeBrowser();this.manual=true;
    try{const page=await this.open(true);await page.goto(this.challenge.url,{waitUntil:'domcontentloaded'});}catch{this.manual=false;await this.closeBrowser();throw new Error('인증 브라우저를 열지 못했습니다. /research open으로 다시 시도하세요.');}
  }
  async resume(){
    const challenge=this.challenge;if(!challenge||!this.manual||!this.page)throw new Error('먼저 /research open에서 인증을 해결하세요.');
    if(new URL(this.page.url()).origin!==new URL(challenge.url).origin)throw new Error('원래 검색 페이지로 돌아온 뒤 재개하세요.');
    const result=await this.snapshot(this.page,challenge.url,challenge.search);
    if(result.status!=='ok')throw new Error('인증 또는 결과 확인이 아직 끝나지 않았습니다. 브라우저에서 확인하세요.');
    this.state=await this.context?.storageState();this.queue.clearPause(new URL(challenge.url).origin);this.queue.remember(challenge.key,result);this.challenge=undefined;this.manual=false;await this.closeBrowser();return result;
  }
  private async closeBrowser(){await this.opening?.catch(()=>{});const browser=this.browser;this.browser=undefined;this.context=undefined;this.page=undefined;if(browser)await browser.close();}
  async interrupt(){const stop=this.queue.interrupt();await this.closeBrowser();await stop;this.manual=false;}
  async close(){if(this.closed)return;this.closed=true;const stop=this.queue.close();await this.closeBrowser();await stop;await this.proxy?.close();this.state=undefined;}
}
