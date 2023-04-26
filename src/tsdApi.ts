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

// export async function uploadFileOffline(fsPath: string, path: string) {
//   const maxUploadTime = 500;
//   const failureRate = 0.1;
//   console.log(`uploading file ${fsPath} -> ${path} ...`);
//   await sleep(Math.round(Math.random() * maxUploadTime)); // up to 5 sec
//   if (Math.random() < failureRate) {
//     const msg = `uploading file ${fsPath} -> ${path} error`;
//     console.log(msg);
//     throw Error(msg);
//   }
//   const len = fs.readFileSync(fsPath).length;
//   console.log(`uploading file ${fsPath} -> ${path} done ${len} bytes`);
// }
