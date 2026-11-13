import { CalendarCheck, ChartNoAxesColumn, GraduationCap } from "lucide-react";
import { requireStudent } from "@/lib/access";
import { gradesFor, gradesSummary, statsFor } from "@/lib/queries";
import { dateLabel, timeLabel } from "@/lib/dates";
import { CardHeader, Empty, Progress, SectionTitle, StatusPill } from "@/components/common";
import { GradeChart } from "@/components/grade-chart";
import { gradeTrend } from "@/lib/grade-trend";
export default async function Grades() {
  const {id}=await requireStudent();
  const [enrollments,stats]=await Promise.all([gradesFor(id),statsFor(id)]);
  const {average,open,basedOnFinal}=gradesSummary(enrollments);
  const weeks=gradeTrend(enrollments.flatMap(e=>e.grades.map(g=>({...g,subject:e.subject.title}))));
  const exams=enrollments.flatMap(e=>e.exams.map(x=>({...x,title:e.subject.title}))).sort((a,b)=>+a.start-+b.start);
  return <><SectionTitle title="Успеваемость" subtitle="Электронная зачётная книжка и график сессии."/>
  <div className="dashboard-grid"><section className="card"><CardHeader title="Результаты" icon={GraduationCap}/><div className="summary"><div><strong>{average}</strong><small>{basedOnFinal?"Средний итоговый балл":"Средний балл за работы с учётом весов"}</small></div><div><strong>{open}</strong><small>Незакрытые дисциплины</small></div></div><Progress value={stats.percent} label="Контрольные точки"/><p className="muted">{stats.done} / {stats.all} контрольных точек закрыто · {stats.completedWeight} из {stats.totalWeight} по весу</p></section>
  <section className="card"><CardHeader title="Учебная динамика" icon={ChartNoAxesColumn} color="blue"/>{weeks.length?<GradeChart weeks={weeks}/>:<Empty title="Оценок пока нет"/>}</section></div>
  <div className="dashboard-grid spaced"><section className="card"><h2>Дисциплины</h2>{enrollments.length?enrollments.map(e=><details className="subject" key={e.id}><summary><span><strong>{e.subject.title}</strong><small>{e.subject.teacher} · {e.subject.credits} зач. ед.</small></span><StatusPill color={e.creditPassed||e.finalGrade!==null?"mint":"gold"} label={e.finalGrade!==null?"Итог: "+e.finalGrade:e.creditPassed?"Зачтено":"В процессе"}/></summary>
  <div className="subject-detail">{e.grades.map(g=><div className="data-row" key={g.id}><div className="row-content"><strong>{g.title}</strong><small>{dateLabel(g.assessedAt)} · {g.points} / {g.maxPoints} баллов · вес {g.weight}</small></div><StatusPill label={String(g.value)}/></div>)}<p className="muted">Контрольные точки · {e.assessments.filter(a=>a.passedAt).length} / {e.assessments.length}</p></div></details>):<Empty title="Дисциплин пока нет"/>}</section>
  <section className="card"><CardHeader title="Сессия" icon={CalendarCheck} color="mint"/>{exams.length?<div className="rows">{exams.map(e=><div className="data-row" key={e.id}><div className="row-content"><strong>{e.title}</strong><small>{e.kind} · {dateLabel(e.start)} · {timeLabel(e.start)} · {e.room}</small></div></div>)}</div>:<Empty title="Даты сессии ещё не опубликованы"/>}</section></div></>;
}
