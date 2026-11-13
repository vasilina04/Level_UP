import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { requireTeacher } from "@/lib/access";
import { db } from "@/lib/db";
import { Empty, IconTile, SectionTitle, StatusPill } from "@/components/common";
export default async function TeacherPage(){
  const {id}=await requireTeacher();
  const points=await db.assessment.findMany({where:{enrollment:{subject:{instructorId:id}},messages:{some:{author:{role:"STUDENT"}}}},include:{
    enrollment:{include:{subject:true,student:{include:{user:{select:{name:true}}}}}},
    messages:{orderBy:[{createdAt:"desc"},{id:"desc"}],take:1,select:{authorId:true}},
  }});
  return <><SectionTitle title="Вопросы студентов" subtitle="Переписка по контрольным точкам ваших дисциплин."/>
    <section className="card">{points.length?<div className="rows">{points.map(point=>{
      const pending=point.messages[0]?.authorId===point.enrollment.studentId;
      return <Link key={point.id} href={"/teacher/checkpoints/"+point.id} className="data-row"><IconTile icon={MessageSquare}/>
        <div className="row-content"><strong>{point.title}</strong><small>{point.enrollment.student.user.name} · {point.enrollment.subject.title}</small></div>
        <StatusPill color={pending?"gold":"mint"} label={pending?"Ожидает ответа":"Ответ отправлен"}/>
      </Link>;
    })}</div>:<Empty title="Вопросов пока нет"/>}</section>
  </>;
}
