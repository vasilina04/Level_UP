import { Progress } from "@/components/common";
import { checkpointProgress } from "@/lib/weights";
import { workStatus } from "@/lib/work-status";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check,CalendarClock,Flag,AlertCircle } from "lucide-react";
import { requireStudent } from "@/lib/access";
import { studentCourse } from "@/lib/courses";
import { parsePlan,activityStatus,activityKinds } from "@/lib/course-data";
import { dateLabel,timeLabel } from "@/lib/dates";
import { CourseLinks } from "@/components/course-links";
import { Back,Empty,SectionTitle,StatusPill } from "@/components/common";
export default async function CourseMap({params}:{params:Promise<{id:string}>}){
  const user=await requireStudent(),{id}=await params;
  const course=await studentCourse(user.id,id);
  if(!course) notFound();
  const versions=course.subject.plan?.versions??[];
  const plan=parsePlan(versions[0]?.data),previous=parsePlan(versions[1]?.data);
  const results=new Map(course.courseResults.map(row=>[row.activityId,row]));
  return <><Back href="/courses" label="К дисциплинам"/><SectionTitle title={plan?.title??course.subject.title} subtitle={plan?`Версия ${versions[0].number}.0 · ${plan.period}`:course.subject.teacher}/>
    <CourseLinks id={id}/><section className="card spaced"><h2>Прогресс дисциплины</h2><Progress value={checkpointProgress(course.assessments).percent} label={"Прогресс дисциплины · "+course.subject.title}/><p className="muted">{course.assessments.filter(point=>point.passedAt).length} из {course.assessments.length} контрольных точек подтверждено преподавателем или деканатом.</p></section>
    {plan?.activities.length?<ol className="course-map">{[...plan.activities].sort((a,b)=>a.startsAt.localeCompare(b.startsAt)).map(activity=>{
      const checkpoint=course.assessments.find(point=>point.title===activity.checkpointTitle);
      const confirmed=Boolean(checkpoint?.passedAt);
      const status=activityStatus(activity,results.get(activity.id),previous?.activities.find(item=>item.id===activity.id),confirmed);
      const color=status==="Оценено"?"mint":status==="Перенесено"?"gold":status==="Открыта подготовка"?"violet":"neutral";
      const Icon=color==="mint"?Check:color==="gold"?AlertCircle:color==="violet"?Flag:CalendarClock;
      const start=new Date(activity.startsAt);
      return <li key={activity.id}><Link href={`/courses/${id}/map/${activity.id}`} className="card course-node">
        <Icon size={22} className="course-node-marker" aria-hidden="true"/><div><h2>{activity.title}</h2><p className="muted">{activityKinds[activity.kind]} · {dateLabel(start)} в {timeLabel(start)} · {activity.format} · до {activity.max} баллов</p></div>
        <div className="pill-row"><StatusPill color={color} label={status}/>{checkpoint&&<StatusPill label={workStatus(checkpoint)}/>}</div>
      </Link></li>;
    })}</ol>:<Empty title="План курса ещё не опубликован"/>}
  </>;
}
