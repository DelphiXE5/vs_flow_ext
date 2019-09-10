import * as vscode from "vscode";
import { PreviewManager } from "./previewManager";
import * as utilities from "./utilities";

const previewCommand = "flowfile.showPreviewToSide";

// Extension interfaces.

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    const previewHtml = await utilities.readFileAsync(context.asAbsolutePath("resources/preview.html"), "utf8");
    const panelSnippet = await utilities.readFileAsync(context.asAbsolutePath("resources/panel.html"), "utf8");
    const previewManager = new PreviewManager(previewHtml, panelSnippet);

    context.subscriptions.push(
        vscode.commands.registerCommand(
            previewCommand,
            () => {
                const activeTextEditor = vscode.window.activeTextEditor;

                if (activeTextEditor !== undefined) {
                    previewManager.showPreviewToSide(activeTextEditor);
                }
            }
        ),
        vscode.workspace.onDidChangeTextDocument((e) => previewManager.updatePreview(e.document)),
    );
}
