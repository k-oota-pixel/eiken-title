const failure=(message,status)=>Object.assign(new Error(message),{status});

// Keep all attempts inside the page's 60-second request timeout.
export async function requestTitleGrade({key,model,prompt,schema,payload,
  fallbackModel=process.env.EIKEN_GEMINI_FALLBACK_MODEL||'gemini-3.6-flash',
  fetchImpl=fetch,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),logger=console}){
  const models=[model,model];
  if(fallbackModel&&fallbackModel!==model)models.push(fallbackModel);
  let lastError;
  for(let attempt=0;attempt<models.length;attempt++){
    const current=models[attempt];
    if(attempt)await wait(attempt===1?1000:1500);
    try{
      const response=await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(current)}:generateContent`,{
        method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},
        signal:AbortSignal.timeout(14000),
        body:JSON.stringify({systemInstruction:{parts:[{text:prompt}]},
          contents:[{role:'user',parts:[{text:JSON.stringify(payload)}]}],
          generationConfig:{temperature:0.1,maxOutputTokens:1536,
            thinkingConfig:current.startsWith('gemini-2.5-')?{thinkingBudget:0}:{thinkingLevel:'low'},
            responseMimeType:'application/json',responseSchema:schema}})
      });
      if(response.ok)return await response.json();
      let detail={};try{detail=await response.json();}catch{}
      const reason=(detail.error?.details||[]).find(item=>typeof item.reason==='string')?.reason;
      const code=String(reason||detail.error?.status||'UNKNOWN').replace(/[^A-Z0-9_]/g,'').slice(0,80);
      logger.error(`Gemini ${current} HTTP ${response.status}: ${code}`);
      if([500,502,503,504].includes(response.status)){
        lastError=failure('AIが一時的に混み合っています。入力を残したまま、少し待って再試行してください。',503);
        continue;
      }
      if(response.status===429)throw failure('Geminiの利用が一時的に集中しています。少し待って、もう一度お試しください。',503);
      if(response.status===404)throw failure('AIモデルに接続できませんでした。先生がモデル設定を確認してください。',502);
      throw failure(`Geminiエラー ${response.status} / ${code}`,502);
    }catch(error){
      const timeout=error?.name==='TimeoutError'||error?.name==='AbortError';
      if(timeout||error instanceof TypeError){
        lastError=failure('AIからの応答に時間がかかっています。入力を残したまま再試行できます。',504);
        logger.warn(`Gemini ${current}: ${timeout?'timeout':'network error'}`);
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}
