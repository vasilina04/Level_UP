import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { requireTeacher } from "@/lib/access";
import { db } from "@/lib/db";
import { Empty, IconTile, SectionTitle, StatusPill } from "@/components/common";
export default async function TeacherPage(){
  const {id}=await requireTeacher();
  const points=await db.assessment.findMany({where:{enrollment:{subject:{instructorId:id}},OR:[{messages:{some:{author:{role:"STUDENT"}}}},{submissions:{some:{}}}]},include:{
    submissions:{orderBy:[{submittedAt:"desc"},{id:"desc"}],take:1},
    enrollment:{include:{subject:true,student:{include:{user:{select:{name:true}}}}}},
    messages:{orderBy:[{createdAt:"desc"},{id:"desc"}],take:1,select:{authorId:true}},
  }});
  return <><SectionTitle title="Вопросы студентов" subtitle="Работы на проверку и переписка по контрольным точкам ваших дисциплин."/>
    <section className="card">{points.length?<div className="rows">{points.map(point=>{
      const work=point.submissions[0];
      const pending=point.messages[0]?.authorId===point.enrollment.studentId;
      return <Link key={point.id} href={"/teacher/checkpoints/"+point.id} className="data-row"><IconTile icon={MessageSquare}/>
        <div className="row-content"><strong>{point.title}</strong><small>{point.enrollment.student.user.name} · {point.enrollment.subject.title}</small></div>
        <StatusPill color={work?.status==="SUBMITTED"||pending?"gold":"mint"} label={point.passedAt&&work?"Выполнено":work?.status==="SUBMITTED"?"Работа на проверке":work?.status==="REVISION"?"На доработке":pending?"Ожидает ответа":"Ответ отправлен"}/>
      </Link>;
    })}</div>:<Empty title="Вопросов пока нет"/>}</section>
  </>;
}
