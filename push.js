
(function(){
'use strict';

const VAPID_PUBLIC_KEY = window.ICC_VAPID_PUBLIC_KEY || '';
let pushStatusEl = null;

function b64ToUint8Array(base64String){
  const padding='='.repeat((4-base64String.length%4)%4);
  const base64=(base64String+padding).replace(/-/g,'+').replace(/_/g,'/');
  const raw=atob(base64);
  return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)));
}
function setStatus(msg,ok){
  if(pushStatusEl){pushStatusEl.textContent=msg;pushStatusEl.className='text-[11px] mt-2 '+(ok?'text-emerald-700':'text-slate-500');}
}
async function currentSession(){
  if(typeof cloudClient==='undefined'||!cloudClient)return null;
  const {data}=await cloudClient.auth.getSession();
  return data?.session||null;
}
function currentMemberId(){
  try{return localStorage.getItem('icc2_member_id')||'';}catch(e){return '';}
}
async function saveSubscription(sub){
  const session=await currentSession();
  if(!session)throw new Error('Connecte-toi d’abord à ton compte.');
  const memberId=currentMemberId();
  const json=sub.toJSON();
  const row={
    user_id:session.user.id,
    member_id:memberId||null,
    endpoint:json.endpoint,
    subscription:json,
    user_agent:navigator.userAgent,
    enabled:true,
    updated_at:new Date().toISOString()
  };
  const {error}=await cloudClient.from('icc_push_subscriptions').upsert(row,{onConflict:'endpoint'});
  if(error)throw error;
}
async function enablePush(){
  try{
    if(!('serviceWorker' in navigator)||!('PushManager' in window))throw new Error('Les notifications push ne sont pas disponibles sur ce navigateur.');
    if(!VAPID_PUBLIC_KEY)throw new Error('La clé VAPID publique n’est pas encore configurée.');
    const permission=await Notification.requestPermission();
    if(permission!=='granted')throw new Error('Autorisation de notifications refusée.');
    const reg=await navigator.serviceWorker.ready;
    let sub=await reg.pushManager.getSubscription();
    if(!sub){
      sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64ToUint8Array(VAPID_PUBLIC_KEY)});
    }
    await saveSubscription(sub);
    setStatus('Notifications téléphone activées ✅',true);
    return true;
  }catch(e){
    console.warn('Push activation',e);
    setStatus(e.message||String(e),false);
    alert(e.message||e);
    return false;
  }
}
async function disablePush(){
  try{
    const reg=await navigator.serviceWorker.ready;
    const sub=await reg.pushManager.getSubscription();
    if(sub){
      if(typeof cloudClient!=='undefined'&&cloudClient){
        await cloudClient.from('icc_push_subscriptions').update({enabled:false,updated_at:new Date().toISOString()}).eq('endpoint',sub.endpoint);
      }
      await sub.unsubscribe();
    }
    setStatus('Notifications désactivées.',false);
  }catch(e){console.warn(e);}
}
async function refreshStatus(){
  try{
    if(!('serviceWorker' in navigator)||!('PushManager' in window)){setStatus('Notifications push non disponibles sur cet appareil.',false);return;}
    const reg=await navigator.serviceWorker.ready;
    const sub=await reg.pushManager.getSubscription();
    setStatus(sub&&Notification.permission==='granted'?'Notifications téléphone activées ✅':'Notifications téléphone non activées.',!!sub);
  }catch(e){}
}
function installPushUI(){
  const page=document.getElementById('page-settings');
  if(!page||document.getElementById('v71-push-card'))return;
  const content=document.getElementById('settings-content')||page;
  const card=document.createElement('div');
  card.id='v71-push-card';
  card.className='bg-white rounded-2xl border shadow-sm p-5';
  card.innerHTML=`<div class="flex flex-wrap justify-between items-start gap-3">
    <div><h3 class="font-black text-iccViolet">🔔 Notifications téléphone</h3>
      <p class="text-xs text-slate-500 mt-1">Reçois les nouvelles sollicitations, affectations et changements importants même lorsque COM Le Mans est fermée.</p>
    </div>
    <div class="flex gap-2 flex-wrap">
      <button type="button" onclick="v71EnablePush()" class="bg-iccYellow text-slate-900 text-xs font-black px-4 py-2 rounded-lg">Activer</button>
      <button type="button" onclick="v71DisablePush()" class="bg-white border text-xs font-bold px-4 py-2 rounded-lg">Désactiver</button>
    </div>
  </div><div id="v71-push-status" class="text-[11px] mt-2 text-slate-500"></div>`;
  content.prepend(card);
  pushStatusEl=document.getElementById('v71-push-status');
  refreshStatus();
}
window.v71EnablePush=enablePush;
window.v71DisablePush=disablePush;

async function sendPushEvent(kind,payload={}){
  try{
    const session=await currentSession();
    if(!session||typeof cloudClient==='undefined'||!cloudClient)return;
    await cloudClient.functions.invoke('send-push',{body:{kind,payload}});
  }catch(e){console.warn('Push event',kind,e);}
}
window.v71SendPushEvent=sendPushEvent;

/* New solicitation -> notify matching recipients, best effort. */
const oldSaveSol=window.saveSolicitation;
if(typeof oldSaveSol==='function'){
  window.saveSolicitation=function(){
    const before=(typeof solicitations!=='undefined'?solicitations.length:0);
    const r=oldSaveSol.apply(this,arguments);
    setTimeout(()=>{
      try{
        const s=solicitations[solicitations.length-1];
        if(s&&solicitations.length>=before){
          sendPushEvent('solicitation.created',{solicitation:s,members:typeof members!=='undefined'?members:[]});
        }
      }catch(e){}
    },50);
    return r;
  };
  try{saveSolicitation=window.saveSolicitation;}catch(e){}
}

/* Program save -> notify assigned members. */
const oldSaveProg=window.saveProgram;
if(typeof oldSaveProg==='function'){
  window.saveProgram=function(){
    const id=document.getElementById('prog-id')?.value||'';
    const r=oldSaveProg.apply(this,arguments);
    setTimeout(()=>{
      try{
        const p=(id&&programs.find(x=>String(x.id)===String(id)))||programs[programs.length-1];
        if(p)sendPushEvent(id?'program.updated':'program.created',{program:p});
      }catch(e){}
    },70);
    return r;
  };
  try{saveProgram=window.saveProgram;}catch(e){}
}

/* Solicitation response -> notify creator/managers where possible. */
const oldAnswer=window.v69AnswerSolicitation;
if(typeof oldAnswer==='function'){
  window.v69AnswerSolicitation=function(id,status){
    const r=oldAnswer.apply(this,arguments);
    setTimeout(()=>{
      try{
        const s=solicitations.find(x=>String(x.id)===String(id));
        sendPushEvent('solicitation.response',{solicitation:s,status,memberId:currentMemberId(),members:typeof members!=='undefined'?members:[]});
      }catch(e){}
    },80);
    return r;
  };
}

document.addEventListener('DOMContentLoaded',()=>setTimeout(installPushUI,400));
window.addEventListener('load',()=>setTimeout(installPushUI,800));
})();
