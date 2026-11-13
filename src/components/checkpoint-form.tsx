"use client";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
export function CheckpointForm({assessmentId,messageId,teacher}:{assessmentId:string,messageId:string,teacher:boolean}){
  const [ready,setReady]=useState(false);
  const [pending,setPending]=useState(false);
  const [error,setError]=useState("");
  useEffect(()=>setReady(true),[]);
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    const form=new FormData(event.currentTarget);
    setError("");
    setPending(true);
    try{
      const response=await fetch("/api/checkpoint-messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:messageId,assessmentId,body:form.get("body")})});
      if(!response.ok){
        setError((await response.json()).message);
        return;
      }
      window.location.reload();
    }catch{
      setError("Проверьте подключение и повторите отправку.");
    }finally{
      setPending(false);
    }
  }
  return <form method="post" className="stack" onSubmit={submit}>
    <label>{teacher?"Ответ преподавателя":"Вопрос преподавателю"}<textarea name="body" required minLength={3} maxLength={2000} rows={4}/></label>
    <Button type="submit" disabled={!ready||pending}>{pending?"Отправляем…":teacher?"Отправить ответ":"Отправить вопрос"}</Button>
    {error&&<p className="form-feedback error" role="alert">{error}</p>}
  </form>;
}
