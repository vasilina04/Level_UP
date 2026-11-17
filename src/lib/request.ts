export function acceptsOrigin(request:Request) {
  const scheme=process.env.NODE_ENV==="production"&&process.env.AUTH_LOCAL_HTTP!=="1"?"https":"http";
  const expected=process.env.AUTH_URL?new URL(process.env.AUTH_URL).origin:`${scheme}://${request.headers.get("host")}`;
  return request.headers.get("origin")===expected;
}

export async function readBoundedText(request:Request,limit:number) {
  if(Number(request.headers.get("content-length"))>limit) return null;
  if(!request.body) return "";
  const reader=request.body.getReader(),decoder=new TextDecoder();
  let size=0,body="";
  try {
    for(;;) {
      const {done,value}=await reader.read();
      if(done) return body+decoder.decode();
      size+=value.byteLength;
      if(size>limit) {
        await reader.cancel().catch(()=>undefined);
        return null;
      }
      body+=decoder.decode(value,{stream:true});
    }
  } finally {reader.releaseLock();}
}
