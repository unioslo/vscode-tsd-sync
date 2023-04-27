// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { statusBarItem } from "./ui/statusBarItem";
import { Logic, ReducerActionType } from "./logic";
import { commandNames } from "./commandNames";
import { showUrlInput } from "./ui/urlInput";

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  const workspaceRoot =
    vscode.workspace.workspaceFolders &&
    vscode.workspace.workspaceFolders.length > 0
      ? vscode.workspace.workspaceFolders[0].uri.fsPath
      : undefined;
  if (!workspaceRoot) {
    return;
  }
  statusBarItem.init();

  const logic = new Logic();
  logic.init();

  const showSyncProgressNotification = vscode.commands.registerCommand(
    commandNames.tsdsyncShowProgress,
    () => logic.dispatch({ type: ReducerActionType.showProgress })
  );

  const tsdSyncUploadAll = vscode.commands.registerCommand(
    commandNames.tsdsyncUploadAll,
    () => logic.dispatch({ type: ReducerActionType.syncWorkspace })
  );

  context.subscriptions.push(statusBarItem.statusBarItem);
  context.subscriptions.push(showSyncProgressNotification);
  context.subscriptions.push(tsdSyncUploadAll);
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async (e) => {
      await logic.dispatch({ type: ReducerActionType.put, uri: e.uri });
    })
  );
  context.subscriptions.push(
    vscode.workspace.onDidCreateFiles(async (e) => {
      const p = e.files.map((file) =>
        logic.dispatch({ type: ReducerActionType.put, uri: file })
      );
      await Promise.all(p);
    })
  );
  context.subscriptions.push(
    vscode.workspace.onWillDeleteFiles(async (e) => {
      const p = e.files.map((file) =>
        logic.dispatch({ type: ReducerActionType.prepareDelete, uri: file })
      );
      await Promise.all(p);
    })
  );
  context.subscriptions.push(
    vscode.workspace.onDidDeleteFiles(async (e) => {
      await logic.dispatch({ type: ReducerActionType.delete });
    })
  );
  context.subscriptions.push(
    vscode.workspace.onWillRenameFiles(async (e) => {
      const p = e.files.map((file) =>
        logic.dispatch({
          type: ReducerActionType.prepareDelete,
          uri: file.oldUri,
        })
      );
      await Promise.all(p);
    })
  );
  context.subscriptions.push(
    vscode.workspace.onDidRenameFiles(async (e) => {
      const p = [
        logic.dispatch({ type: ReducerActionType.delete }),
        ...e.files.map((file) =>
          logic.dispatch({ type: ReducerActionType.put, uri: file.newUri })
        ),
      ];
      await Promise.all(p);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(commandNames.tsdsyncConfigure, () =>
      showUrlInput(logic)
    )
  );
}

// This method is called when your extension is deactivated
export function deactivate() {
  // if (tsdSyncTaskProvider) {
  //   tsdSyncTaskProvider.dispose();
  // }
}
