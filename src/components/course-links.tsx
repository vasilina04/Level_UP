import Link from "next/link";
export function CourseLinks({id}:{id:string}) {
  const map="/courses/"+id+"/map";
  return <nav className="tabs" aria-label="Действия по курсу">
    <Link href={map}>Карта курса</Link><Link href={"/rating?course="+id}>Мой рейтинг</Link><Link href={map+"/history"}>История изменений</Link>
  </nav>;
}
