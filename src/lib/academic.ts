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
    await tx.auditLog.create({data:{actorId:staffId,targetId:assessmentId,action:"assessment.confirm",details:{}}});
    await tx.notification.create({data:{userId:studentId,type:"GRADE",title:"Контрольная точка подтверждена",body:assessment.title,href:"/grades",eventKey:"assessment:"+assessmentId}});
    await synchronizeProgress(tx,studentId);
    return true;
  });
}
export type ScheduleEdit =
  | {kind:"room"; room:string; building:string}
  | {kind:"teacher"; teacherOverride:string}
  | {kind:"time"; start:Date; end:Date}
  | {kind:"cancel"; cancelled:true};
const editTitles={room:"Изменилась аудитория",teacher:"Заменён преподаватель",time:"Занятие перенесено",cancel:"Занятие отменено"};
export async function editSchedule(eventId: string, staffId: string, expected: number, edit:ScheduleEdit, reason: string) {
  return db.$transaction(async tx => {
    const staff = await tx.staffProfile.findFirst({where:{userId:staffId,user:{role:"STAFF"}}});
    if (!staff) return false;
    const event = await tx.scheduleEvent.findFirst({where:{id:eventId,...(staff.facultyId?{group:{students:{some:{facultyId:staff.facultyId}}}}:{})},
      include:{group:{include:{students:{select:{userId:true,facultyId:true}}}},subject:true}});
    if (!event || (staff.facultyId && event.group.students.some(s=>s.facultyId!==staff.facultyId))) return false;
    if (event.cancelled || event.revision!==expected) return false;
    const {kind,...fields}=edit;
    const data={...fields,...(kind==="room"?{format:"Очно"}:{})};
    const snapshot={room:event.room,building:event.building,format:event.format,teacherOverride:event.teacherOverride,start:event.start.toISOString(),end:event.end.toISOString(),cancelled:event.cancelled};
    const current={...snapshot,...data,...(edit.kind==="time"?{start:edit.start.toISOString(),end:edit.end.toISOString()}:{})};
    const change = await tx.scheduleEvent.updateMany({where:{id:eventId,revision:expected},data:{...data,revision:{increment:1},note:reason}});
    if (!change.count) return false;
    const revision=await tx.scheduleChange.create({data:{eventId,previous:snapshot,current,reason}});
    await tx.auditLog.create({data:{actorId:staffId,targetId:eventId,action:"schedule."+kind,details:{previous:snapshot,current,reason}}});
    await tx.notification.createMany({data:event.group.students.map(student=>({userId:student.userId,type:"SCHEDULE",title:editTitles[kind],body:event.subject.title+" · "+reason,href:"/schedule?day="+dayKey(edit.kind==="time"?edit.start:event.start),eventKey:"schedule:"+revision.id}))});
    return true;
  });
}
