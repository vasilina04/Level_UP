import { ConsultationBooking,ConsultationSlot } from "@prisma/client";
import { bookingLabels,formatLabels } from "@/lib/consultations";
import { dateLabel,timeLabel } from "@/lib/dates";
import { PlanningForm } from "@/components/planning-form";
import { StatusPill } from "@/components/common";
export const slotLabel=(slot:ConsultationSlot)=>dateLabel(slot.startsAt)+" · "+timeLabel(slot.startsAt)+"–"+timeLabel(slot.endsAt)+" · "+formatLabels[slot.format];
export function BookingCard({booking,teacher,slots=[]}:{booking:ConsultationBooking&{slot:ConsultationSlot,person:string},teacher?:boolean,slots?:ConsultationSlot[]}){
  const {status,slot}=booking;
  const states=teacher?(status==="PENDING"?["CONFIRMED","REJECTED"]:status==="CONFIRMED"?["CANCELLED",...(slot.endsAt<=new Date()?["COMPLETED"]:[])]:status==="PROPOSED"?["CANCELLED","REJECTED"]:[])
    :status==="PROPOSED"?["CONFIRMED","CANCELLED"]:["PENDING","CONFIRMED"].includes(status)?["CANCELLED"]:[];
  const canMove=teacher&&["PENDING","PROPOSED","CONFIRMED"].includes(status)&&slots.length>0;
  const labels:Record<string,string>={CONFIRMED:teacher?"Подтвердить":"Принять время",REJECTED:"Отклонить",CANCELLED:"Отменить",COMPLETED:"Завершить"};
  return <article className="card stack"><h2>{booking.topic}</h2><p>{booking.person} · {slotLabel(slot)}</p>
    <div><StatusPill label={bookingLabels[status]} color={status==="CONFIRMED"?"mint":status==="CANCELLED"||status==="REJECTED"?"neutral":"violet"}/></div>
    {booking.comment&&<p>{booking.comment}</p>}
    {(status==="CONFIRMED"||status==="COMPLETED")&&(slot.format==="ONLINE"&&slot.location.startsWith("https://")?<a className="text-link" href={slot.location} rel="noreferrer">Открыть ссылку встречи</a>:<p>Место встречи: {slot.location}</p>)}
    {!!states.length&&<div className="planning-buttons">{states.map(next=><PlanningForm key={next} operation="bookingStatus" fields={{id:booking.id,revision:booking.revision,status:next}} label={labels[next]} secondary={next!=="CONFIRMED"}/>)}</div>}
    {canMove&&<PlanningForm operation="bookingStatus" fields={{id:booking.id,revision:booking.revision,status:"PROPOSED"}} label="Предложить другое время" secondary>
      <label>Другой свободный слот<select name="slotId" required>{slots.map(slot=><option key={slot.id} value={slot.id}>{slotLabel(slot)}</option>)}</select></label>
    </PlanningForm>}
  </article>;
}
