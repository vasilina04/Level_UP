"use client";

import { useId, useState } from "react";
import { PlanningForm } from "@/components/planning-form";

type SlotOption = { id: string; day: string; date: string; time: string; format: string; formatLabel: string };

export function ConsultationRequest({ id, slots }: { id: string; slots: SlotOption[] }) {
  const prefix = useId();
  const [selectedDay, setDay] = useState("");
  const [selectedFormat, setFormat] = useState("");
  const days = new Map(slots.map(slot => [slot.day, slot.date]));
  const day = days.has(selectedDay) ? selectedDay : slots[0].day;
  const daySlots = slots.filter(slot => slot.day === day);
  const formats = new Map(daySlots.map(slot => [slot.format, slot.formatLabel]));
  const format = formats.has(selectedFormat) ? selectedFormat : daySlots[0].format;
  return <PlanningForm operation="book" fields={{ id }} label="Отправить заявку на консультацию">
    <div className="stack"><label htmlFor={prefix + "-date"}>Дата</label><select id={prefix + "-date"} value={day} onChange={event => setDay(event.target.value)}>
      {[...days].map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select></div>
    <div className="stack"><label htmlFor={prefix + "-format"}>Формат</label><select id={prefix + "-format"} value={format} onChange={event => setFormat(event.target.value)}>
      {[...formats].map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select></div>
    <div className="stack"><label htmlFor={prefix + "-time"}>Доступное время</label><select id={prefix + "-time"} key={day + format} name="slotId" required>
      {daySlots.filter(slot => slot.format === format).map(slot => <option key={slot.id} value={slot.id}>{slot.time}</option>)}
    </select></div>
    <label>Тема консультации<input name="topic" required minLength={3} maxLength={150}/></label>
    <label>Комментарий<textarea name="comment" maxLength={700}/></label>
  </PlanningForm>;
}
