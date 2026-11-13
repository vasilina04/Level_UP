export const zone = process.env.APP_TIMEZONE || "Asia/Vladivostok";
export const dayKey = (date: Date) => new Intl.DateTimeFormat("en-CA", {timeZone:zone, year:"numeric", month:"2-digit", day:"2-digit"}).format(date);
export function addDays(day: string, days: number) {
  const date = new Date(day + "T12:00:00Z");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0,10);
}
export function weekOf(day: string) {
  return addDays(day, -((new Date(day + "T12:00:00Z").getUTCDay() + 6) % 7));
}
export const dateLabel = (date: Date, options: Intl.DateTimeFormatOptions = {day:"numeric", month:"long"}) => new Intl.DateTimeFormat("ru-RU", { ...options, timeZone:zone }).format(date);
export const timeLabel = (date: Date) => dateLabel(date, {hour:"2-digit", minute:"2-digit"});
export function fromLocal(value:string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) || !validDay(value.slice(0,10))) return null;
  const base=new Date(value+":00Z");
  if (!Number.isFinite(+base)) return null;
  const offset=new Intl.DateTimeFormat("en-US",{timeZone:zone,timeZoneName:"longOffset"}).formatToParts(base).find(part=>part.type==="timeZoneName")!.value.slice(3)||"+00:00";
  const date=new Date(value+":00"+offset);
  return dayKey(date)+"T"+timeLabel(date)===value?date:null;
}
export const calendarLabel = (day: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("ru-RU", {...options,timeZone:"UTC"}).format(new Date(day+"T12:00:00Z"));
export function validDay(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value+"T12:00:00Z");
  return !isNaN(+date) && date.toISOString().startsWith(value);
}
export function validScheduleDay(value:unknown):value is string {
  return validDay(value)&&value>="0001-01-15"&&value<="9999-12-17";
}
