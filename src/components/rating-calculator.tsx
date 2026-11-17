"use client";
import { useState } from "react";
import type { Rule } from "@/lib/course-data";
import { applyRule,courseGrade } from "@/lib/course-ui-data";
import { Button } from "@/components/ui/button";
export function RatingCalculator({rule,earned,bonusEarned,maximum,activities,initialActivityId}:{
  rule:Rule,earned:number,bonusEarned:number,maximum:number,activities:{id:string,title:string,max:number,weight:number,optional:boolean}[],initialActivityId?:string,
}) {
  const defaultId=activities.find(item=>item.id===initialActivityId)?.id??activities[0]?.id??"";
  const [id,setId]=useState(defaultId);
  const [points,setPoints]=useState(0),[target,setTarget]=useState(rule.good);
  const activity=activities.find(item=>item.id===id)??activities[0];
  const weighted=activity?points*activity.weight:0;
  const increase=activity?.optional?Math.min(weighted,Math.max(0,rule.bonus-bonusEarned)):weighted;
  const forecast=applyRule(rule,earned+increase);
  const needed=Math.max(0,target-applyRule(rule,earned));
  return <section className="card stack"><h2>Что, если?</h2>
    {activity?<><label>Мероприятие<select value={activity.id} onChange={event=>{setId(event.target.value);setPoints(0);}}>{activities.map(item=><option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
      <label>Предполагаемый балл<input type="number" min={0} max={activity.max} value={points} onChange={event=>setPoints(Math.min(activity.max,Math.max(0,Math.floor(Number(event.target.value)||0))))}/></label>
      <p role="status">Прогноз: <strong>{forecast} баллов</strong> · расчётная оценка {courseGrade(rule,forecast)}</p></>:<p className="muted">Мероприятий для прогноза пока нет.</p>}
    <h3>Сколько баллов мне нужно?</h3><label>Целевой результат<input type="number" min={0} max={rule.cap} value={target} onChange={event=>setTarget(Math.max(0,Math.floor(Number(event.target.value)||0)))}/></label>
    <p role="status">{target>maximum?`Цель недостижима: с оставшимися мероприятиями максимум ${maximum} баллов.`:needed?`До цели нужно ${needed} баллов из оставшихся.`:"Цель уже достигнута."}</p>
    <Button type="button" variant="secondary" onClick={()=>{setId(defaultId);setPoints(0);setTarget(rule.good);}}>Сбросить прогноз</Button>
  </section>;
}
