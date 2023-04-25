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
      logic.dispatch({ type: ReducerActionType.syncFile, uri: e.uri });
    })
  );
  context.subscriptions.push(
    vscode.workspace.onDidCreateFiles((e) => {
      e.files.map((file) =>
        logic.dispatch({ type: ReducerActionType.syncFile, uri: file })
      );
    })
  );
  context.subscriptions.push(
    vscode.workspace.onDidRenameFiles((e) => {
      // todo: add delete
      // todo: filter
      e.files.map((file) =>
        logic.dispatch({ type: ReducerActionType.syncFile, uri: file.newUri })
      );
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
