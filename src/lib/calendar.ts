import { db } from "@/lib/db";
import { studentCourses,studentCourse } from "@/lib/courses";
import { parsePlan,activityKinds } from "@/lib/course-data";
import { scheduleFor,scheduleRange } from "@/lib/queries";
import { dayKey, timeLabel } from "@/lib/dates";
import { bookingLabels } from "@/lib/consultations";
export const calendarTypes={class:"Занятия",checkpoint:"Контрольные точки",exam:"Зачёты и экзамены",consultation:"Консультации",extra:"Дополнительные мероприятия",personal:"Личные напоминания"} as const;
type Item={id:string,type:keyof typeof calendarTypes,title:string,start:Date,end?:Date,href?:string,detail:string,change?:string,pinned?:boolean};
export async function calendarFor(studentId:string,groupId:string,first:string,last:string) {
  const bounds=scheduleRange(first,last),range={gte:new Date(bounds.gte),lt:new Date(bounds.lt)};
  const [classes,courses,bookings,entries,exams]=await Promise.all([
    scheduleFor(groupId,first,last),studentCourses(studentId),
    db.consultationBooking.findMany({where:{studentId,status:{in:["CONFIRMED","COMPLETED"]},slot:{startsAt:range}},include:{slot:{include:{teacher:{select:{name:true}}}}}}),
    db.calendarEntry.findMany({where:{studentId,OR:[{activityId:{not:null}},{startsAt:range}]}}),
    db.exam.findMany({where:{enrollment:{studentId},start:range},include:{enrollment:{include:{subject:true}}}}),
  ]);
  const pins=new Map(entries.flatMap(item=>item.activityId?[[`${item.subjectId}:${item.activityId}`,item] as const]:[]));
  const plans=new Map(courses.map(course=>[course.id,(course.subject.plan?.versions??[]).map(version=>parsePlan(version.data))]));
  const items:Item[]=classes.map(item=>({id:item.id,type:"class",title:item.subject.title,start:item.start,end:item.end,
    href:"/schedule?day="+dayKey(item.start),detail:item.kind+" · "+item.room,
    change:item.cancelled?"Отменено":item.note??undefined}));
  for(const course of courses){
    const [plan,old]=plans.get(course.id)??[];
    for(const activity of plan?.activities??[]){
      const entry=pins.get(`${course.subjectId}:${activity.id}`);
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
    const [plan,previous]=plans.get(exam.enrollmentId)??[];
    const kind=exam.kind==="Зачёт"?"CREDIT":"EXAM";
    if(plan?.activities.some(activity=>activity.examId===exam.id||(activity.kind===kind&&(
      +new Date(activity.startsAt)===+exam.start||previous?.activities.some(item=>item.id===activity.id&&+new Date(item.startsAt)===+exam.start)
    )))) continue;
    items.push({id:exam.id,type:"exam",title:exam.enrollment.subject.title,start:exam.start,href:"/grades",detail:exam.kind+" · "+exam.room});
  }
  for(const booking of bookings) items.push({id:booking.id,type:"consultation",title:booking.topic,start:booking.slot.startsAt,end:booking.slot.endsAt,href:"/consultations",
    detail:booking.slot.teacher.name+" · "+(booking.slot.format==="ONLINE"?"Онлайн":booking.slot.location)+" · "+bookingLabels[booking.status]});
  for(const entry of entries) if(!entry.activityId&&entry.startsAt&&entry.title) items.push({id:entry.id,type:"personal",title:entry.title,start:entry.startsAt,detail:"Личное напоминание"});
  return items.filter(item=>{const day=dayKey(item.start);return day>=first&&day<=last;}).sort((a,b)=>+a.start-+b.start);
}
export async function setCourseEntry(studentId:string,subjectId:string,activityId:string,choice:"add"|"remove"|"join"|"skip") {
  const enrollment=await studentCourse(studentId,subjectId);
  const activity=parsePlan(enrollment?.subject.plan?.versions[0]?.data)?.activities.find(item=>item.id===activityId);
  if(!activity||activity.optional!==(choice==="join"||choice==="skip")) return false;
  const where={studentId,subjectId,activityId};
  if(choice==="remove") {await db.calendarEntry.deleteMany({where});return true;}
  const participation=choice==="join"?true:choice==="skip"?false:null;
  const registrationStatus=participation&&activity.registration?"PENDING":null;
  await db.$transaction(async tx=>{
    const created=await tx.calendarEntry.createMany({data:{...where,participation,registrationStatus},skipDuplicates:true});
    if(!created.count&&participation!==null) await tx.calendarEntry.updateMany({where:{...where,OR:[{participation:null},{participation:!participation}]},
      data:{participation,registrationStatus}});
  });
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
