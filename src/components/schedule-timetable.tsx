import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, MapPin, Video } from "lucide-react";
import { addDays, calendarLabel, dayKey, timeLabel, validScheduleDay, weekOf } from "@/lib/dates";
import { scheduleFor, scheduleForTeacher } from "@/lib/queries";
import { Empty, SectionTitle, StatusPill } from "@/components/common";
import { describeScheduleRevision, ScheduleRevision } from "@/components/schedule-revision";

export type ScheduleSearch = Promise<{day?:string;view?:string}>;
type Audience = {studentGroup:{id:string;name:string}} | {teacherId:string};

export async function ScheduleTimetable({audience,searchParams}:{audience:Audience;searchParams:ScheduleSearch}) {
  const teacherId="teacherId" in audience?audience.teacherId:null;
  const group="studentGroup" in audience?audience.studentGroup:null;
  const basePath=teacherId?"/teacher/schedule":"/schedule";
  const params=await searchParams,today=dayKey(new Date()),day=validScheduleDay(params.day)?params.day:today;
  const view=params.view==="week"||(!params.view&&teacherId)?"week":"day";
  const monday=weekOf(day),days=Array.from({length:7},(_,i)=>addDays(monday,i));
  const first=view==="week"?monday:day,last=view==="week"?days[6]:day;
  const events="teacherId" in audience?await scheduleForTeacher(audience.teacherId,first,last):await scheduleFor(audience.studentGroup.id,first,last);
  const href=(date:string,mode=view)=>`${basePath}?day=${date}&view=${mode}`;
  const month=calendarLabel(day,{month:"long",year:"numeric"});
  return <>
    <SectionTitle title={teacherId?"Расписание преподавателя":"Расписание"} subtitle={group?`${group.name} · ${month}`:month}/>
    {!teacherId&&<p className="muted">Изменения и отмены вносит деканат с указанием причины. Расписание показывает план занятий, присутствие преподавателя оно не подтверждает. <Link className="text-link" href="/teachers">Найти преподавателя и время консультации →</Link></p>}<div className="schedule-controls">
      <div className="tabs"><Link href={href(day,"day")} aria-current={view==="day"?"page":undefined}>День</Link><Link href={href(day,"week")} aria-current={view==="week"?"page":undefined}>Неделя</Link></div>
      <div className="pager"><Link href={href(addDays(day,view==="week"?-7:-1))} aria-label="Назад"><ChevronLeft size={19}/></Link><Link href={href(today)}>Сегодня</Link><Link href={href(addDays(day,view==="week"?7:1))} aria-label="Вперёд"><ChevronRight size={19}/></Link></div>
    </div>
    <nav className="days" aria-label="Дни недели">{days.map(d=><Link key={d} href={href(d,"day")} aria-current={d===day?"date":undefined}><span>{calendarLabel(d,{weekday:"short"})}</span><strong>{d.slice(-2)}</strong></Link>)}</nav>
    {(view==="week"?days:[day]).map(d=>{
      const list=events.filter(event=>dayKey(event.start)===d);
      return <section className="card schedule-day" key={d}>
        <h2><CalendarDays size={20}/>{calendarLabel(d,{weekday:"long",day:"numeric",month:"long"})}</h2>
        {list.length?<div className="rows">{list.map(event=>{
          const latest=event.changes[0];
          const change=latest?describeScheduleRevision(latest,event.subject.teacher):null;
          const color=event.cancelled?"rose":change?.color??(event.note?"gold":"neutral");
          const label=event.cancelled?"Отменено":change?.label??(event.note?"Изменено":"По плану");
          const summary=change?.edits.length&&color!=="rose"?change.edits.join(" · "):event.note;
          const instructor=event.teacherOverride||event.subject.teacher;
          const replaced=teacherId&&event.subject.instructorId===teacherId&&event.teacherOverride&&event.teacherOverrideId!==teacherId;
          return <article className={"lesson"+(color!=="neutral"?` lesson-changed ${color}`:"")} key={event.id}>
            <div className="time-tile"><strong>{timeLabel(event.start)}</strong><small>{timeLabel(event.end)}</small></div>
            <div className="row-content">
              <strong>{event.subject.title}</strong>
              <small>{event.kind} · {teacherId?event.group.name:instructor}</small>{!teacherId&&(event.teacherOverrideId||event.subject.instructorId)&&<Link className="text-link" href={"/teachers/"+(event.teacherOverrideId||event.subject.instructorId)}>Профиль преподавателя</Link>}
              <small>{event.format==="Онлайн"?<Video size={14}/>:<MapPin size={14}/>} {[event.building,event.room,event.format==="Онлайн"?null:event.format].filter(Boolean).join(" · ")}</small>
              {replaced&&<small className="lesson-change-summary">Ведёт другой преподаватель · {instructor}</small>}
              {summary&&<small className="lesson-change-summary">{summary}</small>}
              {event.changes.length>0&&<details className="schedule-history"><summary>История изменений</summary>{event.changes.map(item=><ScheduleRevision key={item.id} change={item} teacher={event.subject.teacher}/>)}</details>}
            </div>
            <StatusPill label={label} color={color}/>
          </article>;
        })}</div>:<Empty title="Занятий нет"/>}
      </section>;
    })}
  </>;
}
