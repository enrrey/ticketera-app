"use client";

import { SeatGrid } from "@/modules/seating";
import type { CheckoutTicketOption, SelectedSeat } from "../types";

export function SeatSelection({ option, selected, onChange, disabled = false, unavailable = [] }: {
  option: CheckoutTicketOption; selected: SelectedSeat[];
  onChange: (seats: SelectedSeat[]) => void; disabled?: boolean; unavailable?: SelectedSeat[];
}) {
  const key = (seat: SelectedSeat) => JSON.stringify([seat.rowLabel.trim().toLowerCase(), seat.seatNumber]);
  return <div className="sm:col-span-2"><SeatGrid key={option.id} section={{ ...option, seatingType: "numbered", capacity: option.capacity ?? option.available, seatRows: option.seatRows ?? [] }} selected={selected} occupied={unavailable} disabled={disabled} maxSelected={Math.min(option.maxPerOrder, option.available)} onToggle={(seat) => {
    const exists = selected.some((item) => key(item) === key(seat));
    onChange(exists ? selected.filter((item) => key(item) !== key(seat)) : [...selected, seat]);
  }} /></div>;
}
