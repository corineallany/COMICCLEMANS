
(function(){
'use strict';

let pushStatusEl=null;
let vapidCache='';

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
  try{return localStorage.getItem('icc2_member_id')||''}catch(e){return ''}
}
async function publicKey77(){
  const embedded=String(window.ICC_VAPID_PUBLIC_KEY||'').trim();
  if(embedded && !embedded.startsWith('A_REMPLACER'))return embedded;
  if(vapidCache)return vapidCache;
  if(typeof cloudClient==='undefined'||!cloudClient)throw new Error('Connexion Supabase indisponible.');
  const {data,error}=await cloudClient.functions.invoke('send-push',{body:{action:'public-key'}});
  if(error)throw error;
  if(!data?.publicKey)throw new Error('Clé publique de notifications indisponible.');
  vapidCache=data.publicKey;return vapidCache;
}
async function saveSubscription(sub){
  const session=await currentSession();
  if(!session)throw new Error('Connecte-toi d’abord à ton compte.');
  const json=sub.toJSON();
  const memberId=currentMemberId();
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
    if(!('serviceWorker' in navigator)||!('PushManager' in window))throw new Error('Les notifications push ne sont pas disponibles sur cet appareil.');
    const key=await publicKey77();
    const permission=await Notification.requestPermission();
    if(permission!=='granted')throw new Error('Autorisation de notifications refusée.');
    const reg=await navigator.serviceWorker.ready;
    let sub=await reg.pushManager.getSubscription();
    if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64ToUint8Array(key)});
    await saveSubscription(sub);
    setStatus(currentMemberId()?'Notifications téléphone activées et liées à ton profil ✅':'Notifications activées ; lie ton compte à une fiche membre.',true);
    return true;
  }catch(e){console.warn('Push',e);setStatus(e.message||String(e),false);alert(e.message||e);return false;}
}
async function rebind77(){
  try{
    if(!('serviceWorker' in navigator)||!('PushManager' in window))return;
    const reg=await navigator.serviceWorker.ready;
    const sub=await reg.pushManager.getSubscription();
    if(sub && Notification.permission==='granted' && await currentSession())await saveSubscription(sub);
    refreshStatus();
  }catch(e){console.warn('Push rebind',e)}
}
async function disablePush(){
  try{
    const reg=await navigator.serviceWorker.ready;
    const sub=await reg.pushManager.getSubscription();
    if(sub){
      if(typeof cloudClient!=='undefined'&&cloudClient)await cloudClient.from('icc_push_subscriptions').update({enabled:false,updated_at:new Date().toISOString()}).eq('endpoint',sub.endpoint);
      await sub.unsubscribe();
    }
    setStatus('Notifications désactivées.',false);
  }catch(e){console.warn(e)}
}
async function refreshStatus(){
  try{
    if(!('serviceWorker' in navigator)||!('PushManager' in window)){setStatus('Notifications non disponibles sur cet appareil.',false);return}
    const reg=await navigator.serviceWorker.ready,sub=await reg.pushManager.getSubscription();
    setStatus(sub&&Notification.permission==='granted'
      ?(currentMemberId()?'Notifications téléphone activées ✅':'Notifications activées — profil à relier.')
      :'Notifications téléphone non activées.',!!sub);
  }catch(e){}
}
function installUI(){
  const page=document.getElementById('page-settings');
  if(!page||document.getElementById('v71-push-card'))return;
  const content=document.getElementById('settings-content')||page;
  const card=document.createElement('div');card.id='v71-push-card';card.className='bg-white rounded-2xl border shadow-sm p-5';
  card.innerHTML=`<div class="flex flex-wrap justify-between items-start gap-3"><div><h3 class="font-black text-iccViolet">🔔 Notifications téléphone</h3><p class="text-xs text-slate-500 mt-1">Notifications système même lorsque COM Le Mans est fermée.</p></div><div class="flex gap-2 flex-wrap"><button type="button" onclick="v71EnablePush()" class="bg-iccYellow text-slate-900 text-xs font-black px-4 py-2 rounded-lg">Activer</button><button type="button" onclick="v71DisablePush()" class="bg-white border text-xs font-bold px-4 py-2 rounded-lg">Désactiver</button></div></div><div id="v71-push-status" class="text-[11px] mt-2 text-slate-500"></div>`;
  content.prepend(card);pushStatusEl=document.getElementById('v71-push-status');refreshStatus();
}
window.v71EnablePush=enablePush;window.v71DisablePush=disablePush;window.v77RefreshPushBinding=rebind77;

async function sendPushEvent(kind,payload={}){
  try{
    const session=await currentSession();
    if(!session||typeof cloudClient==='undefined'||!cloudClient)return;
    const {error}=await cloudClient.functions.invoke('send-push',{body:{kind,payload}});
    if(error)console.warn('Push event',kind,error);
  }catch(e){console.warn('Push event',kind,e)}
}
window.v71SendPushEvent=sendPushEvent;

/* Les sauvegardes V77 sont finales ; on accroche les événements après chargement. */
document.addEventListener('DOMContentLoaded',()=>{
  setTimeout(installUI,400);
  setTimeout(rebind77,1200);
});
window.addEventListener('load',()=>{setTimeout(installUI,800);setTimeout(rebind77,1600)});
})();
