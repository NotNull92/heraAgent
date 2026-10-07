import assert from 'node:assert/strict';
import {createInterface} from 'node:readline/promises';
import {ResearchBrowser} from '../dist/research/browser.js';
import {heraHome} from '../dist/paths.js';
if(!process.argv.includes('--live')){console.error('Use --live for public browser search/read; --manual additionally opens a CAPTCHA window for the user. No model inference.');process.exit(4);}
const browser=new ResearchBrowser(await heraHome());let input;
const timer=setTimeout(()=>{console.error('Manual research check timed out; preserving an incomplete result.');process.exitCode=4;void browser.close();input?.close();},600000);
try{
  const query='Node.js 24 child_process official documentation';
  const [first,duplicate]=await Promise.all([browser.search(query),browser.search(query)]);assert.equal(first.retrievedAt,duplicate.retrievedAt);
  console.log(JSON.stringify({search:first.status,duplicateShared:true}));let result=first;
  if(first.status==='captcha'&&process.argv.includes('--manual')){
    await browser.openChallenge();console.log('CAPTCHA browser open. User must solve it; enter resume afterwards.');
    input=createInterface({input:process.stdin,output:process.stdout});
    if((await input.question('> ')).trim()!=='resume')throw new Error('Manual verification not confirmed');
    result=await browser.resume();console.log(JSON.stringify({manualResume:result.status,links:result.links}));
  }
  const fetched=await browser.fetch('https://nodejs.org/docs/latest-v24.x/api/child_process.html');assert.equal(fetched.status,'ok');assert.ok(fetched.text.length<=3000);
  const cached=await browser.fetch('https://nodejs.org/docs/latest-v24.x/api/child_process.html');assert.equal(cached.cached,true);assert.equal(cached.retrievedAt,fetched.retrievedAt);
  assert.equal(result.status,'ok','Search incomplete; a CAPTCHA/error is not a pass');
  console.log(JSON.stringify({freeResearch:'pass',links:result.links,fetchCharacters:fetched.text.length,cache:'pass',noPaidSearch:true}));
}catch(error){console.error(JSON.stringify({freeResearch:'incomplete',message:error.message}));process.exitCode=4;}
finally{clearTimeout(timer);input?.close();await browser.close();}
