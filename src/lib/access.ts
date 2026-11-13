import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
export const getUser = cache(async () => {
  const session = await auth();
  if (!session?.user.id) return null;
  return db.user.findUnique({where:{id:session.user.id},select:{id:true,name:true,role:true,
    student:{include:{faculty:true,group:true}},staff:true}});
});
export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}
export async function requireStudent() {
  const user = await requireUser();
  if (user.role !== "STUDENT" || !user.student) redirect(user.role==="TEACHER"?"/teacher":"/staff");
  return {...user, student:user.student};
}
export async function requireStaff() {
  const user = await requireUser();
  if (user.role !== "STAFF" || !user.staff) redirect("/denied");
  return {...user,staff:user.staff};
}
export async function requireTeacher(){
  const user=await requireUser();
  if(user.role!=="TEACHER") redirect("/denied");
  return user;
}
export function staffScope(facultyId: string | null) {
  return {status:{not:"DRAFT" as const}, ...(facultyId ? {student:{student:{is:{facultyId}}}} : {})};
}
