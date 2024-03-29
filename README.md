# TSD code sync

TSD (Tjenester for Sensitive Data) is a solution for researchers at the University of Oslo and other public research institutions.

This extension maintains a copy of your workspace inside TSD.

## Features

Creates and updates a copy of your workspace inside your TSD project. Whenever you save, create, rename or delete files in your local VS Code, your changes are propagated into TSD.

![Enable sync to TSD](images/demo.gif?raw=true)

> Note: Make sure you create an import link _without_ a secret challenge.

## Requirements

A TSD import link without secret challenge. Use [selfservice.tsd.usit.no](https://selfservice.tsd.usit.no/project/import-links) to create one.

## Exclude files from sync

Create a file `.tsdsyncignore` in your workspace folder to specify any files that should be ignored during sync. The file syntax follows [gitignore](http://git-scm.com/docs/gitignore).

Without `.tsdsyncignore`, the folder `.vscode` is ignored.

## Extension Settings

This extension contributes the following settings:

- `tsdSync.importUrl`: The import link that will be used to copy the workspace into TSD

## Known Issues

Currently, the following features are not supported:

- Uploading symbolic links
- Maintaining specific file permissions on uploaded files (for example executable flag)
- Deleting folders
- Creating empty folders
- Upload links with secret challenge

## Development

Requirements: VS Code, node + npm

Clone this repo. Inside the folder, run `npm install`. Open the folder in VS Code. Then, inside the editor, press `F5`. This will compile and run the extension in a new Extension Development Host window.

In the new window, open a folder/workspace. Now you should see a button labled with "TSD" in the bottom bar.

[more info](https://code.visualstudio.com/api/get-started/your-first-extension)

## Release Notes

### [1.0.0] - 2023-09-11

- Support `.tsdsyncignore`

### [0.0.2] - 2023-09-04

- Improve error handling
- Update a data portal URL

### [0.0.1] - 2023-06-11

- Initial release

---

## Feedback & bug reports

- [GitHub repo](https://github.com/unioslo/vscode-tsd-sync)

## For more information

- [UiO Services for sensitive data (TSD)](https://www.uio.no/english/services/it/research/sensitive-data/)
