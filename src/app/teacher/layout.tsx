import { requireTeacher } from "@/lib/access";
import { Shell } from "@/components/shell";
export const dynamic="force-dynamic";
export default async function TeacherLayout({children}:{children:React.ReactNode}){
  const user=await requireTeacher();
  return <Shell name={user.name} subtitle="Преподаватель" teacher>{children}</Shell>;
}
