"use client";
import { useEffect, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { es } from "date-fns/locale";
import { format, isValid, parseISO } from "date-fns";
import { Calendar } from "./calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Input } from "./input";
import { Button } from "./button";

type Props = { value: string; onChange: (value: string) => void; label: string; disabled?: boolean; required?: boolean; min?: string; max?: string };
export function DatePicker({ value, onChange, label, disabled, required, min, max }: Props) {
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const selected = value ? parseISO(value.slice(0, 10)) : undefined;
  useEffect(()=>{
    const date=parseISO(value.slice(0,10));
    const valid=!value || (isValid(date) && format(date,"yyyy-MM-dd")===value.slice(0,10) && (!min||value.slice(0,10)>=min) && (!max||value.slice(0,10)<=max));
    input.current?.setCustomValidity(valid?"":"Introduce una fecha válida dentro del rango permitido.");
  },[value,min,max]);
  return <div className="date-picker-control">
    <Input ref={input} aria-label={label} placeholder="AAAA-MM-DD" pattern="\d{4}-\d{2}-\d{2}" maxLength={16} value={value} required={required} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button type="button" variant="ghost" size="icon" disabled={disabled} aria-label={`Abrir calendario: ${label}`} />}><CalendarDays /></PopoverTrigger>
      <PopoverContent className="w-auto max-w-[calc(100vw-2rem)] p-0" align="end">
        <Calendar mode="single" locale={es} selected={selected && isValid(selected) ? selected : undefined} defaultMonth={selected && isValid(selected) ? selected : undefined} disabled={(date) => Boolean((min && format(date, "yyyy-MM-dd") < min) || (max && format(date, "yyyy-MM-dd") > max))} onSelect={(date) => { onChange(date ? format(date, "yyyy-MM-dd") : ""); setOpen(false); }} />
      </PopoverContent>
    </Popover>
  </div>;
}
export function DateTimePicker({ value, onChange, label, disabled, required }: Props) {
  const date = value.split("T")[0];
  const [timeDraft,setTimeDraft]=useState("");
  const time=value.includes("T") ? value.split("T")[1]?.slice(0,5)??"" : timeDraft;
  return <div className="date-time-control">
    <DatePicker label={label} value={date} disabled={disabled} required={required} onChange={(next) => onChange(next.includes("T") ? next : /^\d{4}-\d{2}-\d{2}$/.test(next) ? `${next}T${time || "00:00"}` : next)} />
    <Input type="time" aria-label={`Hora: ${label}`} value={time} disabled={disabled} required={required} onChange={(e) => {setTimeDraft(e.target.value);if(/^\d{4}-\d{2}-\d{2}$/.test(date)) onChange(`${date}T${e.target.value}`);}} />
  </div>;
}
