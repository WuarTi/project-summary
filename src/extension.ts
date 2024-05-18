import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.commands.registerCommand('projectSummary.show', () => {
			ProjectSummaryPanel.createOrShow(context.extensionUri);
		})
	);
}

class ProjectSummaryPanel {
	public static currentPanel: ProjectSummaryPanel | undefined;

	public static readonly viewType = 'projectSummary';

	private readonly _panel: vscode.WebviewPanel;
	private readonly _extensionUri: vscode.Uri;
	private _disposables: vscode.Disposable[] = [];

	public static createOrShow(extensionUri: vscode.Uri) {
		const column = vscode.window.activeTextEditor
			? vscode.window.activeTextEditor.viewColumn
			: undefined;

		if (ProjectSummaryPanel.currentPanel) {
			ProjectSummaryPanel.currentPanel._panel.reveal(column);
			return;
		}

		const panel = vscode.window.createWebviewPanel(
			ProjectSummaryPanel.viewType,
			'Project Summary',
			column || vscode.ViewColumn.One,
			{
				enableScripts: true,

				localResourceRoots: [
					vscode.Uri.joinPath(extensionUri, 'src', 'webview'),
				],
			}
		);

		ProjectSummaryPanel.currentPanel = new ProjectSummaryPanel(
			panel,
			extensionUri
		);
	}

	private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
		this._panel = panel;
		this._extensionUri = extensionUri;

		this._update();

		this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

		this._panel.webview.onDidReceiveMessage(
			message => {
				switch (message.command) {
					case 'alert':
						vscode.window.showErrorMessage(message.text);
						return;
				}
			},
			null,
			this._disposables
		);
	}

	public dispose() {
		ProjectSummaryPanel.currentPanel = undefined;

		this._panel.dispose();

		while (this._disposables.length) {
			const x = this._disposables.pop();
			if (x) {
				x.dispose();
			}
		}
	}

	private _update() {
		const webview = this._panel.webview;

		this._panel.title = 'Project Summary';
		this._panel.webview.html = this._getHtmlForWebview(webview);

		this._panel.webview.postMessage({
			command: 'update',
			data: this._getProjectSummary(),
		});
	}

	private _getHtmlForWebview(webview: vscode.Webview): string {
		const scriptPathOnDisk = vscode.Uri.joinPath(
			this._extensionUri,
			'src',
			'webview',
			'script.js'
		);
		const scriptUri = webview.asWebviewUri(scriptPathOnDisk);

		const nonce = getNonce();

		return `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Project Summary</title>
        <script nonce="${nonce}" src="${scriptUri}"></script>
      </head>
      <body>
        <h1>Project Summary</h1>
        <div id="summary"></div>
      </body>
      </html>`;
	}

	private _getProjectSummary() {
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders) {
			return { error: 'No workspace opened' };
		}

		const folderPath = workspaceFolders[0].uri.fsPath;
		const summary = {
			totalLines: 0,
			filesCount: 0,
			largestFile: { name: '', lines: 0 },
			libraries: new Set<string>(),
			configFiles: 0,
			readme: false,
			gitignore: false,
			images: 0,
			videos: 0,
			audio: 0,
			binaries: 0,
			documents: 0,
			scripts: 0,
			stylesheets: 0,
			templates: 0,
		};

		const countLines = (filePath: string) => {
			const fileContent = fs.readFileSync(filePath, 'utf-8');
			const lines = fileContent.split(/\r\n|\r|\n/).length;
			summary.totalLines += lines;
			summary.filesCount++;
			if (lines > summary.largestFile.lines) {
				summary.largestFile.name = filePath;
				summary.largestFile.lines = lines;
			}
		};

		const checkFileType = (fileName: string) => {
			const ext = path.extname(fileName).toLowerCase();
			switch (ext) {
				case '.jpg':
				case '.jpeg':
				case '.png':
				case '.gif':
				case '.svg':
					summary.images++;
					break;
				case '.mp4':
				case '.mov':
				case '.avi':
				case '.mkv':
					summary.videos++;
					break;
				case '.mp3':
				case '.wav':
				case '.flac':
				case '.aac':
					summary.audio++;
					break;
				case '.exe':
				case '.dll':
				case '.so':
					summary.binaries++;
					break;
				case '.doc':
				case '.docx':
				case '.pdf':
				case '.xls':
				case '.xlsx':
				case '.ppt':
				case '.pptx':
					summary.documents++;
					break;
				case '.js':
				case '.ts':
					summary.scripts++;
					break;
				case '.css':
				case '.scss':
				case '.less':
					summary.stylesheets++;
					break;
				case '.html':
				case '.ejs':
				case '.pug':
					summary.templates++;
					break;
			}
		};

		const checkConfigFile = (fileName: string) => {
			if (fileName.toLowerCase().includes('config')) {
				summary.configFiles++;
			}
		};

		const walkSync = (dir: string) => {
			const files = fs.readdirSync(dir);
			files.forEach(file => {
				const filePath = path.join(dir, file);
				const stats = fs.statSync(filePath);
				if (stats.isDirectory()) {
					walkSync(filePath);
				} else if (stats.isFile()) {
					countLines(filePath);
					checkFileType(file);
					if (file.toLowerCase() === 'readme.md') {
						summary.readme = true;
					} else if (file.toLowerCase() === '.gitignore') {
						summary.gitignore = true;
					} else {
						checkConfigFile(file);
						if (
							file.toLowerCase().endsWith('.json') ||
							file.toLowerCase().endsWith('.yaml') ||
							file.toLowerCase().endsWith('.yml')
						) {
							summary.configFiles++;
						}
						const fileContent = fs.readFileSync(filePath, 'utf-8');
						const libs = fileContent.match(/(require|import).*?['"](.*?)['"]/g);
						if (libs) {
							libs.forEach(lib => {
								const libNameMatch = lib.match(/['"](.*?)['"]/);
								if (libNameMatch && libNameMatch[1]) {
									summary.libraries.add(libNameMatch[1]);
								}
							});
						}
					}
				}
			});
		};

		walkSync(folderPath);

		return summary;
	}
}

function getNonce() {
	let text = '';
	const possible =
		'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}

export function deactivate() {}
