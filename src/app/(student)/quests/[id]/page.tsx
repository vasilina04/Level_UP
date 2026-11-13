import Link from "next/link";
import { ArrowRight, Swords } from "lucide-react";
import { notFound } from "next/navigation";
import { z } from "zod";
import { completeQuest } from "@/app/actions";
import { ActionForm, Submit } from "@/components/forms";
import { Back, CardHeader, SectionTitle, StatusPill } from "@/components/common";
import { requireStudent } from "@/lib/access";
import { db } from "@/lib/db";
import { dateLabel } from "@/lib/dates";
import { questReward } from "@/lib/rules";
export default async function QuestDetail({params}:{params:Promise<{id:string}>}) {
  const student=await requireStudent(),id=z.string().uuid().safeParse((await params).id);
  if(!id.success) notFound();
  const q=await db.quest.findFirst({where:{id:id.data,studentId:student.id},include:{completion:true,enrollment:{include:{subject:true}}}});
  if(!q) notFound();
  const now=new Date(),overdue=q.due<now;
  const reward=questReward(q.kind,q.due,q.completion?.completedAt??null,now);
  return <><Back href="/quests" label="К квестам"/><SectionTitle title={q.title} subtitle={q.enrollment.subject.title}/>
  <section className="card detail-card"><CardHeader title={q.kind==="PERSONAL"?"Личный квест":"Академический квест"} icon={Swords}/>
  <p>{q.description}</p><div className="pill-row"><StatusPill label={q.completion?"Завершён":overdue?"Просрочен":"Активен"} color={q.completion?"mint":overdue?"rose":"violet"}/><StatusPill label={(reward?"+":"")+reward+" XP"} color={reward?"gold":"neutral"}/></div>
  <p className="muted">Дедлайн · {dateLabel(q.due)}</p>{q.assessmentId&&<Link className="text-link" href={"/checkpoints/"+q.assessmentId}>Условия задания и вопрос преподавателю <ArrowRight size={16}/></Link>}{q.completion?<p className="text-mint">Выполнен {dateLabel(q.completion.completedAt)}</p>:q.kind==="PERSONAL"?<ActionForm action={completeQuest} animate={student.student.animations}><input type="hidden" name="id" value={q.id}/>{overdue&&<p className="muted">После дедлайна выполнение сохраняется без начисления XP.</p>}<Submit>Отметить выполненным</Submit></ActionForm>:<p className="muted">Ожидает подтверждения в учебных данных.</p>}</section></>;
}
