import * as vscode from "vscode";
import { statusBarItem } from "./statusBarItem";
import { UploadQueue } from "./uploadQueue";

enum State {
  init, // -> SYNCING
  synced, // -> SYNCING, ERROR
  syncing, // -> PROGRESS, ERROR
  progress, // -> ERROR
  error, // -> SYNCING
}

export enum ReducerActionType {
  syncFile,
  syncWorkspace,
  syncCompleted,
  syncError,
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

type ReducerAction = SyncFileAction | SyncWorkspaceAction | SyncCompletedAction;

export class Logic {
  state: State = State.init;
  #uploadQueue = new UploadQueue();

  constructor() {
    this.#uploadQueue.onWorkComplete = () => {
      statusBarItem.showSynced();
    };
    this.#uploadQueue.onError = () => {
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
          case State.synced:
          case State.syncing:
          case State.progress:
          case State.error:
            statusBarItem.showSync();
            return State.syncing;
        }
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
      case ReducerActionType.syncCompleted:
        switch (this.state) {
          case State.syncing:
          case State.progress:
            statusBarItem.showSynced();
            return State.synced;
        }
    }
    throw Error(`action: ${action.type} state: ${this.state} not implemented`);
  }

  dispatch(action: ReducerAction) {
    this.state = this.#getState(action);
  }
}
