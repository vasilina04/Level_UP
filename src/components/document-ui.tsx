import Link from "next/link";
import { randomUUID } from "node:crypto";
import { ClipboardList, FileText, ChevronRight } from "lucide-react";
import { RequestFields } from "@/components/request-form";
import { CardHeader, IconTile, StatusPill } from "@/components/common";
import { documentDelivery, documentStatuses, documentTypes, type Status } from "@/lib/rules";
import { dateLabel, timeLabel } from "@/lib/dates";
import type { DocumentRequest, DocumentStatusHistory } from "@prisma/client";
const statusColors:Record<Status,string>={DRAFT:"neutral",SUBMITTED:"blue",REVIEW:"gold",APPROVED:"mint",REJECTED:"rose",READY:"mint"};
export function DocumentStatus({status}:{status:Status}) {return <StatusPill label={documentStatuses[status]} color={statusColors[status]}/>;}
export function DocumentRow({item,staff=false,student}:{item:DocumentRequest,staff?:boolean,student?:string}) {
  return <Link className="data-row" href={(staff?"/staff":"/documents")+"/"+item.id}><IconTile icon={FileText}/><div className="row-content"><strong>{documentTypes[item.type]}</strong><small>№ {item.number} · {student||dateLabel(item.createdAt)}</small></div><DocumentStatus status={item.status}/><ChevronRight className="row-arrow" size={16}/></Link>;
}
export function RequestForm({item,student}:{item?:DocumentRequest,student:{name:string,year:number,program:string}}) {
  return <section className="card detail-card form-card"><CardHeader title="Данные заявки" icon={ClipboardList}/>
  <RequestFields id={item?.id||randomUUID()} type={item?.type||"CERTIFICATE"} recipient={item?.recipient} details={item?.details} student={student}
    initialDelivery={item?.delivery??undefined} email={item?.contactEmail??undefined} phone={item?.contactPhone??undefined} address={item?.postalAddress??undefined}/></section>;
}
export function RequestDetails({item,studentName}:{item:DocumentRequest,studentName?:string}) {
  return <dl className="definition">
    {(item.reviewedName||studentName)&&<><dt>ФИО</dt><dd>{item.reviewedName||studentName}</dd></>}
    {item.reviewedYear&&<><dt>Курс</dt><dd>{item.reviewedYear}</dd></>}
    {item.reviewedProgram&&<><dt>Направление</dt><dd>{item.reviewedProgram}</dd></>}
    <dt>Адресат</dt><dd>{item.recipient}</dd><dt>Цель обращения</dt><dd>{item.details}</dd>
    <dt>Способ получения</dt><dd>{item.delivery?documentDelivery[item.delivery]:"Не указан"}</dd>
    {item.contactEmail&&<><dt>Электронная почта</dt><dd>{item.contactEmail}</dd></>}
    {item.contactPhone&&<><dt>Телефон</dt><dd>{item.contactPhone}</dd></>}
    {item.postalAddress&&<><dt>Почтовый адрес</dt><dd>{item.postalAddress}</dd></>}
    {item.reviewedAt&&<><dt>Данные подтверждены</dt><dd>{dateLabel(item.reviewedAt)}</dd></>}
  </dl>;
}
export function DocumentTimeline({history}:{history:(DocumentStatusHistory&{actor:{name:string}})[]}) {
  return <section className="card"><CardHeader title="История обработки" icon={ClipboardList} color="mint"/><ol className="timeline">{history.map(event=><li key={event.id}><DocumentStatus status={event.status}/><p>{dateLabel(event.createdAt)} · {timeLabel(event.createdAt)} · {event.actor.name}</p>{event.comment&&<p>{event.comment}</p>}</li>)}</ol></section>;
}
