import { INodeType, INodeTypeDescription, NodeConnectionType } from 'n8n-workflow'; // Added NodeConnectionType
import { httpVerbFields, httpVerbOperations } from './HttpVerbDescription';

export class HttpBin implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'HttpBin',
		name: 'httpBin',
		icon: 'file:httpbin.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Interact with HttpBin API',
		defaults: {
			name: 'HttpBin',
		},
		// eslint-disable-next-line n8n-nodes-base/node-class-description-inputs-wrong-regular-node
		inputs: [NodeConnectionType.Main],
		// eslint-disable-next-line n8n-nodes-base/node-class-description-outputs-wrong
		outputs: [NodeConnectionType.Main],
		credentials: [
			{
				name: 'httpbinApi',
				required: false,
			},
		],
		requestDefaults: {
			baseURL: 'https://httpbin.org',
			url: '',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
			},
		},
		/**
		 * In the properties array we have two mandatory options objects required
		 *
		 * [Resource & Operation]
		 *
		 * https://docs.n8n.io/integrations/creating-nodes/code/create-first-node/#resources-and-operations
		 *
		 * In our example, the operations are separated into their own file (HTTPVerbDescription.ts)
		 * to keep this class easy to read.
		 *
		 */
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'HTTP Verb',
						value: 'httpVerb',
					},
				],
				default: 'httpVerb',
			},

			...httpVerbOperations,
			...httpVerbFields,
		],
	};
}
