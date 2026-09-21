'use client';
import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
export type Locale='en'|'zh-CN';
const Context=createContext({locale:'en' as Locale,setLocale:(_locale:Locale)=>{}});
export function I18nProvider({children}:{children:ReactNode}){
 const [locale,setLocale]=useState<Locale>('en');
 useEffect(()=>{const saved=localStorage.getItem('community-language');if(saved==='zh-CN'){setLocale(saved);document.documentElement.lang=saved;}},[]);
 const change=(next:Locale)=>{setLocale(next);localStorage.setItem('community-language',next);document.documentElement.lang=next;};
 return <Context.Provider value={{locale,setLocale:change}}>{children}</Context.Provider>;
}
export const useI18n=()=>useContext(Context);
