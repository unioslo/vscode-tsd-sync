import * as vscode from "vscode";
import { commandNames } from "../commandNames";
import { capTokenMgr } from "../capToken";

export namespace statusBarItem {
  export const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    9500
  );

  export function init() {
    showInit();
    statusBarItem.show();
  }

  export function showMissingConfig() {
    statusBarItem.tooltip = `Click to configure syncing files into TSD`;
    statusBarItem.command = commandNames.tsdsyncConfigure;
    statusBarItem.text = "$(add) " + "TSD sync";
  }

  export function showInit() {
    statusBarItem.tooltip = capTokenMgr.projectCached
      ? `Click to start sync to ${capTokenMgr.projectCached}`
      : "`Click to start sync to TSD";
    statusBarItem.text =
      "$(debug-disconnect) " +
      (capTokenMgr.projectCached
        ? `TSD sync ${capTokenMgr.projectCached}`
        : "TSD sync");
    statusBarItem.command = commandNames.tsdsyncUploadAll;
  }

  export function showError() {
    statusBarItem.tooltip = capTokenMgr.projectCached
      ? `Click to re-try sync to ${capTokenMgr.projectCached}`
      : "`Click to re-try sync to TSD.";
    statusBarItem.text =
      "$(warning) " +
      (capTokenMgr.projectCached
        ? `TSD sync ${capTokenMgr.projectCached}`
        : "TSD sync");
    statusBarItem.command = commandNames.tsdsyncUploadAll;
  }

  export function showSync() {
    statusBarItem.tooltip = "Click to terminate...";
    statusBarItem.command = commandNames.tsdsyncShowProgress;
    statusBarItem.text =
      "$(sync~spin) " +
      (capTokenMgr.projectCached
        ? `TSD sync ${capTokenMgr.projectCached}`
        : `TSD sync`);
  }

  export function showSynced() {
    statusBarItem.tooltip = `All files synced to pXX. Click to force new sync.`;
    statusBarItem.command = commandNames.tsdsyncUploadAll;
    statusBarItem.text =
      "$(check) " +
      (capTokenMgr.projectCached
        ? `TSD sync ${capTokenMgr.projectCached}`
        : `TSD sync`);
  }
}
