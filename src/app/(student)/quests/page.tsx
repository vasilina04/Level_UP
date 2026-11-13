import Link from "next/link";
import { ArrowUpRight, CalendarDays } from "lucide-react";
import { SectionTitle, Empty, QuestGlyph, StatusPill } from "@/components/common";
import { requireStudent } from "@/lib/access";
import { questsFor } from "@/lib/queries";
import { dateLabel } from "@/lib/dates";
import { questReward } from "@/lib/rules";
const tabs={active:"Активные",soon:"Ближайшие",done:"Завершённые",late:"Просроченные"} as const;
export default async function Quests({searchParams}:{searchParams:Promise<{status?:string,subject?:string,sort?:string}>}) {
  const user=await requireStudent(), params=await searchParams, now=new Date();
  const tab=typeof params.status==="string"&&Object.hasOwn(tabs,params.status)?params.status as keyof typeof tabs:"active";
  const quests=await questsFor(user.id);
  const subjects=[...new Map(quests.map(q=>[q.enrollment.subjectId,q.enrollment.subject.title]))];
  const filtered=quests.filter(q=>{
    if(params.subject&&params.subject!==q.enrollment.subjectId) return false;
    if(tab==="done") return Boolean(q.completion);
    if(q.completion) return false;
    if(tab==="late") return q.due<now;
    return q.due>=now&&(tab!=="soon"||+q.due<=+now+7*86_400_000);
  });
  if(params.sort==="desc") filtered.reverse();
  return <><SectionTitle title="Квесты" subtitle="Учебные задания, личные цели и история выполнения."/>
  <div className="tabs" aria-label="Статусы квестов">{Object.entries(tabs).map(([key,label])=><Link key={key} aria-current={tab===key?"page":undefined} href={"/quests?"+new URLSearchParams({status:key,...(params.subject?{subject:params.subject}:{}),...(params.sort?{sort:params.sort}:{})})}>{label}</Link>)}</div>
  <form className="filter-bar"><input type="hidden" name="status" value={tab}/><label>Дисциплина<select name="subject" defaultValue={params.subject||""}><option value="">Все дисциплины</option>{subjects.map(([id,title])=><option key={id} value={id}>{title}</option>)}</select></label><label>Срок<select name="sort" defaultValue={params.sort||"asc"}><option value="asc">Сначала ближайшие</option><option value="desc">Сначала дальние</option></select></label><button className="button secondary">Применить</button></form>
  {filtered.length?<div className="dashboard-grid">{filtered.map(q=>{
    const reward=questReward(q.kind,q.due,q.completion?.completedAt??null,now);
    return <Link className="card quest-card" href={"/quests/"+q.id} key={q.id}><div className="quest-top"><QuestGlyph color={q.enrollment.subject.color}/><StatusPill label={(reward?"+":"")+reward+" XP"} color={reward?"violet":"neutral"}/></div><h2>{q.title}</h2><p>{q.enrollment.subject.title}</p><div className="quest-meta"><span><CalendarDays size={16}/> {q.completion?"Выполнен "+dateLabel(q.completion.completedAt):"До "+dateLabel(q.due)}</span><ArrowUpRight size={18}/></div></Link>;
  })}</div>:<section className="card"><Empty title={tab==="active"?"Нет активных квестов":"В этом разделе пока нет квестов"}/></section>}</>;
}
