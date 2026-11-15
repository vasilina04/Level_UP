import { db } from "@/lib/db";
import type { ConsultationFormat, ConsultationStatus, Prisma } from "@prisma/client";
export const bookingLabels={PENDING:"Ожидает подтверждения",CONFIRMED:"Подтверждена",PROPOSED:"Предложено другое время",REJECTED:"Отклонена",CANCELLED:"Отменена",COMPLETED:"Завершена"} as const;
export const formatLabels={IN_PERSON:"Очно",ONLINE:"Онлайн"} as const;
export const availableSlot={closed:false,startsAt:{gt:new Date(0)},bookings:{none:{status:{in:["PENDING","CONFIRMED","PROPOSED"] as ConsultationStatus[]}}}} satisfies Prisma.ConsultationSlotWhereInput;
export function upcomingSlots(){
  return {...availableSlot,startsAt:{gt:new Date()}};
}
export async function createSlot(teacherId:string,startsAt:Date,endsAt:Date,format:ConsultationFormat,location:string) {
  return db.$transaction(async tx=>{
    await tx.$queryRaw`SELECT id FROM "User" WHERE id=${teacherId}::uuid FOR UPDATE`;
    const overlap=await tx.consultationSlot.findFirst({where:{teacherId,closed:false,startsAt:{lt:endsAt},endsAt:{gt:startsAt}}});
    if(overlap) return false;
    await tx.consultationSlot.create({data:{teacherId,startsAt,endsAt,format,location}});
    return true;
  });
}
export async function reserveSlot(studentId:string,slotId:string,topic:string,comment:string,id:string) {
  return db.$transaction(async tx=>{
    const existing=await tx.consultationBooking.findFirst({where:{id,studentId,slotId,topic,comment}});
    if(existing) return true;
    await tx.$queryRaw`SELECT id FROM "ConsultationSlot" WHERE id=${slotId}::uuid FOR UPDATE`;
    const slot=await tx.consultationSlot.findFirst({where:{id:slotId,...upcomingSlots(),
      teacher:{role:"TEACHER",taughtSubjects:{some:{enrollments:{some:{studentId}}}}}},select:{id:true}});
    if(!slot) return false;
    const inserted=await tx.consultationBooking.createMany({data:{id,studentId,slotId,topic,comment},skipDuplicates:true});
    if(inserted.count) return true;
    return Boolean(await tx.consultationBooking.findFirst({where:{id,studentId,slotId,topic,comment}}));
  });
}
const teacherTransitions:Partial<Record<ConsultationStatus,ConsultationStatus[]>>={
  PENDING:["CONFIRMED","REJECTED","PROPOSED"],CONFIRMED:["PROPOSED","CANCELLED","COMPLETED"],PROPOSED:["PROPOSED","CANCELLED","REJECTED"],
};
export async function updateBooking(actor:{id:string,role:string},input:{id:string,revision:number,status:ConsultationStatus,slotId?:string}) {
  return db.$transaction(async tx=>{
    const isTeacher=actor.role==="TEACHER";
    if(!isTeacher&&actor.role!=="STUDENT") return false;
    const booking=await tx.consultationBooking.findFirst({where:{id:input.id,...(isTeacher?{slot:{teacherId:actor.id}}:{studentId:actor.id})},include:{slot:true}});
    if(!booking||booking.revision!==input.revision) return false;
    const next=input.status;
    const allowed=isTeacher?teacherTransitions[booking.status]?.includes(next):
      (next==="CANCELLED"&&["PENDING","PROPOSED","CONFIRMED"].includes(booking.status))||(next==="CONFIRMED"&&booking.status==="PROPOSED");
    if(!allowed) return false;
    if(next==="COMPLETED"&&booking.slot.endsAt>new Date()) return false;
    if(next==="CONFIRMED"&&booking.slot.startsAt<=new Date()) return false;
    let slotId=booking.slotId;
    if(next==="PROPOSED"){
      if(!input.slotId||input.slotId===slotId) return false;
      await tx.$queryRaw`SELECT id FROM "ConsultationSlot" WHERE id=${input.slotId}::uuid FOR UPDATE`;
      const slot=await tx.consultationSlot.findFirst({where:{id:input.slotId,teacherId:actor.id,...upcomingSlots()}});
      if(!slot) return false;
      slotId=slot.id;
    }
    const changed=await tx.consultationBooking.updateMany({where:{id:booking.id,revision:input.revision},data:{slotId,status:next,revision:{increment:1}}});
    if(!changed.count) return false;
    await tx.auditLog.create({data:{actorId:actor.id,targetId:booking.id,action:"consultation.status",details:{from:booking.status,to:next,previousSlot:booking.slotId,slotId}}});
    if(isTeacher) await tx.notification.create({data:{userId:booking.studentId,type:"CONSULTATION",title:"Консультация · "+bookingLabels[next],body:booking.topic,
      href:"/consultations",eventKey:`consultation:${booking.id}:${input.revision+1}`}});
    return true;
  });
}
export async function setSlotClosed(id:string,teacherId:string) {
  return db.$transaction(async tx=>{
    await tx.$queryRaw`SELECT id FROM "ConsultationSlot" WHERE id=${id}::uuid FOR UPDATE`;
    const updated=await tx.consultationSlot.updateMany({where:{id,teacherId,...upcomingSlots()},data:{closed:true}});
    return updated.count===1;
  });
}
