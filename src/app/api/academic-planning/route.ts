import { z } from "zod";
import { getUser } from "@/lib/access";
import { db } from "@/lib/db";
import { fromLocal } from "@/lib/dates";
import { planSchema } from "@/lib/course-data";
import { saveCoursePlan,publishCourseResult,publishFinalGrade } from "@/lib/courses";
import { createSlot,reserveSlot,updateBooking,setSlotClosed } from "@/lib/consultations";
import { setCourseEntry,decideParticipation } from "@/lib/calendar";
const uuid=z.string().uuid(),revision=z.coerce.number().int().min(0);
const optionalId=z.union([uuid,z.literal("")]).optional();
const editorPlan=z.preprocess(value=>{
  if(!value||typeof value!=="object"||!("activities" in value)||!Array.isArray(value.activities)) return value;
  return {...value,activities:value.activities.map((item:unknown)=>{
    if(!item||typeof item!=="object"||!("startsAt" in item)||typeof item.startsAt!=="string") return item;
    return {...item,startsAt:fromLocal(item.startsAt)?.toISOString()??item.startsAt};
  })};
},planSchema);
const schema=z.discriminatedUnion("operation",[
  z.object({operation:z.literal("book"),id:uuid,slotId:uuid,topic:z.string().trim().min(3).max(150),comment:z.string().trim().max(700)}),
  z.object({operation:z.literal("bookingStatus"),id:uuid,revision,status:z.enum(["CONFIRMED","PROPOSED","REJECTED","CANCELLED","COMPLETED"]),slotId:optionalId}),
  z.object({operation:z.literal("slot"),start:z.string(),end:z.string(),format:z.enum(["IN_PERSON","ONLINE"]),location:z.string().trim().min(2).max(300)}),
  z.object({operation:z.literal("closeSlot"),id:uuid}),
  z.object({operation:z.literal("savePlan"),subjectId:uuid,revision,plan:editorPlan,intent:z.enum(["draft","publish"]),reason:z.string().trim().max(300)}),
  z.object({operation:z.literal("result"),subjectId:uuid,enrollmentId:uuid,activityId:uuid,status:z.enum(["GRADED","WAITING","MISSED"]),points:z.union([z.literal(""),z.number().int(),z.string().regex(/^\d{1,4}$/).transform(Number).pipe(z.number().max(1000))]).optional(),confirmCheckpoint:z.literal("on").optional()}),
  z.object({operation:z.literal("finalGrade"),enrollmentId:uuid,grade:z.enum(["2","3","4","5"])}),
  z.object({operation:z.literal("calendarActivity"),subjectId:uuid,activityId:uuid,choice:z.enum(["add","remove","join","skip"])}),
  z.object({operation:z.literal("reminder"),id:uuid,title:z.string().trim().min(2).max(120),start:z.string()}),
  z.object({operation:z.literal("removeReminder"),id:uuid}),
  z.object({operation:z.literal("participation"),id:uuid,status:z.enum(["CONFIRMED","REJECTED"])}),
]);
const reply=(message:string,status=200,href?:string)=>Response.json({message,href},{status});
export async function POST(request:Request) {
  const scheme=process.env.NODE_ENV==="production"&&process.env.AUTH_LOCAL_HTTP!=="1"?"https":"http";
  const origin=process.env.AUTH_URL?new URL(process.env.AUTH_URL).origin:scheme+"://"+request.headers.get("host");
  if(request.headers.get("origin")!==origin) return reply("Действие недоступно.",403);
  const user=await getUser();
  if(!user) return reply("Войдите в кабинет снова.",401);
  const body=await request.text();
  if(body.length>250000) return reply("Слишком большой запрос.",413);
  let json:unknown;
  try {json=JSON.parse(body);} catch {return reply("Проверьте данные формы.",400);}
  const parsed=schema.safeParse(json);
  if(!parsed.success) return reply("Проверьте поля и правила оценивания.",400);
  const data=parsed.data;
  const student=user.role==="STUDENT"&&Boolean(user.student),teacher=user.role==="TEACHER";
  try{
    switch(data.operation){
      case "book":
        if(!student) break;
        return await reserveSlot(user.id,data.slotId,data.topic,data.comment,data.id)?reply("Запрос отправлен.",200,"/consultations"):reply("Слот уже занят или недоступен. Обновите страницу.",409);
      case "bookingStatus":
        if(!student&&!teacher) break;
        return await updateBooking(user,{...data,slotId:data.slotId||undefined})?reply("Статус обновлён."):reply("Запись недоступна или уже изменилась.",404);
      case "slot":{
        if(!teacher) break;
        const start=fromLocal(data.start),end=fromLocal(data.end);
        if(!start||!end||start<=new Date()||end<=start||+end-+start>4*3600000) return reply("Укажите будущий интервал до четырёх часов.",400);
        if(data.format==="ONLINE"){
          try{if(new URL(data.location).protocol!=="https:") throw new Error();}
          catch{return reply("Укажите HTTPS-ссылку на онлайн-встречу.",400);}
        }
        return await createSlot(user.id,start,end,data.format,data.location)?reply("Слот опубликован."):reply("Это время пересекается с другим слотом.",409);
      }
      case "closeSlot":
        if(!teacher) break;
        return await setSlotClosed(data.id,user.id)?reply("Слот снят с записи."):reply("Слот недоступен или уже занят.",409);
      case "savePlan":
        if(!teacher) break;
        if(data.intent==="publish"&&(data.reason.length<3||!data.plan.activities.length)) return reply("Добавьте мероприятие и укажите причину публикации.",400);
        return await saveCoursePlan(data.subjectId,user.id,data.revision,data.plan,data.intent==="publish"?data.reason:undefined)
          ?reply(data.intent==="publish"?"Версия плана опубликована.":"Черновик сохранён."):reply("Курс недоступен или черновик уже изменился.",409);
      case "result":
        if(!teacher) break;
        return await publishCourseResult({...data,teacherId:user.id,points:typeof data.points==="number"?data.points:null})?reply("Результат опубликован."):reply("Проверьте балл, мероприятие и дисциплину.",400);
      case "finalGrade":
        if(!teacher) break;
        return await publishFinalGrade(user.id,data.enrollmentId,Number(data.grade))?reply("Итоговая оценка сохранена."):reply("Запись недоступна.",404);
      case "calendarActivity":
        if(!student) break;
        return await setCourseEntry(user.id,data.subjectId,data.activityId,data.choice)?reply("Календарь обновлён."):reply("Мероприятие недоступно.",404);
      case "reminder":{
        if(!student) break;
        const startsAt=fromLocal(data.start);
        if(!startsAt) return reply("Укажите корректную дату и время.",400);
        await db.calendarEntry.createMany({data:{id:data.id,studentId:user.id,title:data.title,startsAt},skipDuplicates:true});
        const saved=await db.calendarEntry.findFirst({where:{id:data.id,studentId:user.id,title:data.title,startsAt}});
        return saved?reply("Напоминание сохранено.",200,"/calendar?view=day&day="+data.start.slice(0,10)):reply("Обновите форму и попробуйте снова.",409);
      }
      case "removeReminder":
        if(!student) break;
        await db.calendarEntry.deleteMany({where:{id:data.id,studentId:user.id,activityId:null}});
        return reply("Напоминание удалено.");
      case "participation":
        if(!teacher) break;
        return await decideParticipation(user.id,data.id,data.status)?reply("Ответ отправлен."):reply("Запись недоступна.",404);
    }
  }catch(error){
    if(error instanceof Error&&/^(Сохраните мероприятия|Одну контрольную|Контрольная точка не относится|Связанное мероприятие сессии)/.test(error.message)) return reply(error.message,409);
    console.error(error);
    return reply("Действие не сохранено. Повторите попытку.",500);
  }
  return reply("Действие недоступно.",403);
}
