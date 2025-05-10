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
					{ name: 'Append Block', value: 'appendBlock', description: 'Append Markdown/DOM block to a parent block', action: 'Append markdown dom block to a parent block'},
					{ name: 'Create Document', value: 'createDoc', description: 'Create a new document with Markdown content', action: 'Create a new document with markdown content'},
					{ name: 'Delete Block', value: 'deleteBlock', description: 'Delete a block by its ID', action: 'Delete a block by its ID'},
					{ name: 'Execute SQL Query', value: 'sqlQuery', description: 'Execute a SQL query against the SiYuan database', action: 'Execute a sql query against the si yuan database'},
					{ name: 'Get Block Attributes', value: 'getBlockAttrs', description: 'Get attributes of a block by its ID', action: 'Get attributes of a block by its ID'},
					{ name: 'Get Block Kramdown', value: 'getBlockKramdown', description: 'Get the Kramdown source of a block by its ID', action: 'Get the kramdown source of a block by its id'},
					{ name: 'Get Document ID by Path', value: 'getDocIdByPath', description: 'Find the document ID based on its human-readable path (HPath)', action: 'Find the document id based on its human readable path h path'},
					{ name: 'Get Document Path by ID', value: 'getDocPathById', description: 'Get the human-readable path (HPath) of a document by its ID', action: 'Get the human readable path h path of a document by its id'},
					{ name: 'Get Version', value: 'getVersion', description: 'Get the SiYuan system version', action: 'Get the si yuan system version'},
					{ name: 'Insert Block', value: 'insertBlock', description: 'Insert a Markdown/DOM block relative to another block', action: 'Insert a markdown dom block relative to another block'},
					{ name: 'Move Document', value: 'moveDoc', description: 'Move a document to another parent (notebook or document)', action: 'Move a document to another parent notebook or document'},
					{ name: 'Prepend Block', value: 'prependBlock', description: 'Prepend Markdown/DOM block to a parent block', action: 'Prepend markdown dom block to a parent block'},
					{ name: 'Push Error Message', value: 'pushErrMsg', description: 'Display an error message notification in SiYuan', action: 'Display an error message notification in si yuan'},
					{ name: 'Push Message', value: 'pushMsg', description: 'Display an informational message notification in SiYuan', action: 'Display an informational message notification in si yuan'},
					{ name: 'Remove Document', value: 'removeDoc', description: 'Remove a document by its ID', action: 'Remove a document by its ID'},
					{ name: 'Rename Document', value: 'renameDoc', description: 'Rename a document by its ID', action: 'Rename a document by its ID'},
					{ name: 'Render Sprig Template', value: 'renderSprig', description: 'Render a template string using Sprig functions', action: 'Render a template string using sprig functions'},
					{ name: 'Set Block Attributes', value: 'setBlockAttrs', description: 'Set attributes for a block by its ID', action: 'Set attributes for a block by its ID'},
					{ name: 'Update Block', value: 'updateBlock', description: 'Update the content of a block by its ID', action: 'Update the content of a block by its ID'},
				],
				default: 'createDoc', // Default remains the same

			},

			// --- Parameters for Operations (Conditional Display) ---

			// == Create Document ==
			{
				displayName: 'Notebook ID',
				name: 'notebookId',
				type: 'string',
				required: true,
				default: '',
				displayOptions: { show: { operation: ['createDoc', 'getDocIdByPath'] } },
				description: 'ID of the target notebook',
			},
			{
				displayName: 'Document Path (HPath)',
				name: 'docPath',
				type: 'string',
				required: true,
				default: '/',
				displayOptions: { show: { operation: ['createDoc', 'getDocIdByPath'] } },
				description: 'Human-readable path for the document (e.g., /My Folder/My Note)',
			},
			{
				displayName: 'Markdown Content',
				name: 'markdownContent',
				type: 'string',
				typeOptions: { multiLine: true },
				required: true,
				default: '',
				displayOptions: { show: { operation: ['createDoc'] } },
				description: 'GFM Markdown content for the new document',
			},

			// == Rename Document ==
			// == Remove Document ==
			// == Move Document ==
			// == Get Document Path by ID ==
			{
				displayName: 'Document ID',
				name: 'docId',
				type: 'string',
				required: true,
				default: '',
				displayOptions: { show: { operation: ['renameDoc', 'removeDoc', 'moveDoc', 'getDocPathById'] } },
				description: 'ID of the target document',
			},
			{
				displayName: 'New Title',
				name: 'newTitle',
				type: 'string',
				required: true,
				default: '',
				displayOptions: { show: { operation: ['renameDoc'] } },
				description: 'The new title for the document',
			},
			{
				displayName: 'Target Parent ID (Notebook or Doc)',
				name: 'targetParentId',
				type: 'string',
				required: true,
				default: '',
				displayOptions: { show: { operation: ['moveDoc'] } },
				description: 'The ID of the notebook or document to move the source document(s) into',
			},
			// Note: moveDoc requires 'fromIDs' which might be better handled via expressions or multiple items
			// For simplicity here, we assume a single docId is provided. Logic might need adjustment.

			// == Block Operations (Common ID) ==
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
						]
					}
				},
				description: 'ID of the target block',
			},

			// == Append/Prepend/Insert/Update Block ==
			{
				displayName: 'Parent Block ID',
				name: 'parentBlockId',
				type: 'string',
				required: true,
				default: '',
				displayOptions: { show: { operation: ['appendBlock', 'prependBlock', 'insertBlock'] } },
				description: 'ID of the parent block (document or other block) to add content to',
			},
			{
				displayName: 'Data (Markdown)',
				name: 'blockData',
				type: 'string',
				typeOptions: { multiLine: true },
				required: true,
				default: '',
				displayOptions: { show: { operation: ['appendBlock', 'prependBlock', 'insertBlock', 'updateBlock'] } },
				description: 'Markdown content for the block',
			},
			// Optional for Insert Block
			{
				displayName: 'Previous Block ID',
				name: 'previousBlockId',
				type: 'string',
				default: '',
				displayOptions: { show: { operation: ['insertBlock'] } },
				description: 'Optional: ID of the block to insert after',
			},
			{
				displayName: 'Next Block ID',
				name: 'nextBlockId',
				type: 'string',
				default: '',
				displayOptions: { show: { operation: ['insertBlock'] } },
				description: 'Optional: ID of the block to insert before (takes precedence over previousID)',
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
				description: 'Attributes to set (key-value pairs). Custom attributes must start with "custom-".',
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
								description: 'Attribute name (e.g., custom-priority, title)',
							},
							{
								displayName: 'Value',
								name: 'value',
								type: 'string',
								default: '',
								description: 'Attribute value',
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
				description: 'The SQL query to execute against the SiYuan database',
			},

			// == Render Sprig Template ==
			{
				displayName: 'Sprig Template',
				name: 'sprigTemplate',
				type: 'string',
				required: true,
				default: '{{now | date "2006-01-02"}}',
				displayOptions: { show: { operation: ['renderSprig'] } },
				description: 'The Sprig template string to render',
			},

			// == Push Message / Push Error Message ==
			{
				displayName: 'Message',
				name: 'message',
				type: 'string',
				required: true,
				default: '',
				displayOptions: { show: { operation: ['pushMsg', 'pushErrMsg'] } },
				description: 'The message content to display',
			},
			{
				displayName: 'Timeout (Ms)',
				name: 'timeout',
				type: 'number',
				default: 7000,
				displayOptions: { show: { operation: ['pushMsg', 'pushErrMsg'] } },
				description: 'Duration to display the message (in milliseconds)',
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
					case 'removeDoc': {
						const docId = this.getNodeParameter('docId', itemIndex) as string;
						result = await client.removeDocByID(docId);
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