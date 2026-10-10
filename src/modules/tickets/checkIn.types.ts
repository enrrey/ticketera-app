export type CheckInEvent={slug:string;name:string;status:string};
export type CheckInResult={code:'accepted'|'already_used'|'invalid'|'refunded'|'event_cancelled';message:string;ticketId?:string;checkedAt?:string};
