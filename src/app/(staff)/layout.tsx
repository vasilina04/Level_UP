import { requireStaff } from "@/lib/access";
import { Shell } from "@/components/shell";
export const dynamic="force-dynamic";
export default async function StaffLayout({children}:{children:React.ReactNode}) {
  const user=await requireStaff();
  return <Shell name={user.name} subtitle="Учебный отдел" staff>{children}</Shell>;
}
