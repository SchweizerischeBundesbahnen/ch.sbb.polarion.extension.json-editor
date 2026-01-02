[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=SchweizerischeBundesbahnen_ch.sbb.polarion.extension.json-editor&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=SchweizerischeBundesbahnen_ch.sbb.polarion.extension.json-editor)
[![Bugs](https://sonarcloud.io/api/project_badges/measure?project=SchweizerischeBundesbahnen_ch.sbb.polarion.extension.json-editor&metric=bugs)](https://sonarcloud.io/summary/new_code?id=SchweizerischeBundesbahnen_ch.sbb.polarion.extension.json-editor)
[![Code Smells](https://sonarcloud.io/api/project_badges/measure?project=SchweizerischeBundesbahnen_ch.sbb.polarion.extension.json-editor&metric=code_smells)](https://sonarcloud.io/summary/new_code?id=SchweizerischeBundesbahnen_ch.sbb.polarion.extension.json-editor)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=SchweizerischeBundesbahnen_ch.sbb.polarion.extension.json-editor&metric=coverage)](https://sonarcloud.io/summary/new_code?id=SchweizerischeBundesbahnen_ch.sbb.polarion.extension.json-editor)
[![Duplicated Lines (%)](https://sonarcloud.io/api/project_badges/measure?project=SchweizerischeBundesbahnen_ch.sbb.polarion.extension.json-editor&metric=duplicated_lines_density)](https://sonarcloud.io/summary/new_code?id=SchweizerischeBundesbahnen_ch.sbb.polarion.extension.json-editor)
[![Lines of Code](https://sonarcloud.io/api/project_badges/measure?project=SchweizerischeBundesbahnen_ch.sbb.polarion.extension.json-editor&metric=ncloc)](https://sonarcloud.io/summary/new_code?id=SchweizerischeBundesbahnen_ch.sbb.polarion.extension.json-editor)
[![Reliability Rating](https://sonarcloud.io/api/project_badges/measure?project=SchweizerischeBundesbahnen_ch.sbb.polarion.extension.json-editor&metric=reliability_rating)](https://sonarcloud.io/summary/new_code?id=SchweizerischeBundesbahnen_ch.sbb.polarion.extension.json-editor)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=SchweizerischeBundesbahnen_ch.sbb.polarion.extension.json-editor&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=SchweizerischeBundesbahnen_ch.sbb.polarion.extension.json-editor)
[![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=SchweizerischeBundesbahnen_ch.sbb.polarion.extension.json-editor&metric=sqale_rating)](https://sonarcloud.io/summary/new_code?id=SchweizerischeBundesbahnen_ch.sbb.polarion.extension.json-editor)
[![Vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=SchweizerischeBundesbahnen_ch.sbb.polarion.extension.json-editor&metric=vulnerabilities)](https://sonarcloud.io/summary/new_code?id=SchweizerischeBundesbahnen_ch.sbb.polarion.extension.json-editor)

# JSON Editor Extension for Polarion ALM

This Polarion extension provides possibility to edit JSON files as WorkItem attachments.

> [!IMPORTANT]
> Starting from version 2.0.0 only latest version of Polarion is supported.
> Right now it is Polarion 2512.

## Quick start

The latest version of the extension can be downloaded from the [releases page](../../releases/latest) and installed to Polarion instance without necessity to be compiled from the sources.
The extension should be copied to `<polarion_home>/polarion/extensions/ch.sbb.polarion.extension.json-editor/eclipse/plugins` and changes will take effect after Polarion restart.
> [!IMPORTANT]
> Don't forget to clear `<polarion_home>/data/workspace/.config` folder after extension installation/update to make it work properly.

## Build

This extension can be produced using maven:
```bash
mvn clean package
```

## Installation to Polarion

To install the extension to Polarion `ch.sbb.polarion.extension.json-editor-<version>.jar`
should be copied to `<polarion_home>/polarion/extensions/ch.sbb.polarion.extension.json-editor/eclipse/plugins`
It can be done manually or automated using maven build:
```bash
mvn clean install -P install-to-local-polarion
```
For automated installation with maven env variable `POLARION_HOME` should be defined and point to folder where Polarion is installed.

Changes only take effect after restart of Polarion.

## Polarion configuration

### JSON editor to appear on a WorkItem page

1. Open a project which WorkItem pages should display the editor
2. On the top of the project's navigation pane click ⚙ (Actions) ➙ 🔧 Administration. Project's administration page will be opened.
3. On the administration's navigation pane select Work Items ➙ Form Configuration.
4. On the form configuration page you will see 2 sections: Form Filters and Form Layouts.
5. In the table of Form Layouts section find line with WorkItem's type where editor should appear and click 📝 Edit
6. In opened Form Layout Configuration editor find a line with code:
   ```xml
   …
   <field id="description"/>
   …
   ```
7. Insert following new line after it (with explicit syntax validation on submit):
   ```xml
   …
   <extension id="json-editor" label="JSON Editor" validateOnSave="true"/>
   …
   ```
   Or following new line after it (without syntax validation on submit):
   ```xml
   …
   <extension id="json-editor" label="JSON Editor" validateOnSave="false"/>
   …
   ```
8. Save changes by clicking 💾 Save


### REST API

This extension provides REST API. OpenAPI Specification can be obtained [here](docs/openapi.json).
