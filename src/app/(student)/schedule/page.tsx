import { requireStudent } from "@/lib/access";
import { ScheduleTimetable, type ScheduleSearch } from "@/components/schedule-timetable";

export default async function Schedule({searchParams}:{searchParams:ScheduleSearch}) {
  const {student}=await requireStudent();
  return <ScheduleTimetable audience={{studentGroup:student.group}} searchParams={searchParams}/>;
}
