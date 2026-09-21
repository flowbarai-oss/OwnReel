'use client';
import {useEffect,useState} from 'react';
import {api,ApiError,readableError} from '@/lib/api';
import {useI18n} from '@/lib/i18n';
import {SetupWizard} from './SetupWizard';
import {Workspace} from './Workspace';
export function CommunityApp(){
 const {locale,setLocale}=useI18n();const [initialized,setInitialized]=useState<boolean|null>(null),[signedIn,setSignedIn]=useState(false),[error,setError]=useState('');
 const load=async()=>{setError('');try{const status=await api<{initialized:boolean}>('/api/community/status');setInitialized(status.initialized);try{await api('/api/community/me');setSignedIn(true);}catch(e){if(e instanceof ApiError&&e.status===401)setSignedIn(false);else throw e;}}catch(e){setError(readableError(e,locale));}};
 useEffect(()=>{void load();},[]);
 return <><header className="topbar"><strong>FlowBarAI <span>OwnReel</span></strong><button onClick={()=>setLocale(locale==='en'?'zh-CN':'en')}>{locale==='en'?'中文':'English'}</button></header>{error?<main><p role="alert">{error}</p><button onClick={()=>void load()}>{locale==='en'?'Retry connection':'重新连接'}</button></main>:initialized===null?<main>Loading…</main>:!signedIn?<SetupWizard initialized={initialized} onLogin={()=>void load()}/>:<Workspace onLogout={()=>setSignedIn(false)}/>}</>;
}
