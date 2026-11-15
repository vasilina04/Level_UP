import Link from "next/link";
import { requireTeacher } from "@/lib/access";
import { db } from "@/lib/db";
import { Empty,SectionTitle } from "@/components/common";
export default async function TeacherCourses(){
  const {id}=await requireTeacher();
  const courses=await db.subject.findMany({where:{instructorId:id},orderBy:{title:"asc"}});
  return <><SectionTitle title="Мои дисциплины"/>
    {courses.length?<div className="dashboard-grid">{courses.map(course=><article className="card stack" key={course.id}><h2>{course.title}</h2><Link className="text-link" href={`/teacher/courses/${course.id}`}>Редактировать план →</Link><Link className="text-link" href={`/teacher/courses/${course.id}/results`}>Опубликовать результаты →</Link></article>)}</div>:<Empty title="Назначенных дисциплин нет"/>}
  </>;
}
