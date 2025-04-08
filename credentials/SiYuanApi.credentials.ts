import {
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class SiYuanApi implements ICredentialType {
	name = 'siYuanApi';
	displayName = 'SiYuan API';
	// Define the properties required for this credential. User inputs values
	// for these properties when adding the credential in n8n.
	properties: INodeProperties[] = [
		{
			displayName: 'SiYuan API URL',
			name: 'apiUrl',
			type: 'string',
			default: 'http://127.0.0.1:6806',
			description: 'The URL of your SiYuan API endpoint',
			required: true,
		},
		{
			displayName: 'API Token',
			name: 'apiToken',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			description: 'Your SiYuan API token (found in Settings -> About)',
			required: true,
		},
	];

	// SiYuan uses a simple Token authentication in the header.
	// The actual authentication logic (adding the header) will be handled
	// within the API client or node making the request, not via a generic
	// authenticate property here.
	// A 'test' method could be added later to verify credentials against
	// an endpoint like /api/system/version.
}