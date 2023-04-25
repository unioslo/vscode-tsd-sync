import * as vscode from "vscode";
import { statusBarItem } from "./ui/statusBarItem";
import { UploadQueue } from "./uploadQueue";
import { showSyncProgress } from "./ui/syncProgress";
import { capTokenMgr } from "./capToken";
import { UUID } from "crypto";

enum State {
  noconfig, // -> init
  init, // -> syncing
  synced, // -> syncing, error
  syncing, // -> progress, error
  progress, // -> error, init, synced
  error, // -> syncing
}

export enum ReducerActionType {
  syncFile,
  syncWorkspace,
  syncCompleted,
  raiseFatalError,
  raiseError,
  showProgress,
  hideProgress,
  cancelSync,
  validatedConfig,
}

interface BaseAction {
  type: ReducerActionType;
}

export interface SyncFileAction extends BaseAction {
  type: ReducerActionType.syncFile;
  uri: vscode.Uri;
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
  | SyncFileAction
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

  #getState(action: ReducerAction): State {
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
      case ReducerActionType.syncFile:
        switch (this.state) {
          case State.noconfig:
            return this.state;
          case State.init:
            this.#uploadQueue.add({ uri: action.uri });
            // sync whole workspace on init
            this.#uploadQueue.syncWorkspace();
            return State.syncing;
          case State.synced:
          case State.syncing:
          case State.progress:
          case State.error:
            statusBarItem.showSync();
            this.#uploadQueue.add({ uri: action.uri });
            return State.syncing;
        }
        break;
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
            this.#uploadQueue.syncWorkspace();
            return State.syncing;
        }
        break;
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
            showSyncProgress(this, async (p) => {
              this.#uploadQueue.onProgress = (_, taskData) => {
                p.report({ message: taskData && taskData.path });
              };
              await this.#uploadQueue.taskQueue?.drain();
            });
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
        break;
    }
    throw Error(`action: ${action.type} state: ${this.state} not implemented`);
  }

  dispatch(action: ReducerAction) {
    this.state = this.#getState(action);
  }
}
