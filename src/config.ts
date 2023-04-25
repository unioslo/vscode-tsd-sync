import * as vscode from "vscode";

const configCategory = "tsdSync";
const configKeyUrl = "importUrl";

export function getWsConfigUrl(/*scope: vscode.WorkspaceFolder*/) {
  return vscode.workspace.getConfiguration(configCategory).get(configKeyUrl) as
    | string
    | null;
}

export async function setWsConfigUrl(
  /*scope: vscode.WorkspaceFolder*/ url: string
) {
  await vscode.workspace
    .getConfiguration(configCategory)
    .update(configKeyUrl, url);
}
