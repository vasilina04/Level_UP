"use client";

import { useState } from "react";
import { PlanningForm } from "@/components/planning-form";
import type { ResultStatus } from "@/lib/gradebook";

export type GradebookRow={
  id:string;name:string;group:string;finalGrade:number|null;
  result?:{status:ResultStatus;points:number|null;publishedAt:string};
  checkpoint?:"confirmed"|"pending";
};
type GradebookActivity={id:string;title:string;max:number;weight:number};
const resultLabels={GRADED:"Оценено",WAITING:"Ожидается результат",MISSED:"Пропущено"} as const;

export function Gradebook({subjectId,activity,students}:{subjectId:string;activity?:GradebookActivity;students:GradebookRow[]}) {
  function build(data:FormData) {
    if(!activity) {
      const rows=students.flatMap(student=>{
        const value=data.get(`grade:${student.id}`);
        const grade=value?Number(value):null;
        return grade!==null&&grade!==student.finalGrade?[{enrollmentId:student.id,grade,expected:student.finalGrade}]:[];
      });
      if(!rows.length) throw new Error("Укажите хотя бы одну новую итоговую оценку.");
      return {rows};
    }
    const rows=students.flatMap(student=>{
      const status=data.get(`status:${student.id}`) as ResultStatus|"";
      const value=data.get(`points:${student.id}`);
      const points=status==="GRADED"&&value?Number(value):null;
      const confirmCheckpoint=data.get(`checkpoint:${student.id}`)==="on"?"on":undefined;
      if(!status||(!student.result&&status==="GRADED"&&points===null&&!confirmCheckpoint)) return [];
      if(status==="GRADED"&&points===null) throw new Error(`Укажите баллы для студента «${student.name}».`);
      if(status===student.result?.status&&points===student.result.points&&!confirmCheckpoint) return [];
      return [{enrollmentId:student.id,status,points,confirmCheckpoint,expectedAt:student.result?.publishedAt??null}];
    });
    if(!rows.length) throw new Error("Укажите хотя бы один новый результат.");
    return {rows};
  }

  return <section className="card stack">
    <div className="gradebook-heading"><h2>{activity?.title??"Итоговые оценки"}</h2><p className="muted">{activity?`До ${activity.max} баллов · вес ${activity.weight} · `:""}Студентов в списке — {students.length}</p></div>
    <PlanningForm operation={activity?"gradebookActivity":"gradebookFinal"} fields={activity?{subjectId,activityId:activity.id}:{subjectId}} build={build}
      label={activity?"Сохранить результаты":"Сохранить итоговые оценки"}>
      <ul className="gradebook-list" role="list">
        {students.map(student=><li key={`${student.id}:${activity?student.result?.publishedAt+":"+student.checkpoint:student.finalGrade}`}
          className={"gradebook-row"+(activity?" gradebook-activity":"")}>
          <div className="row-content"><strong>{student.name}</strong><small>{student.group}</small></div>
          {activity?<ActivityFields student={student} max={activity.max}/>:<label>Итоговая оценка<span className="sr-only"> · {student.name}</span>
            <select name={`grade:${student.id}`} defaultValue={student.finalGrade??""}>
              <option value="" disabled={student.finalGrade!==null}>Не выставлена</option>{[2,3,4,5].map(grade=><option key={grade}>{grade}</option>)}
            </select>
          </label>}
        </li>)}
      </ul>
    </PlanningForm>
  </section>;
}

function ActivityFields({student,max}:{student:GradebookRow;max:number}) {
  const [status,setStatus]=useState<ResultStatus|"">(student.result?.status??"");
  const inactive=status==="WAITING"||status==="MISSED";
  return <>
    <label>Статус<span className="sr-only"> · {student.name}</span><select name={`status:${student.id}`} value={status} onChange={event=>setStatus(event.target.value as ResultStatus|"")}>
      <option value="" disabled={Boolean(student.result)}>Не выставлено</option>
      {Object.entries(resultLabels).map(([id,label])=><option value={id} key={id} disabled={student.result?.status==="GRADED"&&id!=="GRADED"}>{label}</option>)}
    </select></label>
    <label>Баллы<span className="sr-only"> · {student.name}</span><input name={`points:${student.id}`} type="number" min={0} max={max} disabled={inactive}
      placeholder={`0–${max}`} defaultValue={student.result?.points??undefined}
      onChange={event=>{if(!status&&event.target.value) setStatus("GRADED");}}/>
    </label>
    {student.checkpoint==="confirmed"&&<p className="muted">Сдача контрольной точки подтверждена</p>}
    {student.checkpoint==="pending"&&<label className="checkbox"><input key={status} type="checkbox" name={`checkpoint:${student.id}`} disabled={status!=="GRADED"}/>
      Подтвердить сдачу контрольной точки<span className="sr-only"> · {student.name}</span>
    </label>}
  </>;
}
