import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

import { SiYuanClient } from '../../lib/SiYuanClient'; // Relative path to the client

export class SiYuanPushMsgTool implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'SiYuan Tool: Push Message',
		name: 'siYuanPushMsgTool',
		group: ['Tool', 'SiYuan'],
		version: 1,
		description: 'AI Tool: Displays an informational message notification in the SiYuan UI.',
		defaults: {
			name: 'SiYuan Push Message',
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
				displayName: 'Message Content', // Corrected casing if needed (already seems correct)
				name: 'messageContent',
				type: 'string',
				required: true,
				default: '',
				typeOptions: {
					rows: 2,
				},
				description: 'The informational message text to display',
			},
			{
				displayName: 'Timeout (Ms)',
				name: 'timeout',
				type: 'number',
				default: 7000,
				description: 'Optional: Duration to display the message (in milliseconds, default 7000)',
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

			const messageContent = this.getNodeParameter('messageContent', itemIndex) as string;
			const timeout = this.getNodeParameter('timeout', itemIndex, 7000) as number; // Use default if not provided

			if (!messageContent) throw new NodeOperationError(this.getNode(), 'Message Content is required.', { itemIndex });

			const result = await client.pushMsg(messageContent, timeout);

			// Return the result (message ID)
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