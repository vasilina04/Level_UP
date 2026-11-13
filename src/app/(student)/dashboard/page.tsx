import Link from "next/link";
import { ArrowRight, CalendarDays, ChartNoAxesColumn, Check, ChevronRight, Map, Sparkles, Swords, Trophy, Zap } from "lucide-react";
import { requireStudent } from "@/lib/access";
import { gradesFor, gradesSummary, questsFor, recentBadges, scheduleFor, stagesFor, statsFor } from "@/lib/queries";
import { addDays, calendarLabel, dateLabel, dayKey, timeLabel } from "@/lib/dates";
import { xpRewards } from "@/lib/rules";
import { BadgeIcon, CardHeader, Empty, Progress, ProgressRing, QuestGlyph, StatusPill } from "@/components/common";
import { Button } from "@/components/ui/button";

export default async function Dashboard() {
  const {id,name,student}=await requireStudent();
  const now=new Date(),today=dayKey(now);
  const [stats,stages,quests,schedule,enrollments,badges]=await Promise.all([statsFor(id),stagesFor(id),questsFor(id),scheduleFor(student.groupId,today,addDays(today,7)),gradesFor(id),recentBadges(id)]);
  const active=stages.find(s=>!s.progress.length), grade=gradesSummary(enrollments);
  const upcoming=quests.filter(q=>!q.completion&&q.due>=now&&dayKey(q.due)<=addDays(today,7)).slice(0,3);
  const lessons=schedule.filter(e=>!e.cancelled&&e.end>now).slice(0,3);
  return <>
    <section className="hero">
      <div className="hero-content"><span className="hero-tag"><Sparkles size={15}/> {student.group.name} · {student.year} курс</span><h1>Привет, {name.split(" ")[0]}!</h1><p>Твои занятия, квесты и прогресс семестра.</p><Button asChild><Link href="/semester-map">Открыть карту семестра <ArrowRight size={17}/></Link></Button></div>
      <span className="hero-date">{calendarLabel(today,{day:"numeric",month:"long"})}</span>
    </section>
    <div className="dashboard-grid dashboard-overview">
      <section className="card semester"><CardHeader title="Прогресс семестра" icon={Map} href="/semester-map" link="Карта"/>
        <div className="semester-value">
          <ProgressRing value={stats.percent} label="Прогресс семестра"/>
          <div className="semester-detail"><h3>{stats.done} из {stats.all} контрольных точек</h3>
            <small>{stats.completedWeight} из {stats.totalWeight} по весу</small>
            {active&&<Link className="text-link next-stage" href={"/semester-map/"+active.position}>Текущий этап · {active.title}<ArrowRight size={16}/></Link>}
          </div>
        </div>
        <div className="mini-map">{stages.map(s=><Link href={"/semester-map/"+s.position} key={s.id} className={s.progress.length?"done":s.id===active?.id?"current":"future"}><span aria-hidden="true">{s.progress.length?<Check size={15}/>:s.position}</span><small>{s.title}</small><span className="sr-only"> · {s.progress.length?"завершён":s.id===active?.id?"активен":"предстоит"}</span></Link>)}</div>
      </section>
      <section className="card xp-card"><CardHeader title="Мой уровень" icon={Zap} color="gold" href="/profile" link="Профиль"/><div className="level-detail"><div className="level-emblem" aria-hidden="true"><span>{stats.xp.level}</span></div><div><h3>Уровень {stats.xp.level}</h3><p>{stats.xp.total.toLocaleString("ru-RU")} XP всего</p></div></div><Progress value={stats.xp.percent} label="До следующего уровня"/><div className="xp-caption"><span>{stats.xp.earned} / {stats.xp.target} XP</span><span>{stats.xp.ceiling-stats.xp.total} XP до уровня {stats.xp.level+1}</span></div></section>
      <section className="card"><CardHeader title="Квесты недели" icon={Swords} href="/quests"/>{upcoming.length?<div className="rows">{upcoming.map(q=><Link href={"/quests/"+q.id} className="data-row" key={q.id}><QuestGlyph color={q.enrollment.subject.color}/><div className="row-content"><strong>{q.title}</strong><small>{q.enrollment.subject.title} · до {dateLabel(q.due)}</small></div><StatusPill label={"+"+xpRewards[q.kind]+" XP"}/><ChevronRight className="row-arrow" size={16}/></Link>)}</div>:<Empty title="Нет активных квестов"/>}</section>
      <section className="card"><CardHeader title="Ближайшие занятия" icon={CalendarDays} color="mint" href="/schedule" link="Расписание"/>{lessons.length?<div className="rows">{lessons.map(e=><Link href={"/schedule?day="+dayKey(e.start)} className="data-row" key={e.id}><div className="time-tile"><strong>{timeLabel(e.start)}</strong><small>{dateLabel(e.start,{day:"numeric",month:"short"})}</small></div><div className="row-content"><strong>{e.subject.title}</strong><small>{e.kind} · {e.teacherOverride||e.subject.teacher}</small></div><StatusPill color="mint" label={e.room}/></Link>)}</div>:<Empty title="На ближайшие дни занятий нет"/>}</section>
      <section className="card"><CardHeader title="Успеваемость" icon={ChartNoAxesColumn} color="blue" href="/grades" link="Оценки"/><div className="summary"><div><strong>{grade.average}</strong><small>Средний балл</small></div><div><strong>{grade.open}</strong><small>Незакрытые дисциплины</small></div></div>{stats.closest&&<p className="muted">Ближайшая точка · {stats.closest.title} · {dateLabel(stats.closest.due)}</p>}</section>
      <section className="card"><CardHeader title="Последние достижения" icon={Trophy} color="gold" href="/achievements"/>{badges.length?<div className="badge-strip">{badges.map(({achievement:a})=><Link href="/achievements" key={a.id}><BadgeIcon icon={a.icon} color={a.color}/><strong>{a.name}</strong></Link>)}</div>:<Empty title="Достижений пока нет"/>}</section>
    </div>
  </>;
}
