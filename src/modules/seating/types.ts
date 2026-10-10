export type SectionPosition = 'north' | 'south' | 'east' | 'west' | 'center';
export type SeatingLayout = { enabled: boolean; template: 'stadium' | 'theater' | 'custom'; stagePosition: 'north' | 'south' };
export type SeatCoordinate = { rowLabel: string; seatNumber: number };
export type MapSection = {
  id?: string; name: string; zone: string; seatingType: 'standing'|'seated'|'numbered'|'box';
  capacity: number; seatRows: {label:string;seats:number}[]; priceCents: number; mapPosition?: SectionPosition;
};
export const defaultSeatingLayout: SeatingLayout = {enabled:false,template:'stadium',stagePosition:'north'};
