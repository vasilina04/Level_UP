import { documentServices } from "@/lib/rules";
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
  return <><div className="page-heading"><SectionTitle title="Единое окно" subtitle="Выберите услугу, проверьте свои данные и отправьте заявку. Ответ и история обработки появятся в личном кабинете."/><Button asChild><Link href="/documents/new"><Plus size={19}/> Новая заявка</Link></Button></div>
  <div className="service-grid spaced">{Object.entries(documentServices).map(([type,service])=><section className="card service-card" key={type}><FileText size={30} className="text-mint" aria-hidden="true"/><h2>{service.title}</h2><p>{service.description}</p><Link className="button secondary" href={"/documents/new?type="+type}>Оформить заявку</Link></section>)}</div><p className="muted">По учебной работе <Link className="text-link" href="/teachers">найдите своего преподавателя</Link> и выберите время консультации.</p>
  <section className="card"><CardHeader title="Мои заявки" icon={FileText}/>{items.length?<div className="rows">{items.map(item=><DocumentRow key={item.id} item={item}/>)}</div>:<Empty title="Заявок пока нет">Новая заявка появится здесь после сохранения.</Empty>}</section></>;
}
