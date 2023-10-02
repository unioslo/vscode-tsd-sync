import { Mutex } from "async-mutex";
import { UUID } from "crypto";
import jwtDecode from "jwt-decode";
import assert = require("assert");
import { tsdApi } from "./tsdApi";
import { sleep } from "./helper";
import { tsdConsts } from "./tsdConsts";

interface UploadJwt {
  exp: number;
  groups: string[];
  proj: string;
  path: string | null;
  // there is more - should add on demand
}

class CapTokenMgr {
  #uploadToken: string | null;
  #tokenMutex: Mutex;
  #linkId: UUID | null;
  #projectCached: string | undefined;

  constructor() {
    this.#tokenMutex = new Mutex();
    this.#uploadToken = null;
    this.#linkId = null;
    this.#projectCached = undefined;
  }

  set linkId(v: UUID) {
    this.#linkId = v;
  }

  set projectCached(v: string | undefined) {
    this.#projectCached = v;
  }

  get projectCached() {
    return this.#projectCached;
  }

  async getToken() {
    return await this.#tokenMutex.runExclusive(async () => {
      if (!this.#linkId) {
        throw Error("undefined link ID");
      }
      if (this.#uploadToken) {
        const capTokDec = jwtDecode(this.#uploadToken) as UploadJwt;
        const tsCurr = Math.floor(new Date().getTime() / 1000); // get epoch
        const minRemainingTtlSec = 5 * 60;
        if (capTokDec.exp - tsCurr < minRemainingTtlSec) {
          console.log(`cap token expired (${capTokDec.exp}) at ${tsCurr}`);
          this.#uploadToken = null;
        }
      }
      // new get token?
      if (!this.#uploadToken) {
        console.log("getting new cap token");
        this.#uploadToken = await tsdApi.getCapToken(this.#linkId);
      }
      assert(this.#uploadToken !== null);
      const capTokDec = jwtDecode(this.#uploadToken) as UploadJwt;
      // TODO: check groups?
      return {
        token: this.#uploadToken,
        project: capTokDec.proj,
        group: capTokDec.groups[0],
        basePath: capTokDec.path,
      };
    });
  }
}

export const capTokenMgr = new CapTokenMgr();

export async function testImportUrl(
  url: string
): Promise<
  | { ok: true; msg: string; linkId: UUID; project: string }
  | { ok: false; msg: string }
> {
  const uuid = tsdConsts.getUuidFromImportUrl(url);
  await sleep(1000);
  const c = new CapTokenMgr();
  try {
    if (!uuid) {
      throw Error(`Unable to extract UUID from '${url}'`);
    }
    c.linkId = uuid;
    const { project } = await c.getToken();
    return {
      ok: true,
      msg: `Upload enabled for project ${project}`,
      linkId: uuid,
      project,
    };
  } catch (e: any) {
    return { ok: false, msg: e.toString() };
  }
}
