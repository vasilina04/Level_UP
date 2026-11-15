import { notFound } from "next/navigation";
import { requireStudent } from "@/lib/access";
import { studentCourse } from "@/lib/courses";
import { parsePlan,planDiff } from "@/lib/course-data";
import { dateLabel,timeLabel } from "@/lib/dates";
import { Back,Empty,SectionTitle } from "@/components/common";
export default async function History({params}:{params:Promise<{id:string}>}){
  const user=await requireStudent(),{id}=await params,course=await studentCourse(user.id,id,true);
  if(!course) notFound();
  const versions=course.subject.plan?.versions??[];
  return <><Back href={"/courses/"+id+"/map"} label="К карте курса"/><SectionTitle title="История изменений" subtitle={course.subject.title}/>
    {versions.length?<div className="stack">{versions.map((version,index)=>{
      const plan=parsePlan(version.data);
      if(!plan) return null;
      const changes=planDiff(parsePlan(versions[index+1]?.data),plan);
      return <article className="card stack" key={version.id}><h2>Версия {version.number}.0</h2>
        <p>{dateLabel(version.publishedAt)} · {timeLabel(version.publishedAt)} · {version.author.name}</p><p>{version.reason}</p>
        <ul className="planning-list">{changes.map((change,i)=><li key={i}>{change}</li>)}</ul>
      </article>;
    })}</div>:<Empty title="Версий плана пока нет"/>}
  </>;
}
