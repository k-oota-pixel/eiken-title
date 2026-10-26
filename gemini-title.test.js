import test from 'node:test';
import assert from 'node:assert/strict';
import {requestTitleGrade} from './gemini-title.js';
const success={candidates:[{finishReason:'STOP',content:{parts:[{text:'{"verdict":"partial","feedback":"本文全体を表そう。","issues":[],"suggestion":"地域活動の楽しさ"}'}]}}]};
function setup(responses){
  const calls=[],delays=[];
  return {calls,delays,options:{key:'test-key',model:'gemini-3.8-flash',fallbackModel:'gemini-3.6-flash',prompt:'teacher',schema:{type:'OBJECT'},payload:{student_title:'たのしい'},
    logger:{error(){},warn(){}},wait:async ms=>delays.push(ms),fetchImpl:async(url,options)=>{
      calls.push({url,body:JSON.parse(options.body)});
      const next=responses.shift();if(next instanceof Error)throw next;
      return new Response(JSON.stringify(next===200?success:{error:{status:'UNAVAILABLE'}}),{status:next});
    }}};
}
test('503 twice switches to another Gemini model and preserves the grading request',async()=>{
  const s=setup([503,503,200]);assert.deepEqual(await requestTitleGrade(s.options),success);
  assert.match(s.calls[0].url,/gemini-3.8-flash/);assert.match(s.calls[1].url,/gemini-3.8-flash/);assert.match(s.calls[2].url,/gemini-3.6-flash/);
  assert.deepEqual(s.calls[2].body.contents,s.calls[0].body.contents);
  assert.deepEqual(s.calls[2].body.generationConfig.thinkingConfig,{thinkingLevel:'low'});
  assert.deepEqual(s.delays,[1000,1500]);
});
test('timeouts can recover using the fallback',async()=>{
  const timeout=()=>Object.assign(new Error('timeout'),{name:'TimeoutError'});
  const s=setup([timeout(),timeout(),200]);assert.deepEqual(await requestTitleGrade(s.options),success);assert.equal(s.calls.length,3);
});
test('successful primary never invokes fallback',async()=>{
  const s=setup([200]);await requestTitleGrade(s.options);assert.equal(s.calls.length,1);assert.deepEqual(s.delays,[]);
});
for(const status of [400,401,403,404,429])test(`HTTP ${status} does not bypass configuration or quota errors with another model`,async()=>{
  const s=setup([status]);await assert.rejects(requestTitleGrade(s.options));assert.equal(s.calls.length,1);
});
test('failure of all attempts returns a bounded temporary error',async()=>{
  const s=setup([503,503,503]);await assert.rejects(requestTitleGrade(s.options),e=>e.status===503);assert.equal(s.calls.length,3);
});
