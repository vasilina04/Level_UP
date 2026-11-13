import { z } from "zod";
import { getUser } from "@/lib/access";
import { saveDocument } from "@/lib/documents";
import { documentTypes } from "@/lib/rules";
const fields=z.object({
  id:z.string().uuid(),
  type:z.custom<keyof typeof documentTypes>(v=>typeof v==="string"&&Object.hasOwn(documentTypes,v)),
  recipient:z.string().trim().max(150),
  details:z.string().trim().max(1500),
  delivery:z.enum(["EMAIL","PICKUP","POSTAL"]).optional(),
  contactEmail:z.string().trim().max(254).optional(),
  contactPhone:z.string().trim().max(32).optional(),
  postalAddress:z.string().trim().max(400).optional(),
  confirmed:z.literal("yes").optional(),
  intent:z.enum(["draft","submit"]),
});
const fail=(message:string,status:number)=>Response.json({message},{status});
export async function POST(request:Request) {
  const scheme=process.env.NODE_ENV==="production"&&process.env.AUTH_LOCAL_HTTP!=="1"?"https":"http";
  const expected=process.env.AUTH_URL ? new URL(process.env.AUTH_URL).origin : scheme+"://"+request.headers.get("host");
  if(request.headers.get("origin")!==expected) return fail("Действие недоступно.",403);
  const user=await getUser();
  if(!user) return fail("Сессия завершена. Войдите в кабинет снова.",401);
  if(user.role!=="STUDENT"||!user.student) return fail("Действие недоступно.",403);
  if(!request.headers.get("content-type")?.startsWith("application/x-www-form-urlencoded")) return fail("Неверный формат заявки.",415);
  if(Number(request.headers.get("content-length"))>30_000) return fail("Заявка слишком длинная.",413);
  const body=await request.text();
  if(body.length>30_000) return fail("Заявка слишком длинная.",413);
  const parsed=fields.safeParse(Object.fromEntries(new URLSearchParams(body)));
  if(!parsed.success) return fail("Проверьте тип документа и длину полей.",400);
  const {intent,confirmed,delivery,contactEmail,contactPhone,postalAddress,...values}=parsed.data;
  if(intent==="submit" && (values.recipient.length<2||values.details.length<5)) return fail("Заполните адресата и цель обращения.",400);
  if(contactEmail&&!z.string().email().safeParse(contactEmail).success) return fail("Укажите корректный адрес электронной почты.",400);
  if(contactPhone&&!/^\+?[\d ()-]{7,32}$/.test(contactPhone)) return fail("Укажите корректный телефон.",400);
  if(intent==="submit"&&(!delivery||!confirmed||(!contactEmail&&!contactPhone))) return fail("Выберите способ получения, укажите контакт и подтвердите проверку данных.",400);
  if(intent==="submit"&&delivery==="EMAIL"&&!contactEmail) return fail("Укажите электронную почту для получения.",400);
  if(intent==="submit"&&delivery==="POSTAL"&&(!postalAddress||postalAddress.length<10)) return fail("Укажите полный почтовый адрес.",400);
  try {
    const result=await saveDocument(user.id,{
      ...values,delivery:delivery??null,contactEmail:contactEmail||null,contactPhone:contactPhone||null,
      postalAddress:delivery==="POSTAL"?postalAddress||null:null,
    },intent==="submit"?{name:user.name,year:user.student.year,program:user.student.program}:null);
    if(result.kind==="missing") return fail("Действие недоступно.",404);
    if(result.kind==="conflict") return fail("Заявка уже отправлена. Откройте её, чтобы увидеть сохранённые данные.",409);
    return Response.json({href:"/documents/"+result.id});
  } catch(error) {
    console.error("Document save failed",error);
    return fail("Не удалось сохранить заявку. Попробуйте ещё раз.",500);
  }
}
