"use client";
import { useEffect,useState,useRef,type FormEvent,type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
export function PlanningForm({operation,fields,children,label,secondary=false,build}:{
  operation:string,fields?:Record<string,string|number>,children?:ReactNode,label:string,secondary?:boolean,
  build?:(fields:FormData)=>Record<string,unknown>,
}) {
  const router=useRouter();
  const [ready,setReady]=useState(false);
  const [pending,setPending]=useState(false);
  const [feedback,setFeedback]=useState<{message:string,ok:boolean}|null>(null);
  const sending=useRef(false);
  useEffect(()=>setReady(true),[]);
  async function send(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(sending.current) return;
    const submitter=(event.nativeEvent as SubmitEvent).submitter;
    const data=new FormData(event.currentTarget,submitter);
    sending.current=true;
    setPending(true);
    setFeedback(null);
    try {
      const payload=build?build(data):Object.fromEntries(data);
      const response=await fetch("/api/academic-planning",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...payload,...fields,operation})});
      const result=await response.json();
      setFeedback({message:result.message,ok:response.ok});
      if(response.ok){
        if(result.href) router.push(result.href);
        router.refresh();
      }
    }catch(error){
      setFeedback({ok:false,message:error instanceof Error&&error.message.startsWith("Укажите")?error.message:"Не удалось сохранить. Проверьте подключение."});
    }finally{sending.current=false;setPending(false);}
  }
  return <form className="stack planning-form" method="post" onSubmit={send} aria-busy={pending}><fieldset className="stack planning-controls" disabled={!ready||pending}>
    {children}
    {label&&<Button type="submit" disabled={pending} variant={secondary?"secondary":"primary"}>{pending?"Сохраняем…":label}</Button>}
    </fieldset>
    {feedback&&<p className={"form-feedback "+(feedback.ok?"success":"error")} role={feedback.ok?"status":"alert"}>{feedback.message}</p>}
  </form>;
}
