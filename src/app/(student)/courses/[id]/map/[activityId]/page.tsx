import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStudent } from "@/lib/access";
import { db } from "@/lib/db";
import { studentCourse } from "@/lib/courses";
import { parsePlan,activityKinds,activityStatus } from "@/lib/course-data";
import { dateLabel,timeLabel } from "@/lib/dates";
import { Back,SectionTitle,StatusPill } from "@/components/common";
import { CourseLinks } from "@/components/course-links";
import { PlanningForm } from "@/components/planning-form";
export default async function CourseActivity({params}:{params:Promise<{id:string,activityId:string}>}){
  const user=await requireStudent(),{id,activityId}=await params;
  const course=await studentCourse(user.id,id),versions=course?.subject.plan?.versions??[];
  const plan=parsePlan(versions[0]?.data),activity=plan?.activities.find(item=>item.id===activityId);
  if(!course||!activity) notFound();
  const result=course.courseResults.find(row=>row.activityId===activityId);
  const [entry,teacherProfile]=await Promise.all([
    db.calendarEntry.findUnique({where:{studentId_subjectId_activityId:{studentId:user.id,subjectId:id,activityId}}}),
    course.subject.instructorId?db.teacherProfile.findUnique({where:{userId:course.subject.instructorId},select:{userId:true}}):null,
  ]);
  const checkpoint=course.assessments.find(point=>point.title===activity.checkpointTitle);
  const start=new Date(activity.startsAt),previous=parsePlan(versions[1]?.data)?.activities.find(item=>item.id===activityId);
  const moved=previous&&previous.startsAt!==activity.startsAt;
  const rule=plan?.rule;
  const potential=rule?Math.min(activity.max*activity.weight,activity.optional?rule.bonus:rule.cap):null;
  return <><Back href={"/courses/"+id+"/map"} label="К карте курса"/><SectionTitle title={activity.title} subtitle={course.subject.title+" · "+activityKinds[activity.kind]}/><CourseLinks id={id}/>
    <div className="dashboard-grid"><section className="card stack"><h2>Что нужно сделать</h2><p>{activity.description}</p><h3>Темы</h3><p className="checkpoint-body">{activity.topics}</p><h3>Требования</h3><p className="checkpoint-body">{activity.requirements}</p>
      {activity.materials&&<a className="text-link" href={activity.materials}>Открыть материалы</a>}
      {checkpoint&&<Link className="text-link" href={"/checkpoints/"+checkpoint.id}>Задать вопрос преподавателю →</Link>}
      {teacherProfile&&<Link className="text-link" href={`/teachers/${teacherProfile.userId}#booking`}>Записаться к преподавателю</Link>}
    </section><section className="card stack"><h2>Дата, формат и баллы</h2><p>{dateLabel(start)} в {timeLabel(start)} · {activity.format} · {activity.place}</p>
      <p>Преподаватель: {course.subject.teacher}</p><p>Баллы: {result?.points??"—"} / {activity.max} · вес {activity.weight}</p>
      {potential!==null&&<p className="muted">До {potential} баллов рейтинга за работу с учётом веса.</p>}
      {rule&&(!result||result.status==="WAITING")&&<Link className="text-link" href={`/rating?course=${id}&activity=${activityId}`}>Рассчитать результат</Link>}
      {moved&&<p className="muted">Прежняя дата: {dateLabel(new Date(previous.startsAt))} в {timeLabel(new Date(previous.startsAt))}</p>}
      <div><StatusPill color={moved?"gold":"violet"} label={activityStatus(activity,result,previous,Boolean(checkpoint?.passedAt))}/></div>
      {activity.optional?<><p>{entry?.participation===false?"Вы отказались от участия":entry?.registrationStatus==="REJECTED"?"Участие отклонено":entry?.registrationStatus==="CONFIRMED"?"Участие подтверждено":entry?.participation===true?activity.registration?"Заявка на регистрацию · ожидает подтверждения":"Вы участвуете":"Участие по выбору"}</p>
        <div className="planning-buttons"><PlanningForm operation="calendarActivity" fields={{subjectId:id,activityId,choice:"join"}} label="Участвовать"/><PlanningForm operation="calendarActivity" fields={{subjectId:id,activityId,choice:"skip"}} label="Не участвовать" secondary/></div></>
        :<PlanningForm operation="calendarActivity" fields={{subjectId:id,activityId,choice:entry?"remove":"add"}} label={entry?"Снять личную отметку":"Добавить в мой календарь"} secondary={Boolean(entry)}/>}
    </section></div>
  </>;
}
