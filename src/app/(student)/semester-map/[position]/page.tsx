import Link from "next/link";
import { CheckCircle2, ChevronRight, CircleDashed, Map, Trophy } from "lucide-react";
import { notFound } from "next/navigation";
import { requireStudent } from "@/lib/access";
import { stagesFor } from "@/lib/queries";
import { dateLabel } from "@/lib/dates";
import { checkpointProgress } from "@/lib/weights";
import { Back, CardHeader, Progress, SectionTitle, StatusPill } from "@/components/common";
export default async function Stage({params}:{params:Promise<{position:string}>}) {
  const {id}=await requireStudent();
  const position=Number((await params).position);
  const stage=(await stagesFor(id)).find(s=>s.position===position);
  if(!stage) notFound();
  const progress=checkpointProgress(stage.assessments);
  return <><Back href="/semester-map" label="К карте семестра"/><SectionTitle title={stage.title} subtitle={stage.description}/>
  <div className="dashboard-grid"><section className="card"><CardHeader title={"Этап "+stage.position} icon={Map}/><p>{progress.done} из {progress.all} контрольных точек · {progress.completedWeight} из {progress.totalWeight} по весу</p><Progress label="Прогресс этапа" value={progress.percent}/><p className="muted">{stage.progress.length?"Завершён "+dateLabel(stage.progress[0].completedAt):"Дедлайн "+dateLabel(stage.assessments.at(-1)!.due)}</p></section>
  <section className="card"><CardHeader title="Награды этапа" icon={Trophy} color="gold"/><p>+150 XP за закрытие всех контрольных точек.</p><p className="muted">После трёх этапов открывается достижение «Исследователь».</p></section></div>
  <section className="card spaced"><h2>Контрольные точки</h2><div className="rows">{stage.assessments.map(a=><Link href={"/checkpoints/"+a.id} className="data-row" key={a.id}>{a.passedAt?<CheckCircle2 className="text-mint" size={23}/>:<CircleDashed className="muted" size={23}/>}<div className="row-content"><strong>{a.title}</strong><small>{a.enrollment.subject.title} · {dateLabel(a.due)} · вес {a.weight}</small></div><StatusPill label={a.passedAt?"Завершена":"Предстоит"} color={a.passedAt?"mint":"neutral"}/><ChevronRight className="row-arrow" size={16}/></Link>)}</div></section></>;
}
