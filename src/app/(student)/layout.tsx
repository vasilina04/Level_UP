import { requireStudent } from "@/lib/access";
import { db } from "@/lib/db";
import { refreshInbox, statsFor } from "@/lib/queries";
import { Shell } from "@/components/shell";
export const dynamic="force-dynamic";
export default async function StudentLayout({children}:{children:React.ReactNode}) {
  const user=await requireStudent();
  const { student }=user;
  await refreshInbox(user.id,student.groupId,student.reminders);
  const [stats,unread]=await Promise.all([statsFor(user.id),db.notification.count({where:{userId:user.id,readAt:null}})]);
  return <Shell name={user.name} subtitle={student.group.name+" · "+student.year+" курс"} level={stats.xp.level} unread={unread} theme={student.theme} animations={student.animations}>{children}</Shell>;
}
