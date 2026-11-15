import Link from "next/link";
import { randomUUID } from "node:crypto";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { requireStudent } from "@/lib/access";
import { calendarFor,calendarTypes } from "@/lib/calendar";
import { addDays,calendarLabel,dayKey,timeLabel,validScheduleDay,weekOf } from "@/lib/dates";
import { Empty,SectionTitle,StatusPill } from "@/components/common";
import { Button } from "@/components/ui/button";
import { PlanningForm } from "@/components/planning-form";
const views={day:"День",week:"Неделя",month:"Месяц"} as const;
export default async function Calendar({searchParams}:{searchParams:Promise<{view?:string,day?:string,type?:string}>}){
  const user=await requireStudent(),params=await searchParams;
  const today=dayKey(new Date()), selected=validScheduleDay(params.day)&&params.day>="1900-01-01"&&params.day<="2100-12-31"?params.day:today;
  const view=params.view==="day"||params.view==="month"?params.view:"week";
  const filter=typeof params.type==="string"&&Object.hasOwn(calendarTypes,params.type)?params.type:"";
  const monthStart=selected.slice(0,7)+"-01";
  const month=new Date(monthStart+"T12:00:00Z");
  const nextMonth=(delta:number)=>new Date(Date.UTC(month.getUTCFullYear(),month.getUTCMonth()+delta,1)).toISOString().slice(0,10);
  const first=view==="month"?monthStart:view==="week"?weekOf(selected):selected;
  const last=view==="month"?addDays(nextMonth(1),-1):view==="week"?addDays(first,6):selected;
  const url=(day:string,mode=view)=>"/calendar?"+new URLSearchParams({view:mode,day,...(filter?{type:filter}:{})});
  const rows=(await calendarFor(user.id,user.student.groupId,first,last)).filter(item=>!filter||item.type===filter);
  const days=new Map<string,typeof rows>();
  for(const item of rows){const day=dayKey(item.start);const sameDay=days.get(day)??[];sameDay.push(item);days.set(day,sameDay);}
  const monthCount=view==="month"?Number(last.slice(8)):0;
  const busy=Math.round(rows.reduce((sum,item)=>sum+(item.end&&!item.change?.startsWith("Отменено")?(+item.end-+item.start)/60_000:0),0));
  return <><SectionTitle title="Мой календарь" subtitle={calendarLabel(selected,{month:"long",year:"numeric"})}/>
    <div className="schedule-controls"><div className="tabs">{Object.entries(views).map(([key,label])=><Link key={key} aria-current={key===view?"page":undefined} href={url(selected,key as keyof typeof views)}>{label}</Link>)}</div>
    <div className="pager"><Link aria-label="Назад" href={url(view==="month"?nextMonth(-1):addDays(selected,view==="week"?-7:-1))}><ChevronLeft size={18}/></Link><Link href={url(today)}>Сегодня</Link><Link aria-label="Вперёд" href={url(view==="month"?nextMonth(1):addDays(selected,view==="week"?7:1))}><ChevronRight size={18}/></Link></div></div>
    <form className="filter-bar spaced"><input type="hidden" name="view" value={view}/><input type="hidden" name="day" value={selected}/><label>Тип события<select name="type" defaultValue={filter}><option value="">Все события</option>{Object.entries(calendarTypes).map(([id,label])=><option value={id} key={id}>{label}</option>)}</select></label><Button variant="secondary">Применить</Button></form>
    {monthCount>0&&<div className="calendar-month card">
      {["Пн","Вт","Ср","Чт","Пт","Сб","Вс"].map(label=><span className="calendar-weekday" key={label} aria-hidden="true">{label}</span>)}
      {Array.from({length:monthCount},(_,i)=>addDays(first,i)).map((day,index)=>{
        const count=days.get(day)?.length??0;
        return <Link key={day} href={url(day,"day")} style={index===0?{gridColumn:((new Date(day+"T12:00:00Z").getUTCDay()+6)%7)+1}:undefined}>
          <strong>{Number(day.slice(8))}</strong><span className="sr-only"> {calendarLabel(day,{month:"long"})}, событий </span>
          <small>{count||<><span aria-hidden="true">—</span><span className="sr-only">0</span></>}</small>
        </Link>;
      })}
    </div>}
    <p className="muted spaced">Занято по интервалам: {Math.floor(busy/60)} ч {busy%60} мин</p>
    <div className="stack spaced">{days.size?[...days.entries()].map(([day,items])=><section className="card stack" key={day}><h2><CalendarDays size={17}/> {calendarLabel(day,{weekday:"long",day:"numeric",month:"long"})}</h2>
      {items.map(item=><article className="data-row" key={item.type+item.id}><div className="row-content"><strong>{item.href?<Link className="text-link" href={item.href}>{item.title}</Link>:item.title}</strong><small>{timeLabel(item.start)}{item.end?"–"+timeLabel(item.end):""} · {item.detail}</small>{item.change&&<small>{item.change}</small>}</div>
      {item.pinned&&<StatusPill label="В моём плане" color="mint"/>}{item.type==="personal"&&<PlanningForm operation="removeReminder" fields={{id:item.id}} label="Удалить" secondary/>}</article>)}
    </section>):<Empty title="На этот период событий нет"/>}</div>
    <section className="card detail-card spaced"><h2>Личное напоминание</h2><PlanningForm operation="reminder" fields={{id:randomUUID()}} label="Добавить напоминание">
      <label>Название<input name="title" required minLength={2} maxLength={120}/></label><label>Дата и время<input type="datetime-local" name="start" defaultValue={selected+"T12:00"} required/></label>
    </PlanningForm></section>
  </>;
}
