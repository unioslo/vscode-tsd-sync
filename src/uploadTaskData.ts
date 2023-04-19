import assert = require("assert");
import fs = require("fs");
var md5 = require("md5");

export interface UploadData {
  fsPath: string;
  path: string;
}

export interface UploadTaskData extends UploadData {
  numRemaingRetries: number;
}

interface FileUploadStatus {
  fsPath: string;
  checksum: string;
}

const getChecksum = (fsPath: string): string => md5(fs.readFileSync(fsPath));

export class UploadStatusCache {
  status: { [key: string]: FileUploadStatus } = {};

  create(fsPath: string) {
    if (this.status.hasOwnProperty(fsPath)) {
      return false;
    }
    const checksum = getChecksum(fsPath);
    this.status[fsPath] = { checksum, fsPath };
    return true;
  }
  delete(fsPath: string): boolean {
    if (!this.status.hasOwnProperty(fsPath)) {
      return false;
    }
    assert(delete this.status[fsPath] === true);
    return true;
  }
  update(fsPath: string): boolean {
    if (!this.status.hasOwnProperty(fsPath)) {
      return false;
    }
    return true;
  }
}
