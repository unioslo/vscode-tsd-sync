import * as vscode from "vscode";

export namespace tsdConfig {
  export const linkId = "c9cc8173-ce4e-4c93-8a2b-b44ef4283937";
  export const tokenUrl = "https://data.tsd.usit.no/capability_token";
  export const uploadUrl = ({
    project,
    group,
    path,
  }: {
    project: string;
    group: string;
    path: string;
  }) =>
    `https://data.tsd.usit.no/v1/${project}/files/stream/${group}/${encodeURI(
      path
    )}`;
}

// POST https://data.tsd.usit.no/capability_token

// {"id":"c9cc8173-ce4e-4c93-8a2b-b44ef4283937"}

// curl -X POST https://data.tsd.usit.no/capability_token --data-ascii '{"id":"c9cc8173-ce4e-4c93-8a2b-b44ef4283937"}'

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
