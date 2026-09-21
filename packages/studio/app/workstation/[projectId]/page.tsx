import {VideoWorkstation} from '@/components/VideoWorkstation';
export default async function Page({params}:{params:Promise<{projectId:string}>}){const {projectId}=await params;return <VideoWorkstation projectId={projectId}/>;}
