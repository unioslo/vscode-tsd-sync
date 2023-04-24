import { window } from "vscode";
import { getWsConfigUrl, setWsConfigUrl } from "./config";

export async function showInputBox() {
  const url = getWsConfigUrl();
  console.debug("showInputBox" + url);
  const re = RegExp(
    /^https:\/\/data\.tsd\.usit\.no\/i\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
  );

  const result = await window.showInputBox({
    value: url || undefined,
    valueSelection: undefined,
    placeHolder:
      "For example: https://data.tsd.usit.no/i/c3dc6179-cede-dc39-8a2b-bddefd289397",
    validateInput: (text) => {
      return re.test(text)
        ? null
        : "https://data.tsd.usit.no/i/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx";
    },
  });
  console.debug("showInputBox" + result);
  if (result) {
    setWsConfigUrl(result);
  }
  //window.showInformationMessage(`Got: ${result}`);
}
