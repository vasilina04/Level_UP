import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStudent } from "@/lib/access";
import { studentCourses } from "@/lib/courses";
import { activityKinds,parsePlan,ratingFor,roundingLabels } from "@/lib/course-data";
import { CourseLinks } from "@/components/course-links";
import { RatingCalculator } from "@/components/rating-calculator";
import { Empty,SectionTitle } from "@/components/common";
import { Button } from "@/components/ui/button";
export default async function Rating({searchParams}:{searchParams:Promise<{course?:string}>}){
  const user=await requireStudent(),{course:id}=await searchParams;
  const courses=await studentCourses(user.id),course=id?courses.find(row=>row.subjectId===id):courses[0];
  if(id&&!course) notFound();
  const plan=parsePlan(course?.subject.plan?.versions[0]?.data);
  const rating=plan&&course?ratingFor(plan,course.courseResults):null;
  const rule=plan?.rule;
  return <><SectionTitle title="Мой рейтинг"/>
    <form className="filter-bar"><label>Дисциплина<select name="course" defaultValue={course?.subjectId}>{courses.map(row=><option key={row.id} value={row.subjectId}>{row.subject.title}</option>)}</select></label><Button>Показать рейтинг</Button></form>
    {course&&<CourseLinks id={course.subjectId}/>}
    {rating&&course?<><div className="dashboard-grid"><section className="card stack"><h2>{course.subject.title}</h2>
      <div className="rating-numbers"><div><strong>{rating.score??rating.earned}</strong><small>Заработано</small></div><div><strong>{rating.maximum===null?rating.potential:Math.max(0,rating.maximum-(rating.score??0))}</strong><small>Можно набрать ещё</small></div><div><strong>{rule?.cap??"—"}</strong><small>Максимум по правилам</small></div></div>
      <p>Итоговая оценка: {course.finalGrade??"Ещё не выставлена"}</p>
      {rule?<p>Баллы за работу умножаются на её вес. Дополнительные мероприятия дают до {rule.bonus} баллов. Пороги оценок 3 / 4 / 5: {rule.pass} / {rule.good} / {rule.excellent}. Округление: {roundingLabels[rule.rounding]}.</p>:<p>Правила курса ещё не опубликованы. Доступны только баллы мероприятий.</p>}
    </section>{rule&&<RatingCalculator rule={rule} earned={rating.earned} bonusEarned={rating.bonusEarned} maximum={rating.maximum!} activities={rating.remaining.map(({id,title,max,weight,optional})=>({id,title,max,weight,optional}))}/>}</div>
    <section className="card spaced"><h2>Рейтинговые мероприятия</h2><div className="rows">{rating.rows.map(row=><Link className="data-row" key={row.id} href={`/courses/${course.subjectId}/map/${row.id}`}><div className="row-content"><strong>{row.title}</strong><small>{activityKinds[row.kind]} · вес {row.weight}</small></div><span>{row.result?.status==="MISSED"?"Пропущено":row.result?.points??"—"} / {row.max}</span></Link>)}</div></section>
    </>:course?.finalGrade!=null?<section className="card stack"><h2>{course.subject.title}</h2>
      <p>Итоговая оценка: {course.finalGrade}</p><p className="muted">Рейтинг появится после публикации плана.</p>
    </section>:<Empty title="Рейтинг появится после публикации плана"/>}
  </>;
}
