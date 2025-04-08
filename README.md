# n8n-nodes-siyuan

This is an n8n community node package. It lets you interact with the [SiYuan](https://b3log.org/siyuan/) personal knowledge management system API within your n8n workflows.

SiYuan is a privacy-first, self-hosted personal knowledge management system with a block-based editor and bidirectional linking capabilities.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

[Installation](#installation)  
[Operations](#operations)  
[Credentials](#credentials)  
[Compatibility](#compatibility)  
[Resources](#resources)  

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

Search for `n8n-nodes-siyuan` (Note: This is the assumed package name based on `package.json`, adjust if different upon publishing).

## Operations

The `SiYuan AI` node provides the following operations:

*   **Document Operations:**
    *   Create Document
    *   Rename Document
    *   Remove Document
    *   Move Document
    *   Get Document ID by Path
    *   Get Document Path by ID
*   **Block Operations:**
    *   Append Block
    *   Prepend Block
    *   Insert Block
    *   Update Block
    *   Delete Block
    *   Get Block Kramdown
*   **Attribute Operations:**
    *   Set Block Attributes
    *   Get Block Attributes
*   **SQL Operations:**
    *   Execute SQL Query
*   **Template Operations:**
    *   Render Sprig Template
*   **Notification Operations:**
    *   Push Message
    *   Push Error Message
*   **System Operations:**
    *   Get Version

## Credentials

To use this node, you need to configure the `SiYuan API` credentials:

1.  **Prerequisites:**
    *   Have SiYuan running and accessible from your n8n instance.
    *   Enable the API in SiYuan (Settings -> About -> API Token). Note down the API Token and the API Server address (usually `http://127.0.0.1:6806` if running locally).
2.  **Setup in n8n:**
    *   Go to the 'Credentials' section in your n8n instance.
    *   Click 'Add credential'.
    *   Search for 'SiYuan API' and select it.
    *   Enter a name for your credential (e.g., "My Local SiYuan").
    *   Fill in the `SiYuan API URL` (e.g., `http://127.0.0.1:6806`).
    *   Paste your SiYuan `API Token` into the corresponding field.
    *   Save the credential.

## Compatibility

*   Minimum n8n version: (Specify based on testing, likely >= 1.0)
*   Tested n8n versions: (Specify versions tested during development)
*   SiYuan API: Tested against SiYuan version (Specify SiYuan version if known, based on API docs used)

## Resources

*   [n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/)
*   [SiYuan User Guide](https://b3log.org/siyuan/en/guide) (Includes API information)
*   [SiYuan API Documentation Files](./SiYuan-API-Doc-part1.txt), [Part 2](./SiYuan-API-Doc-part2.txt), [Part 3](./SiYuan-API-Doc-part3.txt) (Included in this repository)
