import * as vscode from "vscode";
import { commandNames } from "./commandNames";

export namespace statusBarItem {
  export const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    9500
  );

  export function init() {
    showInit();
    statusBarItem.show();
  }

  export function showInit() {
    statusBarItem.tooltip = "Click to start sync to pXX.";
    statusBarItem.command = commandNames.tsdsyncUploadAll;
    statusBarItem.text = "$(testing-unset-icon) " + "TSD sync";
  }

  export function showError() {
    statusBarItem.tooltip = "Click to re-try sync to pXX.";
    statusBarItem.command = "tsdsync.uploadAll";
    statusBarItem.text = "$(warning) " + "TSD sync";
  }

  export function showSync() {
    statusBarItem.tooltip = "Click to terminate...";
    statusBarItem.command = commandNames.tsdsyncShowProgress;
    statusBarItem.text = "$(sync~spin) " + "TSD sync";
  }

  export function showSynced() {
    statusBarItem.tooltip = `All files synced to pXX. Click to force new sync.`;
    statusBarItem.command = "tsdsync.uploadAll";
    statusBarItem.text = "$(check) " + "TSD sync";
  }
}
