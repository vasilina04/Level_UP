import { redirect } from "next/navigation";
import { requireStudent } from "@/lib/access";
export default async function SemesterMap() {
  await requireStudent();
  redirect("/grades");
}
