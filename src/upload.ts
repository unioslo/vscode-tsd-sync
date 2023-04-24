import { sleep } from "./helper";
import * as fs from "fs";
import { Mutex } from "async-mutex";
import jwtDecode from "jwt-decode";
import { tsdConfig } from "./config/config";
import fetch from "node-fetch";
import assert = require("assert");

export async function uploadFileOffline(fsPath: string, path: string) {
  const maxUploadTime = 500;
  const failureRate = 0.1;
  console.log(`uploading file ${fsPath} -> ${path} ...`);
  await sleep(Math.round(Math.random() * maxUploadTime)); // up to 5 sec
  if (Math.random() < failureRate) {
    const msg = `uploading file ${fsPath} -> ${path} error`;
    console.log(msg);
    throw Error(msg);
  }
  const len = fs.readFileSync(fsPath).length;
  console.log(`uploading file ${fsPath} -> ${path} done ${len} bytes`);
}

interface UploadJwt {
  exp: number;
  groups: string[];
  proj: string;
  // there is more - should add on demand
}

let gUploadToken: null | string = null;
const gTokenMutex = new Mutex();

export async function uploadFile(fsPath: string, path: string) {
  return await uploadFileOffline(fsPath, path);
  try {
    const { token, project, group } = await gTokenMutex.runExclusive(
      async () => {
        if (gUploadToken) {
          const capTokDec = jwtDecode(gUploadToken) as UploadJwt;
          const tsCurr = Math.floor(new Date().getTime() / 1000); // get epoch
          const minRemainingTtlSec = 5 * 60;
          if (capTokDec.exp - tsCurr < minRemainingTtlSec) {
            console.log(`cap token expired (${capTokDec.exp}) at ${tsCurr}`);
            gUploadToken = null;
          }
        }
        // new get token?
        if (!gUploadToken) {
          console.log("getting new cap token");
          gUploadToken = await (async () => {
            const r = await fetch(tsdConfig.tokenUrl, {
              method: "POST",
              headers: {
                // eslint-disable-next-line @typescript-eslint/naming-convention
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                id: tsdConfig.linkId,
              }),
            });
            if (!r.ok) {
              throw new Error(r.statusText);
            }
            const j = (await r.json()) as any;
            return j.token;
          })();
        }
        assert(gUploadToken !== null);
        const capTokDec = jwtDecode(gUploadToken) as UploadJwt;
        // TODO: check groups?
        return {
          token: gUploadToken,
          project: capTokDec.proj,
          group: capTokDec.groups[0],
        };
      }
    );
    const r = await fetch(tsdConfig.uploadUrl({ path, group, project }), {
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
    console.log(`upload ok`);
  } catch (e: any) {
    console.log(`error - ${e.message}`);
    throw Error(`Error during upload of file ${path}. ${e.message}`);
  }
}
