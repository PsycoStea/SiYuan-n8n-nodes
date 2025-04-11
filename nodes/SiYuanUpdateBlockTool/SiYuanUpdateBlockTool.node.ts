import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

import { SiYuanClient } from '../../lib/SiYuanClient'; // Relative path to the client

export class SiYuanUpdateBlockTool implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'SiYuan Tool: Update Block',
		name: 'siYuanUpdateBlockTool',
		group: ['Tool', 'SiYuan'],
		version: 1,
		description: 'AI Tool: Updates the content of an existing block in SiYuan using its ID.',
		defaults: {
			name: 'SiYuan Update Block',
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
				displayName: 'Block ID',
				name: 'blockId',
				type: 'string',
				required: true,
				default: '',
				description: 'The ID of the block to update',
			},
			{
				displayName: 'New Markdown Content',
				name: 'markdownContent',
				type: 'string',
				required: true,
				default: '',
				typeOptions: {
					rows: 4,
				},
				description: 'The new Markdown content for the block',
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

			const blockId = this.getNodeParameter('blockId', itemIndex) as string;
			const markdownContent = this.getNodeParameter('markdownContent', itemIndex) as string;

			if (!blockId) throw new NodeOperationError(this.getNode(), 'Block ID is required.', { itemIndex });
			// Allow empty markdown content if the API permits replacing with empty

			const result = await client.updateBlock(blockId, markdownContent);

			// Return the result from the API (might contain info about updated blocks)
			returnData.push({ json: result, pairedItem: { item: itemIndex } });

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