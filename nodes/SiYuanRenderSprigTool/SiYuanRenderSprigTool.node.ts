import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

import { SiYuanClient } from '../../lib/SiYuanClient'; // Relative path to the client

export class SiYuanRenderSprigTool implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'SiYuan Tool: Render Sprig Template',
		name: 'siYuanRenderSprigTool',
		group: ['Tool', 'SiYuan'],
		version: 1,
		description: 'AI Tool: Renders a template string using SiYuan\'s built-in Sprig template functions.',
		defaults: {
			name: 'SiYuan Render Sprig',
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
				displayName: 'Sprig Template String',
				name: 'templateString',
				type: 'string',
				required: true,
				default: '{{now | date "2006-01-02"}}',
				typeOptions: {
					rows: 2,
				},
				description: 'The template string containing Sprig functions to render (e.g., /daily/{{now | date "2006-01-02"}})',
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

			const templateString = this.getNodeParameter('templateString', itemIndex) as string;

			if (!templateString) throw new NodeOperationError(this.getNode(), 'Template String is required.', { itemIndex });

			const renderedString = await client.renderSprig(templateString);

			// Return the result (the rendered string)
			returnData.push({ json: { renderedString: renderedString }, pairedItem: { item: itemIndex } });

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