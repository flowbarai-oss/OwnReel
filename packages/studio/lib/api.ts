export class ApiError extends Error {constructor(readonly code:string,readonly status:number){super(code);}}
export async function api<T>(path:string,init:RequestInit={}):Promise<T>{
 const headers=new Headers(init.headers);if(init.body&&!(init.body instanceof FormData))headers.set('Content-Type','application/json');
 const response=await fetch(path,{...init,headers,credentials:'same-origin',cache:'no-store'});const payload=await response.json();
 if(!response.ok||payload.success===false)throw new ApiError(payload.code??`http_${response.status}`,response.status);return payload.data as T;
}
const errors:Record<string,[string,string]>={
 rate_limited:['Too many requests. Wait a minute and retry; your work is saved.','请求过于频繁，请等一分钟重试，已保存内容不会丢失。'],
 authentication_required:['Please sign in to your local account.','请登录本地账户。'],
 invalid_credentials:['Username or password is incorrect.','用户名或密码不正确。'],
 invalid_setup:['Use a username of 3–80 characters and a password of at least 12 characters.','用户名需为 3–80 个字符，密码至少 12 个字符。'],
 setup_token_invalid_or_expired:['The setup token is invalid or expired. Restart the API to issue a new token.','初始化令牌无效或过期，请重启 API 生成新令牌。'],
 configure_provider:['Add your fal API key in Settings, or upload your own media.','请在设置添加 fal API 密钥，或上传自己的素材。'],
 confirm_provider_cost:['Confirm provider billing before generating. Final charges are set by fal.','生成前请确认供应商计费，最终费用以 fal 账单为准。'],
 timeline_conflict:['This project was changed in another tab. Preserve your draft and reload.','项目已在其他标签页修改，请保留草稿后刷新。'],
 revision_conflict:['This project has a newer version. Reload before saving.','项目已有新版本，请刷新后保存。'],
 asset_in_use:['This asset is used by a project or active task. Remove references or finish the task first.','素材被项目或进行中的任务引用，请先移除引用或等待任务结束。'],
 insufficient_disk_space:['At least 1 GB of free storage is required before rendering.','渲染前需要至少 1 GB 可用空间。'],
 submission_unknown_check_provider_history:['Submission outcome is unknown. Check fal request history; do not blindly generate again.','提交结果未知，请核对 fal 请求记录，不要直接重复生成。'],
 provider_failed:['The provider rejected or failed this request. Review the prompt and provider history before a new attempt.','供应商拒绝或生成失败，请核对提示词和供应商记录后再重试。'],
 provider_http_401:['The provider key is invalid. Update it in Settings.','供应商密钥无效，请在设置更新。'],
 provider_http_402:['Your fal account needs sufficient balance. Check billing at fal.ai, then retry only this failed request.','fal 账户余额不足，请在 fal.ai 核对并充值，再仅重试该失败请求。'],
 provider_http_403:['Your fal key cannot access this model. Check key permissions at fal.ai or replace it in Settings.','fal 密钥没有该模型权限，请在 fal.ai 检查权限或到设置更换密钥。'],
 provider_http_422:['The provider does not accept these settings. Check the supported model, resolution and input before retrying.','供应商不接受这些参数，请检查模型支持的分辨率和输入后重试。'],
 invalid_input:['Check the required fields and supported media settings.','请检查必填内容及模型支持的规格。'],
 image_reference_required:['Choose an image from your assets for image-to-video.','图生视频需要从资产库选择一张图片。'],
 unsupported_media:['Use a PNG/JPEG/WebP image, MP4/WebM video, or MP3/WAV audio.','请使用 PNG/JPEG/WebP 图片、MP4/WebM 视频或 MP3/WAV 音频。'],
};
export function readableError(error:unknown,locale='en'){const code=error instanceof Error?error.message:'operation_failed';return errors[code]?.[locale==='en'?0:1]??(locale==='en'?`Request could not finish (${code}). Your saved work is retained.`:`操作未完成（${code}），已保存的内容会保留。`);}
export interface Asset {id:string;kind:'image'|'video'|'audio';content_type:string;byte_size:number;width?:number;height?:number;duration_ms?:number;hasAudio?:boolean;created_at:string;tags?:string[];signedUrl:string;thumbnailUrl?:string;metadata?:Record<string,unknown>}
export interface AssetPage {items:Asset[];total:number;nextOffset:number|null}
export interface Shot {id:string;prompt:string;narration:string;caption:string;durationMs:number;assetId?:string;voiceAssetId?:string}
export interface Storyboard {title:string;shots:Shot[];aspectRatio?:'16:9'|'9:16';resolution?:'720p'|'1080p';template?:'product'|'feature'|'social'}
export interface Project {id:string;name:string;revision:number;created_at:string;updated_at:string;storyboard?:Storyboard|null;assets?:Asset[]}
export interface Job {id:string;kind:string;state:string;input:Record<string,unknown>;result?:{assetId?:string;storyboard?:Storyboard;error?:string};created_at:string;updated_at:string;providerRequestId?:string}
