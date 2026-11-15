import Link from "next/link";
import { requireStudent } from "@/lib/access";
import { studentCourses } from "@/lib/courses";
import { Empty,SectionTitle } from "@/components/common";
export default async function Courses(){
  const {id}=await requireStudent();
  const courses=await studentCourses(id);
  return <><SectionTitle title="Карты курсов"/>
    {courses.length?<div className="dashboard-grid">{courses.map(({subject})=><Link className="card quest-card" key={subject.id} href={"/courses/"+subject.id+"/map"}><h2>{subject.title}</h2><p>{subject.teacher}</p><span className="text-link">Открыть карту →</span></Link>)}</div>:<Empty title="Дисциплины ещё не добавлены"/>}
  </>;
}
