import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

import { SiYuanClient } from '../../lib/SiYuanClient'; // Relative path to the client

export class SiYuanGetDocPathByIdTool implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'SiYuan Tool: Get Document Path by ID',
		name: 'siYuanGetDocPathByIdTool',
		group: ['Tool', 'SiYuan'],
		version: 1,
		description: 'AI Tool: Retrieves the human-readable path (HPath) for a given document ID.',
		defaults: {
			name: 'SiYuan Get Doc Path',
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
				description: 'The ID of the document whose path is needed',
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

			if (!docId) throw new NodeOperationError(this.getNode(), 'Document ID is required.', { itemIndex });

			const documentPath = await client.getHPathByID(docId);

			// Return the result (the document path)
			returnData.push({ json: { documentPath: documentPath }, pairedItem: { item: itemIndex } });

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