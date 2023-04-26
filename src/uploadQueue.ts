import * as as from "async";
import {
  UploadData,
  UploadDataSet,
  UploadOp,
  UploadTaskData,
} from "./uploadData";
import { QueueObject } from "async";
import * as vscode from "vscode";
import { tsdApi } from "./tsdApi";

const numParallelWorkers = 1;
const maxRetries = 1;

type StatusCallbackFn = (taskQueue: QueueObject<UploadTaskData>) => void;
type ProgressCallbackFn = (
  taskQueue: QueueObject<UploadTaskData>,
  taskData?: UploadTaskData
) => void;

function whitelistedForSyncFilter(uri: vscode.Uri): boolean {
  return !vscode.workspace.asRelativePath(uri.fsPath).startsWith(".vscode/");
}

export class UploadQueue {
  taskQueue: QueueObject<UploadTaskData> | null; // null to make linter happy :(
  incompleteTasks = new IncompleteTasks();
  #onProgress: undefined | ProgressCallbackFn;
  #onWorkStart: undefined | StatusCallbackFn;
  #onWorkComplete: undefined | StatusCallbackFn;
  #onError: undefined | StatusCallbackFn;

  constructor({}: {} = {}) {
    this.taskQueue = null;
    this.clear();
    // this.taskQueue.error((e, t) => {
    //   console.log("taskqueue error on task:", t);
    //   console.log("taskqueue error detail", e.message);
    // });
  }

  #getCurrentTasks = () => {
    if (!this.taskQueue) {
      return [];
    }
    //TODO: this functionality is supposed to be exposed - might break over time; need to add checks
    const taskData = Array.from(
      (this.taskQueue as any)._tasks as UploadTaskData[]
    );
    return taskData;
  };

  #getCurrentTasksSet = () => {
    const taskData = Array.from(
      (this.taskQueue as any)._tasks as UploadTaskData[]
    );
    return new UploadDataSet(this.#getCurrentTasks());
  };

  #taskQueueContains = (file: UploadData, tasks: UploadDataSet): boolean => {
    return tasks.contains(file);
  };

  add({ uri }: { uri: vscode.Uri }) {
    if (!this.taskQueue) {
      throw Error("taskQueue not initialized");
    }
    if (!whitelistedForSyncFilter(uri)) {
      return;
    }
    const tasks = this.#getCurrentTasksSet();
    {
      const td: UploadTaskData = {
        fsPath: uri.fsPath,
        path: vscode.workspace.asRelativePath(uri, true),
        op: UploadOp.put,
        numRemaingRetries: maxRetries,
      };
      // skip already queued files
      if (!this.#taskQueueContains(td, tasks)) {
        this.taskQueue.push(td);
      } else {
        console.log("skip1 " + td.path + " " + td.op);
      }
    }
    // re-queue failed tasks
    {
      const incompleteTasksCached = this.incompleteTasks.toArray();
      incompleteTasksCached.forEach((it) => {
        if (!this.taskQueue) {
          throw Error("taskQueue not initialized");
        }
        // skip already queued files
        if (this.#taskQueueContains(it, tasks)) {
          console.log("skip2 " + it.path + it.fsPath);
          return;
        }
        this.taskQueue.push({ ...it, numRemaingRetries: maxRetries });
        this.incompleteTasks.delete(it);
      });
    }
  }

  async #walk(dir: vscode.Uri, wsFolder: vscode.WorkspaceFolder) {
    const entries = await vscode.workspace.fs.readDirectory(dir);
    entries.map(async ([uriStr, type]) => {
      const uri = vscode.Uri.joinPath(dir, uriStr);
      if (type === vscode.FileType.Directory) {
        await this.#walk(uri, wsFolder);
      }
      if (type === vscode.FileType.File) {
        this.add({ uri });
      }
    });
  }

  async syncWorkspace() {
    if (vscode.workspace.workspaceFolders) {
      const p = vscode.workspace.workspaceFolders.map((wsFolder) =>
        this.#walk(wsFolder.uri, wsFolder)
      );
      Promise.all(p);
    }
  }

  set onProgress(c: ProgressCallbackFn | undefined) {
    this.#onProgress = c;
  }
  set onWorkStart(c: StatusCallbackFn | undefined) {
    this.#onWorkComplete = c;
  }
  set onWorkComplete(c: StatusCallbackFn | undefined) {
    this.#onWorkComplete = c;
  }
  set onError(c: StatusCallbackFn | undefined) {
    this.#onError = c;
  }

  cancel() {
    // save remaining tasks as incomplete
    const tasks = this.#getCurrentTasks();
    tasks.forEach((t) => this.incompleteTasks.add(t));
    // kill tasks
    if (this.taskQueue) {
      this.taskQueue.kill();
      // note: current proce tasks complete?
    }
    this.taskQueue = as.queue<UploadTaskData>(async (taskData, e) => {
      if (!this.taskQueue) {
        throw Error("taskQueue not initialized");
      }
      //TODO: kill task queue and re-init this.taskQueue.kill()
      console.log("taskQueue processing", taskData.fsPath, "start");
      this.#onProgress && this.#onProgress(this.taskQueue, taskData);
      try {
        await tsdApi.putFile(taskData);
      } catch (err: any) {
        console.log(`taskQueue error while uploading file. ${err.toString()}`);
        // retry?
        if (taskData.numRemaingRetries > 0) {
          console.log("taskQueue requeueing", taskData.fsPath);
          this.taskQueue.push({
            ...taskData,
            numRemaingRetries: taskData.numRemaingRetries - 1,
          });
          return;
        }
        // save as incomplete task
        this.incompleteTasks.add({ ...taskData });
        // throw Error(
        //   `failed to upload file ${taskData.fsPath} after ${maxRetries} retries`
        // );
      }
      console.log(
        `taskQueue processing ${
          taskData.fsPath
        } end - len: ${this.taskQueue.length()}`
      );
      if (this.taskQueue.length() === 0) {
        console.log("taskqueue length == 0");
        // reset queue count
        if (this.incompleteTasks.length > 0) {
          console.log("taskqueue incompleteTasks");
          this.#onError && this.#onError(this.taskQueue);
        } else {
          console.log("taskqueue onWorkComplete");
          this.#onWorkComplete && this.#onWorkComplete(this.taskQueue);
        }
      }
    }, numParallelWorkers);
    this.taskQueue.drain(() => {
      if (!this.taskQueue) {
        throw Error("taskQueue not initialized");
      }
      this.#onProgress && this.#onProgress(this.taskQueue);
      console.log(
        `taskQueue all items have been processed; incomplete: ${this.incompleteTasks.toString()}`
      );
    });
  }

  clear() {
    this.cancel();
    this.incompleteTasks.clear();
  }
}

class IncompleteTasks {
  #set: UploadDataSet;

  constructor() {
    this.#set = new UploadDataSet();
  }

  add(d: UploadData) {
    this.#set.add(d);
  }

  get length() {
    return this.#set.length;
  }

  toArray() {
    return this.#set.toArray();
  }

  delete(d: UploadData) {
    this.#set.delete(d);
  }

  clear() {
    this.#set.clear();
  }

  toString() {
    return this.#set
      .toArray()
      .map((td) => `[${td.op}]/${td.path}`)
      .join(";");
  }

  has = (d: UploadData) => this.#set.contains(d);
}
