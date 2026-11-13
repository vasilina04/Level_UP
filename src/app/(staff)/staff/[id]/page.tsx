import { notFound } from "next/navigation";
import { z } from "zod";
import { FileText } from "lucide-react";
import { requireStaff, staffScope } from "@/lib/access";
import { db } from "@/lib/db";
import { changeRequest } from "@/app/actions";
import { ActionForm, Submit } from "@/components/forms";
import { Back, CardHeader, SectionTitle } from "@/components/common";
import { DocumentStatus, DocumentTimeline, RequestDetails } from "@/components/document-ui";
import { documentStatuses, documentTransitions, documentTypes } from "@/lib/rules";
export default async function StaffDocument({params}:{params:Promise<{id:string}>}){
  const {staff}=await requireStaff(),id=z.string().uuid().safeParse((await params).id);
  if(!id.success) notFound();
  const item=await db.documentRequest.findFirst({where:{id:id.data,...staffScope(staff.facultyId)},include:{student:{select:{name:true}},history:{orderBy:[{createdAt:"asc"},{id:"asc"}],include:{actor:{select:{name:true}}}}}});
  if(!item) notFound();
  const options=documentTransitions[item.status];
  return <><Back href="/staff" label="К заявкам студентов"/><SectionTitle title={"Заявка № "+item.number} subtitle={documentTypes[item.type]}/>
  <div className="dashboard-grid"><section className="card"><CardHeader title="Данные заявки" icon={FileText}/><DocumentStatus status={item.status}/><RequestDetails item={item} studentName={item.student.name}/>
  {options.length>0&&<ActionForm className="stack" action={changeRequest}><input type="hidden" name="id" value={item.id}/><input type="hidden" name="expected" value={item.status}/><label>Новый статус<select name="status">{options.map(s=><option value={s} key={s}>{documentStatuses[s]}</option>)}</select></label><label>Комментарий<textarea name="comment" maxLength={600} rows={3}/></label><Submit>Обновить статус</Submit></ActionForm>}</section><DocumentTimeline history={item.history}/></div></>;
}
