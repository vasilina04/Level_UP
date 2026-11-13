import { db } from "@/lib/db";
import type { Role } from "@prisma/client";

export function checkpointScope(id:string,user:{id:string,role:Role}) {
  if(user.role==="STUDENT") return {id,enrollment:{studentId:user.id}};
  if(user.role==="TEACHER") return {id,enrollment:{subject:{instructorId:user.id}}};
  return null;
}
export async function sendCheckpointMessage(data:{id:string,assessmentId:string,body:string},user:{id:string,role:Role}) {
  const scope=checkpointScope(data.assessmentId,user);
  if(!scope) return "denied";
  return db.$transaction(async tx=>{
    const point=await tx.assessment.findFirst({where:scope,include:{enrollment:{include:{subject:{include:{instructor:{select:{role:true}}}}}}}});
    if(!point||point.enrollment.subject.instructor?.role!=="TEACHER") return "denied";
    if(user.role==="TEACHER"&&!await tx.checkpointMessage.count({where:{assessmentId:point.id,authorId:point.enrollment.studentId}})) return "denied";
    const row={id:data.id,assessmentId:point.id,authorId:user.id,body:data.body};
    const created=await tx.checkpointMessage.createMany({data:[row],skipDuplicates:true});
    if(!created.count){
      const old=await tx.checkpointMessage.findFirst({where:row,select:{id:true}});
      return old?"saved":"denied";
    }
    if(user.role==="TEACHER") await tx.notification.create({data:{
      userId:point.enrollment.studentId,type:"TEACHER_REPLY",title:"Преподаватель ответил",
      body:point.title,href:"/checkpoints/"+point.id,eventKey:"checkpoint-reply:"+data.id,
    }});
    return "saved";
  });
}
