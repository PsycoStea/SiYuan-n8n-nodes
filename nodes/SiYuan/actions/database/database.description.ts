import type { INodeProperties } from 'n8n-workflow';

export const databaseOperations: INodeProperties = {
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	displayOptions: { show: { resource: ['database'] } },
	options: [
		{
			name: 'Add Column',
			value: 'addColumn',
			description: 'Add a new column (field/key) to a database',
			action: 'Add a column to a database',
		},
		{
			name: 'Add Row',
			value: 'addRow',
			description: 'Add a new (detached) row to a database',
			action: 'Add a row to a database',
		},
		{
			name: 'Create',
			value: 'create',
			description: 'Append a new empty database (AttributeView) block to a parent block',
			action: 'Create a database',
		},
		{
			name: 'Get',
			value: 'get',
			description: 'Get the full schema and all rows of a database (pages through every row)',
			action: 'Get a database',
		},
		{
			name: 'Get Schema',
			value: 'getSchema',
			description: 'Get only the column definitions of a database (no rows)',
			action: 'Get database schema',
		},
		{
			name: 'List',
			value: 'list',
			description: 'List all database (AttributeView) blocks in the workspace',
			action: 'List all databases',
		},
		{
			name: 'Remove Column',
			value: 'removeColumn',
			description: 'Remove a column from a database',
			action: 'Remove a column from a database',
		},
		{
			name: 'Remove Row',
			value: 'removeRow',
			description: 'Remove a row from a database by its row ID',
			action: 'Remove a row from a database',
		},
		{
			name: 'Set Cell',
			value: 'setCell',
			description: 'Set the value of a cell in a database row',
			action: 'Set a cell value in a database',
		},
		{
			name: 'Update Row',
			value: 'updateRow',
			description: 'Update multiple cell values in an existing row in one operation',
			action: 'Update a row in a database',
		},
	],
	default: 'list',
};

