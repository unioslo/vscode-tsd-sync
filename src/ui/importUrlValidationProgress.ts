import * as vscode from "vscode";
import { testImportUrl } from "../capToken";
import { Logic, ReducerActionType } from "../logic";

export function importUrlValidationProgress(url: string, logic: Logic) {
  vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Testing TSD import link...",
      cancellable: false,
    },
    async (progress, token) => {
      const r = await testImportUrl(url);
      if (!r.ok) {
        vscode.window.showErrorMessage(
          `Unable to use TSD import link. ${r.msg}`
        );
      } else {
        // ready
        logic.dispatch({
          type: ReducerActionType.validatedConfig,
          linkId: r.linkId,
          project: r.project,
        });
      }
    }
  );
}
