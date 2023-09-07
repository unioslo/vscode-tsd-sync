import * as vscode from "vscode";
import ignore, { Ignore } from "ignore";
import { TextDecoder } from "util";

const syncIgnoreFilename = ".tsdsyncignore";

export class SyncIgnore {
  #ignore: Ignore;
  #ignoreFileMtime: number | null; // to check if reload is required

  constructor() {
    this.#ignore = ignore();
    this.#ignoreFileMtime = null;
  }

  #getSyncIgnorePath(): vscode.Uri | undefined {
    if (
      !vscode.workspace.workspaceFolders ||
      vscode.workspace.workspaceFolders.length === 0
    ) {
      return undefined;
    }
    const f = vscode.workspace.workspaceFolders[0].uri;
    const ignorePath = vscode.Uri.joinPath(f, syncIgnoreFilename);
    return ignorePath;
  }

  /*
   * we have to handle 3 cases:
   * - config file has not changed (same mtime / still missing) -> do nothing
   * - config file was removed / error during reading -> drop rules, resync workspace
   * - config file has changed / first time reading -> load file, resync workspace
   */
  async hasConfigChanged(): Promise<boolean> {
    let mtimeNew = null;
    try {
      const path = this.#getSyncIgnorePath();
      if (path === undefined) {
        throw Error("no workspace");
      }
      const fstat = await vscode.workspace.fs.stat(path);
      mtimeNew = fstat.mtime;
    } catch (e) {}
    return this.#ignoreFileMtime !== mtimeNew;
  }

  async reloadConfig(): Promise<void> {
    if ((await this.hasConfigChanged()) === false) {
      return;
    }
    try {
      const ignorePath = this.#getSyncIgnorePath();
      if (ignorePath === undefined) {
        throw Error("no workspace");
      }
      const fstat = await vscode.workspace.fs.stat(ignorePath);
      // read file
      const b = await vscode.workspace.fs.readFile(ignorePath);
      // convert to string
      const s = new TextDecoder().decode(b);
      // split into lines
      const match = s.match(/[^\r\n]+/g);
      const lines = match ? match.map((m) => m.toString()) : [];
      // load
      this.#ignore = ignore();
      this.#ignore.add(lines);
      // remember mtime
      this.#ignoreFileMtime = fstat.mtime;
      console.log(`SyncIgnore loaded config for ${fstat.mtime}`);
    } catch (e) {
      // config file was removed / error during reading -> drop rules
      this.#ignore = ignore();
      this.#ignore.add(".vscode/*");
      this.#ignoreFileMtime = null;
      console.log(
        `SyncIgnore error during loading "${syncIgnoreFilename}": ${e}`
      );
    }
  }

  isIgnoredPath = (uri: vscode.Uri): boolean => {
    const path = vscode.workspace.asRelativePath(uri.fsPath);
    return this.#ignore.ignores(path);
  };
}
