import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

import { SiYuanClient } from '../../lib/SiYuanClient'; // Relative path to the client

export class SiYuanGetDocIdByPathTool implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'SiYuan Tool: Get Document ID by Path',
		name: 'siYuanGetDocIdByPathTool',
		group: ['Tool', 'SiYuan'],
		version: 1,
		description: 'AI Tool: Retrieves the document ID(s) for a given human-readable path (HPath) within a specific notebook.',
		defaults: {
			name: 'SiYuan Get Doc ID',
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
				displayName: 'Notebook ID',
				name: 'notebookId',
				type: 'string',
				required: true,
				default: '',
				description: 'The ID of the notebook containing the document path',
			},
			{
				displayName: 'Document Path (HPath)',
				name: 'docPath',
				type: 'string',
				required: true,
				default: '/',
				description: 'The human-readable path to resolve (e.g., /Notes/My Document)',
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

			const notebookId = this.getNodeParameter('notebookId', itemIndex) as string;
			const docPath = this.getNodeParameter('docPath', itemIndex) as string;

			if (!notebookId) throw new NodeOperationError(this.getNode(), 'Notebook ID is required.', { itemIndex });
			if (!docPath) throw new NodeOperationError(this.getNode(), 'Document Path is required.', { itemIndex });

			const documentIds = await client.getIDsByHPath(docPath, notebookId);

			// Return the result (array of document IDs)
			returnData.push({ json: { documentIds: documentIds }, pairedItem: { item: itemIndex } });

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