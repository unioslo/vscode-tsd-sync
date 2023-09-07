import * as as from "async";
import {
  UploadData,
  UploadDataSet,
  UploadOp,
  UploadTaskData,
  uploadOpStr,
} from "./uploadData";
import { QueueObject } from "async";
import * as vscode from "vscode";
import { tsdApi } from "./tsdApi";
import { SyncIgnore } from "./syncIgnore";

const numParallelWorkers = 1;
const maxRetries = 1;

type ErrorCallbackFn = (
  taskQueue: QueueObject<UploadTaskData>,
  messages: string[]
) => void;
type StatusCallbackFn = (taskQueue: QueueObject<UploadTaskData>) => void;
type ProgressCallbackFn = (
  taskQueue: QueueObject<UploadTaskData>,
  taskData?: UploadTaskData
) => void;

export class UploadQueue {
  taskQueue: QueueObject<UploadTaskData> | null; // null to make linter happy :(
  incompleteTasks = new IncompleteTasks();
  #deleteCache = new DeleteCache();
  #onProgress: undefined | ProgressCallbackFn;
  #onWorkStart: undefined | StatusCallbackFn;
  #onWorkComplete: undefined | StatusCallbackFn;
  #onError: undefined | ErrorCallbackFn;
  #messages: string[];
  #ignore: SyncIgnore;

  constructor({}: {} = {}) {
    this.taskQueue = null;
    this.clear();
    this.#messages = [];
    this.#ignore = new SyncIgnore();
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
    return new UploadDataSet(this.#getCurrentTasks());
  };

  #taskQueueContains = (file: UploadData, tasks: UploadDataSet): boolean => {
    return tasks.contains(file);
  };

  #add = ({ uri, op }: { uri: vscode.Uri; op: UploadOp }) => {
    if (!this.taskQueue) {
      throw Error("taskQueue not initialized");
    }
    if (this.#ignore.isIgnoredPath(uri)) {
      console.log(`skipping ignored file ${uri.fsPath}`);
      return;
    }
    const tasks = this.#getCurrentTasksSet();
    {
      const td: UploadTaskData = {
        fsPath: uri.fsPath,
        path: vscode.workspace.asRelativePath(uri, true),
        op,
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
  };

  #recurseDir = async (
    dir: vscode.Uri,
    onFile: (uri: vscode.Uri) => Promise<void>
  ) => {
    const entries = await vscode.workspace.fs.readDirectory(dir);
    entries.map(async ([uriStr, type]) => {
      const uri = vscode.Uri.joinPath(dir, uriStr);
      if (type === vscode.FileType.Directory) {
        await this.#recurseDir(uri, onFile);
      }
      if (type === vscode.FileType.File) {
        await onFile(uri);
      }
    });
  };

  async hasConfigChanged(): Promise<boolean> {
    return await this.#ignore.hasConfigChanged();
  }

