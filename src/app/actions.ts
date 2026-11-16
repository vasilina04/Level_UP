"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { signOut } from "@/auth";
import { requireStaff, requireStudent } from "@/lib/access";
import { db } from "@/lib/db";
import { completePersonal, lockStudent } from "@/lib/progress";
import { updateDocument } from "@/lib/documents";
import { addScheduleLesson, confirmAssessment, editSchedule, type ScheduleEdit } from "@/lib/academic";
import { fromLocal } from "@/lib/dates";
import { documentStatuses } from "@/lib/rules";

const uuid=z.string().uuid();
const statusSchema=z.custom<keyof typeof documentStatuses>(v=>typeof v==="string"&&Object.hasOwn(documentStatuses,v));
export type Result={message:string,success?:boolean,leveled?:boolean,navigateTo?:string} | null;
async function sameOrigin() {
  const h=await headers();
  const origin=h.get("origin");
  if (!origin) throw new Error("Missing request origin");
  const target=process.env.AUTH_URL ? new URL(process.env.AUTH_URL).origin : (process.env.NODE_ENV==="production"&&process.env.AUTH_LOCAL_HTTP!=="1"?"https://":"http://")+(h.get("host")||"");
  if (origin!==target) throw new Error("Invalid request origin");
}
const denied={message:"Действие недоступно."};
export async function logout() { await sameOrigin(); await signOut({redirectTo:"/login"}); }
export async function completeQuest(_:Result,data:FormData):Promise<Result> {
  await sameOrigin();
  const user=await requireStudent();
  const id=uuid.safeParse(data.get("id"));
  if(!id.success) return denied;
  const { levelFor }=await import("@/lib/rules");
  const outcome=await db.$transaction(async tx=>{
    await lockStudent(tx,user.id);
    const before=await tx.xpEvent.aggregate({where:{studentId:user.id},_sum:{amount:true}});
    const ok=await completePersonal(tx,user.id,id.data,new Date());
    const after=await tx.xpEvent.aggregate({where:{studentId:user.id},_sum:{amount:true}});
    return {ok,leveled:levelFor(after._sum.amount??0).level>levelFor(before._sum.amount??0).level};
  });
  if(!outcome.ok) return denied;
  revalidatePath("/","layout");
  return {message:outcome.leveled?"Новый уровень!":"Квест выполнен",success:true,leveled:outcome.leveled};
}
export async function changeRequest(_:Result,data:FormData):Promise<Result> {
  await sameOrigin();
  const user=await requireStaff();
  const fields=z.object({id:uuid,expected:statusSchema,status:statusSchema,comment:z.string().trim().max(600)}).safeParse(Object.fromEntries(data));
  if(!fields.success) return {message:"Проверьте статус и комментарий."};
  const {id,expected,status,comment}=fields.data;
  if(status==="REJECTED"&&!comment) return {message:"Укажите причину отклонения."};
  if(!await updateDocument(user.id,user.staff.facultyId,id,expected,status,comment)) return {message:"Статус уже изменился или действие недоступно."};
  return {message:"Статус обновлён",success:true,navigateTo:"/staff/"+id};
}
export async function markNotification(data:FormData) {
  await sameOrigin();
  const user=await requireStudent();
  const value=data.get("id");
  const id=uuid.safeParse(value);
  if(value==="all"||id.success) await db.notification.updateMany({where:{userId:user.id,readAt:null,...(id.success?{id:id.data}:{})},data:{readAt:new Date()}});
  revalidatePath("/","layout");
}
export async function saveSettings(_:Result,data:FormData):Promise<Result> {
  await sameOrigin();
  const user=await requireStudent();
  const theme=z.enum(["dark","light"]).safeParse(data.get("theme"));
  if(!theme.success) return denied;
  await db.studentProfile.update({where:{userId:user.id},data:{theme:theme.data,animations:data.get("animations")==="on",reminders:data.get("reminders")==="on"}});
  revalidatePath("/","layout");
  return {message:"Настройки сохранены",success:true};
}
export async function verifyAssessment(_:Result,data:FormData):Promise<Result> {
  await sameOrigin();
  const user=await requireStaff();
  const id=uuid.safeParse(data.get("id"));
  if(!id.success||!await confirmAssessment(id.data,user.id)) return denied;
  revalidatePath("/","layout");
  return {message:"Контрольная точка подтверждена",success:true};
}
export async function createLesson(_:Result,data:FormData):Promise<Result> {
  await sameOrigin();
  const user=await requireStaff();
  const fields=z.object({
    id:uuid,offering:z.string().transform(value=>value.split(":")).pipe(z.tuple([uuid,uuid])),
    kind:z.enum(["Лекция","Практика","Лабораторная","Семинар"]),format:z.enum(["Очно","Онлайн"]),
    start:z.string(),end:z.string(),room:z.string().trim().max(80).optional(),building:z.string().trim().max(80).optional(),
    reason:z.string().trim().min(3).max(200),
  }).safeParse(Object.fromEntries(data));
  if(!fields.success) return {message:"Проверьте данные занятия и укажите причину добавления."};
  const {id,offering:[groupId,subjectId],kind,format,reason}=fields.data;
  const start=fromLocal(fields.data.start),end=fromLocal(fields.data.end);
  if(!start||!end||end<=start) return {message:"Укажите корректное время начала и окончания."};
  const online=format==="Онлайн",room=online?"Онлайн":fields.data.room,building=online?null:fields.data.building;
  if(!room||(!online&&!building)) return {message:"Укажите корпус и аудиторию."};
  if(!await addScheduleLesson(user.id,{id,groupId,subjectId,start,end,kind,format,room,building:building??null},reason))
    return {message:"Занятие уже добавлено или дисциплина недоступна для выбранной группы."};
  return {message:"Занятие добавлено",success:true,navigateTo:"/staff/academic"};
}
export async function reviseSchedule(_:Result,data:FormData):Promise<Result> {
  await sameOrigin();
  const user=await requireStaff();
  const fields=z.object({id:uuid,revision:z.coerce.number().int().min(0),reason:z.string().trim().min(3).max(200)}).and(z.discriminatedUnion("kind",[
    z.object({kind:z.literal("room"),room:z.string().trim().min(1).max(80),building:z.string().trim().min(1).max(80)}),
    z.object({kind:z.literal("teacher"),teacherOverride:z.string().trim().max(100).optional(),teacherOverrideId:z.union([uuid,z.literal(""),z.literal("original")]).optional()}),
    z.object({kind:z.literal("time"),start:z.string(),end:z.string()}),
    z.object({kind:z.literal("cancel")}),
  ])).safeParse(Object.fromEntries(data));
  if(!fields.success) return {message:"Заполните поля изменения и укажите причину."};
  const {id,revision,reason,...values}=fields.data;
  let edit:ScheduleEdit;
  if(values.kind==="cancel") edit={kind:"cancel",cancelled:true};
  else if(values.kind==="time"){
    const start=fromLocal(values.start),end=fromLocal(values.end);
    if(!start||!end||end<=start) return {message:"Укажите корректное время начала и окончания."};
    edit={kind:"time",start,end};
  } else if(values.kind==="teacher"){
    const choice=values.teacherOverrideId;
    if(!choice&&(values.teacherOverride?.length??0)<2) return {message:"Укажите имя преподавателя или выберите его аккаунт."};
    edit={kind:"teacher",teacherOverride:choice?null:values.teacherOverride??null,teacherOverrideId:choice&&choice!=="original"?choice:null};
  } else edit=values;
  if(!await editSchedule(id,user.id,revision,edit,reason)) return {message:"Изменение не сохранено. Проверьте поля и обновите страницу, если занятие уже изменилось."};
  return {message:"Расписание обновлено",success:true,navigateTo:"/staff/academic"};
}
