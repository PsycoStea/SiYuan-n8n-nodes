import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

import { SiYuanClient } from '../../lib/SiYuanClient'; // Relative path to the client

export class SiYuanGetBlockAttrsTool implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'SiYuan Tool: Get Block Attributes',
		name: 'siYuanGetBlockAttrsTool',
		group: ['Tool', 'SiYuan'],
		version: 1,
		description: 'AI Tool: Retrieves the attributes of a block by its ID.',
		defaults: {
			name: 'SiYuan Get Block Attrs',
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
				description: 'The ID of the block whose attributes are needed',
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

			if (!blockId) throw new NodeOperationError(this.getNode(), 'Block ID is required.', { itemIndex });

			const result = await client.getBlockAttrs(blockId);

			// Return the result (object containing attributes)
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