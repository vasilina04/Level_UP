import { z } from "zod";
import { getUser } from "@/lib/access";
import { sendCheckpointMessage } from "@/lib/checkpoints";
import { acceptsOrigin,readBoundedText } from "@/lib/request";
import { checkpointWork } from "@/lib/checkpoint-work";
const schema=z.object({id:z.string().uuid(),assessmentId:z.string().uuid(),body:z.string().trim().min(3).max(2000)});
export async function POST(request:Request){
  if(!acceptsOrigin(request)) return Response.json({message:"Действие недоступно."},{status:403});
  const user=await getUser();
  if(!user) return Response.json({message:"Войдите в кабинет снова."},{status:401});
  const body=await readBoundedText(request,20000);
  if(body===null) return Response.json({message:"Сообщение слишком длинное."},{status:413});
  let input:unknown;
  try {input=JSON.parse(body);} catch {return Response.json({message:"Проверьте формат сообщения."},{status:400});}
  const values=schema.safeParse(input);
  if(!values.success) return Response.json({message:"Введите сообщение от 3 до 2000 символов."},{status:400});
  const legacyPrefix="Работа на проверку\n";
  if(user.role==="STUDENT"&&values.data.body.startsWith(legacyPrefix)) {
    const work=values.data.body.slice(legacyPrefix.length).trim();
    if(work.length<3) return Response.json({message:"Добавьте результат работы или ссылку."},{status:400});
    const result=await checkpointWork({...values.data,operation:"submit",body:work},user);
    return result==="saved"?Response.json({saved:true}):Response.json({message:"Обновите страницу и проверьте статус работы."},{status:result==="denied"?404:409});
  }
  const result=await sendCheckpointMessage(values.data,user);
  if(result!=="saved") return Response.json({message:"Переписка недоступна."},{status:404});
  return Response.json({saved:true});
}
