import { notFound } from "next/navigation";
import { requireTeacher } from "@/lib/access";
import { db } from "@/lib/db";
import { isUuid } from "@/lib/courses";
import { parsePlan } from "@/lib/course-data";
import { Back,Empty,SectionTitle } from "@/components/common";
import { PlanningForm } from "@/components/planning-form";
export default async function CourseResults({params}:{params:Promise<{id:string}>}){
  const teacher=await requireTeacher(),{id}=await params;
  if(!isUuid(id)) notFound();
  const course=await db.subject.findFirst({where:{id,instructorId:teacher.id},include:{plan:{include:{versions:{orderBy:{number:"desc"},take:1}}},enrollments:{include:{student:{include:{user:{select:{name:true}}}},courseResults:true,assessments:{select:{title:true,passedAt:true}}}}}});
  if(!course) notFound();
  const plan=parsePlan(course.plan?.versions[0]?.data);
  const registrations=await db.calendarEntry.findMany({where:{subjectId:id,registrationStatus:"PENDING",participation:true},include:{student:{include:{user:{select:{name:true}}}}}});
  return <><Back href={`/teacher/courses/${id}`} label="К плану курса"/><SectionTitle title="Результаты студентов" subtitle={course.title}/>
    {registrations.length>0&&<section className="card stack"><h2>Запросы на участие</h2>{registrations.map(entry=>{
      const activity=plan?.activities.find(item=>item.id===entry.activityId&&item.optional&&item.registration);
      return activity&&<div key={entry.id}><p>{entry.student.user.name} · {activity.title}</p><div className="planning-buttons">
        <PlanningForm operation="participation" fields={{id:entry.id,status:"CONFIRMED"}} label="Подтвердить участие"/>
        <PlanningForm operation="participation" fields={{id:entry.id,status:"REJECTED"}} label="Отклонить участие" secondary/>
      </div></div>;
    })}</section>}
    {plan&&course.enrollments.length?<div className="stack">{course.enrollments.map(enrollment=><section className="card stack" key={enrollment.id}><h2>{enrollment.student.user.name}</h2>
      <PlanningForm operation="finalGrade" fields={{enrollmentId:enrollment.id}} label="Сохранить итоговую оценку" secondary>
        <label>Итоговая оценка<select name="grade" defaultValue={enrollment.finalGrade??""} required><option value="" disabled>Выберите оценку</option>{[2,3,4,5].map(grade=><option key={grade}>{grade}</option>)}</select></label>
      </PlanningForm>
      {plan.activities.map(activity=>{
        const result=enrollment.courseResults.find(row=>row.activityId===activity.id);
        const checkpoint=enrollment.assessments.find(row=>row.title===activity.checkpointTitle);
        return <details key={activity.id}><summary>{activity.title} · {result?.points??"—"} / {activity.max} баллов</summary>
          <PlanningForm operation="result" fields={{subjectId:id,enrollmentId:enrollment.id,activityId:activity.id}} label="Опубликовать результат">
            <label>Статус<select name="status" defaultValue={result?.status??"GRADED"}><option value="GRADED">Оценено</option><option value="WAITING">Ожидается результат</option><option value="MISSED">Пропущено</option></select></label>
            <label>Баллы<input type="number" name="points" min={0} max={activity.max} defaultValue={result?.points??undefined}/></label>
            {checkpoint&&(checkpoint.passedAt?<p className="muted">Сдача контрольной точки подтверждена</p>:<label className="checkbox"><input type="checkbox" name="confirmCheckpoint"/> Подтвердить сдачу контрольной точки</label>)}
          </PlanningForm>
        </details>;
      })}
    </section>)}</div>:<Empty title="Нужны опубликованные мероприятия и зачисленные студенты"/>}
  </>;
}
