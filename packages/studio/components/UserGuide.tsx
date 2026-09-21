'use client';
import {useI18n} from '@/lib/i18n';
export function GuideLink(_props:{topic:string;compact?:boolean}){
 const {locale}=useI18n();return <details className="community-editor-help"><summary>{locale==='en'?'Quick guide':'使用说明'}</summary><p>{locale==='en'?'Add media from the library or upload it. Select a clip to trim, split, adjust text, volume or transitions. Changes are saved automatically; Undo / Redo preserve your original assets. Export renders a real MP4 locally.':'从素材库添加素材或上传文件。选择片段以裁剪、拆分、调整文字、音量与转场。修改自动保存，可撤销和重做，原素材不会改变。导出在本地渲染真实 MP4。'}</p></details>;
}