  syncWorkspace = async () => {
    await this.#ignore.reloadConfig();
    if (vscode.workspace.workspaceFolders) {
      const p = vscode.workspace.workspaceFolders.map((wsFolder) =>
        this.#recurseDir(wsFolder.uri, async (uri: vscode.Uri) => {
          this.#add({ uri, op: UploadOp.put });
        })
      );
      Promise.all(p);
    }
  };

  put = async (uri: vscode.Uri) => {
    await this.#ignore.reloadConfig();
    const stat = await vscode.workspace.fs.stat(uri);
    switch (stat.type) {
      case vscode.FileType.File:
        this.#add({ uri, op: UploadOp.put });
        break;
      case vscode.FileType.SymbolicLink:
        // TODO:
        break;
      case vscode.FileType.Directory:
        await this.#recurseDir(uri, async (uri: vscode.Uri) => {
          this.#add({ uri, op: UploadOp.put });
        });
        break;
      case vscode.FileType.Unknown:
        console.warn(`uploadQueue put: unkown file ${uri.path}`);
        break;
      default:
    }
  };

  prepareDelete = async (uri: vscode.Uri) => {
    await this.#ignore.reloadConfig();
    const stat = await vscode.workspace.fs.stat(uri);
    switch (stat.type) {
      case vscode.FileType.File:
        this.#deleteCache.queue(uri);
        break;
      case vscode.FileType.SymbolicLink:
        // TODO:
        break;
      case vscode.FileType.Directory:
        await this.#recurseDir(uri, async (uri: vscode.Uri) => {
          this.#deleteCache.queue(uri);
        });
        break;
      case vscode.FileType.Unknown:
        console.warn(`uploadQueue delete: unkown file ${uri.path}`);
        break;
      default:
    }
  };

  delete = async () => {
    this.#deleteCache.files.forEach((uri) =>
      this.#add({ uri, op: UploadOp.delete })
    );
    this.#deleteCache.clear();
  };

  set onProgress(c: ProgressCallbackFn | undefined) {
    this.#onProgress = c;
  }
  set onWorkStart(c: StatusCallbackFn | undefined) {
    this.#onWorkComplete = c;
  }
  set onWorkComplete(c: StatusCallbackFn | undefined) {
    this.#onWorkComplete = c;
  }
  set onError(c: ErrorCallbackFn | undefined) {
    this.#onError = c;
  }

  #taskQueueWorker = async (
    taskData: UploadTaskData,
    _: as.ErrorCallback<Error>
  ) => {
    if (!this.taskQueue) {
      throw Error("taskQueue not initialized");
    }
    //TODO: kill task queue and re-init this.taskQueue.kill()
    console.log(
      `uploadQueue worker ${uploadOpStr(taskData.op)} ${taskData.fsPath} start`
    );
    this.#onProgress && this.#onProgress(this.taskQueue, taskData);
    try {
      switch (taskData.op) {
        case UploadOp.put:
          await tsdApi.putFile(taskData);
          break;
        case UploadOp.delete:
          await tsdApi.deleteFile(taskData);
          break;
        default:
          throw new Error(`upload operation ${taskData.op} not implemented`);
      }
    } catch (err: any) {
      console.log(
        `uploadQueue worker error while uploading file. ${err.toString()}`
      );
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
      this.#messages.push(
        `Error while syncing file ${taskData.path} after ${
          maxRetries + 1
        } attempts. ${err.toString()}`
      );
    }
    console.log(
      `uploadQueue worker ${uploadOpStr(taskData.op)} ${
        taskData.fsPath
      } finished - remaining=${this.taskQueue.length()}`
    );
    if (this.taskQueue.length() === 0) {
      // reset queue count
      if (this.incompleteTasks.length > 0) {
        console.log(
          `uploadQueue incompleteTasks=${this.incompleteTasks.length}`
        );
        this.#onError && this.#onError(this.taskQueue, this.#messages);
      } else {
        console.log("uploadQueue complete");
        this.#onWorkComplete && this.#onWorkComplete(this.taskQueue);
      }
      // clean up messages
      this.#messages = [];
    }
  };

  cancel() {
    // save remaining tasks as incomplete
    const tasks = this.#getCurrentTasks();
    tasks.forEach((t) => this.incompleteTasks.add(t));
    // kill tasks
    if (this.taskQueue) {
      this.taskQueue.kill();
      // note: current proce tasks complete?
    }
    // init new taskqueue
    this.taskQueue = as.queue<UploadTaskData>(
      this.#taskQueueWorker,
      numParallelWorkers
    );
    this.taskQueue.drain(() => {
      if (!this.taskQueue) {
        throw Error("taskQueue not initialized");
      }
      this.#onProgress && this.#onProgress(this.taskQueue);
      console.log(
        `uploadQueue is empty${
          this.incompleteTasks.length
            ? ` - incomplete: ${this.incompleteTasks.toString()}`
            : ""
        }`
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

/**
 * We can't list files after they have deleted.
 */
class DeleteCache {
  #files: vscode.Uri[] = [];

  queue(file: vscode.Uri) {
    console.log(`deleteCache queue ${file.path}`);
    this.#files.push(file);
  }

  get files() {
    return [...this.#files];
  }

  clear() {
    this.#files = [];
  }
}
