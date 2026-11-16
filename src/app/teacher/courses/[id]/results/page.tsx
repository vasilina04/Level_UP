import { notFound } from "next/navigation";
import { requireTeacher } from "@/lib/access";
import { db } from "@/lib/db";
import { isUuid } from "@/lib/courses";
import { parsePlan } from "@/lib/course-data";
import { Back,Empty,SectionTitle } from "@/components/common";
import { PlanningForm } from "@/components/planning-form";
import { Gradebook,type GradebookRow } from "@/components/gradebook";
import { Button } from "@/components/ui/button";
export default async function CourseResults({params,searchParams}:{params:Promise<{id:string}>,searchParams:Promise<{activity?:string}>}){
  const teacher=await requireTeacher(),{id}=await params;
  if(!isUuid(id)) notFound();
  const {activity:activityId}=await searchParams;
  const course=await db.subject.findFirst({where:{id,instructorId:teacher.id},include:{plan:{include:{versions:{orderBy:{number:"desc"},take:1}}},enrollments:{include:{
    student:{select:{user:{select:{name:true}},group:{select:{name:true}}}},
    courseResults:{where:isUuid(activityId)?{activityId}:{activityId:{in:[]}}},assessments:{select:{title:true,passedAt:true}},
  }}}});
  if(!course) notFound();
  const plan=parsePlan(course.plan?.versions[0]?.data);
  const activity=plan?.activities.find(item=>item.id===activityId);
  const students:GradebookRow[]=course.enrollments.map(row=>{
    const checkpoint=activity?.checkpointTitle?row.assessments.find(item=>item.title===activity.checkpointTitle):undefined;
    const result=row.courseResults.find(item=>item.activityId===activity?.id);
    return {id:row.id,name:row.student.user.name,group:row.student.group.name,finalGrade:row.finalGrade,
      result:result?{status:result.status==="WAITING"||result.status==="MISSED"?result.status:"GRADED",points:result.points,publishedAt:result.publishedAt.toISOString()}:undefined,
      checkpoint:checkpoint?(checkpoint.passedAt?"confirmed":"pending"):undefined,
    };
  });
  students.sort((a,b)=>a.group.localeCompare(b.group,"ru")||a.name.localeCompare(b.name,"ru"));
  const registrations=await db.calendarEntry.findMany({where:{subjectId:id,registrationStatus:"PENDING",participation:true},include:{student:{include:{user:{select:{name:true}}}}}});
  return <><Back href={`/teacher/courses/${id}`} label="К плану курса"/><SectionTitle title="Ведомость оценок" subtitle={course.title}/>
    {registrations.length>0&&<section className="card stack"><h2>Запросы на участие</h2>{registrations.map(entry=>{
      const activity=plan?.activities.find(item=>item.id===entry.activityId&&item.optional&&item.registration);
      return activity&&<div key={entry.id}><p>{entry.student.user.name} · {activity.title}</p><div className="planning-buttons">
        <PlanningForm operation="participation" fields={{id:entry.id,status:"CONFIRMED"}} label="Подтвердить участие"/>
        <PlanningForm operation="participation" fields={{id:entry.id,status:"REJECTED"}} label="Отклонить участие" secondary/>
      </div></div>;
    })}</section>}
    {students.length?<>
      {Boolean(plan?.activities.length)&&<form className="filter-bar"><label>За что выставить оценку<select name="activity" defaultValue={activity?.id??""}>
        <option value="">Итоговые оценки</option>{plan?.activities.map(item=><option key={item.id} value={item.id}>{item.title}</option>)}
      </select></label><Button type="submit" variant="secondary">Показать ведомость</Button></form>}
      <Gradebook key={activity?.id??"final"} subjectId={id} activity={activity&&{id:activity.id,title:activity.title,max:activity.max,weight:activity.weight}} students={students}/>
    </>:<Empty title="На дисциплину пока никто не зачислен"/>}
  </>;
}
