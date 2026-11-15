import { requireTeacher } from "@/lib/access";
import { db } from "@/lib/db";
import { upcomingSlots } from "@/lib/consultations";
import { BookingCard,slotLabel } from "@/components/consultation-ui";
import { Empty,SectionTitle } from "@/components/common";
import { PlanningForm } from "@/components/planning-form";
export default async function TeacherConsultations(){
  const {id}=await requireTeacher();
  const [slots,rows]=await Promise.all([
    db.consultationSlot.findMany({where:{teacherId:id,...upcomingSlots()},orderBy:{startsAt:"asc"}}),
    db.consultationBooking.findMany({where:{slot:{teacherId:id}},include:{slot:true,student:{include:{user:{select:{name:true}}}}},orderBy:{updatedAt:"desc"}}),
  ]);
  return <><SectionTitle title="Управление консультациями"/><div className="dashboard-grid">
    <section className="card stack"><h2>Опубликовать слот</h2><PlanningForm operation="slot" label="Опубликовать слот">
      <label>Начало<input name="start" type="datetime-local" required/></label><label>Конец<input name="end" type="datetime-local" required/></label>
      <label>Формат<select name="format"><option value="IN_PERSON">Очно</option><option value="ONLINE">Онлайн</option></select></label>
      <label>Кабинет или HTTPS-ссылка<input name="location" required maxLength={300}/></label>
    </PlanningForm></section><section className="card stack"><h2>Свободные слоты</h2>
      {slots.length?slots.map(slot=><div className="data-row" key={slot.id}><span>{slotLabel(slot)}</span><PlanningForm operation="closeSlot" fields={{id:slot.id}} label="Снять слот" secondary/></div>):<Empty title="Свободных слотов нет"/>}
    </section></div><section className="stack spaced"><h2>Запросы студентов</h2>
      {rows.length?<div className="dashboard-grid">{rows.map(item=><BookingCard key={item.id} booking={{...item,person:item.student.user.name}} teacher slots={slots}/>)}</div>:<Empty title="Запросов пока нет"/>}
    </section>
  </>;
}
