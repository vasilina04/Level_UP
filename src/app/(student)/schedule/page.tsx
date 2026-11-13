import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, MapPin, Video } from "lucide-react";
import { requireStudent } from "@/lib/access";
import { scheduleFor } from "@/lib/queries";
import { addDays, calendarLabel, dayKey, timeLabel, validScheduleDay, weekOf } from "@/lib/dates";
import { Empty, SectionTitle, StatusPill } from "@/components/common";
import { ScheduleRevision } from "@/components/schedule-revision";
export default async function Schedule({searchParams}:{searchParams:Promise<{day?:string,view?:string}>}) {
  const user=await requireStudent(),params=await searchParams,today=dayKey(new Date()),day=validScheduleDay(params.day)?params.day:today;
  const view=params.view==="week"?"week":"day", monday=weekOf(day);
  const days=Array.from({length:7},(_,i)=>addDays(monday,i));
  const events=await scheduleFor(user.student.groupId,view==="week"?monday:day,view==="week"?days[6]:day);
  const href=(date:string,mode=view)=>"/schedule?day="+date+"&view="+mode;
  return <><SectionTitle title="Расписание" subtitle={user.student.group.name+" · "+calendarLabel(day,{month:"long",year:"numeric"})}/>
  <div className="schedule-controls"><div className="tabs"><Link href={href(day,"day")} aria-current={view==="day"?"page":undefined}>День</Link><Link href={href(day,"week")} aria-current={view==="week"?"page":undefined}>Неделя</Link></div><div className="pager"><Link href={href(addDays(day,view==="week"?-7:-1))} aria-label="Назад"><ChevronLeft size={19}/></Link><Link href={href(today)}>Сегодня</Link><Link href={href(addDays(day,view==="week"?7:1))} aria-label="Вперёд"><ChevronRight size={19}/></Link></div></div>
  <nav className="days" aria-label="Дни недели">{days.map(d=><Link key={d} href={href(d,"day")} aria-current={d===day?"date":undefined}><span>{calendarLabel(d,{weekday:"short"})}</span><strong>{d.slice(-2)}</strong></Link>)}</nav>
  {(view==="week"?days:[day]).map(d=>{
    const list=events.filter(e=>dayKey(e.start)===d);
    return <section className="card schedule-day" key={d}><h2><CalendarDays size={20}/>{calendarLabel(d,{weekday:"long",day:"numeric",month:"long"})}</h2>{list.length?<div className="rows">{list.map(e=><article className="lesson" key={e.id}>
      <div className="time-tile"><strong>{timeLabel(e.start)}</strong><small>{timeLabel(e.end)}</small></div>
      <div className="row-content"><strong>{e.subject.title}</strong><small>{e.kind} · {e.teacherOverride||e.subject.teacher}</small>
      <small>{e.format==="Онлайн"?<Video size={14}/>:<MapPin size={14}/>} {[e.building,e.room,e.format==="Онлайн"?null:e.format].filter(Boolean).join(" · ")}</small>
      {e.changes.length>0&&<details className="schedule-history"><summary>История изменений</summary>{e.changes.map(c=><ScheduleRevision key={c.id} change={c} teacher={e.subject.teacher}/>)}</details>}</div>
      <StatusPill label={e.cancelled?"Отменено":e.note?"Изменено":"По плану"} color={e.cancelled?"rose":e.note?"gold":"neutral"}/>
      </article>)}</div>:<Empty title="Занятий нет"/>}</section>;
  })}</>;
}
