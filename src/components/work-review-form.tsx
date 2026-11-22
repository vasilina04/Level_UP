"use client";
import { useEffect,useState,type FormEvent } from "react";
import { Button } from "@/components/ui/button";

export function WorkReviewForm({assessmentId,submissionId,max}:{assessmentId:string;submissionId?:string;max?:number}) {
  const [ready,setReady]=useState(false),[pending,setPending]=useState(false),[error,setError]=useState("");
  const [decision,setDecision]=useState("REVISION");
  useEffect(()=>setReady(true),[]);
  async function save(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(pending) return;
    const form=new FormData(event.currentTarget);
    const data=submissionId?{operation:"review",assessmentId,id:submissionId,decision,comment:form.get("comment"),
      ...(decision==="APPROVED"?{points:Number(form.get("points")),grade:Number(form.get("grade"))}:{})}:{operation:"start",assessmentId};
    setPending(true);setError("");
    try {
      const response=await fetch("/api/checkpoint-work",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});
      if(!response.ok) {setError((await response.json()).message);return;}
      window.location.reload();
    } catch {setError("Не удалось сохранить. Проверьте подключение и повторите попытку.");}
    finally {setPending(false);}
  }
  return <form className="stack" method="post" onSubmit={save}>
    {submissionId&&<><label>Решение по работе<select value={decision} onChange={event=>setDecision(event.target.value)}>
      <option value="REVISION">Вернуть на доработку</option>{max!==undefined&&<option value="APPROVED">Принять работу</option>}</select></label>
      <label>Замечания преподавателя<textarea name="comment" rows={3} minLength={decision==="REVISION"?3:0} required={decision==="REVISION"} maxLength={2000}/></label>
      {decision==="APPROVED"&&<div className="request-contacts"><label>Баллы за работу<input name="points" type="number" min={0} max={max} step={1} required/></label>
        <label>Оценка за работу<select name="grade" required defaultValue=""><option value="" disabled>Выберите оценку</option>{[2,3,4,5].map(grade=><option key={grade}>{grade}</option>)}</select></label></div>}
      {max===undefined&&<p className="muted">Для приёма работы сначала опубликуйте в плане дисциплины связанное мероприятие с максимальным баллом.</p>}</>}
    <Button type="submit" disabled={!ready||pending}>{pending?"Сохраняем…":submissionId?"Сохранить решение":"Начать работу"}</Button>
    {error&&<p role="alert" className="form-feedback error">{error}</p>}
  </form>;
}
