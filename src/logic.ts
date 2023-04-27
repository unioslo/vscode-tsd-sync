import * as vscode from "vscode";
import { statusBarItem } from "./ui/statusBarItem";
import { UploadQueue } from "./uploadQueue";
import { showSyncProgress } from "./ui/syncProgress";
import { capTokenMgr } from "./capToken";
import { UUID } from "crypto";
import { getWsConfigUrl } from "./config";
import { importUrlValidationProgress } from "./ui/importUrlValidationProgress";
import { UploadData, UploadTaskData } from "./uploadData";

enum State {
  noconfig, // -> init
  init, // -> syncing
  synced, // -> syncing, error
  syncing, // -> progress, error
  progress, // -> error, synced
  error, // -> syncing
}

export enum ReducerActionType {
  put,
  delete,
  prepareDelete,
  syncWorkspace,
  syncCompleted,
  raiseFatalError,
  raiseError,
  showProgress,
  hideProgress,
  cancelSync,
  validatedConfig,
}

/* eslint-disable */
const reducerActionTypeNames: Record<ReducerActionType, string> = {
  "0": "put",
  "1": "delete",
  "2": "prepareDelete",
  "3": "syncWorkspace",
  "4": "syncCompleted",
  "5": "raiseFatalError",
  "6": "raiseError",
  "7": "showProgress",
  "8": "hideProgress",
  "9": "cancelSync",
  "10": "validatedConfig",
};
/* eslint-enable */

interface BaseAction {
  type: ReducerActionType;
}

export interface PutFileAction extends BaseAction {
  type: ReducerActionType.put;
  uri: vscode.Uri;
}

export interface PrepareDeleteFileAction extends BaseAction {
  type: ReducerActionType.prepareDelete;
  uri: vscode.Uri;
}

export interface DeleteFileAction extends BaseAction {
  type: ReducerActionType.delete;
}

export interface SyncWorkspaceAction extends BaseAction {
  type: ReducerActionType.syncWorkspace;
}

export interface SyncCompletedAction extends BaseAction {
  type: ReducerActionType.syncCompleted;
}

export interface ShowProgressAction extends BaseAction {
  type: ReducerActionType.showProgress;
}

export interface CancelSyncAction extends BaseAction {
  type: ReducerActionType.cancelSync;
}

export interface RaiseErrorAction extends BaseAction {
  type: ReducerActionType.raiseError;
}

export interface ValidatedConfigAction extends BaseAction {
  type: ReducerActionType.validatedConfig;
  linkId: UUID;
  project: string;
}

type ReducerAction =
  | PutFileAction
  | PrepareDeleteFileAction
  | DeleteFileAction
  | SyncWorkspaceAction
  | SyncCompletedAction
  | ShowProgressAction
  | RaiseErrorAction
  | CancelSyncAction
  | ValidatedConfigAction;

export class Logic {
  state: State = State.noconfig;
  #uploadQueue = new UploadQueue();

  constructor() {
    this.#uploadQueue.onWorkComplete = () => {
      this.dispatch({ type: ReducerActionType.syncCompleted });
    };
    this.#uploadQueue.onError = () => {
      this.dispatch({ type: ReducerActionType.raiseError });
      statusBarItem.showError();
    };
    statusBarItem.showMissingConfig();
    this.state = State.noconfig;
  }

  init() {
    // check for config on startup
    const importLink = getWsConfigUrl();
    if (importLink) {
      importUrlValidationProgress(importLink, this);
    }
  }

  async #getState(action: ReducerAction): Promise<State> {
    switch (action.type) {
      case ReducerActionType.validatedConfig:
        capTokenMgr.linkId = action.linkId; // load new config
        capTokenMgr.projectCached = action.project;
        statusBarItem.showInit();
        switch (this.state) {
          case State.noconfig:
            return State.init;
        }
        // init, because we just might have set a new project/group
        this.#uploadQueue.cancel();
        return State.init;
      case ReducerActionType.prepareDelete:
        this.#uploadQueue.prepareDelete(action.uri);
        return this.state;
      case ReducerActionType.put:
      case ReducerActionType.delete: {
        const f =
          action.type === ReducerActionType.put
            ? () => this.#uploadQueue.put(action.uri)
            : () => this.#uploadQueue.delete();
        switch (this.state) {
          case State.noconfig:
            return this.state;
          case State.init:
            statusBarItem.showSync();
            f();
            // sync whole workspace on init
            await this.#uploadQueue.syncWorkspace();
            return State.syncing;
          case State.synced:
          case State.syncing:
          case State.progress:
          case State.error:
            statusBarItem.showSync();
            await f();
            return State.syncing;
        }
      }
      case ReducerActionType.syncWorkspace:
        switch (this.state) {
          case State.noconfig:
            return this.state;
          case State.init:
          case State.synced:
          case State.syncing:
          case State.progress:
          case State.error:
            statusBarItem.showSync();
            await this.#uploadQueue.syncWorkspace();
            return State.syncing;
        }
      case ReducerActionType.syncCompleted:
        switch (this.state) {
          case State.syncing:
          case State.progress:
            statusBarItem.showSynced();
            return State.synced;
        }
        break;
      case ReducerActionType.showProgress:
        switch (this.state) {
          case State.progress:
            // do nothing if button is clicked again
            return State.progress;
          case State.syncing:
            showSyncProgress(this, this.#syncProgressFn);
            return State.progress;
        }
        break;
      case ReducerActionType.cancelSync:
        switch (this.state) {
          case State.progress:
            this.#uploadQueue.cancel();
            statusBarItem.showError();
            return State.error;
        }
        break;
      case ReducerActionType.raiseError:
        statusBarItem.showError();
        return State.error;
    }
    throw Error(`action: ${action.type} state: ${this.state} not implemented`);
  }

  #syncProgressFn = async (
    p: vscode.Progress<{
      message?: string | undefined;
      increment?: number | undefined;
    }>
  ) => {
    const formatMessage = (td: UploadTaskData): string => {
      const maxChars = 40;
      const pathTrunc =
        td.path.length > maxChars
          ? td.path.substring(0, maxChars - 3) + "..."
          : td.path;
      return `${pathTrunc}`;
    };
    {
      const currWorkers = this.#uploadQueue.taskQueue?.workersList();
      if (currWorkers && currWorkers.length) {
        const currTasks = currWorkers.map((e) => e.data);
        if (currTasks && currTasks.length) {
          p.report({ message: formatMessage(currTasks[0]) });
        }
      }
    }
    this.#uploadQueue.onProgress = (_, taskData) => {
      p.report({ message: taskData ? formatMessage(taskData) : "" });
    };
    await this.#uploadQueue.taskQueue?.drain();
  };

  async dispatch(action: ReducerAction) {
    console.log(`logic dispatch ${reducerActionTypeNames[action.type]}`);
    this.state = await this.#getState(action);
  }
}
