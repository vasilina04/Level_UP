import type { ScheduleChange } from "@prisma/client";
import { dateLabel, timeLabel } from "@/lib/dates";
type Snapshot={room?:string,building?:string,teacherOverride?:string,start?:string,end?:string,cancelled?:boolean};
export function ScheduleRevision({change,teacher}:{change:ScheduleChange,teacher:string}){
  const previous=change.previous as Snapshot,current=change.current as Snapshot;
  const when=(value:string)=>{const date=new Date(value);return dateLabel(date)+" "+timeLabel(date);};
  const edits=[
    current.room!==previous.room&&"Аудитория: "+previous.room+" → "+current.room,
    current.building!==previous.building&&"Корпус: "+(previous.building||"—")+" → "+(current.building||"—"),
    current.teacherOverride!==previous.teacherOverride&&"Преподаватель: "+(previous.teacherOverride||teacher)+" → "+current.teacherOverride,
    current.start&&previous.start&&(current.start!==previous.start||current.end!==previous.end)&&
      "Время: "+when(previous.start)+"–"+timeLabel(new Date(previous.end||previous.start))+" → "+when(current.start)+"–"+timeLabel(new Date(current.end||current.start)),
    current.cancelled&&!previous.cancelled&&"Занятие отменено",
  ].filter(Boolean);
  return <p>{dateLabel(change.createdAt)} · {change.reason}{edits.length>0&&<><br/>{edits.join(" · ")}</>}</p>;
}
