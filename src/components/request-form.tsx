"use client";
import { useEffect, useState, type FormEvent } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { documentDelivery, documentTypes } from "@/lib/rules";
type Delivery=keyof typeof documentDelivery;
export function RequestFields({id,type,recipient,details,student,initialDelivery,email,phone,address}:{
  id:string,type:keyof typeof documentTypes,recipient?:string,details?:string,
  student:{name:string,year:number,program:string},initialDelivery?:Delivery,email?:string,phone?:string,address?:string,
}) {
  const [pending,setPending]=useState(false);
  const [ready,setReady]=useState(false);
  const [error,setError]=useState("");
  const [delivery,setDelivery]=useState<Delivery>(initialDelivery??"EMAIL");
  useEffect(()=>setReady(true),[]);
  async function save(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(pending) return;
    const submitter=(event.nativeEvent as SubmitEvent).submitter;
    const data=new FormData(event.currentTarget);
    data.set("intent",submitter?.getAttribute("value")||"submit");
    const body=new URLSearchParams();
    for(const [key,value] of data) if(typeof value==="string") body.set(key,value);
    setError("");
    setPending(true);
    try {
      const response=await fetch("/api/documents",{method:"POST",body});
      const result=await response.json();
      if(!response.ok) {
        setError(result.message);
        return;
      }
      window.location.assign(result.href);
    } catch {
      setError("Не удалось сохранить заявку. Проверьте подключение и повторите попытку.");
    } finally {
      setPending(false);
    }
  }
  return <form method="post" className="stack" onSubmit={save}>
    <input type="hidden" name="id" value={id}/>
    <label>Тип документа<select name="type" defaultValue={type}>{Object.entries(documentTypes).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
    <label>Адресат<input name="recipient" placeholder="Например, по месту требования" maxLength={150} minLength={2} required defaultValue={recipient}/></label>
    <label>Цель обращения<textarea name="details" rows={4} placeholder="Опишите, для чего нужен документ" maxLength={1500} minLength={5} required defaultValue={details}/></label>
    <label>Способ получения<select name="delivery" value={delivery} onChange={event=>setDelivery(event.target.value as Delivery)}>{Object.entries(documentDelivery).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
    <fieldset className="request-review">
      <legend>Проверка данных</legend>
      <dl className="definition"><dt>ФИО</dt><dd>{student.name}</dd><dt>Курс</dt><dd>{student.year}</dd><dt>Направление</dt><dd>{student.program}</dd></dl>
      <h3>Контактные данные</h3>
      <div className="request-contacts">
        <label>Электронная почта<input name="contactEmail" type="email" autoComplete="email" maxLength={254} required={delivery==="EMAIL"} defaultValue={email}/></label>
        <label>Телефон<input name="contactPhone" type="tel" autoComplete="tel" maxLength={32} defaultValue={phone}/></label>
      </div>
      <p className="muted">Укажите электронную почту или телефон для связи по заявке.</p>
      {delivery==="POSTAL"&&<label>Почтовый адрес<textarea name="postalAddress" autoComplete="street-address" rows={2} maxLength={400} minLength={10} required placeholder="Индекс, город, улица, дом, квартира" defaultValue={address}/></label>}
      <label className="checkbox"><input name="confirmed" type="checkbox" value="yes" required/>Подтверждаю, что проверил(а) данные</label>
    </fieldset>
    <div className="form-buttons">
      <Button type="submit" value="submit" disabled={!ready||pending}>{pending&&<LoaderCircle size={17} className="spin"/>}Отправить заявку</Button>
      <Button type="submit" value="draft" variant="secondary" formNoValidate disabled={!ready||pending}>Сохранить черновик</Button>
    </div>
    {error&&<p className="form-feedback error" role="alert">{error}</p>}
  </form>;
}
