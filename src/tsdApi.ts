import fetch from "node-fetch";
import { UUID } from "crypto";
import * as fs from "fs";
import { capTokenMgr } from "./capToken";
import { tsdConsts } from "./tsdConsts";

export namespace tsdApi {
  export async function getCapToken(uuid: UUID) {
    const r = await fetch(tsdConsts.tokenUrl, {
      method: "POST",
      headers: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: uuid,
      }),
    });
    if (!r.ok) {
      throw new Error(r.statusText);
    }
    const j = (await r.json()) as any;
    if (!j.token) {
      throw Error("Expected token field in response data");
    }
    return j.token as string;
  }

  export async function putFile({
    path,
    fsPath,
  }: {
    path: string;
    fsPath: string;
  }) {
    const { group, project, token } = await capTokenMgr.getToken();
    const r = await fetch(tsdConsts.uploadUrl({ path, group, project }), {
      method: "PUT",
      headers: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        Authorization: `Bearer ${token}`,
      },
      body: fs.createReadStream(fsPath),
    });
    if (!r.ok) {
      throw new Error(r.statusText);
    }
  }
}
