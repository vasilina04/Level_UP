import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTeacher } from "@/lib/access";
import { db } from "@/lib/db";
import { isUuid } from "@/lib/courses";
import { emptyPlan,parsePlan } from "@/lib/course-data";
import { dayKey,timeLabel,addDays } from "@/lib/dates";
import { Back,SectionTitle } from "@/components/common";
import { CoursePlanEditor } from "@/components/course-plan-editor";
export default async function EditCourse({params}:{params:Promise<{id:string}>}){
  const teacher=await requireTeacher(),{id}=await params;
  if(!isUuid(id)) notFound();
  const course=await db.subject.findFirst({where:{id,instructorId:teacher.id},include:{plan:{include:{versions:{orderBy:{number:"desc"},take:1}}},enrollments:{include:{assessments:{select:{title:true}}}}}});
  if(!course) notFound();
  const latest=course.plan?.versions[0],revision=course.plan?.draftRevision??0;
  const plan=parsePlan(course.plan?.draft)??parsePlan(latest?.data)??emptyPlan(course.title);
  const dates=Object.fromEntries(plan.activities.map(item=>{const date=new Date(item.startsAt);return [item.id,dayKey(date)+"T"+timeLabel(date)];}));
  const checkpoints=[...new Set(course.enrollments.flatMap(e=>e.assessments.map(a=>a.title)))];
  return <><Back href="/teacher/courses" label="К дисциплинам"/><SectionTitle title={course.title} subtitle={latest?`Опубликована версия ${latest.number}.0`:"План ещё не опубликован"}/>
    <Link className="text-link" href={`/teacher/courses/${id}/results`}>Результаты студентов →</Link>
    <CoursePlanEditor key={revision} subjectId={id} revision={revision} plan={plan} localDates={dates} defaultDate={addDays(dayKey(new Date()),7)+"T12:00"} checkpoints={checkpoints}/>
  </>;
}
