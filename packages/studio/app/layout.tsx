import type {ReactNode} from 'react';
import {I18nProvider} from '@/lib/i18n';
import './globals.css';
export const metadata={title:'OwnReel',description:'Independent integrated creation and smart movie studio.'};
export default function Layout({children}:{children:ReactNode}){return <html lang="en"><body><I18nProvider>{children}</I18nProvider></body></html>;}