export const databaseFields: INodeProperties[] = [
	{
		displayName: 'Parent Block ID',
		name: 'parentBlockId',
		type: 'string',
		required: true,
		default: '',
		description: 'The ID of the parent block (typically a document) to append the new database to',
		displayOptions: { show: { resource: ['database'], operation: ['create'] } },
	},
	{
		displayName: 'AV ID',
		name: 'avId',
		type: 'string',
		required: true,
		default: '',
		description:
			'The AttributeView ID (the data-av-ID attribute of the database block — NOT the block ID itself). Use the List operation to discover existing AV IDs.',
		displayOptions: {
			show: {
				resource: ['database'],
				operation: [
					'get',
					'getSchema',
					'addRow',
					'updateRow',
					'removeRow',
					'addColumn',
					'removeColumn',
					'setCell',
				],
			},
		},
	},
	{
		displayName: 'Database Block ID',
		name: 'databaseBlockId',
		type: 'string',
		default: '',
		description:
			'Optional — leave blank to auto-resolve from the AV ID. Set explicitly to skip the lookup (one SQL round-trip) if you already have the hosting block ID.',
		displayOptions: { show: { resource: ['database'], operation: ['addRow'] } },
	},
	{
		displayName: 'Primary Key Content',
		name: 'primaryKeyContent',
		type: 'string',
		default: '',
		description: 'The initial content for the primary key cell of the new row',
		displayOptions: { show: { resource: ['database'], operation: ['addRow'] } },
	},
	{
		displayName: 'Fields Mode',
		name: 'fieldsMode',
		type: 'options',
		default: 'byNameAndValue',
		description: 'How to identify the columns to set. Leave the chosen mode\'s collection empty to create or keep a row without setting any fields.',
		displayOptions: {
			show: { resource: ['database'], operation: ['addRow', 'updateRow'] },
		},
		options: [
			{
				name: 'By Column Name & Value (Collection)',
				value: 'byNameAndValue',
				description:
					'Per-row UI — pick a column name and type the value as a plain string. Recommended for most workflows; avoids JSON quoting concerns when using n8n expressions.',
			},
			{
				name: 'By Column Name (JSON)',
				value: 'byColumnName',
				description:
					'JSON object mapping column display names to values. Useful when computing the payload dynamically (e.g. from a Code node).',
			},
			{
				name: 'By Column (Key) ID',
				value: 'byKeyId',
				description:
					'Repeat field with explicit keyID + value entries — use when you already have the internal column IDs',
			},
		],
	},
	{
		displayName: 'Row ID',
		name: 'rowId',
		type: 'string',
		required: true,
		default: '',
		description: 'The ID of the row to operate on',
		displayOptions: { show: { resource: ['database'], operation: ['removeRow', 'setCell', 'updateRow'] } },
	},
	{
		displayName: 'Fields',
		name: 'fieldsByNameAndValue',
		type: 'fixedCollection',
		typeOptions: { multipleValues: true },
		default: {},
		description:
			'Column-name + value pairs. The value is a plain string; n8n expressions work directly here without needing JSON-style quoting. Booleans/numbers/dates are coerced based on the column type.',
		displayOptions: {
			show: {
				resource: ['database'],
				operation: ['addRow', 'updateRow'],
				fieldsMode: ['byNameAndValue'],
			},
		},
		options: [
			{
				name: 'field',
				displayName: 'Field',
				values: [
					{
						displayName: 'Column Name',
						name: 'columnName',
						type: 'string',
						default: '',
						description: 'The display name of the column to set',
					},
					{
						displayName: 'Value',
						name: 'value',
						type: 'string',
						default: '',
						description:
							'Value for the cell. n8n expressions like {{ $JSON.x }} render here without needing outer quotes.',
					},
				],
			},
		],
	},
	{
		displayName: 'Fields',
		name: 'fieldsByKeyId',
		type: 'fixedCollection',
		typeOptions: { multipleValues: true },
		default: {},
		description: 'Field/value pairs to set on the row, keyed by internal column ID',
		displayOptions: {
			show: {
				resource: ['database'],
				operation: ['addRow', 'updateRow'],
				fieldsMode: ['byKeyId'],
			},
		},
		options: [
			{
				name: 'field',
				displayName: 'Field',
				values: [
					{
						displayName: 'Column (Key) ID',
						name: 'keyId',
						type: 'string',
						default: '',
						description: 'The ID of the column to set',
					},
					{
						displayName: 'Value',
						name: 'value',
						type: 'string',
						default: '',
						description:
							'Value for the cell. Booleans, numbers, and dates are coerced based on the column type.',
					},
				],
			},
		],
	},
	{
		displayName: 'Fields (JSON)',
		name: 'fieldsByColumnName',
		type: 'string',
		typeOptions: { rows: 4 },
		default: '',
		placeholder: '{ "Title": "Hello", "Done": true }',
		description:
			'JSON object mapping column display names to values. Note: n8n expressions still need outer quotes for string columns — switch to "By Column Name & Value (Collection)" to skip that concern.',
		displayOptions: {
			show: {
				resource: ['database'],
				operation: ['addRow', 'updateRow'],
				fieldsMode: ['byColumnName'],
			},
		},
	},
	{
		displayName: 'Output Mode',
		name: 'getOutputMode',
		type: 'options',
		default: 'split',
		description:
			'How to shape the output: split returns one item per row with flat column-name keys; single returns one item per input with the schema, rows and a rowCount. Use single for existence or lookup checks inside a loop — split emits no item when a filter matches no rows, so a non-matching input is silently dropped (this only becomes visible at batch sizes above 1).',
		displayOptions: { show: { resource: ['database'], operation: ['get'] } },
		options: [
			{
				name: 'Split (One Item per Row)',
				value: 'split',
				description:
					'Flat records keyed by column display name, one n8n item per matching row. Emits no item when the filter matches no rows, so do not use it for "does this record exist" checks behind an IF — use Single instead.',
			},
			{
				name: 'Single (Schema + Rows)',
				value: 'single',
				description:
					'One item per input with the schema, an array of flat rows and a rowCount. Best for existence checks — test that rowCount is 0 to branch on "not found".',
			},
		],
	},
	{
		displayName: 'Filter (JSON)',
		name: 'getFilter',
		type: 'string',
		typeOptions: { rows: 4 },
		default: '',
		placeholder: '{ "Status": ["Done", "WIP"] }',
		description:
			'Optional JSON object — applied client-side after fetch. Scalar values match by equality and combine with AND across keys. Array values match any-of (OR) within that column. Examples: {"Status":"Done","Owner":"Mike"} (AND); {"Status":["Done","WIP"]} (OR on one column); {"Status":["Done","WIP"],"Owner":"Mike"} (mixed). For "does this row already exist" checks in a loop, set Output Mode to Single and test that the returned rowCount is 0 — Split mode drops non-matching input items.',
		displayOptions: { show: { resource: ['database'], operation: ['get'] } },
	},
	{
		displayName: 'Column (Key) ID',
		name: 'keyId',
		type: 'string',
		required: true,
		default: '',
		description: 'The ID of the column (key) to operate on',
		displayOptions: {
			show: { resource: ['database'], operation: ['removeColumn', 'setCell'] },
		},
	},
	{
		displayName: 'Column Name',
		name: 'columnName',
		type: 'string',
		required: true,
		default: '',
		description: 'The display name for the new column',
		displayOptions: { show: { resource: ['database'], operation: ['addColumn'] } },
	},
	{
		displayName: 'Column Type',
		name: 'columnType',
		type: 'options',
		required: true,
		default: 'text',
		description: 'The SiYuan column type. Determines how the cell value is stored and rendered.',
		displayOptions: { show: { resource: ['database'], operation: ['addColumn'] } },
		options: [
			{ name: 'Checkbox', value: 'checkbox' },
			{ name: 'Date', value: 'date' },
			{ name: 'Email', value: 'email' },
			{ name: 'Multi-Select', value: 'mSelect' },
			{ name: 'Number', value: 'number' },
			{ name: 'Phone', value: 'phone' },
			{ name: 'Select', value: 'select' },
			{ name: 'Text', value: 'text' },
			{ name: 'URL', value: 'url' },
		],
	},
	{
		displayName: 'Previous Column ID',
		name: 'previousKeyId',
		type: 'string',
		default: '',
		description:
			'Optional. ID of the column the new column should be inserted after. Leave blank to append at the end.',
		displayOptions: { show: { resource: ['database'], operation: ['addColumn'] } },
	},
	{
		displayName: 'Cell Value',
		name: 'cellValue',
		type: 'string',
		default: '',
		description:
			'Value to set. For checkbox use true/false. For multi-select use a comma-separated list. For date use ISO string or epoch ms.',
		displayOptions: { show: { resource: ['database'], operation: ['setCell'] } },
	},
];
