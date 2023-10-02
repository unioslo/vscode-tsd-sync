import fetch, { Response } from "node-fetch";
import { UUID } from "crypto";
import * as fs from "fs";
import { capTokenMgr } from "./capToken";
import { tsdConsts } from "./tsdConsts";

async function tryParseMessage(r: Response): Promise<string> {
  try {
    const j = r.json() as any;
    if (j.message) {
      return j.message;
    }
  } catch (e) {}
  return r.statusText;
}

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
      const msg = await tryParseMessage(r);
      throw new Error(msg);
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
    const { group, project, token, basePath } = await capTokenMgr.getToken();
    const r = await fetch(
      tsdConsts.uploadUrl({ path, group, project, basePath }),
      {
        method: "PUT",
        headers: {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          Authorization: `Bearer ${token}`,
        },
        body: fs.createReadStream(fsPath),
      }
    );
    if (!r.ok) {
      const msg = await tryParseMessage(r);
      throw new Error(msg);
    }
  }

  export async function deleteFile({ path }: { path: string }) {
    const { group, project, token, basePath } = await capTokenMgr.getToken();
    const r = await fetch(
      tsdConsts.uploadUrl({ path, group, project, basePath }),
      {
        method: "DELETE",
        headers: {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          Authorization: `Bearer ${token}`,
        },
      }
    );
    if (!r.ok) {
      const msg = await tryParseMessage(r);
      throw new Error(msg);
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
