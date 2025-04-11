import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
	// JsonObject, // Removed unused import
} from 'n8n-workflow';

import { SiYuanClient } from '../../lib/SiYuanClient'; // Relative path to the client

export class SiYuanSetBlockAttrsTool implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'SiYuan Tool: Set Block Attributes',
		name: 'siYuanSetBlockAttrsTool',
		group: ['Tool', 'SiYuan'],
		version: 1,
		description: 'AI Tool: Sets custom attributes for a block using its ID. Input attributes as a JSON string.',
		defaults: {
			name: 'SiYuan Set Block Attrs',
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
				description: 'The ID of the block to set attributes for',
			},
			{
				displayName: 'Attributes (JSON String)',
				name: 'attributesJson',
				type: 'string',
				required: true,
				default: '{}',
				typeOptions: {
					rows: 2,
				},
				description: 'A JSON string representing key-value pairs for attributes (e.g., `{"custom-priority":"high", "custom-tag":"project-a"}`)',
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
			const attributesJson = this.getNodeParameter('attributesJson', itemIndex) as string;

			if (!blockId) throw new NodeOperationError(this.getNode(), 'Block ID is required.', { itemIndex });
			if (!attributesJson) throw new NodeOperationError(this.getNode(), 'Attributes JSON string is required.', { itemIndex });

			let attributes: Record<string, string>;
			try {
				const parsed = JSON.parse(attributesJson);
				// Basic validation: ensure it's an object and values are strings
				if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
					// Throw NodeOperationError for invalid JSON structure
					throw new NodeOperationError(this.getNode(), 'Input must be a valid JSON object string.', { itemIndex });
				}
				attributes = {};
				for (const key in parsed) {
					if (Object.prototype.hasOwnProperty.call(parsed, key)) {
						if (typeof parsed[key] !== 'string') {
							// Throw NodeOperationError for non-string attribute values
							// attributes[key] = String(parsed[key]); // Avoid auto-casting for tool clarity
							throw new NodeOperationError(this.getNode(), `Attribute value for key "${key}" must be a string.`, { itemIndex });
						}
						attributes[key] = parsed[key];
					}
				}
			} catch (e) {
				throw new NodeOperationError(this.getNode(), `Invalid Attributes JSON string: ${e.message}`, { itemIndex });
			}

			// The client method already handles prefix validation
			await client.setBlockAttrs(blockId, attributes);

			// Return success confirmation
			returnData.push({ json: { success: true, blockId: blockId, attributesSet: attributes }, pairedItem: { item: itemIndex } });

		} catch (error) {
			if (this.continueOnFail()) {
				returnData.push({ json: { error: error.message }, pairedItem: { item: itemIndex } });
			} else {
				if (error instanceof NodeOperationError) {
					throw error;
				}
				// Wrap other errors in NodeOperationError
				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex });
			}
		}

		return this.prepareOutputData(returnData);
	}
}