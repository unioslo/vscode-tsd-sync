import * as as from "async";
import { UploadData, UploadTaskData } from "./uploadTaskData";
import { QueueObject } from "async";
import { uploadFile } from "./upload";
import * as vscode from "vscode";

const numParallelWorkers = 1;
const maxRetries = 1;

type StatusCallbackFn = (taskQueue: QueueObject<UploadTaskData>) => void;

class UploadDataSet {
  #set: Set<string>;

  constructor(d: UploadData[]) {
    this.#set = new Set(d.map((d) => d.fsPath));
  }

  contains(v: UploadData): boolean {
    return this.#set.has(v.fsPath);
  }
}

export class UploadQueue {
  taskQueue: QueueObject<UploadTaskData>;
  incompleteTasks = new IncompleteTasks();
  #onProgress: undefined | StatusCallbackFn;
  #onWorkStart: undefined | StatusCallbackFn;
  #onWorkComplete: undefined | StatusCallbackFn;
  #onError: undefined | StatusCallbackFn;

  constructor({
    onProgress,
  }: {
    onProgress?: StatusCallbackFn;
  } = {}) {
    this.clear();
    this.#onProgress = onProgress;
    this.taskQueue = as.queue<UploadTaskData>(async (taskData, e) => {
      console.log("taskQueue processing", taskData.fsPath, "start");
      this.#onProgress && this.#onProgress(this.taskQueue);
      try {
        await uploadFile(taskData.fsPath, taskData.path);
      } catch (err) {
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
      this.#onProgress && this.#onProgress(this.taskQueue);
      console.log(
        `taskQueue all items have been processed; incomplete: ${this.incompleteTasks.toString()}`
      );
    });

    // this.taskQueue.error((e, t) => {
    //   console.log("taskqueue error on task:", t);
    //   console.log("taskqueue error detail", e.message);
    // });
  }

  #getCurrentTasks = () => {
    const taskData = Array.from(
      (this.taskQueue as any)._tasks as UploadTaskData[]
    );
    return new UploadDataSet(
      //TODO: this functionality is supposed to be exposed - might break over time; need to add checks
      taskData
    );
  };

  #taskQueueContains = (file: UploadData, tasks: UploadDataSet): boolean => {
    return tasks.contains(file);
  };

  add({ uri }: { uri: vscode.Uri }) {
    const tasks = this.#getCurrentTasks();
    {
      const td: UploadTaskData = {
        fsPath: uri.fsPath,
        path: vscode.workspace.asRelativePath(uri, true),
        numRemaingRetries: maxRetries,
      };
      // skip already queued files
      if (!this.#taskQueueContains(uri, tasks)) {
        this.taskQueue.push(td);
      } else {
        console.log("skip1 " + td.path);
      }
    }
    // re-queue failed tasks
    {
      const incompleteTasksCached = this.incompleteTasks.toArray();
      incompleteTasksCached.forEach((it) => {
        // skip already queued files
        if (this.#taskQueueContains(it, tasks)) {
          console.log("skip2 " + it.path + it.fsPath);
          return;
        }
        this.taskQueue.push({ ...it, numRemaingRetries: maxRetries });
        this.incompleteTasks.pop(it);
      });
    }
    // TODO: race condition - we need to make sure
  }

  set onProgress(c: StatusCallbackFn | undefined) {
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

  // clear
  clear() {
    //TODO: kill task queue and re-init this.taskQueue.kill()
    this.incompleteTasks.clear();
  }
}

class IncompleteTasks {
  #map: Map<string, UploadData> = new Map();

  constructor() {}

  add(d: UploadData) {
    this.#map.set(d.fsPath, d);
  }

  get length() {
    return this.#map.size;
  }

  toArray() {
    return Array.from(this.#map.values());
  }

  pop(d: UploadData) {
    this.#map.delete(d.fsPath);
  }

  clear() {
    this.#map.clear;
  }

  toString() {
    return Array.from(this.#map)
      .map(([k, v]) => k)
      .join(";");
  }

  has = (d: UploadData) => this.#map.has(d.fsPath);
}
