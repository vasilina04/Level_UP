import { requireTeacher } from "@/lib/access";
import { ScheduleTimetable, type ScheduleSearch } from "@/components/schedule-timetable";

export default async function TeacherSchedule({searchParams}:{searchParams:ScheduleSearch}) {
  const {id}=await requireTeacher();
  return <ScheduleTimetable audience={{teacherId:id}} searchParams={searchParams}/>;
}
