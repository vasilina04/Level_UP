"use client";
import { useState } from "react";
import type { Activity,Plan } from "@/lib/course-data";
import { activityKinds } from "@/lib/course-ui-data";
import { PlanningForm } from "@/components/planning-form";
import { Button } from "@/components/ui/button";
const initialActivity=(id:string,date:string):Activity=>({id,title:"",kind:"CONTROL",startsAt:date,place:"",format:"Очно",description:"",topics:"",requirements:"",max:20,weight:1,optional:false,registration:false,materials:""});
export function CoursePlanEditor({subjectId,revision,plan,localDates,defaultDate,checkpoints}:{
  subjectId:string,revision:number,plan:Plan,localDates:Record<string,string>,defaultDate:string,checkpoints:string[],
}) {
  const [rows,setRows]=useState(plan.activities);
  const [hasRules,setHasRules]=useState(Boolean(plan.rule));
  function build(data:FormData){
    const intent=data.get("intent")??"draft";
    const value=(name:string)=>String(data.get(name)??"");
    const activities=rows.map(row=>{
      const field=(name:string)=>value(row.id+":"+name);
      const start=field("startsAt");
      return {id:row.id,title:field("title"),kind:field("kind"),startsAt:start,place:field("place"),format:field("format"),
        description:field("description"),topics:field("topics"),requirements:field("requirements"),max:field("max"),weight:field("weight"),
        optional:field("optional")==="on",registration:field("optional")==="on"&&field("registration")==="on",materials:field("materials"),checkpointTitle:field("checkpointTitle")||undefined,examId:row.examId};
    });
    const rule=hasRules?Object.fromEntries(["cap","bonus","rounding","pass","good","excellent"].map(name=>[name,value(name)])):null;
    return {intent,reason:value("reason"),plan:{title:value("title"),period:value("period"),rule,activities}};
  }
  return <PlanningForm operation="savePlan" fields={{subjectId,revision}} label="" build={build}>
    <div className="card stack"><h2>План курса</h2>
      <label>Название<input name="title" defaultValue={plan.title} required maxLength={120}/></label>
      <label>Учебный период<input name="period" defaultValue={plan.period} placeholder="Осенний семестр 2026" required maxLength={120}/></label>
      <label className="checkbox"><input type="checkbox" checked={hasRules} onChange={event=>setHasRules(event.target.checked)}/> Публиковать правила рейтинга</label>
      {hasRules&&<div className="dashboard-grid">{([["cap","Максимальный рейтинг",100],["bonus","Дополнительные баллы, до",10],["pass","Порог оценки 3",50],["good","Порог оценки 4",70],["excellent","Порог оценки 5",85]] as const).map(([name,label,defaultValue])=><label key={name}>{label}<input name={name} type="number" required min={name==="cap"?1:0} max={10000} defaultValue={plan.rule?.[name]??defaultValue}/></label>)}
        <label>Округление<select name="rounding" defaultValue={plan.rule?.rounding??"NEAREST"}><option value="NONE">До сотых</option><option value="FLOOR">Вниз до целого</option><option value="NEAREST">До ближайшего целого</option></select></label></div>}
    </div>
    {rows.map((row,index)=><fieldset className="card stack plan-activity" key={row.id}><legend>{row.title||"Новое мероприятие "+(index+1)}</legend>
      <div className="dashboard-grid">
        <label>Название мероприятия<input name={row.id+":title"} defaultValue={row.title} required maxLength={120}/></label>
        <label>Тип<select name={row.id+":kind"} defaultValue={row.kind}>{Object.entries(activityKinds).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
        <label>Дата и время<input type="datetime-local" name={row.id+":startsAt"} required defaultValue={localDates[row.id]??row.startsAt}/></label>
        <label>Место<input name={row.id+":place"} defaultValue={row.place} required maxLength={160}/></label>
        <label>Формат<select name={row.id+":format"} defaultValue={row.format}><option>Очно</option><option>Онлайн</option></select></label>
        <label>Максимум баллов<input name={row.id+":max"} type="number" min={1} max={1000} defaultValue={row.max} required/></label>
        <label>Вес<input name={row.id+":weight"} type="number" min={1} max={100} defaultValue={row.weight} required/></label>
        <label>Связь с контрольной точкой<select name={row.id+":checkpointTitle"} defaultValue={row.checkpointTitle??""}><option value="">Без связи</option>{checkpoints.map(title=><option key={title}>{title}</option>)}</select></label>
      </div>
      <label>Описание<textarea name={row.id+":description"} defaultValue={row.description} required maxLength={1000}/></label>
      <label>Темы<textarea name={row.id+":topics"} defaultValue={row.topics} required maxLength={1000}/></label>
      <label>Требования<textarea name={row.id+":requirements"} defaultValue={row.requirements} required maxLength={1000}/></label>
      <label>Ссылка на материалы<input type="url" name={row.id+":materials"} defaultValue={row.materials}/></label>
      <label className="checkbox"><input type="checkbox" name={row.id+":optional"} defaultChecked={row.optional}/> Дополнительное мероприятие</label>
      <label className="checkbox"><input type="checkbox" name={row.id+":registration"} defaultChecked={row.registration}/> Требуется подтверждение участия</label>
      <Button type="button" variant="ghost" onClick={()=>setRows(rows.filter(item=>item.id!==row.id))}>Убрать из черновика</Button>
    </fieldset>)}
    <Button type="button" variant="secondary" disabled={rows.length>=60} onClick={()=>setRows([...rows,initialActivity(crypto.randomUUID(),defaultDate)])}>Добавить мероприятие</Button>
    <label>Причина публикации<textarea name="reason" placeholder="Например, перенос контрольной из-за изменения расписания" maxLength={300}/></label>
    <div className="planning-buttons"><Button type="submit" name="intent" value="draft" variant="secondary">Сохранить черновик</Button><Button type="submit" name="intent" value="publish">Опубликовать версию</Button></div>
  </PlanningForm>;
}
