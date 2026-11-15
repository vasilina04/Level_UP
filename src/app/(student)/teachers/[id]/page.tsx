import { notFound } from "next/navigation";
import { randomUUID } from "node:crypto";
import { requireStudent } from "@/lib/access";
import { db } from "@/lib/db";
import { isUuid } from "@/lib/courses";
import { formatLabels, upcomingSlots } from "@/lib/consultations";
import { dateLabel, dayKey, timeLabel } from "@/lib/dates";
import { ConsultationRequest } from "@/components/consultation-request";
import { Back,Empty,SectionTitle } from "@/components/common";
export default async function Teacher({params}:{params:Promise<{id:string}>}){
  const user=await requireStudent(),{id}=await params;
  if(!isUuid(id)) notFound();
  const teacher=await db.user.findFirst({where:{id,role:"TEACHER",taughtSubjects:{some:{enrollments:{some:{studentId:user.id}}}}},
    select:{name:true,teacherProfile:true,taughtSubjects:{where:{enrollments:{some:{studentId:user.id}}},select:{title:true}},
      consultationSlots:{where:upcomingSlots(),orderBy:{startsAt:"asc"}}}});
  if(!teacher?.teacherProfile) notFound();
  const p=teacher.teacherProfile;
  const slots=teacher.consultationSlots.map(slot => ({ id:slot.id, day:dayKey(slot.startsAt),
    date:dateLabel(slot.startsAt,{day:"numeric",month:"long",year:"numeric"}),
    time:timeLabel(slot.startsAt)+"–"+timeLabel(slot.endsAt), format:slot.format, formatLabel:formatLabels[slot.format] }));
  return <><Back href="/teachers" label="К преподавателям"/><SectionTitle title={teacher.name} subtitle={p.department}/>
    <div className="dashboard-grid"><section className="card stack"><h2>Часы приёма</h2><p>{p.receptionHours}</p>
      <p>{p.building}, {p.room}</p><p>Дисциплины: {teacher.taughtSubjects.map(s=>s.title).join(", ")}</p>
      <p>Форматы: очно и онлайн, согласно опубликованным слотам.</p><a className="text-link" href={"mailto:"+p.contactEmail}>{p.contactEmail}</a>
      <p className="muted">Часы приёма справочные. Дождитесь подтверждения выбранного слота.</p>
    </section><section id="booking" className="card stack"><h2>Записаться на консультацию</h2>
      {slots.length?<ConsultationRequest id={randomUUID()} slots={slots}/>:<Empty title="Свободных слотов пока нет"/>}
    </section></div>
  </>;
}
