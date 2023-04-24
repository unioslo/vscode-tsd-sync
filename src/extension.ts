// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { statusBarItem } from "./statusBarItem";
import { Logic, ReducerActionType } from "./logic";
import { commandNames } from "./commandNames";
import { showInputBox } from "./config/urlInput";

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

  const showSyncProgressNotification = vscode.commands.registerCommand(
    commandNames.tsdsyncShowProgress,
    () => logic.dispatch({ type: ReducerActionType.showProgress })
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
    vscode.workspace.onDidSaveTextDocument(async (e) =>
      logic.dispatch({ type: ReducerActionType.syncFile, uri: e.uri })
    )
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
      e.files.map((file) =>
        logic.dispatch({ type: ReducerActionType.syncFile, uri: file.newUri })
      );
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "getting-started-sample.runCommand",
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        vscode.commands.executeCommand(
          "getting-started-sample.sayHello",
          vscode.Uri.joinPath(context.extensionUri, "sample-folder")
        );
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "getting-started-sample.changeSetting",
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        vscode.workspace
          .getConfiguration("getting-started-sample")
          .update("sampleSetting", true);
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("getting-started-sample.sayHello", () => {
      vscode.window.showInformationMessage("Hello");
    })
  );

  vscode.commands.registerCommand(commandNames.tsdsyncConfigure, async () => {
    // 1) Getting the value
    const value = await vscode.window.showQuickPick(
      ["explorer", "search", "scm", "debug", "extensions"],
      { placeHolder: "Select the view to show when opening a window." }
    );

    if (vscode.workspace.workspaceFolders) {
      // 2) Getting the Configuration target
      const target = await vscode.window.showQuickPick(
        [
          {
            label: "User",
            description: "User Settings",
            target: vscode.ConfigurationTarget.Global,
          },
          {
            label: "Workspace",
            description: "Workspace Settings",
            target: vscode.ConfigurationTarget.Workspace,
          },
        ],
        { placeHolder: "Select the view to show when opening a window." }
      );

      if (value && target) {
        // 3) Update the configuration value in the target
        await vscode.workspace
          .getConfiguration()
          .update("conf.view.showOnWindowOpen", value, target.target);

        /*
				// Default is to update in Workspace
				await vscode.workspace.getConfiguration().update('conf.view.showOnWindowOpen', value);
				*/
      }
    } else {
      // 2) Update the configuration value in User Setting in case of no workspace folders
      await vscode.workspace
        .getConfiguration()
        .update(
          "conf.view.showOnWindowOpen",
          value,
          vscode.ConfigurationTarget.Global
        );
    }
  });

  vscode.commands.registerCommand("samples.quickInput", async () => {
    await showInputBox();
    // const options: {
    //   [key: string]: (context: vscode.ExtensionContext) => Promise<void>;
    // } = {
    //   showInputBox,
    // };
    // const quickPick = vscode.window.createQuickPick();
    // quickPick.items = Object.keys(options).map((label) => ({ label }));
    // quickPick.onDidChangeSelection((selection) => {
    //   if (selection[0]) {
    //     options[selection[0].label](context).catch(console.error);
    //   }
    // });
    // quickPick.onDidHide(() => quickPick.dispose());
    // quickPick.show();
  });
}

// This method is called when your extension is deactivated
export function deactivate() {
  // if (tsdSyncTaskProvider) {
  //   tsdSyncTaskProvider.dispose();
  // }
}
