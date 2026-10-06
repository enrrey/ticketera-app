import { render, screen } from "@testing-library/react";
import { expect,it } from "vitest";
import { FeaturedEventsHero } from "./FeaturedEventsHero";
import type { Event } from "../types";
it("uses only explicitly highlighted events, including cities outside Lima",()=>{
  const base={category:"concert",date:"2030-01-01",venue:"Recinto",price:null,currency:"PEN",imageUrl:"/images/events/zayn.jpg"} as const;
  render(<FeaturedEventsHero events={[{...base,id:"one",title:"Destacado real",city:"Cusco",featured:true},{...base,id:"two",title:"Sin destacar",city:"Lima",featured:false}] as Event[]}/>);
  expect(screen.getAllByText("Destacado real")).toHaveLength(2);expect(screen.queryByText("Sin destacar")).not.toBeInTheDocument();
});
