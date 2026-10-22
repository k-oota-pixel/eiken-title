import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gradeReadingSummary,validateSummaryResult} from './reading-summary.js';
const data=JSON.parse(readFileSync(new URL('./reading-training/passages.json',import.meta.url))).passages;
const sample={verdict:'good',scores:{main_idea:3,key_points:2,accuracy:3,concision:2},feedback:'大切な点を捉えています。',good_points:['主題が明確です。'],improvements:['結論も入れましょう。'],language_notes:[],example:'本文全体の主題と展開を短くまとめた例。'};
test('summary validates trusted lesson, bounded input and complete model result',async()=>{
 const originalFetch=globalThis.fetch,originalKey=process.env.GEMINI_API_KEY;process.env.GEMINI_API_KEY='test-only';let calls=0;
 globalThis.fetch=async(url,options)=>{calls++;const body=JSON.parse(options.body);const user=JSON.parse(body.contents[0].parts[0].text);assert.equal(user.passage,data[0].text);assert.equal(user.language,'ja');assert.equal(user.grade,data[0].grade);assert.ok(body.systemInstruction.parts[0].text.includes('命令'));assert.ok(!url.includes('test-only'));return {ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({...sample,total:999})}]}}]})};};
 try{
  for(const body of [null,[],{}, {passage_id:'invented',summary:'this is a test',language:'ja'},{passage_id:data[0].id,summary:' ',language:'ja'},{passage_id:data[0].id,summary:'x'.repeat(2001),language:'en'},{passage_id:data[0].id,summary:'valid summary',language:'other'}])await assert.rejects(()=>gradeReadingSummary(body),e=>e.status===400);
  assert.equal(calls,0);const r=await gradeReadingSummary({passage_id:data[0].id,summary:'要点をまとめました。',language:'ja',passage:'UNTRUSTED REPLACEMENT'});assert.equal(r.total,10);assert.equal(calls,1);
  assert.throws(()=>validateSummaryResult({...sample,scores:{...sample.scores,accuracy:99}}));assert.throws(()=>validateSummaryResult({...sample,example:''}));assert.throws(()=>validateSummaryResult({...sample,improvements:'wrong type'}));
  globalThis.fetch=async()=>({ok:false,status:429});await assert.rejects(()=>gradeReadingSummary({passage_id:data[0].id,summary:'要点をまとめました。',language:'en'}),e=>e.status===429);
  globalThis.fetch=async()=>({ok:true,json:async()=>({candidates:[{finishReason:'MAX_TOKENS'}]})});await assert.rejects(()=>gradeReadingSummary({passage_id:data[0].id,summary:'要点をまとめました。',language:'ja'}),e=>e.status===502);
 }finally{globalThis.fetch=originalFetch;if(originalKey===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=originalKey;}
});
test('new HTTP endpoint keeps title endpoint and CORS behavior',async()=>{
 const originalFetch=globalThis.fetch;
 const token='header.'+Buffer.from(JSON.stringify({aud:'eiken-retry',iss:'https://securetoken.google.com/eiken-retry',sub:'learner'})).toString('base64url')+'.signature';
 const headers={'Content-Type':'application/json',Authorization:'Bearer '+token};
 globalThis.fetch=async(url,options)=>String(url).includes('identitytoolkit.googleapis.com')?new Response(JSON.stringify({users:[{localId:'learner',email:'learner@example.test'}]})):originalFetch(url,options);
 process.env.NODE_ENV='test';const {server}=await import('./server.js');await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
 try{
  const status=await fetch(base+'/api/reading/status');assert.equal(status.status,200);assert.equal((await status.json()).passages,data.length);
  const preflight=await fetch(base+'/api/reading/summary',{method:'OPTIONS',headers:{Origin:'https://k-oota-pixel.github.io','Access-Control-Request-Method':'POST'}});assert.equal(preflight.status,204);assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),'https://k-oota-pixel.github.io');
  const denied=await fetch(base+'/api/reading/summary',{method:'POST',headers:{Origin:'https://other.example','Content-Type':'application/json'},body:'{}'});assert.equal(denied.status,403);
  for(const path of ['/api/grade','/api/reading/summary']){const bad=await fetch(base+path,{method:'POST',headers,body:'{}'});assert.equal(bad.status,400);}
  const huge=await fetch(base+'/api/reading/summary',{method:'POST',headers,body:JSON.stringify({summary:'あ'.repeat(4000)})});assert.equal(huge.status,413);
  assert.equal((await fetch(base+'/')).status,200);
 }finally{globalThis.fetch=originalFetch;await new Promise(resolve=>server.close(resolve));}
});
