'use client';
import {useState} from 'react';
import {api,type Project} from '@/lib/api';
import {useI18n} from '@/lib/i18n';
export function ProjectActions({project,onAction}:{project:Project;onAction:(action:()=>Promise<unknown>)=>Promise<void>}){
 const {locale}=useI18n(),en=locale==='en';const [editing,setEditing]=useState(false),[name,setName]=useState(project.name);
 return <div className="stack">{editing&&<label>{en?'New name':'新名称'}<input value={name} maxLength={160} onChange={e=>setName(e.target.value)}/></label>}<div className="row">
 <button onClick={()=>{if(!editing){setEditing(true);return;}void onAction(async()=>{await api(`/api/v1/projects/${project.id}`,{method:'PATCH',body:JSON.stringify({name,revision:project.revision})});setEditing(false);});}}>{editing?(en?'Save name':'保存名称'):(en?'Rename':'重命名')}</button>
 <button onClick={()=>void onAction(()=>api(`/api/v1/projects/${project.id}/duplicate`,{method:'POST'}))}>{en?'Duplicate':'复制'}</button>
 <button onClick={()=>{if(window.confirm(en?'Delete this project and its storyboard? Your media assets will be kept.':'删除此项目及其分镜？素材资产会保留。'))void onAction(()=>api(`/api/v1/projects/${project.id}`,{method:'DELETE'}));}}>{en?'Delete project':'删除项目'}</button>
 </div></div>;
}
