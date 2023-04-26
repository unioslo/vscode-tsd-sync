import * as vscode from "vscode";
import { getWsConfigUrl, setWsConfigUrl } from "../config";
import { Logic, ReducerActionType } from "../logic";
import { testImportUrl } from "../capToken";
import { tsdConsts } from "../tsdConsts";
import { importUrlValidationProgress } from "./importUrlValidationProgress";

export async function showUrlInput(logic: Logic) {
  const url = getWsConfigUrl();
  // UUID at the end of url
  const result = await vscode.window.showInputBox({
    value: url || undefined,
    valueSelection: undefined,
    placeHolder: `For example: ${tsdConsts.importLinkExample}`,
    validateInput: (text) => {
      return tsdConsts.importUrlRegEx.test(text)
        ? null
        : tsdConsts.importLinkPlaceholder;
    },
  });
  if (result) {
    // save setting
    setWsConfigUrl(result);
    // show progress of getting a cap token
    importUrlValidationProgress(result, logic);
  }
}
