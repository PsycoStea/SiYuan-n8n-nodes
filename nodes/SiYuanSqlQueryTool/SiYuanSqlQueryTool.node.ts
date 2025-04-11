import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

import { SiYuanClient } from '../../lib/SiYuanClient'; // Relative path to the client

export class SiYuanSqlQueryTool implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'SiYuan Tool: Execute SQL Query',
		name: 'siYuanSqlQueryTool',
		group: ['Tool', 'SiYuan'],
		version: 1,
		description: 'AI Tool: Executes a read-only SQL query against the SiYuan database.',
		defaults: {
			name: 'SiYuan SQL Query',
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
				displayName: 'SQL Statement',
				name: 'sqlStatement',
				type: 'string',
				required: true,
				default: 'SELECT * FROM blocks LIMIT 10',
				typeOptions: {
					rows: 3,
				},
				description: 'The SQL query statement to execute (e.g., SELECT * FROM blocks WHERE content LIKE \'%keyword%\')',
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

			const sqlStatement = this.getNodeParameter('sqlStatement', itemIndex) as string;

			if (!sqlStatement) throw new NodeOperationError(this.getNode(), 'SQL Statement is required.', { itemIndex });

			// Basic check to prevent modification queries (can be improved)
			const lowerStmt = sqlStatement.toLowerCase().trim();
			if (lowerStmt.startsWith('update ') || lowerStmt.startsWith('insert ') || lowerStmt.startsWith('delete ') || lowerStmt.startsWith('drop ') || lowerStmt.startsWith('alter ')) {
				throw new NodeOperationError(this.getNode(), 'Only SELECT statements are allowed for safety.', { itemIndex });
			}

			const result = await client.sqlQuery(sqlStatement);

			// Return the result (array of result objects)
			returnData.push({ json: { results: result }, pairedItem: { item: itemIndex } });

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