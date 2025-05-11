import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
	NodeConnectionType, // Added as value import
} from 'n8n-workflow';

import { SiYuanClient } from '../../lib/SiYuanClient'; // Adjust path as needed

export class SiYuan implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'SiYuan',
		name: 'siYuan',
		// eslint-disable-next-line n8n-nodes-base/node-class-description-icon-not-svg
		icon: 'file:siyuan.svg',
		group: ['productivity'],
		version: 1,
		subtitle: '={{$parameter[\"operation\"]}}',
		description: 'Interacts with the SiYuan API using selected operations',
		defaults: {
			name: 'SiYuan', // Renamed default
		},
		// eslint-disable-next-line n8n-nodes-base/node-class-description-inputs-wrong-regular-node
		inputs: [NodeConnectionType.Main],
		// eslint-disable-next-line n8n-nodes-base/node-class-description-outputs-wrong
		outputs: [NodeConnectionType.Main],
		credentials: [
			{
				name: 'siYuanApi',
				required: true,
			},
		],
		properties: [
			// Operation Selector
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				// Alphabetized options with descriptions and actions
				options: [
					{ name: 'Append Block', value: 'appendBlock', description: 'Adds a new block of content (Markdown or HTML) to the end of a specified parent block (like a document or another block within it)', action: 'Append markdown dom block to a parent block'},
					{ name: 'Create Document', value: 'createDoc', description: 'Creates a brand new document within a chosen notebook, using the Markdown content you provide', action: 'Create a new document with markdown content'},
					{ name: 'Create Notebook', value: 'createNotebook', description: 'Creates a new, empty notebook in SiYuan', action: 'Create notebook'},
					{ name: 'Delete Block', value: 'deleteBlock', description: 'Permanently removes a specific block (like a paragraph, list, or image) using its unique ID', action: 'Delete a block by its ID'},
					{ name: 'Execute SQL Query', value: 'sqlQuery', description: 'Runs a custom SQL query directly on your SiYuan database to fetch or modify data', action: 'Execute a sql query against the si yuan database'},
					{ name: 'Export Document Markdown', value: 'exportDocMd', description: 'Exports a document\'s full Markdown content along with its human-readable path (HPath)', action: 'Export document markdown'},
					{ name: 'Get Block Attributes', value: 'getBlockAttrs', description: 'Retrieves all custom and built-in attributes (like title, name, alias) for a specific block using its ID', action: 'Get attributes of a block by its ID'},
					{ name: 'Get Block Kramdown', value: 'getBlockKramdown', description: 'Fetches the raw Markdown (Kramdown format) content of a specific block (including documents) using its ID', action: 'Get the kramdown source of a block by its id'},
					{ name: 'Get Child Blocks', value: 'getChildBlocks', description: 'Retrieves a list of direct child blocks under a specified parent block ID', action: 'Get child blocks'},
					{ name: 'Get Document ID by Path', value: 'getDocIdByPath', description: 'Finds the unique ID of a document by providing its folder-like path (e.g., /My Notes/Meeting Summary) within a notebook', action: 'Find the document id based on its human readable path h path'},
					{ name: 'Get Document Path by ID', value: 'getDocPathById', description: 'Retrieves the human-readable folder-like path (e.g., /My Notes/Meeting Summary) for a document using its unique ID', action: 'Get the human readable path h path of a document by its id'},
					{ name: 'Get Version', value: 'getVersion', description: 'Retrieves the current version number of your SiYuan application', action: 'Get the si yuan system version'},
					{ name: 'Insert Block', value: 'insertBlock', description: 'Adds a new block of content (Markdown or HTML) either before or after an existing block, or as the first/last child of a parent block', action: 'Insert a markdown dom block relative to another block'},
					{ name: 'List Documents in Notebook', value: 'listDocsInNotebook', description: 'Retrieves a list of all documents (including their titles and IDs) found directly within a specific notebook', action: 'List documents in notebook'},
					{ name: 'List Files in Directory', value: 'listFilesInDir', description: 'Lists files and folders within a specified directory path under the SiYuan workspace (e.g., /data/notebook_id/, /assets/)', action: 'List files in directory'},
					{ name: 'List Notebooks', value: 'listNotebooks', description: 'Retrieves a list of all your notebooks, showing their names and unique IDs', action: 'List notebooks'},
					{ name: 'Move Document', value: 'moveDoc', description: 'Moves one or more documents to a different location (another notebook or as a sub-document)', action: 'Move a document to another parent notebook or document'},
					{ name: 'Prepend Block', value: 'prependBlock', description: 'Adds a new block of content (Markdown or HTML) to the beginning of a specified parent block', action: 'Prepend markdown dom block to a parent block'},
					{ name: 'Push Error Message', value: 'pushErrMsg', description: 'Shows an error message popup (toast notification) in the SiYuan user interface', action: 'Display an error message notification in si yuan'},
					{ name: 'Push Message', value: 'pushMsg', description: 'Shows an informational message popup (toast notification) in the SiYuan user interface', action: 'Display an informational message notification in si yuan'},
					{ name: 'Remove Document', value: 'removeDoc', description: 'Permanently deletes a document using its unique ID', action: 'Remove a document by its ID'},
					{ name: 'Remove Notebook', value: 'removeNotebook', description: 'Permanently deletes an entire notebook and all its contents. Use with caution as this is irreversible.', action: 'Remove notebook irreversible'},
					{ name: 'Rename Document', value: 'renameDoc', description: 'Changes the title of an existing document using its unique ID', action: 'Rename a document by its ID'},
					{ name: 'Rename Notebook', value: 'renameNotebook', description: 'Changes the name of an existing notebook', action: 'Rename notebook'},
					{ name: 'Render Sprig Template', value: 'renderSprig', description: 'Processes a template string using SiYuan\'s built-in Sprig template functions (useful for dynamic text generation)', action: 'Render a template string using sprig functions'},
					{ name: 'Set Block Attributes', value: 'setBlockAttrs', description: 'Adds or updates custom or built-in attributes (like title, alias, custom tags) for a specific block', action: 'Set attributes for a block by its ID'},
					{ name: 'Update Block', value: 'updateBlock', description: 'Replaces the entire content of an existing block with new Markdown or HTML content', action: 'Update the content of a block by its ID'},
				],
				default: 'createDoc', // Default remains the same

			},

			// --- Parameters for Operations (Conditional Display) ---

			// == Create Document / Get Document ID by Path / List Documents in Notebook ==
			{
				displayName: 'Notebook ID',
				name: 'notebookId',
				type: 'string',
				required: true,
				default: '',
				displayOptions: { show: { operation: ['createDoc', 'getDocIdByPath', 'listDocsInNotebook', 'renameNotebook', 'removeNotebook'] } },
				description: 'The unique ID of the SiYuan notebook you want to work with (e.g., for creating a document in it or listing its documents)',
			},
			// == Create Document / Get Document ID by Path ==
			{
				displayName: 'Document Path',
				name: 'docPath',
				type: 'string',
				required: true,
				default: '/',
				displayOptions: { show: { operation: ['createDoc', 'getDocIdByPath'] } },
				description: 'The folder-like path where the document should be created or found (e.g., `/My Project/Meeting Notes`). Must start with `/`.',
			},
			// == List Files in Directory ==
			{
				displayName: 'Directory Path',
				name: 'directoryPath',
				type: 'string',
				required: true,
				default: '/data/',
				displayOptions: { show: { operation: ['listFilesInDir'] } },
				description: 'The path of the directory within the SiYuan workspace (e.g., /data/notebook_id/, /assets/). Must start with /.',
			},
			// == Create Document ==
			{
				displayName: 'Markdown Content',
				name: 'markdownContent',
				type: 'string',
				typeOptions: { multiLine: true },
				required: true,
				default: '',
				displayOptions: { show: { operation: ['createDoc'] } },
				description: 'The actual text and formatting (using GitHub Flavored Markdown) for the new document you\'re creating',
			},
			// == Create Notebook ==
			{
				displayName: 'New Notebook Name',
				name: 'notebookNameForCreate',
				type: 'string',
				required: true,
				default: '',
				displayOptions: { show: { operation: ['createNotebook'] } },
				description: 'The name for the new notebook to be created',
			},
			// == Rename Notebook ==
			{
				displayName: 'New Name for Notebook',
				name: 'notebookNewName', // Distinct name for this parameter
				type: 'string',
				required: true,
				default: '',
				displayOptions: { show: { operation: ['renameNotebook'] } },
				description: 'The new name to assign to the specified notebook',
			},

			// == Rename Document / Remove Document / Move Document / Get Document Path by ID ==
			{
				displayName: 'Document ID',
				name: 'docId',
				type: 'string',
				required: true,
				default: '',
				displayOptions: { show: { operation: ['renameDoc', 'removeDoc', 'moveDoc', 'getDocPathById', 'exportDocMd'] } },
				description: 'The unique ID of the SiYuan document you want to target for this operation (e.g., renaming, removing, moving)',
			},
			// == Rename Document ==
			{
				displayName: 'New Title',
				name: 'newTitle',
				type: 'string',
				required: true,
				default: '',
				displayOptions: { show: { operation: ['renameDoc'] } },
				description: 'The new name you want to give to the document',
			},
			// == Move Document ==
			{
				displayName: 'New Parent ID (Notebook/Doc)',
				name: 'targetParentId',
				type: 'string',
				required: true,
				default: '',
				displayOptions: { show: { operation: ['moveDoc'] } },
				description: 'The unique ID of the destination notebook or parent document where you want to move the selected document(s)',
			},

			// == Block Operations (Common ID for Update, Delete, Get Kramdown, Set/Get Attributes) ==
			{
				displayName: 'Block ID',
				name: 'blockId',
				type: 'string',
				required: true,
				default: '',
				displayOptions: {
					show: {
						operation: [
							'updateBlock',
							'deleteBlock',
							'getBlockKramdown',
							'setBlockAttrs',
							'getBlockAttrs',
							'getChildBlocks',
						]
					}
				},
				description: 'The unique ID of the specific block (paragraph, list, image, or even a whole document) you want to affect',
			},

			// == Append/Prepend/Insert Block ==
			{
				displayName: 'Parent Block ID',
				name: 'parentBlockId',
				type: 'string',
				required: true,
				default: '',
				displayOptions: { show: { operation: ['appendBlock', 'prependBlock', 'insertBlock'] } },
				description: 'The unique ID of the block (often a document or a list) inside which you want to add the new content',
			},
			// == Append/Prepend/Insert/Update Block ==
			{
				displayName: 'Content (Markdown/HTML)',
				name: 'blockData',
				type: 'string',
				typeOptions: { multiLine: true },
				required: true,
				default: '',
				displayOptions: { show: { operation: ['appendBlock', 'prependBlock', 'insertBlock', 'updateBlock'] } },
				description: 'The text and formatting (Markdown or HTML) for the new or updated block',
			},
			// == Insert Block (Optional) ==
			{
				displayName: 'Previous Block ID',
				name: 'previousBlockId',
				type: 'string',
				default: '',
				displayOptions: { show: { operation: ['insertBlock'] } },
				description: 'Optional: If inserting a new block, this is the ID of the existing block that the new one should come *after*',
			},
			{
				displayName: 'Next Block ID',
				name: 'nextBlockId',
				type: 'string',
				default: '',
				displayOptions: { show: { operation: ['insertBlock'] } },
				description: 'Optional: If inserting a new block, this is the ID of the existing block that the new one should come *before* (used if `Previous Block ID` is empty)',
			},

			// == Set Block Attributes ==
			{
				displayName: 'Attributes',
				name: 'attributes',
				type: 'fixedCollection',
				typeOptions: { multipleValues: true },
				required: true,
				default: {},
				displayOptions: { show: { operation: ['setBlockAttrs'] } },
				description: 'Define one or more attributes (name/value pairs) to add or update on the block. Custom attribute names need to start with `custom-`.',
				options: [
					{
						name: 'attributeValues',
						displayName: 'Attribute',
						values: [
							{
								displayName: 'Name',
								name: 'name',
								type: 'string',
								default: '',
								description: 'The name of the attribute (e.g., `title`, `alias`, `custom-status`)',
							},
							{
								displayName: 'Value',
								name: 'value',
								type: 'string',
								default: '',
								description: 'The value to assign to this attribute',
							},
						],
					},
				],
			},

			// == Execute SQL Query ==
			{
				displayName: 'SQL Statement',
				name: 'sqlStatement',
				type: 'string',
				typeOptions: { multiLine: true },
				required: true,
				default: 'SELECT * FROM blocks LIMIT 10',
				displayOptions: { show: { operation: ['sqlQuery'] } },
				description: 'The full SQL query (e.g., `SELECT * FROM blocks WHERE content LIKE \'%keyword%\'`) to run on your SiYuan data',
			},

			// == Render Sprig Template ==
			{
				displayName: 'Sprig Template',
				name: 'sprigTemplate',
				type: 'string',
				required: true,
				default: '{{now | date "2006-01-02"}}',
				displayOptions: { show: { operation: ['renderSprig'] } },
				description: 'A template string using Sprig functions (e.g., `{{now | date "2006-01-02"}}`) that SiYuan will process',
			},

			// == Push Message / Push Error Message ==
			{
				displayName: 'Message',
				name: 'message',
				type: 'string',
				required: true,
				default: '',
				displayOptions: { show: { operation: ['pushMsg', 'pushErrMsg'] } },
				description: 'The text content of the notification message you want to show in SiYuan',
			},
			{
				displayName: 'Timeout (Ms)',
				name: 'timeout',
				type: 'number',
				default: 7000,
				displayOptions: { show: { operation: ['pushMsg', 'pushErrMsg'] } },
				description: 'How long (in milliseconds) the notification message should stay visible in SiYuan (e.g., 7000 for 7 seconds)',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const length = items.length;

		// Get credentials
		const credentials = await this.getCredentials('siYuanApi');
		const apiUrl = credentials.apiUrl as string;
		const apiToken = credentials.apiToken as string;

		if (!apiUrl || !apiToken) {
			throw new NodeOperationError(this.getNode(), 'Credentials missing!', { itemIndex: 0 });
		}

		const client = new SiYuanClient(apiUrl, apiToken);

		for (let itemIndex = 0; itemIndex < length; itemIndex++) {
			try {
				const operation = this.getNodeParameter('operation', itemIndex) as string;
				let result: any; // Use 'any' for simplicity, refine later if needed

				switch (operation) {
					// --- Notebook/Document Creation ---
					case 'createNotebook': {
						const notebookName = this.getNodeParameter('notebookNameForCreate', itemIndex) as string;
						result = await client.createNotebook(notebookName);
						break;
					}
					// --- Document Operations ---
					case 'createDoc': {
						const notebookId = this.getNodeParameter('notebookId', itemIndex) as string;
						const docPath = this.getNodeParameter('docPath', itemIndex) as string;
						const markdownContent = this.getNodeParameter('markdownContent', itemIndex) as string;
						result = await client.createDocWithMd(notebookId, docPath, markdownContent);
						break;
					}
					case 'renameDoc': {
						const docId = this.getNodeParameter('docId', itemIndex) as string;
						const newTitle = this.getNodeParameter('newTitle', itemIndex) as string;
						result = await client.renameDocByID(docId, newTitle);
						break;
					}
					case 'renameNotebook': {
						const notebookId = this.getNodeParameter('notebookId', itemIndex) as string;
						const newNotebookName = this.getNodeParameter('notebookNewName', itemIndex) as string;
						result = await client.renameNotebook(notebookId, newNotebookName);
						break;
					}
					case 'removeDoc': {
						const docId = this.getNodeParameter('docId', itemIndex) as string;
						result = await client.removeDocByID(docId);
						break;
					}
					case 'removeNotebook': {
						const notebookId = this.getNodeParameter('notebookId', itemIndex) as string;
						// Confirmation check removed as per user request
						result = await client.removeNotebook(notebookId);
						break;
					}
					case 'moveDoc': {
						// Assuming single item processing for simplicity
						const docId = this.getNodeParameter('docId', itemIndex) as string;
						const targetParentId = this.getNodeParameter('targetParentId', itemIndex) as string;
						result = await client.moveDocsByID([docId], targetParentId); // Pass docId as array
						break;
					}
					case 'getDocIdByPath': {
						const notebookId = this.getNodeParameter('notebookId', itemIndex) as string;
						const docPath = this.getNodeParameter('docPath', itemIndex) as string;
						result = await client.getIDsByHPath(docPath, notebookId);
						break;
					}
					case 'getDocPathById': {
						const docId = this.getNodeParameter('docId', itemIndex) as string;
						result = await client.getHPathByID(docId);
						break;
					}
					case 'listDocsInNotebook': {
						const notebookId = this.getNodeParameter('notebookId', itemIndex) as string;
						result = await client.listDocsInNotebook(notebookId);
						break;
					}
					case 'listNotebooks': {
						result = await client.listNotebooks();
						break;
					}
					case 'listFilesInDir': {
						const directoryPath = this.getNodeParameter('directoryPath', itemIndex) as string;
						result = await client.listFilesInDirectory(directoryPath);
						break;
					}

					// --- Block Operations ---
					case 'appendBlock': {
						const parentBlockId = this.getNodeParameter('parentBlockId', itemIndex) as string;
						const blockData = this.getNodeParameter('blockData', itemIndex) as string;
						result = await client.appendBlock(parentBlockId, blockData);
						break;
					}
					case 'prependBlock': {
						const parentBlockId = this.getNodeParameter('parentBlockId', itemIndex) as string;
						const blockData = this.getNodeParameter('blockData', itemIndex) as string;
						result = await client.prependBlock(parentBlockId, blockData);
						break;
					}
					case 'insertBlock': {
						const parentBlockId = this.getNodeParameter('parentBlockId', itemIndex) as string;
						const blockData = this.getNodeParameter('blockData', itemIndex) as string;
						const previousBlockId = this.getNodeParameter('previousBlockId', itemIndex, '') as string | undefined;
						const nextBlockId = this.getNodeParameter('nextBlockId', itemIndex, '') as string | undefined;
						result = await client.insertBlock(blockData, 'markdown', previousBlockId || undefined, nextBlockId || undefined, parentBlockId);
						break;
					}
					case 'updateBlock': {
						const blockId = this.getNodeParameter('blockId', itemIndex) as string;
						const blockData = this.getNodeParameter('blockData', itemIndex) as string;
						result = await client.updateBlock(blockId, blockData);
						break;
					}
					case 'deleteBlock': {
						const blockId = this.getNodeParameter('blockId', itemIndex) as string;
						result = await client.deleteBlock(blockId);
						break;
					}
					case 'getBlockKramdown': {
						const blockId = this.getNodeParameter('blockId', itemIndex) as string;
						result = await client.getBlockKramdown(blockId);
						break;
					}
					case 'getChildBlocks': {
						const parentBlockId = this.getNodeParameter('blockId', itemIndex) as string; // Reusing 'blockId' as the parent ID
						result = await client.getChildBlocks(parentBlockId);
						break;
					}

					// --- Attribute Operations ---
					case 'setBlockAttrs': {
						const blockId = this.getNodeParameter('blockId', itemIndex) as string;
						const attributesRaw = this.getNodeParameter('attributes', itemIndex) as { attributeValues: Array<{ name: string; value: string }> };
						const attrs: Record<string, string> = {};
						if (attributesRaw.attributeValues) {
							for (const pair of attributesRaw.attributeValues) {
								if (pair.name) { // Ensure name is not empty
									attrs[pair.name] = pair.value;
								}
							}
						}
						result = await client.setBlockAttrs(blockId, attrs);
						break;
					}
					case 'getBlockAttrs': {
						const blockId = this.getNodeParameter('blockId', itemIndex) as string;
						result = await client.getBlockAttrs(blockId);
						break;
					}

					// --- SQL Operations ---
					case 'sqlQuery': {
						const sqlStatement = this.getNodeParameter('sqlStatement', itemIndex) as string;
						result = await client.sqlQuery(sqlStatement);
						break;
					}
					case 'exportDocMd': {
						const docId = this.getNodeParameter('docId', itemIndex) as string;
						result = await client.exportDocMd(docId);
						break;
					}

					// --- Template Operations ---
					case 'renderSprig': {
						const sprigTemplate = this.getNodeParameter('sprigTemplate', itemIndex) as string;
						result = await client.renderSprig(sprigTemplate);
						break;
					}

					// --- Notification Operations ---
					case 'pushMsg': {
						const message = this.getNodeParameter('message', itemIndex) as string;
						const timeout = this.getNodeParameter('timeout', itemIndex) as number;
						result = await client.pushMsg(message, timeout);
						break;
					}
					case 'pushErrMsg': {
						const message = this.getNodeParameter('message', itemIndex) as string;
						const timeout = this.getNodeParameter('timeout', itemIndex) as number;
						result = await client.pushErrMsg(message, timeout);
						break;
					}

					// --- System Operations ---
					case 'getVersion': {
						result = await client.getVersion();
						break;
					}

					default:
						throw new NodeOperationError(this.getNode(), `Unsupported operation: ${operation}`, { itemIndex });
				}

				// Structure the output data
				const executionData = this.helpers.constructExecutionMetaData(
					this.helpers.returnJsonArray(result === null ? { success: true } : result), // Handle null results
					{ itemData: { item: itemIndex } },
				);
				returnData.push(...executionData);

			} catch (error) {
				if (this.continueOnFail()) {
					const executionErrorData = this.helpers.constructExecutionMetaData(
						this.helpers.returnJsonArray({ error: error.message }),
						{ itemData: { item: itemIndex } },
					);
					returnData.push(...executionErrorData);
					continue;
				}
				throw error; // Rethrow if not continuing on fail
			}
		}

		return this.prepareOutputData(returnData);
	}
}