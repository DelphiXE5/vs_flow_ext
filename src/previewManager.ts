import * as path from "path";
import * as vscode from "vscode";
import Parser = require("xml-js");

const previewType = "flowfile.preview";

const options = {
    compact: false,
};

function uriToVscodeResource(uri: vscode.Uri): string {
    return uri.with({ scheme: "vscode-resource" }).toString(true);
}

interface IPreviewContext {
    readonly webviewPanel: vscode.WebviewPanel;
    readonly updatePreview: (document: vscode.TextDocument) => void;
}

export class PreviewManager {
    private readonly previewContexts = new WeakMap<
        vscode.TextDocument,
        IPreviewContext
    >();
    private readonly template: string;
    private readonly panel: string;

    public constructor(template: string, panel: string) {
        this.template = template;
        this.panel = panel;
    }

    public async showPreviewToSide(editor: vscode.TextEditor): Promise<void> {
        const document = editor.document;
        const context = this.previewContexts.get(document);
        if (context === undefined) {
            this.previewContexts.set(
                document,
                await this.createPreview(document, vscode.ViewColumn.Beside)
            );
        } else {
            context.webviewPanel.reveal(undefined, true);
        }
    }

    private async createPreview(
        document: vscode.TextDocument,
        column: vscode.ViewColumn
    ): Promise<IPreviewContext> {
        const documentDir = path.dirname(document.fileName);
        const documentDirUri = vscode.Uri.file(documentDir);

        const webviewPanel = vscode.window.createWebviewPanel(
            previewType,
            `Preview: ${path.basename(document.fileName)}`,
            {
                preserveFocus: true,
                viewColumn: column,
            },
            {
                enableScripts: true,
                retainContextWhenHidden: true,
            }
        );

        webviewPanel.webview.html = this.getWebviewContent(document).replace(
            /\{base-url\}/g,
            uriToVscodeResource(documentDirUri)
        );

        webviewPanel.onDidDispose(() => this.previewContexts.delete(document));

        const updatePreview = (document: vscode.TextDocument) => {
            webviewPanel.webview.html = this.getWebviewContent(document);
        };

        return { webviewPanel, updatePreview };
    }

    public async updatePreview(document: vscode.TextDocument): Promise<void> {
        const context = this.previewContexts.get(document);
        if (context !== undefined) {
            context.updatePreview(document);
        }
    }

    private getWebviewContent(document: vscode.TextDocument): string {
        let previewContent = this.template;
        let panelSnippet = this.panel;
        previewContent = previewContent.replace(
            /\{heading\}/g,
            document.fileName.replace(/^.*[\\\/]/, "")
        ); //Add head title
        try {
            var jsonObj = JSON.parse(
                Parser.xml2json(document.getText(), options)
            );
            let count = 1;
            for (let scenario of jsonObj.elements[0].elements[0].elements) {
                panelSnippet = this.panel;
                panelSnippet = panelSnippet.replace(
                    /\{scenario_num\}/g,
                    "Szenario " + count + ": "
                ); //Add scenario count
                panelSnippet = panelSnippet.replace(
                    /\{scenario_title\}/g,
                    scenario.elements.filter((obj: any) => {
                        return obj.name === "title";
                    })[0].elements[0].text
                ); //Add scenario title
                panelSnippet = panelSnippet.replace(
                    /\{scenario_description\}/g,
                    Parser.js2xml(
                        scenario.elements.filter((obj: any) => {
                            return obj.name === "description";
                        })[0]
                    )
                ); //add scenario description (with xml)
                panelSnippet = panelSnippet.replace(
                    /\<sentence \/\>/g,
                    Parser.js2xml(
                        scenario.elements.filter((obj: any) => {
                            return obj.name === "test";
                        })[0]
                    )
                );
                count++;
                previewContent = previewContent.replace(
                    /\<panel \/\>/g,
                    panelSnippet
                );
            }

            //Parse feature to html
            previewContent = previewContent.replace(
                /\{qtext\}/g,
                JSON.stringify(jsonObj.elements[0].elements[0].elements)
            );
        } catch (e) {
            previewContent = previewContent.replace(
                /\<error \/\>/g,
                '<div id="error" class="panel">' + e + "</div>"
            );
        }
        return previewContent;
    }
}
