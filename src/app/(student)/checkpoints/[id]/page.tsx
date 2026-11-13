import { requireStudent } from "@/lib/access";
import { CheckpointDetail } from "@/components/checkpoint-detail";
export default async function Page({params}:{params:Promise<{id:string}>}){
  const user=await requireStudent();
  return <CheckpointDetail id={(await params).id} user={{id:user.id,role:"STUDENT"}}/>;
}
