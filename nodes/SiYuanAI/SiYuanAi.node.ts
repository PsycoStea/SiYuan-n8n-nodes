import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	// NodeOperationError, // Keep commented for now
} from 'n8n-workflow';

// import { SiYuanClient } from '../../lib/SiYuanClient'; // Keep commented for now

export class SiYuanAI implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'SiYuan AI (Minimal Test)', // Changed display name for clarity
		name: 'siYuanAi', // Keep original internal name
		group: ['testing'], // Use a simple group
		version: 1,
		description: 'Minimal test version of the SiYuan AI node',
		defaults: {
			name: 'SiYuan AI Minimal Test',
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
			// Only one simple property for testing
			{
				displayName: 'Test Input',
				name: 'testInput',
				type: 'string',
				default: '',
				description: 'A simple test input field',
			},
		],
	};

	// Minimal execute function
	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const returnData: INodeExecutionData[] = [];
		// No logic, just return empty data structure
		return this.prepareOutputData(returnData);
	}
}