import { z } from "zod";
import { getUser } from "@/lib/access";
import { acceptsOrigin,readBoundedText } from "@/lib/request";
import { checkpointWork } from "@/lib/checkpoint-work";
import { revalidatePath } from "next/cache";

const uuid=z.string().uuid();
const schema=z.discriminatedUnion("operation",[
  z.object({operation:z.literal("start"),assessmentId:uuid}),
  z.object({operation:z.literal("submit"),assessmentId:uuid,id:uuid,body:z.string().trim().min(3).max(2000)}),
  z.object({operation:z.literal("review"),assessmentId:uuid,id:uuid,decision:z.enum(["REVISION","APPROVED"]),
    comment:z.string().trim().max(2000),points:z.number().int().min(0).optional(),grade:z.number().int().min(2).max(5).optional()}),
]).refine(value=>value.operation!=="review"||value.decision!=="REVISION"||value.comment.length>=3,"Укажите замечания для доработки.");

export async function POST(request:Request) {
  if(!acceptsOrigin(request)) return Response.json({message:"Действие недоступно."},{status:403});
  const user=await getUser();
  if(!user) return Response.json({message:"Войдите в кабинет снова."},{status:401});
  const body=await readBoundedText(request,20000);
  if(body===null) return Response.json({message:"Запрос слишком большой."},{status:413});
  let input:unknown;
  try {input=JSON.parse(body);} catch {return Response.json({message:"Проверьте данные формы."},{status:400});}
  const fields=schema.safeParse(input);
  if(!fields.success) return Response.json({message:"Проверьте текст, баллы, оценку и замечания преподавателя."},{status:400});
  const result=await checkpointWork(fields.data,user);
  if(result!=="saved") return Response.json({message:result==="invalid"?"Сверьте баллы с опубликованным планом дисциплины.":"Работа недоступна или её статус уже изменился. Обновите страницу."},
    {status:result==="denied"?404:result==="invalid"?400:409});
  revalidatePath("/","layout");
  return Response.json({saved:true});
}
