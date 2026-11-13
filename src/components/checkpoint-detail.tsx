import { randomUUID } from "node:crypto";
import { ClipboardCheck, MessageSquare } from "lucide-react";
import { notFound } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { checkpointScope } from "@/lib/checkpoints";
import { dateLabel, timeLabel } from "@/lib/dates";
import { Back, CardHeader, SectionTitle, StatusPill } from "@/components/common";
import { CheckpointForm } from "@/components/checkpoint-form";

export async function CheckpointDetail({id,user}:{id:string,user:{id:string,role:"STUDENT"|"TEACHER"}}){
  if(!z.string().uuid().safeParse(id).success) notFound();
  const scope=checkpointScope(id,user);
  if(!scope) notFound();
  const point=await db.assessment.findFirst({where:scope,include:{
    stage:true,enrollment:{include:{subject:true,student:{include:{user:{select:{name:true}}}}}},
    messages:{orderBy:[{createdAt:"asc"},{id:"asc"}],include:{author:{select:{name:true,role:true}}}},
  }});
  if(!point) notFound();
  const teacher=user.role==="TEACHER";
  if(teacher&&!point.messages.some(message=>message.authorId===point.enrollment.studentId)) notFound();
  const subject=point.enrollment.subject;
  return <><Back href={teacher?"/teacher":"/semester-map/"+point.stage.position} label={teacher?"К вопросам студентов":"К этапу семестра"}/>
    <SectionTitle title={point.title} subtitle={subject.title+" · "+(teacher?point.enrollment.student.user.name:subject.teacher)}/>
    <div className="dashboard-grid checkpoint-grid">
      <section className="card"><CardHeader title="Что нужно сделать" icon={ClipboardCheck}/>
        <p className="checkpoint-body">{point.instructions||"Для этой контрольной точки инструкции ещё не добавлены."}</p>
        <p className="muted">Срок · {dateLabel(point.due)} · вес {point.weight}</p>
        <div className="pill-row"><StatusPill color={point.passedAt?"mint":"violet"} label={point.passedAt?"Завершена":"Предстоит"}/></div>
      </section>
      <section className="card"><CardHeader title="Переписка по заданию" icon={MessageSquare} color="mint"/>
        {point.messages.length?<ol className="checkpoint-messages">{point.messages.map(m=><li key={m.id} className={m.author.role==="TEACHER"?"teacher-message":""}>
          <strong>{m.author.name}</strong><small>{dateLabel(m.createdAt)} · {timeLabel(m.createdAt)}</small><p className="checkpoint-body">{m.body}</p>
        </li>)}</ol>:<p className="muted spaced">Здесь появятся ваш вопрос и ответ преподавателя.</p>}
        {subject.instructorId?<CheckpointForm assessmentId={id} messageId={randomUUID()} teacher={teacher}/>:<p className="muted">Преподаватель для переписки ещё не назначен.</p>}
      </section>
    </div>
  </>;
}
