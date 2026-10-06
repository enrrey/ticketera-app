import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { useState } from "react";
import { DatePicker, DateTimePicker } from "./date-picker";
it("opens the Spanish shadcn calendar, selects a date and closes it", async()=>{
  function Field(){const [value,setValue]=useState("2030-01-01");return <DatePicker label="Fecha" value={value} max="2030-01-10" onChange={setValue}/>;}
  render(<Field/>);fireEvent.change(screen.getByLabelText("Fecha"),{target:{value:"2030-01-20"}});
  expect((screen.getByLabelText("Fecha") as HTMLInputElement).validity.customError).toBe(true);
  fireEvent.change(screen.getByLabelText("Fecha"),{target:{value:"2030-01-01"}});
  fireEvent.click(screen.getByRole("button",{name:"Abrir calendario: Fecha"}));
  const days=await screen.findAllByRole("button",{name:/5 de enero/i});fireEvent.click(days[0]);
  expect(screen.getByLabelText("Fecha")).toHaveValue("2030-01-05");
  expect((screen.getByLabelText("Fecha") as HTMLInputElement).validity.customError).toBe(false);
  await waitFor(()=>expect(screen.queryByRole("button",{name:/5 de enero/i})).not.toBeInTheDocument());
});
it("allows manual partial date typing without inserting the time into the date field",()=>{
  function Field(){const [value,setValue]=useState("");return <DateTimePicker label="Inicio" value={value} onChange={setValue}/>;}
  render(<Field/>);fireEvent.change(screen.getByLabelText("Inicio"),{target:{value:"2"}});
  expect(screen.getByLabelText("Inicio")).toHaveValue("2");
  fireEvent.change(screen.getByLabelText("Inicio"),{target:{value:"2030-01-01"}});
  fireEvent.change(screen.getByLabelText("Hora: Inicio"),{target:{value:"20:30"}});
  expect(screen.getByLabelText("Inicio")).toHaveValue("2030-01-01");expect(screen.getByLabelText("Hora: Inicio")).toHaveValue("20:30");
});
it("preserves date and time independently and disables calendar interaction",()=>{
  const change=vi.fn();render(<DateTimePicker label="Inicio" value="2030-01-01T20:30" onChange={change} disabled/>);
  expect(screen.getByRole("button",{name:"Abrir calendario: Inicio"})).toBeDisabled();
  expect(screen.getByLabelText("Hora: Inicio")).toHaveValue("20:30");
});

