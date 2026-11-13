import { FileText } from "lucide-react";
import { requireStaff, staffScope } from "@/lib/access";
import { db } from "@/lib/db";
import { CardHeader, Empty, SectionTitle } from "@/components/common";
import { DocumentRow } from "@/components/document-ui";
export default async function Staff(){
  const {staff}=await requireStaff();
  const items=await db.documentRequest.findMany({where:staffScope(staff.facultyId),include:{student:{select:{name:true}}},orderBy:{createdAt:"desc"}});
  return <><SectionTitle title="Заявки студентов" subtitle="Проверяйте обращения и обновляйте статус обработки."/><section className="card"><CardHeader title="Журнал заявок" icon={FileText}/>{items.length?<div className="rows">{items.map(item=><DocumentRow key={item.id} item={item} staff student={item.student.name}/>)}</div>:<Empty title="Заявок пока нет"/>}</section></>;
}
