import { requireStaff } from "@/lib/access";
import { db } from "@/lib/db";
import { verifyAssessment } from "@/app/actions";
import { ActionForm, ScheduleEditForm, Submit } from "@/components/forms";
import { Empty, SectionTitle } from "@/components/common";
import { dateLabel, timeLabel } from "@/lib/dates";
export default async function AcademicStaff(){
  const {staff}=await requireStaff(),facultyId=staff.facultyId;
  const [assessments,events]=await Promise.all([
    db.assessment.findMany({where:{passedAt:null,...(facultyId?{enrollment:{student:{facultyId}}}:{})},include:{enrollment:{include:{subject:true,student:{include:{user:{select:{name:true}}}}}}},orderBy:{due:"asc"},take:50}),
    db.scheduleEvent.findMany({where:{end:{gte:new Date()},cancelled:false,...(facultyId?{group:{students:{some:{facultyId},every:{facultyId}}}}:{})},include:{group:true,subject:true},orderBy:{start:"asc"},take:20}),
  ]);
  return <><SectionTitle title="Учебные данные" subtitle="Подтверждение контрольных точек и изменения расписания."/><div className="dashboard-grid">
    <section className="card"><h2>Контрольные точки</h2>{assessments.length?assessments.map(a=><details className="subject" key={a.id}><summary><span><strong>{a.title}</strong><small>{a.enrollment.student.user.name} · {a.enrollment.subject.title}</small></span></summary><ActionForm action={verifyAssessment} className="stack subject-detail"><input type="hidden" name="id" value={a.id}/><p className="muted">Дедлайн · {dateLabel(a.due)}</p><Submit>Подтвердить выполнение</Submit></ActionForm></details>):<Empty title="Все контрольные точки закрыты"/>}</section>
    <section className="card"><h2>Ближайшие занятия</h2>{events.length?events.map(e=><details className="subject" key={e.id}><summary><span><strong>{e.subject.title}</strong><small>{e.group.name} · {dateLabel(e.start)} · {timeLabel(e.start)} · {e.room}</small></span></summary><ScheduleEditForm id={e.id} revision={e.revision} room={e.room} building={e.building||"Главный корпус"} teacher={e.teacherOverride||e.subject.teacher}/></details>):<Empty title="Ближайших занятий нет"/>}</section>
  </div></>;
}
