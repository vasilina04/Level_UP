import { redirect } from "next/navigation";
import { getUser } from "@/lib/access";
export default async function Home() {
  const user=await getUser();
  redirect(user?.role==="TEACHER"?"/teacher":user?.role==="STAFF"?"/staff":user?"/dashboard":"/login");
}
