# JSON Editor Extension for Polarion ALM

This Polarion extension provides possibility to edit JSON files as WorkItem attachments.

## Build

JSON editor extension can be produced using maven:
```bash
mvn clean package
```

## Installation to Polarion

To install JSON editor extension to Polarion `ch.sbb.polarion.extension.json-editor-<version>.jar` should be copied to `<polarion_home>/polarion/extensions/json-editor/eclipse/plugins`

It can be done manually or automated using maven build:
```bash
mvn clean install -Pinstall-to-local-polarion
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
