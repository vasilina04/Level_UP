import { db } from "@/lib/db";
import { studentCourses,studentCourse } from "@/lib/courses";
import { parsePlan,activityKinds } from "@/lib/course-data";
import { scheduleFor } from "@/lib/queries";
import { dayKey, timeLabel } from "@/lib/dates";
export const calendarTypes={class:"Занятия",checkpoint:"Контрольные точки",exam:"Зачёты и экзамены",consultation:"Консультации",extra:"Дополнительные мероприятия",personal:"Личные напоминания"} as const;
type Item={id:string,type:keyof typeof calendarTypes,title:string,start:Date,end?:Date,href?:string,detail:string,change?:string,pinned?:boolean};
export async function calendarFor(studentId:string,groupId:string,first:string,last:string) {
  const [classes,courses,bookings,entries,exams]=await Promise.all([
    scheduleFor(groupId,first,last),studentCourses(studentId),
    db.consultationBooking.findMany({where:{studentId,status:"CONFIRMED"},include:{slot:{include:{teacher:{select:{name:true}}}}}}),
    db.calendarEntry.findMany({where:{studentId}}),
    db.exam.findMany({where:{enrollment:{studentId}},include:{enrollment:{include:{subject:true}}}}),
  ]);
  const items:Item[]=classes.map(item=>({id:item.id,type:"class",title:item.subject.title,start:item.start,end:item.end,
    href:"/schedule?day="+dayKey(item.start),detail:item.kind+" · "+item.room,
    change:item.cancelled?"Отменено":item.note??undefined}));
  for(const course of courses){
    const versions=course.subject.plan?.versions??[];
    const plan=parsePlan(versions[0]?.data),old=parsePlan(versions[1]?.data);
    for(const activity of plan?.activities??[]){
      const entry=entries.find(item=>item.subjectId===course.subjectId&&item.activityId===activity.id);
      if(activity.optional&&(!entry?.participation||(activity.registration&&entry.registrationStatus!=="CONFIRMED"))) continue;
      const previous=old?.activities.find(item=>item.id===activity.id);
      const moved=previous&&previous.startsAt!==activity.startsAt ? new Date(previous.startsAt):null;
      items.push({id:activity.id,type:activity.optional?"extra":activity.kind==="CREDIT"||activity.kind==="EXAM"?"exam":"checkpoint",
        title:activity.title,start:new Date(activity.startsAt),href:`/courses/${course.subjectId}/map/${activity.id}`,
        detail:activityKinds[activity.kind]+" · "+activity.place,
        change:moved?`Перенесено с ${dayKey(moved)} ${timeLabel(moved)}`:undefined,pinned:Boolean(entry)});
    }
  }
  for(const exam of exams){
    const versions=courses.find(c=>c.id===exam.enrollmentId)?.subject.plan?.versions??[];
    const plan=parsePlan(versions[0]?.data),previous=parsePlan(versions[1]?.data);
    const kind=exam.kind==="Зачёт"?"CREDIT":"EXAM";
    if(plan?.activities.some(activity=>activity.examId===exam.id||(activity.kind===kind&&(
      +new Date(activity.startsAt)===+exam.start||previous?.activities.some(item=>item.id===activity.id&&+new Date(item.startsAt)===+exam.start)
    )))) continue;
    items.push({id:exam.id,type:"exam",title:exam.enrollment.subject.title,start:exam.start,href:"/grades",detail:exam.kind+" · "+exam.room});
  }
  for(const booking of bookings) items.push({id:booking.id,type:"consultation",title:booking.topic,start:booking.slot.startsAt,end:booking.slot.endsAt,href:"/consultations",detail:booking.slot.teacher.name+" · "+(booking.slot.format==="ONLINE"?"Онлайн":booking.slot.location)});
  for(const entry of entries) if(!entry.activityId&&entry.startsAt&&entry.title) items.push({id:entry.id,type:"personal",title:entry.title,start:entry.startsAt,detail:"Личное напоминание"});
  return items.filter(item=>{const day=dayKey(item.start);return day>=first&&day<=last;}).sort((a,b)=>+a.start-+b.start);
}
export async function setCourseEntry(studentId:string,subjectId:string,activityId:string,choice:"add"|"remove"|"join"|"skip") {
  const enrollment=await studentCourse(studentId,subjectId);
  const activity=parsePlan(enrollment?.subject.plan?.versions[0]?.data)?.activities.find(item=>item.id===activityId);
  if(!activity||(["join","skip"].includes(choice)&&!activity.optional)) return false;
  const where={studentId_subjectId_activityId:{studentId,subjectId,activityId}};
  if(choice==="remove") await db.calendarEntry.deleteMany({where:where.studentId_subjectId_activityId});
  else {
    const participation=choice==="join"?true:choice==="skip"?false:null;
    const registrationStatus=participation&&activity.registration?"PENDING":null;
    const current=await db.calendarEntry.findUnique({where});
    if(current?.participation===participation) return true;
    await db.calendarEntry.upsert({where,update:{participation,registrationStatus},create:{...where.studentId_subjectId_activityId,participation,registrationStatus}});
  }
  return true;
}
export async function decideParticipation(teacherId:string,id:string,status:"CONFIRMED"|"REJECTED"){
  return db.$transaction(async tx=>{
    const entry=await tx.calendarEntry.findFirst({where:{id,participation:true,registrationStatus:"PENDING",subject:{instructorId:teacherId}},include:{subject:{include:{plan:{include:{versions:{orderBy:{number:"desc"},take:1}}}}}}});
    const activity=parsePlan(entry?.subject?.plan?.versions[0]?.data)?.activities.find(item=>item.id===entry?.activityId&&item.optional&&item.registration);
    if(!entry||!activity||!entry.subjectId) return false;
    const change=await tx.calendarEntry.updateMany({where:{id,registrationStatus:"PENDING",participation:true},data:{registrationStatus:status}});
    if(!change.count) return false;
    const audit=await tx.auditLog.create({data:{actorId:teacherId,targetId:entry.id,action:"course.participation",details:{status}}});
    await tx.notification.create({data:{userId:entry.studentId,type:"COURSE_PLAN",title:status==="CONFIRMED"?"Участие подтверждено":"Участие отклонено",
      body:activity.title,href:`/courses/${entry.subjectId}/map/${activity.id}`,eventKey:"participation:"+audit.id}});
    return true;
  });
}
