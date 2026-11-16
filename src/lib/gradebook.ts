import type { CourseResult, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { parsePlan,type Activity } from "@/lib/course-data";
import { lockStudent,synchronizeProgress } from "@/lib/progress";

export type ResultStatus="GRADED"|"MISSED"|"WAITING";
type FinalEdit={enrollmentId:string;grade:number;expected?:number|null};
type ActivityEdit={enrollmentId:string;status:ResultStatus;points:number|null;confirmCheckpoint?:"on";expectedAt?:string|null};
type GradebookEdit={kind:"final";subjectId?:string;rows:FinalEdit[]}|{kind:"activity";subjectId:string;activityId:string;rows:ActivityEdit[]};
type EnrollmentRef={id:string;studentId:string;subjectId:string};

export async function publishGradebook(teacherId:string,edit:GradebookEdit) {
  const ids=edit.rows.map(row=>row.enrollmentId);
  if(!ids.length||new Set(ids).size!==ids.length) return "invalid";
  return db.$transaction(async tx=>{
    const enrollments=await tx.enrollment.findMany({where:{id:{in:ids},subjectId:edit.subjectId,subject:{instructorId:teacherId}},
      orderBy:{studentId:"asc"},select:{id:true,studentId:true,subjectId:true}});
    if(enrollments.length!==ids.length) return "unavailable";
    const byId=new Map(enrollments.map(enrollment=>[enrollment.id,enrollment]));
    if(edit.kind==="final") {
      for(const enrollment of enrollments) await lockStudent(tx,enrollment.studentId);
      const current=new Map((await tx.enrollment.findMany({where:{id:{in:ids}},select:{id:true,finalGrade:true}})).map(row=>[row.id,row.finalGrade]));
      if(edit.rows.some(row=>row.expected!==undefined&&row.expected!==current.get(row.enrollmentId)&&row.grade!==current.get(row.enrollmentId))) return "conflict";
      for(const row of edit.rows) {
        const before=current.get(row.enrollmentId)??null;
        if(before!==row.grade) await storeFinalGrade(tx,teacherId,byId.get(row.enrollmentId)!,before,row.grade);
      }
      return "ok";
    }

    const courseId=edit.subjectId;
    await tx.$queryRaw`SELECT "subjectId" FROM "CoursePlan" WHERE "subjectId" = ${courseId}::uuid FOR UPDATE`;
    const version=await tx.coursePlanVersion.findFirst({where:{subjectId:courseId},orderBy:{number:"desc"}});
    const activity=parsePlan(version?.data)?.activities.find(item=>item.id===edit.activityId);
    if(!activity||edit.rows.some(row=>
      (row.status==="GRADED"&&(row.points===null||row.points<0||row.points>activity.max))||
      (row.confirmCheckpoint&&(row.status!=="GRADED"||!activity.checkpointTitle)),
    )) return "invalid";
    for(const enrollment of enrollments) await lockStudent(tx,enrollment.studentId);
    const stored=new Map((await tx.courseResult.findMany({where:{enrollmentId:{in:ids},activityId:activity.id}})).map(row=>[row.enrollmentId,row]));
    for(const row of edit.rows) {
      const previous=stored.get(row.enrollmentId);
      if(row.expectedAt!==undefined&&row.expectedAt!==(previous?.publishedAt.toISOString()??null)&&resultChanged(row,previous)) return "conflict";
      if(previous?.status==="GRADED"&&row.status!=="GRADED") return "invalid";
    }
    for(const row of edit.rows) await storeResult(tx,teacherId,byId.get(row.enrollmentId)!,activity,row,stored.get(row.enrollmentId));
    return "ok";
  },{timeout:25000});
}

function resultChanged(row:ActivityEdit,stored?:CourseResult) {
  return !stored||stored.status!==row.status||stored.points!==(row.status==="GRADED"?row.points:null);
}

async function storeResult(tx:Prisma.TransactionClient,teacherId:string,enrollment:EnrollmentRef,activity:Activity,row:ActivityEdit,stored?:CourseResult) {
  const key={enrollmentId:enrollment.id,activityId:activity.id},points=row.status==="GRADED"?row.points:null;
  const changed=resultChanged(row,stored);
  if(changed) await tx.courseResult.upsert({where:{enrollmentId_activityId:key},create:{...key,status:row.status,points},update:{status:row.status,points,publishedAt:new Date()}});
  let checkpointConfirmed=false;
  if(row.confirmCheckpoint) {
    const confirmed=await tx.assessment.updateMany({where:{enrollmentId:enrollment.id,title:activity.checkpointTitle!,passedAt:null},data:{passedAt:new Date()}});
    checkpointConfirmed=confirmed.count>0;
    if(checkpointConfirmed) await synchronizeProgress(tx,enrollment.studentId);
  }
  if(changed||checkpointConfirmed) {
    const audit=await tx.auditLog.create({data:{actorId:teacherId,targetId:enrollment.id,action:"course.result",details:{activityId:activity.id,points,status:row.status,checkpointConfirmed}}});
    await tx.notification.create({data:{userId:enrollment.studentId,type:"GRADE",title:changed?"Обновлён результат по курсу":"Подтверждена контрольная точка",body:activity.title,
      href:"/rating?course="+enrollment.subjectId,eventKey:"course-result:"+audit.id}});
  }
}

async function storeFinalGrade(tx:Prisma.TransactionClient,teacherId:string,enrollment:EnrollmentRef,before:number|null,finalGrade:number) {
  await tx.enrollment.update({where:{id:enrollment.id},data:{finalGrade}});
  const audit=await tx.auditLog.create({data:{actorId:teacherId,targetId:enrollment.id,action:"course.final-grade",details:{before,finalGrade}}});
  await tx.notification.create({data:{userId:enrollment.studentId,type:"GRADE",title:"Выставлена итоговая оценка",body:`Итоговая оценка: ${finalGrade}`,
    href:`/rating?course=${enrollment.subjectId}`,eventKey:`course-final-grade:${audit.id}`}});
}
