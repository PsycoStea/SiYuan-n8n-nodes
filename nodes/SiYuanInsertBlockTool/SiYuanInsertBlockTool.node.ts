import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

import { SiYuanClient } from '../../lib/SiYuanClient'; // Relative path to the client

export class SiYuanInsertBlockTool implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'SiYuan Tool: Insert Block',
		name: 'siYuanInsertBlockTool',
		group: ['Tool', 'SiYuan'],
		version: 1,
		description: 'AI Tool: Inserts Markdown content relative to another block (before, after, or as child) in SiYuan.',
		defaults: {
			name: 'SiYuan Insert Block',
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
				displayName: 'Markdown Content',
				name: 'markdownContent',
				type: 'string',
				required: true,
				default: '',
				typeOptions: {
					rows: 4,
				},
				description: 'The Markdown content to insert',
			},
			{
				displayName: 'Parent Block ID (Optional)',
				name: 'parentBlockId',
				type: 'string',
				default: '',
				description: 'Insert as the last child of this block ID (used if Previous/Next ID not provided)',
			},
			{
				displayName: 'Previous Block ID (Optional)',
				name: 'previousBlockId',
				type: 'string',
				default: '',
				description: 'Insert after this block ID (takes precedence over Parent ID)',
			},
			{
				displayName: 'Next Block ID (Optional)',
				name: 'nextBlockId',
				type: 'string',
				default: '',
				description: 'Insert before this block ID (takes precedence over Previous and Parent ID)',
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

			const markdownContent = this.getNodeParameter('markdownContent', itemIndex) as string;
			const parentBlockId = this.getNodeParameter('parentBlockId', itemIndex, '') as string | undefined;
			const previousBlockId = this.getNodeParameter('previousBlockId', itemIndex, '') as string | undefined;
			const nextBlockId = this.getNodeParameter('nextBlockId', itemIndex, '') as string | undefined;

			if (!markdownContent) throw new NodeOperationError(this.getNode(), 'Markdown Content is required.', { itemIndex });
			if (!parentBlockId && !previousBlockId && !nextBlockId) {
				throw new NodeOperationError(this.getNode(), 'At least one anchor ID (Parent, Previous, or Next) is required.', { itemIndex });
			}

			const result = await client.insertBlock(
				markdownContent,
				'markdown',
				previousBlockId || undefined,
				nextBlockId || undefined,
				parentBlockId || undefined,
			);

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