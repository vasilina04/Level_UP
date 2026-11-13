import Link from "next/link";
import { ArrowRight, Check, Flag, FlaskConical, Goal, GraduationCap, Layers, Rocket } from "lucide-react";
import { SectionTitle, Empty, Progress, ProgressRing, StatusPill } from "@/components/common";
import { requireStudent } from "@/lib/access";
import { stagesFor, statsFor } from "@/lib/queries";
import { dateLabel } from "@/lib/dates";
import { checkpointProgress } from "@/lib/weights";
const icons=[Flag,FlaskConical,Layers,Rocket,Goal,GraduationCap];
export default async function SemesterMap() {
  const user=await requireStudent();
  const [stages,stats]=await Promise.all([stagesFor(user.id),statsFor(user.id)]);
  const active=stages.find(s=>!s.progress.length);
  return <><SectionTitle title="Карта семестра" subtitle="Откройте этап, чтобы увидеть его контрольные точки и дедлайны."/>
    <section className="card map-summary"><ProgressRing value={stats.percent} label="Прогресс семестра"/><div><h2>{stats.done} из {stats.all} контрольных точек</h2><p>{stats.completedWeight} из {stats.totalWeight} по весу · {stages.filter(s=>s.progress.length).length} из {stages.length} этапов завершено</p></div>
      {active&&<Link className="text-link map-continue" href={"/semester-map/"+active.position}>Перейти к этапу «{active.title}»<ArrowRight size={17}/></Link>}
    </section>
    {!stages.length?<Empty title="Карта пока пуста"/>:<ol className="route-map">{stages.map((s,i)=>{
      const done=s.progress.length>0,current=s.id===active?.id, Icon=done?Check:icons[i%icons.length];
      const progress=checkpointProgress(s.assessments);
      const status=done?"Завершён":current?"Активен":"Предстоящий";
      return <li key={s.id} className={done?"done":current?"current":"future"}>
        <Link className="map-step" href={"/semester-map/"+s.position}>
          <span className="map-node" aria-hidden="true"><Icon size={23}/></span>
          <div className="map-step-card">
            <div className="stage-top"><span className="muted">Этап {s.position}</span><ArrowRight className="stage-arrow" size={16} aria-hidden="true"/></div>
            <h2>{s.title}</h2><StatusPill color={done?"mint":current?"violet":"neutral"} label={status}/>
            <div className="stage-meta"><span>{progress.done} из {progress.all} точек</span><small>{dateLabel(s.progress[0]?.completedAt||s.assessments.at(-1)!.due,{day:"numeric",month:"short"})}</small></div>
            <Progress value={progress.percent} label={"Контрольные точки · "+s.title}/>
          </div>
        </Link>
      </li>;
    })}</ol>}</>;
}
