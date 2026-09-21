'use client';
import {useEffect,useRef,type ReactNode} from 'react';
export function Modal({label,onClose,children}:{label:string;onClose:()=>void;children:ReactNode}){
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const node=dialog.current;const previous=document.activeElement as HTMLElement|null;node?.showModal();return()=>{node?.close();previous?.focus();};},[]);
 return <dialog ref={dialog} className="modal" aria-label={label} onCancel={e=>{e.preventDefault();onClose();}}>{children}</dialog>;
}
