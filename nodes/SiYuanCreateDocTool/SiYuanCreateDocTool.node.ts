import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

import { SiYuanClient } from '../../lib/SiYuanClient'; // Relative path to the client

export class SiYuanCreateDocTool implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'SiYuan Tool: Create Document',
		name: 'siYuanCreateDocTool',
		group: ['Tool', 'SiYuan'], // Grouping for AI Agent tools
		version: 1,
		description: 'AI Tool: Creates a new document in SiYuan with specified content.',
		defaults: {
			name: 'SiYuan Create Doc',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'siYuanApi', // Reference the existing credential
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
				description: 'The ID of the target notebook where the document will be created',
			},
			{
				displayName: 'Document Path (HPath)',
				name: 'docPath',
				type: 'string',
				required: true,
				default: '/',
				description: 'The desired human-readable path for the new document (e.g., /Notes/My New Doc)',
			},
			{
				displayName: 'Markdown Content',
				name: 'markdownContent',
				type: 'string',
				required: true,
				default: '',
				typeOptions: {
					rows: 4, // Use rows instead of multiLine for programmatic nodes if needed
				},
				description: 'The initial Markdown content for the new document',
			},
		],
	};

	// The execute method will be called by the AI Agent node
	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		// Assume the AI Agent provides inputs on the first item
		if (items.length === 0) {
			throw new NodeOperationError(this.getNode(), 'No input data found.');
		}
		const itemIndex = 0; // Process only the first item for tool execution

		try {
			const credentials = await this.getCredentials('siYuanApi');
			const client = new SiYuanClient(credentials.apiUrl as string, credentials.apiToken as string);

			// Get parameters specific to this tool
			const notebookId = this.getNodeParameter('notebookId', itemIndex) as string;
			const docPath = this.getNodeParameter('docPath', itemIndex) as string;
			const markdownContent = this.getNodeParameter('markdownContent', itemIndex) as string;

			// Validate required parameters
			if (!notebookId) throw new NodeOperationError(this.getNode(), 'Notebook ID is required.', { itemIndex });
			if (!docPath) throw new NodeOperationError(this.getNode(), 'Document Path is required.', { itemIndex });
			// markdownContent can be empty, so no validation needed unless required by API

			// Call the SiYuanClient method
			const documentId = await client.createDocWithMd(notebookId, docPath, markdownContent);

			// Return the result (the new document ID)
			returnData.push({ json: { documentId: documentId }, pairedItem: { item: itemIndex } });

		} catch (error) {
			// Catch and re-throw n8n errors to include node context
			if (this.continueOnFail()) {
				returnData.push({ json: { error: error.message }, pairedItem: { item: itemIndex } });
			} else {
				// Ensure the error is wrapped in NodeApiError or NodeOperationError for proper handling
				if (error instanceof NodeOperationError) {
					throw error;
				}
				// If it's another error type, wrap it
				throw new NodeOperationError(this.getNode(), error, { itemIndex });
			}
		}

		return this.prepareOutputData(returnData);
	}
}