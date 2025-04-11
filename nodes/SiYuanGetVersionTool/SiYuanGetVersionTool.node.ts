import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

import { SiYuanClient } from '../../lib/SiYuanClient'; // Relative path to the client

export class SiYuanGetVersionTool implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'SiYuan Tool: Get Version',
		name: 'siYuanGetVersionTool',
		group: ['Tool', 'SiYuan'],
		version: 1,
		description: 'AI Tool: Retrieves the current version of the SiYuan system.',
		defaults: {
			name: 'SiYuan Get Version',
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
			// No properties needed for this operation
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const itemIndex = 0; // Process only the first item for tool execution

		// Although no input items are strictly needed, we process the first one
		// to maintain consistency and handle potential future extensions.
		if (items.length === 0) {
			// If needed, create a dummy item if the node should run even with no input
			// items.push({ json: {}, pairedItem: { item: 0 } });
			// For now, require at least one input item like other tools
			 throw new NodeOperationError(this.getNode(), 'No input data found.');
		}


		try {
			const credentials = await this.getCredentials('siYuanApi');
			const client = new SiYuanClient(credentials.apiUrl as string, credentials.apiToken as string);

			const version = await client.getVersion();

			// Return the result (the version string)
			returnData.push({ json: { version: version }, pairedItem: { item: itemIndex } });

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