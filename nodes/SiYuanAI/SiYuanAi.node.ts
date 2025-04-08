import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

import { SiYuanClient } from '../../lib/SiYuanClient'; // Adjust path as needed

export class SiYuanAI implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'SiYuan AI',
		name: 'siYuanAi',
		// eslint-disable-next-line n8n-nodes-base/node-class-description-icon-not-svg
		icon: 'file:siyuanai.svg', // Placeholder - icon needs to be created
		group: ['ai', 'productivity'], // Assuming 'ai' group exists or adjust as needed
		version: 1,
		subtitle: '={{$parameter[\"operation\"]}}',
		description: 'Interacts with the SiYuan API using selected operations',
		defaults: {
			name: 'SiYuan AI',
		},
		inputs: ['main'],
		outputs: ['main'],
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
				// Alphabetized options
				options: [
					{ name: 'Append Block', value: 'appendBlock' },
					{ name: 'Create Document', value: 'createDoc' },
					{ name: 'Delete Block', value: 'deleteBlock' },
					{ name: 'Execute SQL Query', value: 'sqlQuery' },
					{ name: 'Get Block Attributes', value: 'getBlockAttrs' },
					{ name: 'Get Block Kramdown', value: 'getBlockKramdown' },
					{ name: 'Get Document ID by Path', value: 'getDocIdByPath' },
					{ name: 'Get Document Path by ID', value: 'getDocPathById' },
					{ name: 'Get Version', value: 'getVersion' },
					{ name: 'Insert Block', value: 'insertBlock' },
					{ name: 'Move Document', value: 'moveDoc' },
					{ name: 'Prepend Block', value: 'prependBlock' },
					{ name: 'Push Error Message', value: 'pushErrMsg' },
					{ name: 'Push Message', value: 'pushMsg' },
					{ name: 'Remove Document', value: 'removeDoc' },
					{ name: 'Rename Document', value: 'renameDoc' },
					{ name: 'Render Sprig Template', value: 'renderSprig' },
					{ name: 'Set Block Attributes', value: 'setBlockAttrs' },
					{ name: 'Update Block', value: 'updateBlock' },
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
			// --- Temporarily removed all other properties for debugging ---
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		// --- Temporarily commented out execute body for debugging ---
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		// const length = items.length;

		// // Get credentials
		// const credentials = await this.getCredentials('siYuanApi');
		// const apiUrl = credentials.apiUrl as string;
		// const apiToken = credentials.apiToken as string;

		// if (!apiUrl || !apiToken) {
		// 	throw new NodeOperationError(this.getNode(), 'Credentials missing!', { itemIndex: 0 });
		// }

		// const client = new SiYuanClient(apiUrl, apiToken);

		// for (let itemIndex = 0; itemIndex < length; itemIndex++) {
		// 	try {
		// 		const operation = this.getNodeParameter('operation', itemIndex) as string;
		// 		let result: any; // Use 'any' for simplicity, refine later if needed

		// 		// Simplified switch or remove entirely for testing
		// 		switch (operation) {
		// 			case 'getVersion': {
		// 				result = await client.getVersion();
		// 				break;
		// 			}
		// 			default:
		// 				result = { message: `Operation '${operation}' selected, but execution is disabled for debugging.` };
		// 				// throw new NodeOperationError(this.getNode(), `Unsupported operation: ${operation}`, { itemIndex });
		// 		}


		// 		// Structure the output data
		// 		const executionData = this.helpers.constructExecutionMetaData(
		// 			this.helpers.returnJsonArray(result === null ? { success: true } : result), // Handle null results
		// 			{ itemData: { item: itemIndex } },
		// 		);
		// 		returnData.push(...executionData);

		// 	} catch (error) {
		// 		if (this.continueOnFail()) {
		// 			const executionErrorData = this.helpers.constructExecutionMetaData(
		// 				this.helpers.returnJsonArray({ error: error.message }),
		// 				{ itemData: { item: itemIndex } },
		// 			);
		// 			returnData.push(...executionErrorData);
		// 			continue;
		// 		}
		// 		throw error; // Rethrow if not continuing on fail
		// 	}
		// }

		// Return empty data for now
		return this.prepareOutputData(returnData);
	}
}