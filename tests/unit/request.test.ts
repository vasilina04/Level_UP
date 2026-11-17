import { expect,it } from "vitest";
import { readBoundedText } from "../../src/lib/request";

function streamed(chunks:Uint8Array[]) {
  const body=new ReadableStream<Uint8Array>({start(controller){chunks.forEach(chunk=>controller.enqueue(chunk));controller.close();}});
  const init:RequestInit&{duplex:"half"}={method:"POST",body,duplex:"half"};
  return new Request("http://localhost/",init);
}

it("bounds streamed bodies by bytes even without a content length",async()=>{
  const bytes=new TextEncoder().encode("абв");
  const chunks=[bytes.slice(0,3),bytes.slice(3)];
  expect(await readBoundedText(streamed(chunks),6)).toBe("абв");
  expect(await readBoundedText(streamed(chunks),5)).toBeNull();
});

it("rejects a declared length above the limit before parsing",async()=>{
  const request=new Request("http://localhost/",{method:"POST",headers:{"Content-Length":"9"},body:"x"});
  expect(await readBoundedText(request,8)).toBeNull();
});
