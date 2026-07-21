import { DurableObject } from "cloudflare:workers";

import type { WorkerEnv } from "../env";

export class RoomDurableObject extends DurableObject<WorkerEnv> {
  ping(): string {
    return "room-runtime-ready";
  }
}
