// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { statusBarItem } from "./statusBarItem";
import { Logic, ReducerActionType } from "./logic";

namespace commandNames {
  export const tsdsyncUploadAll = "tsdsync.uploadAll";
  export const tsdsyncShowProgress = "tsdsync.showProgress";
}

//const uploadQueue = new UploadQueue({});

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

  const disposable = vscode.commands.registerCommand(
    "tsd-code-push.helloWorld",
    () => {
      // The code you place here will be executed every time your command is executed
      // Display a message box to the user
      vscode.window.showInformationMessage("Hello World! from TSD code push!");
    }
  );

  // const showProgressNotification = vscode.commands.registerCommand(
  //   "notifications-sample.showProgress",
  //   () => {
  //     vscode.window.withProgress(
  //       {
  //         location: vscode.ProgressLocation.Notification,
  //         title: "Progress Notification",
  //         cancellable: true,
  //       },
  //       async (progress, token) => {
  //         token.onCancellationRequested(() => {
  //           console.log("User canceled the long running operation");
  //         });
  //         progress.report({ increment: 0 });
  //         await sleep(1000);
  //         progress.report({ increment: 10, message: "Still going..." });
  //         await sleep(1000);
  //         progress.report({
  //           increment: 40,
  //           message: "Still going even more...",
  //         });
  //         await sleep(1000);
  //         progress.report({
  //           increment: 50,
  //           message: "I am long running! - almost there...",
  //         });
  //         await sleep(1000);
  //         //hideBusyIndicator();
  //       }
  //     );
  //   }
  // );

  const showSyncProgressNotification = vscode.commands.registerCommand(
    commandNames.tsdsyncShowProgress,
    () => {
      vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "TSD Sync (pXX)",
          cancellable: true,
        },
        async (progress, token) => {
          token.onCancellationRequested(() => {
            console.log("User canceled the long running operation");
          });
          //const numInitialItems = uploadQueue.taskQueue.length();
          // const p = (1 / numInitialItems) * 100;
          // uploadQueue.onProgress = (taskQueue) => {
          //   progress.report({
          //     increment: p,
          //     message:
          //       (taskQueue.workersList().length &&
          //         taskQueue.workersList()[0].data.path) ||
          //       undefined,
          //   });
          //   if (taskQueue.length() === 0) {
          //     //uploadQueue.onProgress = undefined;
          //   }
          // };
          //await uploadQueue.taskQueue.drain();
        }
      );
    }
  );

  const tsdSyncUploadAll = vscode.commands.registerCommand(
    commandNames.tsdsyncUploadAll,
    () => logic.dispatch({ type: ReducerActionType.syncWorkspace })
  );

  context.subscriptions.push(statusBarItem.statusBarItem);
  context.subscriptions.push(disposable);
  context.subscriptions.push(showSyncProgressNotification);
  context.subscriptions.push(tsdSyncUploadAll);
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async (e) => {
      const d = new Date();
      console.log("onDidSaveTextDocument", d, "start", e.uri.fsPath);
      //uploadQueue.add({ uri: e.uri });
    })
  );
  context.subscriptions.push(
    vscode.workspace.onDidCreateFiles(async (e) => {
      const d = new Date();
      console.log(
        "onDidCreateFiles",
        d,
        "start",
        e.files.map((e) => e.fsPath).join(";")
      );
      //e.files.map((file) => uploadQueue.add({ uri: file }));
    })
  );
  context.subscriptions.push(
    vscode.workspace.onDidRenameFiles(async (e) => {
      const d = new Date();
      console.log(
        "onDidRenameFiles",
        d,
        "start",
        e.files.map((e) => e.newUri.path).join(";")
      );
      // todo: add delete
      //e.files.map((file) => uploadQueue.add({ uri: file.newUri }));
    })
  );
}

// This method is called when your extension is deactivated
export function deactivate() {
  // if (tsdSyncTaskProvider) {
  //   tsdSyncTaskProvider.dispose();
  // }
}
