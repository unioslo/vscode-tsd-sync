// import assert = require("assert");
// import fs = require("fs");
// var md5 = require("md5");

export enum UploadOp {
  put,
  delete,
}



/* eslint-disable */
const uploadOpNames: Record<UploadOp, string> = {
  "0": "put",
  "1": "delete",
};
/* eslint-enable */

export function uploadOpStr(op: UploadOp) {
  return uploadOpNames[op];
}

export interface UploadData {
  fsPath: string;
  path: string;
  op: UploadOp;
}

export interface UploadTaskData extends UploadData {
  numRemaingRetries: number;
}

export class UploadDataSet {
  #ordered: UploadData[];

  constructor(d: UploadData[] = []) {
    this.#ordered = [...d];
  }

  #findIndex(v: UploadData): number {
    return this.#ordered.findIndex(
      (e) => e.fsPath === v.fsPath && e.op === v.op
    );
  }

  contains(v: UploadData): boolean {
    return this.#findIndex(v) !== -1;
  }

  add(v: UploadData) {
    if (this.contains(v)) {
      return;
    }
    this.#ordered.push(v);
  }

  delete(v: UploadData) {
    const idx = this.#findIndex(v);
    if (idx === -1) {
      return;
    }
    this.#ordered.splice(idx, 1);
  }

  clear() {
    this.#ordered = [];
  }

  get length() {
    return this.#ordered.length;
  }

  toArray() {
    return Array.from(this.#ordered);
  }
}

// interface FileUploadStatus {
//   fsPath: string;
//   checksum: string;
// }

// const getChecksum = (fsPath: string): string => md5(fs.readFileSync(fsPath));

// export class UploadStatusCache {
//   status: { [key: string]: FileUploadStatus } = {};

//   create(fsPath: string) {
//     if (this.status.hasOwnProperty(fsPath)) {
//       return false;
//     }
//     const checksum = getChecksum(fsPath);
//     this.status[fsPath] = { checksum, fsPath };
//     return true;
//   }
//   delete(fsPath: string): boolean {
//     if (!this.status.hasOwnProperty(fsPath)) {
//       return false;
//     }
//     assert(delete this.status[fsPath] === true);
//     return true;
//   }
//   update(fsPath: string): boolean {
//     if (!this.status.hasOwnProperty(fsPath)) {
//       return false;
//     }
//     return true;
//   }
// }
