import type { ScheduleChange } from "@prisma/client";
import { dateLabel, timeLabel } from "@/lib/dates";
type Snapshot={room?:string,building?:string|null,format?:string,teacherOverride?:string|null,teacherOverrideId?:string|null,start?:string,end?:string,cancelled?:boolean};

export function describeScheduleRevision(change:ScheduleChange,teacher:string){
  const previous=change.previous as Snapshot|null,current=change.current as Snapshot;
  if(previous===null) return {label:"Новая пара",color:"mint" as const,edits:[]};
  const when=(value:string)=>{const date=new Date(value);return dateLabel(date)+" "+timeLabel(date);};
  const moved=current.start&&previous.start&&(current.start!==previous.start||current.end!==previous.end);
  const roomChanged=current.room!==previous.room||current.building!==previous.building;
  const teacherChanged=current.teacherOverride!==previous.teacherOverride||(current.teacherOverrideId??null)!==(previous.teacherOverrideId??null);
  const edits=[
    current.room!==previous.room&&"Аудитория: "+previous.room+" → "+current.room,
    current.building!==previous.building&&"Корпус: "+(previous.building||"—")+" → "+(current.building||"—"),
    current.format!==previous.format&&"Формат: "+(previous.format||"—")+" → "+(current.format||"—"),
    teacherChanged&&"Преподаватель: "+(previous.teacherOverride||teacher)+" → "+(current.teacherOverride||teacher),
    moved&&current.start&&previous.start&&
      "Время: "+when(previous.start)+"–"+timeLabel(new Date(previous.end||previous.start))+" → "+when(current.start)+"–"+timeLabel(new Date(current.end||current.start)),
    current.cancelled&&!previous.cancelled&&"Занятие отменено",
  ].filter(Boolean);
  if(current.cancelled&&!previous.cancelled) return {label:"Отменено",color:"rose" as const,edits};
  return {label:moved?"Перенесено":roomChanged?"Смена аудитории":teacherChanged?"Замена преподавателя":"Изменено",color:"gold" as const,edits};
}

export function ScheduleRevision({change,teacher}:{change:ScheduleChange,teacher:string}){
  const {label,edits}=describeScheduleRevision(change,teacher);
  return <p>{dateLabel(change.createdAt)} · {label} · {change.reason}{edits.length>0&&<><br/>{edits.join(" · ")}</>}</p>;
}
