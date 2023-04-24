import * as vscode from "vscode";
import { statusBarItem } from "./statusBarItem";
import { UploadQueue } from "./uploadQueue";
import { progress } from "./ui/progress";

enum State {
  init, // -> SYNCING
  synced, // -> SYNCING, ERROR
  syncing, // -> PROGRESS, ERROR
  progress, // -> ERROR, INIT
  error, // -> SYNCING
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

type ReducerAction =
  | SyncFileAction
  | SyncWorkspaceAction
  | SyncCompletedAction
  | ShowProgressAction
  | RaiseErrorAction
  | CancelSyncAction;

export class Logic {
  state: State = State.init;
  #uploadQueue = new UploadQueue();

  constructor() {
    this.#uploadQueue.onWorkComplete = () => {
      this.dispatch({ type: ReducerActionType.syncCompleted });
    };
    this.#uploadQueue.onError = () => {
      this.dispatch({ type: ReducerActionType.raiseError });
      statusBarItem.showError();
    };
  }

  #walk = async (dir: vscode.Uri, wsFolder: vscode.WorkspaceFolder) => {
    const entries = await vscode.workspace.fs.readDirectory(dir);
    entries.map(async ([uriStr, type]) => {
      const uri = vscode.Uri.joinPath(dir, uriStr);
      if (type === vscode.FileType.Directory) {
        await this.#walk(uri, wsFolder);
      }
      if (type === vscode.FileType.File) {
        this.#uploadQueue.add({ uri });
      }
    });
  };

  #syncWorkSpace = async () => {
    if (vscode.workspace.workspaceFolders) {
      const p = vscode.workspace.workspaceFolders.map((wsFolder) =>
        this.#walk(wsFolder.uri, wsFolder)
      );
      Promise.all(p);
    }
  };

  #getState(action: ReducerAction): State {
    switch (action.type) {
      case ReducerActionType.syncFile:
        switch (this.state) {
          case State.init:
            // sync whole workspace on init
            this.#uploadQueue.add({ uri: action.uri });
            this.dispatch({ type: ReducerActionType.syncWorkspace });
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
          case State.init:
          case State.synced:
          case State.syncing:
          case State.progress:
          case State.error:
            statusBarItem.showSync();
            this.#syncWorkSpace();
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
            console.log("show progress");
            progress.showProgress(this, async (p) => {
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
