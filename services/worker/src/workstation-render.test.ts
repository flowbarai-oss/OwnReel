import { describe,it,expect } from "vitest";
import { workstationSchema, validateWorkstationReferences } from "@flowbar/gen-contracts";
import { workstationGraph } from "./workstation-render.js";
const asset="11111111-1111-4111-8111-111111111111";
const clip={id:"22222222-2222-4222-8222-222222222222",sourceAssetId:asset,track:"video",start:1000,in:1000,out:5000,speed:2,volume:.5,muted:false,fit:"contain",text:"",scale:1,x:50,y:50,transition:"fade"};
const manifest=()=>workstationSchema.parse({version:1,aspectRatio:"16:9",resolution:"720p",clips:[clip]});
const media={path:"/tmp/owned.mp4",directory:"/tmp",contentType:"video/mp4",extension:".mp4",byteSize:100,sha256:"hash",width:1920,height:1080,durationMs:10000,hasAudio:true};
describe("workstation rendering",()=>{
  it("renders saved caption coordinates while preserving unmoved legacy captions",()=>{
    const t=manifest(); t.clips[0].track="caption"; t.clips[0].text="Caption";
    expect(workstationGraph(t,[{id:asset,media}],"/tmp").texts[0].text).toContain("\\an8\\pos(640,590.4)");
    t.clips[0].captionX=25; t.clips[0].captionY=30;
    expect(workstationGraph(t,[{id:asset,media}],"/tmp").texts[0].text).toContain("\\an5\\pos(320,216)");
    for(const patch of [{captionX:-1},{captionY:101},{captionX:"movie=/etc/passwd"},{track:"video"},{captionY:undefined}])
      expect(()=>workstationSchema.parse({...t,clips:[{...t.clips[0],...patch}]})).toThrow();
  });
  it("renders trims and speed with aligned audio, a finite duration and fade",()=>{
    const result=workstationGraph(manifest(),[{id:asset,media}],"/tmp/job");
    expect(result.seconds).toBe(3);expect(result.graph).toContain("trim=start=1:end=5");expect(result.graph).toContain("atempo=2");expect(result.graph).toContain("adelay=1000:all=1");expect(result.graph).toContain("fade=t=in");
  });
  it("refuses missing or out of bounds sources",()=>{
    expect(()=>workstationGraph(manifest(),[],"/tmp")).toThrow("workstation_source_missing");
    expect(()=>workstationGraph(manifest(),[{id:asset,media:{...media,durationMs:2000}}],"/tmp")).toThrow("workstation_trim_out_of_bounds");
  });
  it("stores captions as text files, never interpolating caption contents into filters",()=>{
    const t=manifest();t.clips[0].track="caption";t.clips[0].text="a'; movie=/etc/passwd [bad]";
    const result=workstationGraph(t,[{id:asset,media}],"/tmp");expect(result.graph).not.toContain("/etc/passwd");expect(result.texts[0].text).toContain("/etc/passwd");expect(result.graph).toContain("ass=filename=");
  });
  it("rejects assets outside the priced request before reservation",()=>{
    expect(()=>validateWorkstationReferences(manifest(),[],"smart-cut")).toThrow("timeline_invalid");
    expect(()=>validateWorkstationReferences(manifest(),[asset],"text-to-video")).toThrow("timeline_invalid");
  });
  it("rejects excessive duration and unimplemented resolutions",()=>{
    expect(()=>workstationSchema.parse({...manifest(),resolution:"2160p"})).toThrow();
    expect(()=>workstationSchema.parse({...manifest(),clips:[{...clip,out:700000}]})).toThrow();
  });
  it("renders a blurred, darkened 9:16 canvas at portrait 1080p",()=>{
    const portrait=workstationSchema.parse({version:1,aspectRatio:"9:16",resolution:"1080p",clips:[{...clip,transition:"cut",canvasBackground:"blur",canvasBackgroundDarkening:.25}]});
    const result=workstationGraph(portrait,[{id:asset,media}],"/tmp/job");
    expect([result.width,result.height]).toEqual([1080,1920]);
    expect(result.graph).toContain("boxblur=luma_radius=24:luma_power=1");
    expect(result.graph).toContain("eq=brightness=-0.25");
    expect(result.graph).toContain("overlay=(W-w)/2:(H-h)/2");
    expect(result.graph).toContain("[base0][v0]overlay=x=0:y=0");
  });
  it("applies canvas composition before transitions",()=>{
    const second={...clip,id:"33333333-3333-4333-8333-333333333333",start:2500,in:0,out:4000,speed:1,transition:"dissolve" as const,transitionDuration:500,canvasBackground:"blur" as const};
    const first={...clip,start:0,in:0,out:3000,speed:1,transition:"cut" as const,canvasBackground:"blur" as const};
    const result=workstationGraph(workstationSchema.parse({version:1,aspectRatio:"9:16",resolution:"1080p",clips:[first,second]}),[{id:asset,media}],"/tmp/job");
    expect((result.graph.match(/boxblur=/g) || [])).toHaveLength(2);
    expect(result.graph.indexOf("boxblur=")).toBeLessThan(result.graph.indexOf("xfade=transition=dissolve"));
  });
  it("keeps the default 16:9 graph byte-for-byte when canvas fields are absent",()=>{
    const legacy=workstationGraph(manifest(),[{id:asset,media}],"/tmp/job");
    const explicit=workstationGraph(workstationSchema.parse({...manifest(),clips:[{...clip,canvasBackground:"black",canvasBackgroundDarkening:0}]}),[{id:asset,media}],"/tmp/job");
    expect(explicit.graph).toBe(legacy.graph);
  });
  it("rejects untrusted canvas background values",()=>{
    for(const patch of [{canvasBackground:"movie=/etc/passwd"},{canvasBackgroundDarkening:-.1},{canvasBackgroundDarkening:.61}])
      expect(()=>workstationSchema.parse({...manifest(),clips:[{...clip,...patch}]})).toThrow();
    expect(()=>workstationSchema.parse({...manifest(),clips:[{...clip,track:"overlay",canvasBackground:"blur"}]})).toThrow();
  });
  it("renders a small static PNG overlay at its position for the clip duration",()=>{
    const sticker={...clip,track:"overlay" as const,start:0,in:0,out:3000,speed:1,scale:.3,x:25,y:75,transition:"cut" as const};
    const png={...media,path:"/tmp/sticker.png",contentType:"image/png",extension:".png",width:100,height:100,durationMs:null,hasAudio:false};
    const result=workstationGraph(workstationSchema.parse({version:1,aspectRatio:"16:9",resolution:"720p",clips:[sticker]}),[{id:asset,media:png}],"/tmp/job");
    expect(result.seconds).toBe(3);
    expect(result.graph).toContain("scale=216:216");
    expect(result.graph).toContain("overlay=x=266:y=378");
    expect(result.graph).toContain("enable='between(t,0,3)'");
  });
  it("keeps explicit normal blend byte-identical and bounds screen blend to the overlay interval",()=>{
    const sticker={...clip,track:"overlay" as const,start:0,in:0,out:3000,speed:1,scale:.3,x:25,y:75,transition:"cut" as const};
    const png={...media,path:"/tmp/sticker.png",contentType:"image/png",extension:".png",width:100,height:100,durationMs:null,hasAudio:false};
    const absent=workstationGraph(workstationSchema.parse({version:1,aspectRatio:"16:9",resolution:"720p",clips:[sticker]}),[{id:asset,media:png}],"/tmp/job");
    const normal=workstationGraph(workstationSchema.parse({version:1,aspectRatio:"16:9",resolution:"720p",clips:[{...sticker,blendMode:"normal"}]}),[{id:asset,media:png}],"/tmp/job");
    expect(normal.graph).toBe(absent.graph);
    const screen=workstationGraph(workstationSchema.parse({version:1,aspectRatio:"16:9",resolution:"720p",clips:[{...sticker,blendMode:"screen"}]}),[{id:asset,media:png}],"/tmp/job");
    expect(screen.graph).toContain("format=rgba,crop=216:216:0:0,pad=1280:720:266:378:black@0,fps=30,settb=AVTB");
    expect(screen.graph).toContain("blend=all_mode=screen:all_opacity=1");
    expect(screen.graph).toContain("enable='between(t,0,3)'");
  });
  it("applies an effect and xfade before one synchronized group blend",()=>{
    const first={...clip,track:"overlay" as const,start:0,in:0,out:3000,speed:1,transition:"cut" as const,blendMode:"screen" as const,effectPreset:"bloom" as const};
    const second={...first,id:"33333333-3333-4333-8333-333333333333",start:2500,transition:"dissolve" as const,transitionDuration:500};
    const result=workstationGraph(workstationSchema.parse({version:1,aspectRatio:"16:9",resolution:"720p",clips:[first,second]}),[{id:asset,media}],"/tmp/job");
    expect(result.graph.indexOf("gblur=sigma=8")).toBeLessThan(result.graph.indexOf("xfade=transition=dissolve"));
    expect(result.graph.indexOf("xfade=transition=dissolve")).toBeLessThan(result.graph.indexOf("[blend_base0_a][blend_base0_fg_rgb]blend=all_mode=screen"));
    expect(result.graph).toContain("[blend_base0_a][blend_base0_fg_rgb]blend=all_mode=screen");
  });
});
