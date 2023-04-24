import * as vscode from "vscode";
import { Logic, ReducerActionType } from "../logic";

export namespace progress {
  export const showProgress = (
    logic: Logic,
    cb: (
      p: vscode.Progress<{ message?: string; increment?: number }>
    ) => Promise<void>
  ) => {
    vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "TSD Sync (pXX)",
        cancellable: true,
      },
      async (progress, token) => {
        token.onCancellationRequested(() => {
          // use a vscode commend?
          logic.dispatch({ type: ReducerActionType.cancelSync });
          console.log("User canceled the long running operation");
        });
        await cb(progress);
        // progress.report({
        //   increment
        // })

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
  };
}
