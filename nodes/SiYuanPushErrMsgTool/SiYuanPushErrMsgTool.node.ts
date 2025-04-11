import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

import { SiYuanClient } from '../../lib/SiYuanClient'; // Relative path to the client

export class SiYuanPushErrMsgTool implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'SiYuan Tool: Push Error Message',
		name: 'siYuanPushErrMsgTool',
		group: ['Tool', 'SiYuan'],
		version: 1,
		description: 'AI Tool: Displays an error message notification in the SiYuan UI.',
		defaults: {
			name: 'SiYuan Push Error Msg',
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
				displayName: 'Error Message Content', // Corrected casing if needed (already seems correct)
				name: 'errorMessageContent',
				type: 'string',
				required: true,
				default: '',
				typeOptions: {
					rows: 2,
				},
				description: 'The error message text to display',
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

			const errorMessageContent = this.getNodeParameter('errorMessageContent', itemIndex) as string;
			const timeout = this.getNodeParameter('timeout', itemIndex, 7000) as number; // Use default if not provided

			if (!errorMessageContent) throw new NodeOperationError(this.getNode(), 'Error Message Content is required.', { itemIndex });

			const result = await client.pushErrMsg(errorMessageContent, timeout);

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