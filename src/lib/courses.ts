import { db } from "@/lib/db";
import { dayKey, addDays } from "@/lib/dates";
import { parsePlan, planDiff, type Plan } from "@/lib/course-data";
import { lockStudent, synchronizeProgress } from "@/lib/progress";
import { z } from "zod";
import { cache } from "react";
export const isUuid=(id:unknown):id is string=>z.string().uuid().safeParse(id).success;

export function studentCourses(studentId:string) {
  return db.enrollment.findMany({where:{studentId},orderBy:{subject:{title:"asc"}},include:{courseResults:true,
    assessments:{select:{id:true,title:true,passedAt:true,quest:{select:{id:true}}}},
    subject:{include:{plan:{include:{versions:{orderBy:{number:"desc"},take:2}}}}}}});
}
export async function studentCourse(studentId:string,subjectId:string,history=false) {
  if(!isUuid(subjectId)) return null;
  return db.enrollment.findUnique({where:{studentId_subjectId:{studentId,subjectId}},include:{courseResults:true,assessments:{select:{id:true,title:true,passedAt:true}},
    subject:{include:{plan:{include:{versions:{orderBy:{number:"desc"},take:history?undefined:2,include:{author:{select:{name:true}}}}}}}}}});
}
export async function saveCoursePlan(subjectId:string,teacherId:string,revision:number,plan:Plan,reason?:string) {
  return db.$transaction(async tx=>{
    const subject=await tx.subject.findFirst({where:{id:subjectId,instructorId:teacherId},select:{id:true,enrollments:{select:{studentId:true}}}});
    if(!subject) return false;
    await tx.coursePlan.createMany({data:{subjectId},skipDuplicates:true});
    const locked=await tx.coursePlan.updateMany({where:{subjectId,draftRevision:revision},data:{draft:plan,draftRevision:{increment:1}}});
    if(!locked.count) return false;
    if(!reason) return true;
    const latest=await tx.coursePlanVersion.findFirst({where:{subjectId},orderBy:{number:"desc"}});
    const previous=parsePlan(latest?.data);
    if(previous&&!planDiff(previous,plan).length) return true;
    const awarded=await tx.courseResult.findMany({where:{enrollment:{subjectId}},select:{activityId:true,points:true}});
    const activities=new Map(plan.activities.map(item=>[item.id,item]));
    if(awarded.some(result=>!activities.has(result.activityId)||(result.points??0)>activities.get(result.activityId)!.max))
      throw new Error("Сохраните мероприятия с опубликованным результатом и их допустимый максимум.");
    const linked=plan.activities.filter(activity=>activity.checkpointTitle);
    const titles=new Set(linked.map(activity=>activity.checkpointTitle!));
    if(titles.size!==linked.length) throw new Error("Одну контрольную точку можно связать только с одним мероприятием.");
    const exams=plan.activities.filter(activity=>activity.examId);
    if(exams.length){
      const valid=await tx.exam.count({where:{id:{in:exams.map(item=>item.examId!)},enrollment:{subjectId}}});
      if(valid!==exams.length||exams.some(item=>!["CREDIT","EXAM"].includes(item.kind)||item.optional))
        throw new Error("Связанное мероприятие сессии должно оставаться обязательным зачётом или экзаменом этой дисциплины.");
    }
    const existingPoints=await tx.assessment.findMany({where:{enrollment:{subjectId},title:{in:[...titles]}},select:{id:true,title:true}});
    if([...titles].some(title=>!existingPoints.some(point=>point.title===title))) throw new Error("Контрольная точка не относится к этой дисциплине.");
    for(const activity of linked){
      const ids=existingPoints.filter(point=>point.title===activity.checkpointTitle).map(point=>point.id);
      await tx.assessment.updateMany({where:{id:{in:ids},passedAt:null},data:{due:new Date(activity.startsAt)}});
      await tx.quest.updateMany({where:{assessmentId:{in:ids},completion:null},data:{due:new Date(activity.startsAt)}});
    }
    const changedDates=(previous?.activities??[]).filter(item=>activities.get(item.id)?.startsAt!==item.startsAt);
    if(changedDates.length) await tx.notification.deleteMany({where:{
      userId:{in:subject.enrollments.map(item=>item.studentId)},readAt:null,
      eventKey:{in:changedDates.flatMap(item=>[0,1,7].map(offset=>reminderKey(subjectId,item,offset)))},
    }});
    const number=(latest?.number??0)+1;
    const version=await tx.coursePlanVersion.create({data:{subjectId,number,data:plan,authorId:teacherId,reason}});
    await tx.auditLog.create({data:{actorId:teacherId,targetId:subjectId,action:"course.publish",details:{number,reason}}});
    await tx.notification.createMany({data:subject.enrollments.map(({studentId})=>({userId:studentId,type:"COURSE_PLAN",
      title:"Опубликован план курса",body:plan.title+" · версия "+number+".0 · "+reason,href:"/courses/"+subjectId+"/map/history",eventKey:"course:"+version.id})),skipDuplicates:true});
    return true;
  });
}
export async function publishCourseResult(args:{teacherId:string,subjectId:string,enrollmentId:string,activityId:string,status:"GRADED"|"MISSED"|"WAITING",points:number|null,confirmCheckpoint?:"on"}) {
  return db.$transaction(async tx=>{
    const enrollment=await tx.enrollment.findFirst({where:{id:args.enrollmentId,subjectId:args.subjectId,subject:{instructorId:args.teacherId}}});
    if(!enrollment) return false;
    await tx.$queryRaw`SELECT "subjectId" FROM "CoursePlan" WHERE "subjectId" = ${args.subjectId}::uuid FOR UPDATE`;
    const version=await tx.coursePlanVersion.findFirst({where:{subjectId:args.subjectId},orderBy:{number:"desc"}});
    const activity=parsePlan(version?.data)?.activities.find(item=>item.id===args.activityId);
    if(!activity||(args.status==="GRADED"&&(args.points===null||args.points<0||args.points>activity.max))) return false;
    if(args.confirmCheckpoint&&(args.status!=="GRADED"||!activity.checkpointTitle)) return false;
    await lockStudent(tx,enrollment.studentId);
    const where={enrollmentId_activityId:{enrollmentId:enrollment.id,activityId:activity.id}};
    const stored=await tx.courseResult.findUnique({where});
    if(stored?.status==="GRADED"&&args.status!=="GRADED") return false;
    const points=args.status==="GRADED"?args.points:null;
    const resultChanged=!stored||stored.points!==points||stored.status!==args.status;
    if(resultChanged) await tx.courseResult.upsert({where,create:{...where.enrollmentId_activityId,status:args.status,points},update:{status:args.status,points,publishedAt:new Date()}});
    let checkpointConfirmed=false;
    if(args.confirmCheckpoint){
      const confirmed=await tx.assessment.updateMany({where:{enrollmentId:enrollment.id,title:activity.checkpointTitle!,passedAt:null},data:{passedAt:new Date()}});
      checkpointConfirmed=confirmed.count>0;
      if(checkpointConfirmed) await synchronizeProgress(tx,enrollment.studentId);
    }
    if(resultChanged||checkpointConfirmed){
      const audit=await tx.auditLog.create({data:{actorId:args.teacherId,targetId:enrollment.id,action:"course.result",details:{activityId:activity.id,points,status:args.status,checkpointConfirmed}}});
      await tx.notification.create({data:{userId:enrollment.studentId,type:"GRADE",title:resultChanged?"Обновлён результат по курсу":"Подтверждена контрольная точка",body:activity.title,href:"/rating?course="+args.subjectId,eventKey:"course-result:"+audit.id}});
    }
    return true;
  });
}
export async function publishFinalGrade(teacherId:string,enrollmentId:string,finalGrade:number) {
  return db.$transaction(async tx=>{
    const enrollment=await tx.enrollment.findFirst({where:{id:enrollmentId,subject:{instructorId:teacherId}}});
    if(!enrollment) return false;
    await lockStudent(tx,enrollment.studentId);
    const current=await tx.enrollment.findUniqueOrThrow({where:{id:enrollmentId},select:{finalGrade:true}});
    if(current.finalGrade===finalGrade) return true;
    await tx.enrollment.update({where:{id:enrollmentId},data:{finalGrade}});
    const audit=await tx.auditLog.create({data:{actorId:teacherId,targetId:enrollmentId,action:"course.final-grade",details:{before:current.finalGrade,finalGrade}}});
    await tx.notification.create({data:{userId:enrollment.studentId,type:"GRADE",title:"Выставлена итоговая оценка",body:`Итоговая оценка: ${finalGrade}`,
      href:`/rating?course=${enrollment.subjectId}`,eventKey:`course-final-grade:${audit.id}`}});
    return true;
  });
}
const reminderKey=(subjectId:string,activity:{id:string;startsAt:string},offset:number)=>`course-reminder:${subjectId}:${activity.id}:${activity.startsAt}:${offset}`;
export const refreshCourseReminders=cache(async (studentId:string) => {
  const today=dayKey(new Date());
  const linkedPoints=new Set<string>();
  const legacyKeys:string[]=[];
  const rows=(await studentCourses(studentId)).flatMap(enrollment=>{
    const version=enrollment.subject.plan?.versions[0];
    const plan=parsePlan(version?.data);
    return (plan?.activities??[]).flatMap(activity=>{
      if(activity.optional) return [];
      const point=enrollment.assessments.find(item=>item.title===activity.checkpointTitle);
      if(point){
        linkedPoints.add(point.id);
        if(point.quest) legacyKeys.push("deadline:"+point.quest.id);
      }
      if(point?.passedAt||enrollment.courseResults.some(result=>result.activityId===activity.id&&result.status!=="WAITING")) return [];
      const date=dayKey(new Date(activity.startsAt));
      const offset=[0,1,7].find(days=>addDays(today,days)===date);
      if(offset===undefined) return [];
      return [{userId:studentId,type:"DEADLINE" as const,title:offset===7?"Контрольная точка через 7 дней":offset===1?"Контрольная точка завтра":"Контрольная точка сегодня",
        body:activity.title,href:`/courses/${enrollment.subjectId}/map/${activity.id}`,eventKey:reminderKey(enrollment.subjectId,activity,offset)}];
    });
  });
  await Promise.all([
    rows.length?db.notification.createMany({data:rows,skipDuplicates:true}):null,
    legacyKeys.length?db.notification.deleteMany({where:{userId:studentId,readAt:null,eventKey:{in:legacyKeys}}}):null,
  ]);
  return [...linkedPoints];
});
