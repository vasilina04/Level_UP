import { db } from "@/lib/db";
import { checkpointScope } from "@/lib/checkpoints";
import { parsePlan } from "@/lib/course-data";
import { lockStudent,synchronizeProgress } from "@/lib/progress";
import type { Role } from "@prisma/client";

export type WorkOperation =
  | {operation:"start";assessmentId:string}
  | {operation:"submit";assessmentId:string;id:string;body:string}
  | {operation:"review";assessmentId:string;id:string;decision:"REVISION"|"APPROVED";comment:string;points?:number;grade?:number};

export async function checkpointWork(data:WorkOperation,user:{id:string;role:Role}) {
  const scope=checkpointScope(data.assessmentId,user);
  if(!scope||(data.operation==="review"?user.role!=="TEACHER":user.role!=="STUDENT")) return "denied";
  return db.$transaction(async tx=>{
    const point=await tx.assessment.findFirst({where:scope,include:{enrollment:{include:{subject:true}}}});
    if(!point) return "denied";
    const enrollment=point.enrollment;
    if(data.operation==="review") {
      const subjectId=enrollment.subjectId;
      await tx.$queryRaw`SELECT "subjectId" FROM "CoursePlan" WHERE "subjectId" = ${subjectId}::uuid FOR UPDATE`;
    }
    await lockStudent(tx,enrollment.studentId);
    const current=await tx.assessment.findUniqueOrThrow({where:{id:point.id}});
    const latest=await tx.checkpointSubmission.findFirst({where:{assessmentId:point.id},orderBy:[{submittedAt:"desc"},{id:"desc"}]});
    if(data.operation==="start") {
      await tx.assessment.updateMany({where:{id:point.id,passedAt:null,workStatus:"NOT_STARTED"},data:{workStatus:"IN_PROGRESS"}});
      return "saved";
    }
    if(data.operation==="submit") {
      const previous=await tx.checkpointSubmission.findUnique({where:{id:data.id}});
      if(previous) return previous.assessmentId===point.id&&previous.body===data.body?"saved":"conflict";
      if(current.passedAt||latest?.status==="SUBMITTED"||!enrollment.subject.instructorId) return "conflict";
      const inserted=await tx.checkpointSubmission.createMany({data:{id:data.id,assessmentId:point.id,body:data.body,submittedAt:new Date()},skipDuplicates:true});
      if(!inserted.count) return "conflict";
      await tx.assessment.update({where:{id:point.id},data:{workStatus:"SUBMITTED"}});
      await tx.auditLog.create({data:{actorId:user.id,targetId:point.id,action:"checkpoint.submit",details:{submissionId:data.id}}});
      return "saved";
    }
    const submission=await tx.checkpointSubmission.findFirst({where:{id:data.id,assessmentId:point.id}});
    if(!submission||latest?.id!==submission.id) return "conflict";
    if(submission.status!=="SUBMITTED") {
      return submission.reviewerId===user.id&&submission.status===data.decision&&submission.comment===data.comment&&
        (data.decision!=="APPROVED"||(submission.points===data.points&&submission.grade===data.grade))?"saved":"conflict";
    }
    if(current.passedAt) return "conflict";
    const version=await tx.coursePlanVersion.findFirst({where:{subjectId:enrollment.subjectId},orderBy:{number:"desc"}});
    const activity=parsePlan(version?.data)?.activities.find(item=>item.checkpointTitle===point.title);
    if(data.decision==="APPROVED"&&(!activity||data.points===undefined||data.grade===undefined||data.points>activity.max)) return "invalid";
    const reviewedAt=new Date();
    await tx.checkpointSubmission.update({where:{id:data.id},data:{status:data.decision,comment:data.comment,
      reviewerId:user.id,reviewedAt,points:data.decision==="APPROVED"?data.points:null,grade:data.decision==="APPROVED"?data.grade:null}});
    await tx.assessment.update({where:{id:point.id},data:{workStatus:data.decision==="APPROVED"?"APPROVED":"REVISION",
      ...(data.decision==="APPROVED"?{passedAt:reviewedAt}:{})}});
    if(data.decision==="APPROVED"&&activity) {
      const result={status:"GRADED",points:data.points!};
      await tx.courseResult.upsert({where:{enrollmentId_activityId:{enrollmentId:enrollment.id,activityId:activity.id}},
        create:{enrollmentId:enrollment.id,activityId:activity.id,...result},update:{...result,publishedAt:reviewedAt}});
      const grade={enrollmentId:enrollment.id,title:point.title,value:data.grade!,points:data.points!,maxPoints:activity.max,weight:activity.weight,assessedAt:reviewedAt};
      await tx.grade.upsert({where:{id:point.id},create:{id:point.id,...grade},update:grade});
      await synchronizeProgress(tx,enrollment.studentId);
    }
    await tx.auditLog.create({data:{actorId:user.id,targetId:point.id,action:"checkpoint.review",details:{submissionId:data.id,decision:data.decision}}});
    await tx.notification.create({data:{userId:enrollment.studentId,type:"GRADE",
      title:data.decision==="APPROVED"?"Работа принята":"Работа возвращена на доработку",body:point.title+(data.comment?" · "+data.comment:""),
      href:"/checkpoints/"+point.id,eventKey:"checkpoint-review:"+data.id}});
    return "saved";
  },{timeout:25000});
}
