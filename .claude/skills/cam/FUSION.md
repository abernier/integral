# Acting in Fusion

What an agent does in the Fusion desktop app beyond `pnpm cam`: inspect, simulate, set the machine up. Two channels: Fusion's MCP tools for anything the API reaches, the UI (computer-use on `com.autodesk.fusion360`) for what it does not.

## MCP tools

They come from the `fusion` server of the repo's `.mcp.json`, Fusion's local MCP server, or from the Autodesk Fusion connector when it is on: the same Fusion, either set of `fusion_mcp_*` tools.

- `fusion_mcp_execute`, featureType `script`, `object: {script, readOnly}`: Python with a `def run(_context: str):`; `print` is the result, an exception the error. Let exceptions raise.
- `fusion_mcp_execute`, featureType `document`: `open` by file id, `close`; `save` only on the user's word.
- `fusion_mcp_read`: `activeCommand` (the open dialog and its inputs), `screenshot` (with a `direction`), `document` (`search`, `open`, `recent`), `apiDocumentation`.

A script runs only while no command dialog is open. A `readOnly: true` script runs with one open, and is enough to inspect, move the camera (`viewport.camera`, `isFitView`, `viewOrientation`) or read `activeCommand`. An open dialog also stops `pnpm cam` (`Cannot perform 'script' while a command dialog is open`): close it (its Cancel or OK, Exit Simulation), then rerun.

API lengths are centimetres; multiply by 10 for mm. `app.activeDocument` is what a script acts on: activate the run's document first (`document.activate()`); several are named `Untitled`, the last opened is the newest.

## Simulate

- Select what to simulate, then run the command: `ui.activeSelections.clear()`, `add(setup)` or `add(operation)`, then `ui.commandDefinitions.itemById(id).execute()`. `IronSimulation` is Simulate, `IronMachineSimulation` Simulate with Machine. The run leaves every setup's toolpaths shown; select a setup to see one.
- Hide the imported design occurrences (the top-level ones that are not the sheet's) with `isLightBulbOn = False`, so only the stock and the parts on it show.
- Collisions: the panel's Info tab, Verification > Collisions, or the toast "Errors: n". On the ShopBot, 0 is the target: a red table or gantry is a pass deeper than the overcut, a sheet off the table, or the wrong machine.
- Fusion for Personal Use simulates no tool change with the machine: for a sheet with a `_rest` file, select its operations but `Rest`.
- Exit with the panel's Exit Simulation button; Escape in the viewport does not always.

## The machine

`docs/cam.md` ("The ShopBot in Fusion") holds what the machine is and why. To put it on a setup, the UI only (the API refuses a simulation-ready machine): double-click the setup in the browser, Setup tab, Machine > Select, My machines > Local, the ShopBot, Select, then OK. One setup at a time, on every `--keep` run. Check with a script: `setup.machine.model` is `PRSalpha 96-48`.

The `.mch` in `~/Library/Application Support/Autodesk/CAM360/machines/` is JSON: the table's attach point is `kinematics.default.parts[id=table].attach_frame.point`, its model is `fusion.default.model_urn`. A setup holds a copy of the machine: after editing the `.mch`, pick it again on the setup.

The machine's model is a Fusion cloud document, named by a version urn (`urn:adsk.wipprod:fs.file:vf.<id>?version=1`, its `dataFile.versionId`). To change the model, edit it and `saveAs` a new document: Fusion refuses a later version of the same file, and re-downloads a model named by an https URL on every pick. Find cloud files through `app.data.dataProjects` by name (`app.data.activeProject` can fail), and re-read a folder's `dataFiles` after deleting one.

Placement: the script lays every setup by its stock's bottom centre (`job_positionReference_origin_mode`), the attach point is the spoilboard's top centre. A sheet off the table means a setup made otherwise, or a moved attach point: measure in the top view against the table's 2540 x 1300 and correct the `.mch`.

## The UI

Use computer-use with full-screen control: Fusion takes background clicks unreliably. Take a screenshot before each click; dialogs open at the same places, but positions shift with the window. A click in the browser tree on a setup row selects it; a double-click opens its edit dialog.
