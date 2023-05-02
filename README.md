# TSD code sync

TSD (Tjenester for Sensitive Data) is a solution for researchers at the University of Oslo and other public research institutions.

This extension maintains a copy of your workspace inside TSD.

## Features

Creates and updates a copy of your workspace inside your TSD project. Whenever you save, create, rename or delete files in your local VS Code, your changes are propagated into TSD.

![Enable sync to TSD](images/demo.gif?raw=true)

> Note: Make sure you create an import link _without_ a secret challenge.

## Requirements

A TSD import link without secret challenge. Use [selfservice.tsd.usit.no](https://selfservice.tsd.usit.no/project/import-links) to create one.

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

## Release Notes

### 0.0.1

Initial release

---

## For more information

- [UiO Services for sensitive data (TSD)](https://www.uio.no/english/services/it/research/sensitive-data/)

- [GitHub](https://github.com/unioslo/vscode-tsd-sync)
