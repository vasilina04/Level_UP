import { checkpointProgress } from "@/lib/weights";
import Link from "next/link";
import { requireStudent } from "@/lib/access";
import { studentCourses } from "@/lib/courses";
import { Empty,SectionTitle,Progress } from "@/components/common";
export default async function Courses(){
  const {id}=await requireStudent();
  const courses=await studentCourses(id);
  return <><SectionTitle title="Планы дисциплин"/>
    {courses.length?<div className="dashboard-grid">{courses.map(({subject,assessments})=><Link className="card quest-card" key={subject.id} href={"/courses/"+subject.id+"/map"}><h2>{subject.title}</h2><p>{subject.teacher}</p><Progress value={checkpointProgress(assessments).percent} label={"Прогресс дисциплины · "+subject.title}/><span className="text-link">Открыть план →</span></Link>)}</div>:<Empty title="Дисциплины ещё не добавлены"/>}
  </>;
}
