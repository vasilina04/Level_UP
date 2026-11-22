import Link from "next/link";
import { randomUUID } from "node:crypto";
import { ClipboardCheck, MessageSquare } from "lucide-react";
import { notFound } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { checkpointScope } from "@/lib/checkpoints";
import { dateLabel, timeLabel } from "@/lib/dates";
import { Back, CardHeader, SectionTitle, StatusPill } from "@/components/common";
import { CheckpointForm } from "@/components/checkpoint-form";
import { WorkReviewForm } from "@/components/work-review-form";
import { parsePlan,activityKinds } from "@/lib/course-data";
import { workStatus } from "@/lib/work-status";

export async function CheckpointDetail({id,user}:{id:string,user:{id:string,role:"STUDENT"|"TEACHER"}}){
  if(!z.string().uuid().safeParse(id).success) notFound();
  const scope=checkpointScope(id,user);
  if(!scope) notFound();
  const point=await db.assessment.findFirst({where:scope,include:{
    stage:true,enrollment:{include:{subject:{include:{plan:{include:{versions:{orderBy:{number:"desc"},take:1}}}}},student:{include:{user:{select:{name:true}}}}}},
    submissions:{orderBy:[{submittedAt:"desc"},{id:"desc"}],include:{reviewer:{select:{name:true}}}},
    messages:{orderBy:[{createdAt:"asc"},{id:"asc"}],include:{author:{select:{name:true,role:true}}}},
  }});
  if(!point) notFound();
  const teacher=user.role==="TEACHER";
  if(teacher&&!point.submissions.length&&!point.messages.some(message=>message.authorId===point.enrollment.studentId)) notFound();
  const subject=point.enrollment.subject;
  const activity=parsePlan(subject.plan?.versions[0]?.data)?.activities.find(item=>item.checkpointTitle===point.title);
  const latest=point.submissions[0];
  const status=workStatus(point);
  return <><Back href={teacher?"/teacher":"/grades"} label={teacher?"К вопросам студентов":"К зачётке"}/>
    <SectionTitle title={point.title} subtitle={subject.title+" · "+(teacher?point.enrollment.student.user.name:subject.teacher)}/>
    <div className="dashboard-grid checkpoint-grid">
      <section className="card"><CardHeader title="Что нужно сделать" icon={ClipboardCheck}/>
        <p className="muted">Преподаватель проверяет отправленную работу здесь или подтверждает результат в ведомости. Контрольную точку также может подтвердить уполномоченный сотрудник деканата. Отправка работы или вопроса не означает выполнение и не даёт XP.</p>{teacher&&<Link className="button secondary" href={"/teacher/courses/"+subject.id+"/results"}>Проверить и выставить результат</Link>}<p className="checkpoint-body">{point.instructions||"Для этой контрольной точки инструкции ещё не добавлены."}</p>
        <p className="muted">Срок · {dateLabel(point.due)} · вес {point.weight}</p>
        {activity?<><p>{activityKinds[activity.kind]} · {activity.format} · {activity.place}</p><p className="checkpoint-body">{activity.requirements}</p><p>Максимальный балл · {activity.max}</p>
          <Link className="text-link" href={teacher?`/teacher/courses/${subject.id}`:`/courses/${subject.id}/map/${activity.id}`}>{teacher?"План дисциплины →":"Условия и календарь мероприятия →"}</Link></>:<p className="muted">Максимальный балл появится после публикации связанного мероприятия в плане дисциплины.</p>}
        <div className="pill-row"><StatusPill color={point.passedAt?"mint":point.workStatus==="REVISION"?"gold":"violet"} label={status}/></div>
        {point.due<new Date()&&!point.passedAt&&<p className="muted">Срок сдачи истёк. Возможность поздней сдачи определяет преподаватель.</p>}
        {!teacher&&!point.passedAt&&point.workStatus==="NOT_STARTED"&&<WorkReviewForm assessmentId={id}/>}
      </section>
      <section className="card"><CardHeader title="Работа и вопросы преподавателю" icon={MessageSquare} color="mint"/>
        {point.messages.length?<ol className="checkpoint-messages">{point.messages.map(m=><li key={m.id} className={m.author.role==="TEACHER"?"teacher-message":""}>
          <strong>{m.author.name}</strong><small>{dateLabel(m.createdAt)} · {timeLabel(m.createdAt)}</small><p className="checkpoint-body">{m.body}</p>
        </li>)}</ol>:<p className="muted spaced">Здесь появятся ваш вопрос и ответ преподавателя.</p>}
        {subject.instructorId?<CheckpointForm assessmentId={id} messageId={randomUUID()} teacher={teacher} canSubmit={!point.passedAt&&latest?.status!=="SUBMITTED"}/>:<p className="muted">Преподаватель для переписки ещё не назначен.</p>}
      </section>
    </div>
    <section className="card spaced"><h2>Работа на проверку</h2>
      {!point.submissions.length&&<p className="muted">Отправьте текст результата или ссылку через форму выше. Преподаватель получит работу в своём кабинете.</p>}
      {point.submissions.map((submission,index)=><article className="subject-detail" key={submission.id}>
        <h3>Попытка {point.submissions.length-index}</h3><p className="muted">Отправлена {dateLabel(submission.submittedAt)} · {timeLabel(submission.submittedAt)}</p>
        <p className="checkpoint-body">{submission.body}</p><StatusPill label={submission.status==="APPROVED"?"Работа принята":submission.status==="REVISION"?"На доработке":"Отправлено на проверку"}/>
        {submission.comment&&<p className="checkpoint-body"><strong>Комментарий преподавателя</strong><br/>{submission.comment}</p>}
        {submission.reviewer&&<p className="muted">Проверил(а) {submission.reviewer.name}</p>}
        {submission.points!==null&&<p>Получено баллов · {submission.points} / {activity?.max??"—"} · оценка {submission.grade??"—"}</p>}
        {teacher&&index===0&&!point.passedAt&&submission.status==="SUBMITTED"&&<WorkReviewForm assessmentId={id} submissionId={submission.id} max={activity?.max}/>}
      </article>)}
    </section>
  </>;
}
