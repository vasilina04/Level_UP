import Link from "next/link";
import { Bell, CalendarDays, ChartNoAxesColumn, ClipboardList, Clock, Megaphone, MessageSquare, Trophy } from "lucide-react";
import { requireStudent } from "@/lib/access";
import { db } from "@/lib/db";
import { markNotification } from "@/app/actions";
import { dateLabel, timeLabel } from "@/lib/dates";
import { notificationTypes } from "@/lib/rules";
import { Empty, IconTile, SectionTitle } from "@/components/common";
import { Button } from "@/components/ui/button";
const icons={SCHEDULE:CalendarDays,GRADE:ChartNoAxesColumn,DEADLINE:Clock,DOCUMENT:ClipboardList,ACHIEVEMENT:Trophy,ANNOUNCEMENT:Megaphone,TEACHER_REPLY:MessageSquare};
const internalLink=/^(\/(quests|documents|grades|achievements|schedule|checkpoints)(\/[-\w]+)?|\/schedule\?day=\d{4}-\d{2}-\d{2})$/;
export default async function Notifications({searchParams}:{searchParams:Promise<{type?:string,read?:string}>}){
  const {id}=await requireStudent(),params=await searchParams;
  const type=typeof params.type==="string"&&Object.hasOwn(notificationTypes,params.type)?params.type as keyof typeof notificationTypes:undefined;
  const unread=await db.notification.count({where:{userId:id,readAt:null}});
  const items=await db.notification.findMany({where:{userId:id,type,...(params.read==="unread"?{readAt:null}:params.read==="read"?{readAt:{not:null}}:{})},orderBy:{createdAt:"desc"}});
  return <><div className="page-heading"><SectionTitle title="Уведомления" subtitle={"Непрочитанных: "+unread}/>{unread>0&&<form action={markNotification}><input type="hidden" name="id" value="all"/><Button variant="secondary">Прочитать все</Button></form>}</div>
  <form className="filter-bar"><label>Категория<select name="type" defaultValue={type||""}><option value="">Все категории</option>{Object.entries(notificationTypes).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><label>Статус<select name="read" defaultValue={params.read||""}><option value="">Все</option><option value="unread">Непрочитанные</option><option value="read">Прочитанные</option></select></label><Button variant="secondary">Применить</Button></form>
  <section className="card">{items.length?<div className="rows">{items.map(item=><article key={item.id} className={"notice"+(!item.readAt?" unread":"")}><IconTile icon={icons[item.type]||Bell}/><div className="row-content"><small>{notificationTypes[item.type]} · {dateLabel(item.createdAt)} · {timeLabel(item.createdAt)}</small><strong>{item.title}</strong><p>{item.body}</p>{item.href&&internalLink.test(item.href)&&<Link className="text-link" href={item.href}>Открыть</Link>}</div>{!item.readAt&&<form action={markNotification}><input type="hidden" name="id" value={item.id}/><Button variant="ghost" aria-label={"Прочитано: "+item.title}>Прочитано</Button></form>}</article>)}</div>:<Empty title="Уведомлений нет"/>}</section></>;
}
