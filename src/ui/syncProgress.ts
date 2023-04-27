import * as vscode from "vscode";
import { Logic, ReducerActionType } from "../logic";

export const showSyncProgress = (
  logic: Logic,
  cb: (
    p: vscode.Progress<{ message?: string; increment?: number }>
  ) => Promise<void>
) => {
  vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `syncing file`,
      cancellable: true,
    },
    async (progress, token) => {
      token.onCancellationRequested(() => {
        logic.dispatch({ type: ReducerActionType.cancelSync });
      });
      await cb(progress);
    }
  );
};
