import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

import { SiYuanClient } from '../../lib/SiYuanClient'; // Relative path to the client

export class SiYuanPrependBlockTool implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'SiYuan Tool: Prepend Block',
		name: 'siYuanPrependBlockTool',
		group: ['Tool', 'SiYuan'],
		version: 1,
		description: 'AI Tool: Prepends Markdown content to the beginning of a specified parent block (document or block) in SiYuan.',
		defaults: {
			name: 'SiYuan Prepend Block',
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
				displayName: 'Parent Block ID',
				name: 'parentBlockId',
				type: 'string',
				required: true,
				default: '',
				description: 'The ID of the document or block to prepend content to',
			},
			{
				displayName: 'Markdown Content',
				name: 'markdownContent',
				type: 'string',
				required: true,
				default: '',
				typeOptions: {
					rows: 4,
				},
				description: 'The Markdown content to prepend',
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

			const parentBlockId = this.getNodeParameter('parentBlockId', itemIndex) as string;
			const markdownContent = this.getNodeParameter('markdownContent', itemIndex) as string;

			if (!parentBlockId) throw new NodeOperationError(this.getNode(), 'Parent Block ID is required.', { itemIndex });
			// Allow empty markdown content

			const result = await client.prependBlock(parentBlockId, markdownContent);

			// Return the result from the API (might contain info about new blocks)
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