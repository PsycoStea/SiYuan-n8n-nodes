import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

import { SiYuanClient } from '../../lib/SiYuanClient'; // Relative path to the client

export class SiYuanRenameDocTool implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'SiYuan Tool: Rename Document',
		name: 'siYuanRenameDocTool',
		group: ['Tool', 'SiYuan'],
		version: 1,
		description: 'AI Tool: Renames an existing document in SiYuan using its ID.',
		defaults: {
			name: 'SiYuan Rename Doc',
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
				displayName: 'Document ID',
				name: 'docId',
				type: 'string',
				required: true,
				default: '',
				description: 'The ID of the document to rename',
			},
			{
				displayName: 'New Title',
				name: 'newTitle',
				type: 'string',
				required: true,
				default: '',
				description: 'The desired new title for the document',
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

			const docId = this.getNodeParameter('docId', itemIndex) as string;
			const newTitle = this.getNodeParameter('newTitle', itemIndex) as string;

			if (!docId) throw new NodeOperationError(this.getNode(), 'Document ID is required.', { itemIndex });
			if (!newTitle) throw new NodeOperationError(this.getNode(), 'New Title is required.', { itemIndex });

			await client.renameDocByID(docId, newTitle);

			// Return success confirmation
			returnData.push({ json: { success: true, documentId: docId, newTitle: newTitle }, pairedItem: { item: itemIndex } });

		} catch (error) {
			if (this.continueOnFail()) {
				returnData.push({ json: { error: error.message }, pairedItem: { item: itemIndex } });
			} else {
				if (error instanceof NodeOperationError) {
					throw error;
				}
				throw new NodeOperationError(this.getNode(), error, { itemIndex });
			}
		}

		return this.prepareOutputData(returnData);
	}
}