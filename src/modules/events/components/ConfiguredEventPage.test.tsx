import { render,screen } from "@testing-library/react";
import { expect,it } from "vitest";
import { EventPurchaseExperience } from "./EventPurchaseExperience";
it("shows persisted ticket prices and capacities without invented seat availability or demo checkout",()=>{
  render(<EventPurchaseExperience event={{id:"real",title:"Evento real",category:"concert",date:"2030-01-01",venue:"Recinto",city:"Lima",price:125.5,currency:"PEN",imageUrl:"https://cdn.example.com/img.jpg",featured:false,minimumAge:18,entryInstructions:"Traer documento",ticketOptions:[{id:"vip",name:"VIP",zone:"Platea norte",description:"Mesa para cuatro",priceCents:12550,capacity:20,seatingType:"box",peoplePerUnit:4,maxPerOrder:2,seatRows:[],available:18,salesStartAt:"2026-10-02T15:00:00Z",salesEndAt:"2030-01-01T15:00:00Z",sessionDates:["2030-01-01T20:00:00Z"]}]}}/>);
  expect(screen.getAllByText(/125[.,]50/).length).toBeGreaterThan(0);expect(screen.getByText(/20 espacios.*4 personas/)).toBeInTheDocument();
  expect(screen.getByText("Platea norte · Mesa o box")).toBeInTheDocument();expect(screen.getByText("Traer documento")).toBeInTheDocument();
  expect(screen.queryByText("Platinum")).not.toBeInTheDocument();expect(screen.queryByRole("button",{name:/Confirmar compra/})).not.toBeInTheDocument();
});
