import { Prisma, type ScheduleEvent } from "@prisma/client";
import { db } from "@/lib/db";
import { lockStudent, synchronizeProgress } from "@/lib/progress";
import { dayKey } from "@/lib/dates";

export async function confirmAssessment(assessmentId: string, staffId: string) {
  return db.$transaction(async tx => {
    const staff = await tx.staffProfile.findFirst({where:{userId:staffId,user:{role:"STAFF"}}});
    if (!staff) return false;
    const assessment = await tx.assessment.findFirst({where:{id:assessmentId,
      ...(staff.facultyId ? {enrollment:{student:{facultyId:staff.facultyId}}} : {})},include:{enrollment:true}});
    if (!assessment) return false;
    const studentId = assessment.enrollment.studentId;
    await lockStudent(tx,studentId);
    const result = await tx.assessment.updateMany({where:{id:assessmentId,passedAt:null},data:{passedAt:new Date()}});
    if (!result.count) return true;
    await tx.checkpointSubmission.updateMany({where:{assessmentId,status:"SUBMITTED"},data:{status:"APPROVED",reviewerId:staffId,
      reviewedAt:new Date(),comment:"Выполнение подтверждено деканатом в учебных данных."}});
    await tx.auditLog.create({data:{actorId:staffId,targetId:assessmentId,action:"assessment.confirm",details:{}}});
    await tx.notification.create({data:{userId:studentId,type:"GRADE",title:"Контрольная точка подтверждена",body:assessment.title,href:"/grades",eventKey:"assessment:"+assessmentId}});
    await synchronizeProgress(tx,studentId);
    return true;
  });
}
export type ScheduleEdit =
  | {kind:"room"; room:string; building:string}
  | {kind:"teacher"; teacherOverride:string|null; teacherOverrideId:string|null}
  | {kind:"time"; start:Date; end:Date}
  | {kind:"cancel"; cancelled:true};
const editTitles={room:"Изменилась аудитория",teacher:"Заменён преподаватель",time:"Занятие перенесено",cancel:"Занятие отменено"};
type ScheduleDetails=Pick<ScheduleEvent,"start"|"end"|"room"|"building"|"format"|"teacherOverride"|"teacherOverrideId"|"cancelled">;
function scheduleSnapshot(event:ScheduleDetails) {
  const {room,building,format,teacherOverride,teacherOverrideId,start,end,cancelled}=event;
  return {room,building,format,teacherOverride,teacherOverrideId,start:start.toISOString(),end:end.toISOString(),cancelled};
}

type NewLesson=Pick<ScheduleEvent,"id"|"groupId"|"subjectId"|"kind"|"start"|"end"|"room"|"building"|"format">;
export async function addScheduleLesson(staffId:string,lesson:NewLesson,reason:string) {
  return db.$transaction(async tx => {
    const staff=await tx.staffProfile.findFirst({where:{userId:staffId,user:{role:"STAFF"}}});
    if(!staff) return false;
    const facultyId=staff.facultyId;
    const group=await tx.group.findFirst({where:{id:lesson.groupId,students:{
      some:{enrollments:{some:{subjectId:lesson.subjectId}},...(facultyId?{facultyId}:{})},
      ...(facultyId?{every:{facultyId}}:{}),
    }},select:{students:{select:{userId:true}}}});
    if(!group) return false;
    const event=await tx.scheduleEvent.createMany({data:{...lesson,note:reason},skipDuplicates:true});
    if(!event.count) return false;
    const snapshot=scheduleSnapshot({...lesson,cancelled:false,teacherOverride:null,teacherOverrideId:null});
    const revision=await tx.scheduleChange.create({data:{eventId:lesson.id,previous:Prisma.JsonNull,current:snapshot,reason}});
    await tx.auditLog.create({data:{actorId:staffId,targetId:lesson.id,action:"schedule.add",details:{current:snapshot,reason}}});
    const subject=await tx.subject.findUniqueOrThrow({where:{id:lesson.subjectId},select:{title:true}});
    await tx.notification.createMany({data:group.students.map(({userId})=>({userId,type:"SCHEDULE",title:"Новая пара",body:subject.title+" · "+reason,
      href:"/schedule?day="+dayKey(lesson.start),eventKey:"schedule:"+revision.id}))});
    return true;
  });
}

export async function editSchedule(eventId: string, staffId: string, expected: number, edit:ScheduleEdit, reason: string) {
  return db.$transaction(async tx => {
    const staff = await tx.staffProfile.findFirst({where:{userId:staffId,user:{role:"STAFF"}}});
    if (!staff) return false;
    const event = await tx.scheduleEvent.findFirst({where:{id:eventId,...(staff.facultyId?{group:{students:{some:{facultyId:staff.facultyId}}}}:{})},
      include:{group:{include:{students:{select:{userId:true,facultyId:true}}}},subject:true}});
    if (!event || (staff.facultyId && event.group.students.some(s=>s.facultyId!==staff.facultyId))) return false;
    if (event.cancelled || event.revision!==expected) return false;
    const {kind,...fields}=edit;
    let data={...fields,...(kind==="room"?{format:"Очно"}:{})};
    if(edit.kind==="teacher"&&edit.teacherOverrideId){
      const substitute=await tx.user.findFirst({where:{id:edit.teacherOverrideId,role:"TEACHER"},select:{name:true}});
      if(!substitute) return false;
      data={...data,teacherOverride:substitute.name};
    }
    const snapshot=scheduleSnapshot(event),current=scheduleSnapshot({...event,...data});
    if(JSON.stringify(snapshot)===JSON.stringify(current)) return false;
    const change = await tx.scheduleEvent.updateMany({where:{id:eventId,revision:expected},data:{...data,revision:{increment:1},note:reason}});
    if (!change.count) return false;
    const revision=await tx.scheduleChange.create({data:{eventId,previous:snapshot,current,reason}});
    await tx.auditLog.create({data:{actorId:staffId,targetId:eventId,action:"schedule."+kind,details:{previous:snapshot,current,reason}}});
    await tx.notification.createMany({data:event.group.students.map(student=>({userId:student.userId,type:"SCHEDULE",title:editTitles[kind],body:event.subject.title+" · "+reason,href:"/schedule?day="+dayKey(edit.kind==="time"?edit.start:event.start),eventKey:"schedule:"+revision.id}))});
    return true;
  });
}
