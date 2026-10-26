import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('authenticated title API returns real grading after primary model failure',async()=>{
  process.env.NODE_ENV='test';process.env.GEMINI_API_KEY='test-key';
  process.env.EIKEN_GEMINI_MODEL='gemini-3.8-flash';process.env.EIKEN_GEMINI_FALLBACK_MODEL='gemini-3.6-flash';
  const nativeFetch=globalThis.fetch,calls=[];
  globalThis.fetch=async(url,options)=>{
    if(String(url).includes('identitytoolkit.googleapis.com'))return Response.json({users:[{localId:'student',email:'student@example.test'}]});
    if(String(url).includes('generativelanguage.googleapis.com')){
      calls.push(String(url));
      if(calls.length<3)return Response.json({error:{status:'UNAVAILABLE'}},{status:503});
      return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({verdict:'partial',feedback:'本文全体の内容を具体的に表しましょう。',issues:[],suggestion:'地域活動を通して広がる興味'})}]}}]});
    }
    return nativeFetch(url,options);
  };
  const {server}=await import('./server.js');await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    const claims=Buffer.from(JSON.stringify({aud:'eiken-retry',iss:'https://securetoken.google.com/eiken-retry',sub:'student'})).toString('base64url');
    const data=JSON.parse(readFileSync(new URL('./data.json',import.meta.url),'utf8'));
    const response=await nativeFetch(`http://127.0.0.1:${server.address().port}/api/grade`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer header.${claims}.accepted`},body:JSON.stringify({passage_id:data.passages[0].id,student_title:'たのしい'})});
    assert.equal(response.status,200);assert.equal((await response.json()).verdict,'partial');
    assert.equal(calls.length,3);assert.match(calls[2],/gemini-3.6-flash/);
  }finally{globalThis.fetch=nativeFetch;await new Promise(resolve=>server.close(resolve));}
});
