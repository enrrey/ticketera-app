// @vitest-environment node
import { expect,it } from "vitest";
import { isEventImageUrl } from "./eventImageUrl";
it("accepts local assets and public HTTPS images and rejects executable or local-network sources",()=>{
  for(const value of ["","/images/events/zayn.jpg","https://cdn.example.com/cover.jpg?version=2"]) expect(isEventImageUrl(value)).toBe(true);
  for(const value of ["javascript:alert(1)","data:image/svg+xml;base64,abc","http://cdn.example.com/img","https://user:password@example.com/img","https://localhost/img","https://127.0.0.1/img","https://192.168.0.1/img","https://[::1]/img","https://device.local/img","/images/../secret"]) expect(isEventImageUrl(value)).toBe(false);
});
