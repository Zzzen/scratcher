// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { ParserOptions, ParserPlugin, parse } from '@babel/parser';
import traverse, { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { performance } from 'perf_hooks';

// https://github.com/benjamn/recast/blob/master/parsers/_babel_options.ts#L21
const babelOptions: ParserOptions = {
	sourceType: 'module',
	strictMode: false,
	allowImportExportEverywhere: true,
	allowReturnOutsideFunction: true,
	startLine: 1,
	tokens: true,
	plugins: [
		'typescript',
		'asyncGenerators',
		'bigInt',
		'classPrivateMethods',
		'classPrivateProperties',
		'classProperties',
		'decorators-legacy',
		'doExpressions',
		'dynamicImport',
		'exportDefaultFrom',
		"exportExtensions" as any as ParserPlugin,
		'exportNamespaceFrom',
		'functionBind',
		'functionSent',
		'importMeta',
		'nullishCoalescingOperator',
		'numericSeparator',
		'objectRestSpread',
		'optionalCatchBinding',
		'optionalChaining',
		['pipelineOperator', { proposal: 'minimal' }],
		'throwExpressions',
	]
};

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "scratcher" is now active!');

	let dis = vscode.languages.registerDefinitionProvider(['javascript', 'typescript'], {
		provideDefinition(doc, pos, token) {
			const start = performance.now();
			console.log('provideDefinition');
			const file = doc.getText();

			const ast = parse(file, babelOptions);

			const babelPos = pos.translate(1);

			const path = getStringPathAt(ast, babelPos);

			console.log('find node path in pos');

			if (!path) {
				return undefined;
			}

			const { value } = path.node;
			if (/^(GET|POST)/.test(value)) {
				// 如果当前是函数定义，那就不用管了
				if (path.parent.type === 'ObjectProperty' && path.key === 'key') {
					console.log('ignore def');

					path.stop();
					return undefined;
				}
			} else {
				return undefined;
			}

			let def: vscode.Location | undefined;

			traverse(ast, {
				StringLiteral(path) {
					if (path.node.value === value && path.key === 'key' && path.parent.type === 'ObjectProperty') {
						console.log('get def');

						const v = path.parent.value;
						const { start, end } = v.loc!;
						def = new vscode.Location(doc.uri, new vscode.Range(new vscode.Position(start.line - 1, start.column), new vscode.Position(end.line - 1, end.column))) ;
						path.stop();
					}
				}
			});

			console.log(def ? 'get def' : 'no def');

			console.log(`used ${performance.now() - start}ms`);

			return def;
		}
	});

	context.subscriptions.push(dis);


	const referenceProviderListener = vscode.languages.registerReferenceProvider(['javascript', 'typescript'],{
		provideReferences(doc, pos, token) {
			const start = performance.now();
			console.log('provideDefinition');
			const file = doc.getText();

			const ast = parse(file, babelOptions);

			const babelPos = pos.translate(1);

			const refPath = getStringPathAt(ast, babelPos);

			console.log('find node path in pos');

			if (!refPath) {
				return undefined;
			}

			const { value } = refPath.node;
			if (/^(GET|POST)/.test(value)) {
				if (!(refPath.parent.type === 'ObjectProperty' && refPath.key === 'key')) {
					console.log('not def. stop');

					refPath.stop();
					return undefined;
				}
			} else {
				return undefined;
			}

			let refs: vscode.Location[] = [];

			traverse(ast, {
				StringLiteral(path) {
					if (path.node === refPath.node) {
						return;
					}

					if (path.node.value === value) {
						const v = path.node;
						const { start, end } = v.loc!;
						const ref = new vscode.Location(doc.uri, new vscode.Range(new vscode.Position(start.line - 1, start.column), new vscode.Position(end.line - 1, end.column)));
						refs.push(ref);
					}
				}
			});

			console.log(refs.length ? `found ${refs.length} ref(s)` : 'refs not found');
			return refs;
		}
	});

	context.subscriptions.push(referenceProviderListener);
}

// this method is called when your extension is deactivated
export function deactivate() { }

function getStringPathAt(ast: t.File, babelPos: vscode.Position) {
	let ret: NodePath<t.StringLiteral> | undefined;
	traverse(ast, {
		StringLiteral(path) {
			const { node } = path;

			if (node.loc?.start.line === babelPos.line &&
				node.loc.end.line === babelPos.line &&
				node.loc.start.column < babelPos.character &&
				babelPos.character < node.loc.end.column
			) {
				ret = path;
				path.stop();
			}
		}
	});
	return ret;
}