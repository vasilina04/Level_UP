import { cache } from "react";
import { refreshCourseReminders } from "@/lib/courses";
import { refreshInbox } from "@/lib/queries";

export const refreshStudentInbox=cache(async (userId:string,groupId:string,reminders:boolean)=>{
  const coveredPoints=reminders?await refreshCourseReminders(userId):[];
  await refreshInbox(userId,groupId,reminders,coveredPoints);
});
