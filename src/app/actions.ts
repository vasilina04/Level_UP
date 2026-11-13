"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { signOut } from "@/auth";
import { requireStaff, requireStudent } from "@/lib/access";
import { db } from "@/lib/db";
import { completePersonal, lockStudent } from "@/lib/progress";
import { updateDocument } from "@/lib/documents";
import { confirmAssessment, editSchedule, type ScheduleEdit } from "@/lib/academic";
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
export async function reviseSchedule(_:Result,data:FormData):Promise<Result> {
  await sameOrigin();
  const user=await requireStaff();
  const fields=z.object({id:uuid,revision:z.coerce.number().int().min(0),reason:z.string().trim().min(3).max(200)}).and(z.discriminatedUnion("kind",[
    z.object({kind:z.literal("room"),room:z.string().trim().min(1).max(80),building:z.string().trim().min(1).max(80)}),
    z.object({kind:z.literal("teacher"),teacherOverride:z.string().trim().min(2).max(100)}),
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
  } else edit=values;
  if(!await editSchedule(id,user.id,revision,edit,reason)) return {message:"Занятие уже изменилось или действие недоступно."};
  return {message:"Расписание обновлено",success:true,navigateTo:"/staff/academic"};
}
