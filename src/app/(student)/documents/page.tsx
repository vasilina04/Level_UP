import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { requireStudent } from "@/lib/access";
import { db } from "@/lib/db";
import { CardHeader, Empty, SectionTitle } from "@/components/common";
import { Button } from "@/components/ui/button";
import { DocumentRow } from "@/components/document-ui";
export default async function Documents(){
  const {id}=await requireStudent();
  const items=await db.documentRequest.findMany({where:{studentId:id},orderBy:{createdAt:"desc"}});
  return <><div className="page-heading"><SectionTitle title="Заявки и справки" subtitle="Оформите документ или проверьте статус обращения."/><Button asChild><Link href="/documents/new"><Plus size={19}/> Новая заявка</Link></Button></div>
  <section className="card"><CardHeader title="Мои заявки" icon={FileText}/>{items.length?<div className="rows">{items.map(item=><DocumentRow key={item.id} item={item}/>)}</div>:<Empty title="Заявок пока нет">Новая заявка появится здесь после сохранения.</Empty>}</section></>;
}
