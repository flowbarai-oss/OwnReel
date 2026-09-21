/** Community media contract. Network downloading is handled by the scoped provider adapter. */
export interface MediaFile {
 hasAudio?:boolean;path:string;directory:string;contentType:string;extension:string;
 byteSize:number;sha256:string;width?:number;height?:number;durationMs?:number|null;
}
