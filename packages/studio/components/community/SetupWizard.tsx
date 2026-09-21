'use client';
import {useState} from 'react';
import {api,readableError} from '@/lib/api';
import {useI18n} from '@/lib/i18n';
export function SetupWizard({initialized,onLogin}:{initialized:boolean;onLogin:()=>void}){
 const {locale}=useI18n(),en=locale==='en',say=(a:string,b:string)=>en?a:b;
 const [name,setName]=useState(''),[password,setPassword]=useState(''),[token,setToken]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[visible,setVisible]=useState(false);
 return <section className="setup-grid"><div className="intro"><span className="eyebrow">FLOWBARAI GEN · COMMUNITY</span><h1>{say('Make your first movie','从灵感，到成片。')}</h1><p>{say('Your ideas. Your assets. Your studio.','你的灵感、素材与独立创作工作室。')}</p><div className="feature-list"><article><b>{say('Integrated creation','一体化创作')}</b><p>{say('Generate, edit, voice and export in one project.','生成、剪辑、配音和导出，在一个项目完成。')}</p></article><article><b>{say('Smart movie','智能成片')}</b><p>{say('Turn a brief into editable scenes and a finished film.','把创意变成可编辑分镜，再制作完整影片。')}</p></article></div><small>{say('No cloud account required. Upload your own media to start without an API key. AI features are billed by your provider.','无需云端账户。上传自己的素材即可无密钥制作。AI 功能由你的供应商计费。')}</small></div><form className="panel setup-form" onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{if(!initialized)await api('/api/community/setup',{method:'POST',body:JSON.stringify({name,password,token})});await api('/api/community/login',{method:'POST',body:JSON.stringify({name,password})});setPassword('');setToken('');onLogin();}catch(err){setError(readableError(err,locale));}finally{setBusy(false);}}}>
 <h2>{initialized?say('Welcome back','欢迎回来'):say('Create your local studio','创建本地工作室')}</h2>
 {!initialized&&<label>{say('Setup token','初始化令牌')}<input aria-label="Setup token" type="password" required value={token} onChange={e=>setToken(e.target.value)} autoComplete="off"/><small>{say('Read data/bootstrap-token on the host. The token expires after 30 minutes.','在主机读取 data/bootstrap-token，令牌 30 分钟后过期。')}</small></label>}
 <label>{say('Username','用户名')}<input aria-label="Username" autoComplete="username" minLength={3} required value={name} onChange={e=>setName(e.target.value)}/></label>
 <label>{say('Password','密码')}<div className="inline"><input aria-label="Password" type={visible?'text':'password'} autoComplete={initialized?'current-password':'new-password'} minLength={initialized?1:12} required value={password} onChange={e=>setPassword(e.target.value)}/><button type="button" onClick={()=>setVisible(!visible)} aria-pressed={visible}>{visible?say('Hide','隐藏'):say('Show','显示')}</button></div></label>
 {error&&<p role="alert" className="error">{error}</p>}
 <button className="primary" disabled={busy}>{busy?say('Please wait…','请稍候…'):initialized?say('Sign in','登录'):say('Create local account','创建本地账户')}</button>
 </form></section>;
}
