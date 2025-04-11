import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

import { SiYuanClient } from '../../lib/SiYuanClient'; // Relative path to the client

export class SiYuanMoveDocTool implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'SiYuan Tool: Move Document(s)',
		name: 'siYuanMoveDocTool',
		group: ['Tool', 'SiYuan'],
		version: 1,
		description: 'AI Tool: Moves one or more documents to a new parent (notebook or document) in SiYuan using their IDs.',
		defaults: {
			name: 'SiYuan Move Doc(s)',
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
			// --- Input Properties for this specific tool ---
			{
				displayName: 'Source Document IDs',
				name: 'fromIDs',
				type: 'string', // AI Agent likely provides comma-separated string or JSON array string
				required: true,
				default: '',
				description: 'Comma-separated list or JSON array string of document IDs to move',
			},
			{
				displayName: 'Target Parent ID',
				name: 'toID',
				type: 'string',
				required: true,
				default: '',
				description: 'The ID of the target notebook or document to move the source document(s) into',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const itemIndex = 0; // Process only the first item for tool execution

		if (items.length === 0) {
			throw new NodeOperationError(this.getNode(), 'No input data found.');
		}

		try {
			const credentials = await this.getCredentials('siYuanApi');
			const client = new SiYuanClient(credentials.apiUrl as string, credentials.apiToken as string);

			const fromIDsInput = this.getNodeParameter('fromIDs', itemIndex) as string;
			const toID = this.getNodeParameter('toID', itemIndex) as string;

			if (!fromIDsInput) throw new NodeOperationError(this.getNode(), 'Source Document IDs are required.', { itemIndex });
			if (!toID) throw new NodeOperationError(this.getNode(), 'Target Parent ID is required.', { itemIndex });

			// Attempt to parse the input string as JSON array or split by comma
			let fromIDsArray: string[];
			try {
				// Try parsing as JSON array first
				const parsedJson = JSON.parse(fromIDsInput);
				if (Array.isArray(parsedJson) && parsedJson.every(item => typeof item === 'string')) {
					fromIDsArray = parsedJson;
				} else {
					// Throw NodeOperationError for invalid JSON structure
					throw new NodeOperationError(this.getNode(), 'Input is not a valid JSON array of strings.', { itemIndex });
				}
			} catch (jsonError) {
				// If JSON parsing fails, assume comma-separated string
				fromIDsArray = fromIDsInput.split(',').map(id => id.trim()).filter(id => id !== '');
			}

			if (fromIDsArray.length === 0) {
				throw new NodeOperationError(this.getNode(), 'No valid Source Document IDs found in the input string.', { itemIndex });
			}

			await client.moveDocsByID(fromIDsArray, toID);

			// Return success confirmation
			returnData.push({ json: { success: true, movedDocumentIds: fromIDsArray, targetParentId: toID }, pairedItem: { item: itemIndex } });

		} catch (error) {
			if (this.continueOnFail()) {
				returnData.push({ json: { error: error.message }, pairedItem: { item: itemIndex } });
			} else {
				if (error instanceof NodeOperationError) {
					throw error;
				}
				// Wrap other errors in NodeOperationError
				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex });
			}
		}

		return this.prepareOutputData(returnData);
	}
}