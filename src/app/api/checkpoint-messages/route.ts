import { z } from "zod";
import { getUser } from "@/lib/access";
import { sendCheckpointMessage } from "@/lib/checkpoints";
const schema=z.object({id:z.string().uuid(),assessmentId:z.string().uuid(),body:z.string().trim().min(3).max(2000)});
export async function POST(request:Request){
  const scheme=process.env.NODE_ENV==="production"&&process.env.AUTH_LOCAL_HTTP!=="1"?"https":"http";
  const expected=process.env.AUTH_URL?new URL(process.env.AUTH_URL).origin:scheme+"://"+request.headers.get("host");
  if(request.headers.get("origin")!==expected) return Response.json({message:"Действие недоступно."},{status:403});
  const user=await getUser();
  if(!user) return Response.json({message:"Войдите в кабинет снова."},{status:401});
  const values=schema.safeParse(await request.json().catch(()=>null));
  if(!values.success) return Response.json({message:"Введите сообщение от 3 до 2000 символов."},{status:400});
  const result=await sendCheckpointMessage(values.data,user);
  if(result!=="saved") return Response.json({message:"Переписка недоступна."},{status:404});
  return Response.json({saved:true});
}
