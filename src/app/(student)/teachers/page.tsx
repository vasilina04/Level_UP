import Link from "next/link";
import { requireStudent } from "@/lib/access";
import { db } from "@/lib/db";
import { Empty,SectionTitle } from "@/components/common";
import { Button } from "@/components/ui/button";
import { upcomingSlots } from "@/lib/consultations";
export default async function Teachers({searchParams}:{searchParams:Promise<{q?:string,department?:string}>}){
  const {id}=await requireStudent(),params=await searchParams;
  const q=typeof params.q==="string"?params.q.trim().slice(0,120):"";
  const department=typeof params.department==="string"?params.department:"";
  const teachers=await db.user.findMany({where:{role:"TEACHER",teacherProfile:{isNot:null},taughtSubjects:{some:{enrollments:{some:{studentId:id}}}}},
    select:{id:true,name:true,teacherProfile:true,taughtSubjects:{where:{enrollments:{some:{studentId:id}}},select:{title:true}},
      _count:{select:{consultationSlots:{where:upcomingSlots()}}}},orderBy:{name:"asc"}});
  const departments=[...new Set(teachers.map(item=>item.teacherProfile!.department))];
  const rows=teachers.filter(t=>(!department||t.teacherProfile?.department===department)&&
    [t.name,t.teacherProfile!.department,...t.taughtSubjects.map(s=>s.title)].some(value=>value.toLowerCase().includes(q.toLowerCase())));
  return <><SectionTitle title="Мои преподаватели" subtitle="Часы приёма, свободные слоты и запись на консультацию."/>
    <div className="page-heading"><form className="filter-bar"><label>Поиск<input name="q" defaultValue={q} placeholder="ФИО, дисциплина или кафедра"/></label>
      <label>Кафедра<select name="department" defaultValue={department}><option value="">Все кафедры</option>{departments.map(item=><option key={item}>{item}</option>)}</select></label><Button>Найти</Button></form>
      <Link className="text-link" href="/consultations">Мои консультации →</Link></div>
    {rows.length?<div className="teacher-grid">{rows.map(t=>{
      const p=t.teacherProfile!;
      return <article className="card teacher-card" key={t.id}><h2>{t.name}</h2><p>{p.department}</p><p>{t.taughtSubjects.map(s=>s.title).join(", ")}</p>
        <p className="muted">{p.building}, {p.room} · {p.receptionHours}</p><a className="text-link" href={"mailto:"+p.contactEmail}>{p.contactEmail}</a>
        <div className="planning-buttons"><Button asChild variant="secondary"><Link href={"/teachers/"+t.id}>Подробнее</Link></Button>
        {t._count.consultationSlots>0?<Button asChild><Link href={"/teachers/"+t.id+"#booking"}>Записаться</Link></Button>:<p className="muted">Нет свободных слотов</p>}</div>
      </article>;
    })}</div>:<Empty title="Преподаватели не найдены"/>}
  </>;
}
