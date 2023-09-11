import * as vscode from "vscode";
import { statusBarItem } from "./ui/statusBarItem";
import { UploadQueue } from "./uploadQueue";
import { showSyncProgress } from "./ui/syncProgress";
import { capTokenMgr } from "./capToken";
import { UUID } from "crypto";
import { getWsConfigUrl } from "./config";
import { importUrlValidationProgress } from "./ui/importUrlValidationProgress";
import { UploadTaskData } from "./uploadData";
import { QueueObject } from "async";
import { SyncIgnoreMgr } from "./syncIgnore";

enum State {
  noconfig, // -> init
  init, // -> syncing
  synced, // -> syncing, error
  syncing, // -> synced, progress, error
  progress, // -> synced, error
  error, // -> syncing
}

export enum ReducerActionType {
  put,
  prepareDelete,
  delete,
  syncWorkspace,
  syncCompleted,
  raiseError,
  showProgress,
  cancelSync,
  validatedConfig,
}

/* eslint-disable */
const reducerActionTypeNames: Record<ReducerActionType, string> = {
  "0": "put",
  "1": "prepareDelete",
  "2": "delete",
  "3": "syncWorkspace",
  "4": "syncCompleted",
  "5": "raiseError",
  "6": "showProgress",
  "7": "cancelSync",
  "8": "validatedConfig",
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
  #syncIgnore = new SyncIgnoreMgr();
  #uploadQueue = new UploadQueue({ syncIgnore: this.#syncIgnore });

  constructor() {
    this.#uploadQueue.onWorkComplete = () => {
      this.dispatch({ type: ReducerActionType.syncCompleted });
    };
    this.#uploadQueue.onError = (
      taskQueue: QueueObject<UploadTaskData>,
      messages: string[]
    ) => {
      this.dispatch({ type: ReducerActionType.raiseError });
      statusBarItem.showError();
      if (messages.length) {
        vscode.window.showErrorMessage(
          `${messages[0]}.${
            messages.length > 1
              ? ` ${messages.length - 1} more error${
                  messages.length - 1 > 1 ? "s" : ""
                }`
              : ""
          }`
        );
      }
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
        const configChanged = await this.#syncIgnore.hasConfigChanged();
        await this.#syncIgnore.reloadConfig();
        switch (this.state) {
          case State.noconfig:
            return this.state;
          case State.init:
            statusBarItem.showSync();
            await f();
            // sync whole workspace on init
            await this.#uploadQueue.syncWorkspace();
            return State.syncing;
          case State.synced:
          case State.syncing:
          case State.progress:
          case State.error: {
            statusBarItem.showSync();
            // note: this needs to be called before the put/delete
            await f();
            // if ignore-config has changed, resync whole ws
            if (configChanged) {
              await this.#uploadQueue.syncWorkspace();
            }
            return State.syncing;
          }
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
            await this.#syncIgnore.reloadConfig();
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
    throw Error(`action=${action.type} state=${this.state} not implemented`);
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
