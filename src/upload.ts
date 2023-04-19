import { sleep } from "./helper";
import fs = require("fs");

const maxUploadTime = 500;
const failureRate = 0.3;

export async function uploadFile(fsPath: string, path: string) {
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
