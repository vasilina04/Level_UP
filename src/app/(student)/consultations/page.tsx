import { requireStudent } from "@/lib/access";
import { db } from "@/lib/db";
import { Back,Empty,SectionTitle } from "@/components/common";
import { BookingCard } from "@/components/consultation-ui";
export default async function Consultations(){
  const {id}=await requireStudent();
  const rows=await db.consultationBooking.findMany({where:{studentId:id},include:{slot:{include:{teacher:{select:{name:true}}}}},orderBy:{updatedAt:"desc"}});
  return <><Back href="/teachers" label="К преподавателям"/><SectionTitle title="Мои консультации"/>
    {rows.length?<div className="dashboard-grid">{rows.map(item=><BookingCard key={item.id} booking={{...item,person:item.slot.teacher.name}}/>)}</div>:<Empty title="Записей на консультации пока нет"/>}
  </>;
}
