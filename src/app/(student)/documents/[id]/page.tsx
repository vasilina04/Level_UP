import { notFound } from "next/navigation";
import { z } from "zod";
import { FileText } from "lucide-react";
import { requireStudent } from "@/lib/access";
import { db } from "@/lib/db";
import { Back, CardHeader, SectionTitle } from "@/components/common";
import { DocumentStatus, DocumentTimeline, RequestDetails, RequestForm } from "@/components/document-ui";
import { documentTypes } from "@/lib/rules";
export default async function Document({params}:{params:Promise<{id:string}>}){
  const user=await requireStudent(),id=z.string().uuid().safeParse((await params).id);
  if(!id.success) notFound();
  const item=await db.documentRequest.findFirst({where:{id:id.data,studentId:user.id},include:{history:{orderBy:[{createdAt:"asc"},{id:"asc"}],include:{actor:{select:{name:true}}}}}});
  if(!item) notFound();
  return <><Back href="/documents" label="К заявкам"/><SectionTitle title={"Заявка № "+item.number} subtitle={documentTypes[item.type]}/>
  <div className="dashboard-grid">{item.status==="DRAFT"?<RequestForm item={item} student={{name:user.name,year:user.student.year,program:user.student.program}}/>:<section className="card"><CardHeader title="Данные заявки" icon={FileText}/><DocumentStatus status={item.status}/><RequestDetails item={item}/></section>}<DocumentTimeline history={item.history}/></div></>;
}
