# ✨ n8n-nodes-siyuan ✨

[![NPM Version](https://img.shields.io/npm/v/n8n-nodes-siyuan.svg?style=flat-square)](https://www.npmjs.com/package/n8n-nodes-siyuan)
[![NPM Downloads](https://img.shields.io/npm/dt/n8n-nodes-siyuan.svg?style=flat-square)](https://www.npmjs.com/package/n8n-nodes-siyuan)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![GitHub issues](https://img.shields.io/github/issues/PsycoStea/SiYuan-n8n-nodes.svg?style=flat-square)](https://github.com/PsycoStea/SiYuan-n8n-nodes/issues)

This is an [n8n](https://n8n.io/) community node package that empowers you to seamlessly integrate with [SiYuan](https://b3log.org/siyuan/), your personal knowledge management powerhouse, directly within your automation workflows. 🧠

SiYuan is a privacy-first, self-hosted personal knowledge base that supports Markdown, block-based editing, and bidirectional linking. This n8n node package provides a comprehensive set of operations to interact with the SiYuan API.

---

**Navigation**
* [💾 Installation](#installation)
* [⚙️ The SiYuan Node](#the-siyuan-node)
* [🔑 Credentials](#credentials)
* [🚀 Usage Examples](#usage-examples)
* [🔗 Compatibility](#compatibility)
* [📚 Resources](#resources)
* [📜 Version History](#version-history)
* [🤝 Contributing](#contributing)

---

## Installation

1.  Go to **Settings > Community Nodes** in your n8n instance.
2.  Select **Install**.
3.  Enter `n8n-nodes-siyuan` in the search box.
4.  Click the **Install** button.

Alternatively, follow the generic [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

## The SiYuan Node

This package provides a single, comprehensive `SiYuan` node. You can select the desired action using the **Operation** dropdown within the node.

![SiYuan Node Example](./siyuan-image.png)

**Supported Operations:**

*   **Notebook Management:**
    *   Create Notebook
    *   Rename Notebook
    *   Remove Notebook
    *   List Notebooks
*   **Document Management:**
    *   Create Document
    *   Rename Document
    *   Remove Document
    *   Move Document
    *   Get Document ID by Path
    *   Get Document Path by ID
    *   List Documents in Notebook (includes titles)
    *   Export Document Markdown
*   **Block Manipulation:**
    *   Append Block
    *   Prepend Block
    *   Insert Block
    *   Update Block
    *   Delete Block
    *   Get Block Kramdown
    *   Get Child Blocks
*   **File System (Workspace):**
    *   List Files in Directory
*   **Attributes:**
    *   Set Block Attributes
    *   Get Block Attributes
*   **Database & Templating:**
    *   Execute SQL Query
    *   Render Sprig Template
*   **Notifications:**
    *   Push Message
    *   Push Error Message
*   **System:**
    *   Get Version

## Credentials

To interact with your SiYuan instance, you'll need to configure the `SiYuan API` credentials in n8n:

1.  **Prerequisites:**
    *   Ensure SiYuan is running and accessible from your n8n instance.
    *   In SiYuan, go to **Settings -> About -> API Token**.
    *   Enable the API and copy your **API Token**.
    *   Note down your SiYuan **API Server address** (e.g., `http://127.0.0.1:6806` for a local instance).
2.  **Setup in n8n:**
    *   Navigate to the **Credentials** section in your n8n instance.
    *   Click **Add credential**.
    *   Search for `SiYuan API` and select it.
    *   Provide a **Credential Name** (e.g., "My Local SiYuan").
    *   Enter your SiYuan **API URL** (e.g., `http://127.0.0.1:6806`).
    *   Paste your SiYuan **API Token**.
    *   Click **Save**.

## Usage Examples

The SiYuan node is designed for direct interaction with the API via clearly defined parameters for each operation. This makes it highly versatile for various automation tasks.

**Using with AI Agents in n8n:**

While this node itself doesn't perform AI functions, it can be a powerful downstream component for AI-driven workflows in n8n:

*   **AI-Generated Content:** Use an LLM node (like OpenAI, Anthropic, or a local model via Ollama) to generate meeting summaries, blog post drafts, or research notes. Then, pass this generated Markdown content to the SiYuan node's "Create Document" or "Append Block" operation to automatically save it into your knowledge base.
*   **AI-Powered Task Management:** An AI agent could parse incoming emails or messages, extract tasks, and then use the SiYuan node to create new task blocks or documents in a specific project notebook.
*   **Dynamic Querying:** Use an AI node to formulate SQL queries based on natural language questions about your notes, then pass the SQL to the SiYuan node's "Execute SQL Query" operation to retrieve information.

The possibilities are broad when combining n8n's AI capabilities with direct SiYuan integration!

## Compatibility

*   **Minimum n8n Version:** Recommended `v1.22.0+` (due to stable Node API v1 usage).
*   **Tested n8n Versions:** Actively tested with n8n `v1.40.0` and newer.
*   **SiYuan API:** Developed against the SiYuan API as documented [here](https://github.com/siyuan-note/siyuan/blob/master/API.md). Compatibility is expected with recent SiYuan versions that support this API.

## Resources

*   [n8n Community Nodes Documentation](https://docs.n8n.io/integrations/community-nodes/)
*   [Official SiYuan API Documentation](https://github.com/siyuan-note/siyuan/blob/master/API.md)
*   [SiYuan User Guide](https://b3log.org/siyuan/en/guide)
*   [Project Repository (Issues, Source Code)](https://github.com/PsycoStea/SiYuan-n8n-nodes)

## Version History

*   **`0.4.0`** (2025-05-11)
    *   Added Notebook Management: Create Notebook, Rename Notebook, Remove Notebook.
    *   Added Get Child Blocks operation.
    *   Added Export Document Markdown operation.
    *   Added List Files in Directory operation.
*   **`0.3.1`** (2025-05-11)
    *   Improved clarity of operation and parameter descriptions in the node UI.
    *   Includes minor lint fixes for descriptions.
*   **`0.3.0`** (2025-05-10)
    *   Added "List Documents in Notebook" operation (fetches document titles).
    *   Added "List Notebooks" operation.
*   **`0.2.0`** (2025-05-10)
    *   Major refactor: Consolidated all functionality into a single `SiYuan` node with an operation selector.
    *   Removed "AI" branding from node name for clarity.
    *   Updated dependencies and resolved various build/lint issues.
    *   This version supersedes any previous individual "Tool" nodes.
*   **`0.1.x`**
    *   Previous experimental versions with individual tool nodes (now deprecated).

## Contributing

Contributions, issues, and feature requests are welcome! Please feel free to check the [issues page](https://github.com/PsycoStea/SiYuan-n8n-nodes/issues).

---

[![Star History Chart](https://api.star-history.com/svg?repos=PsycoStea/SiYuan-n8n-nodes&type=Timeline)](https://www.star-history.com/#PsycoStea/SiYuan-n8n-nodes&Timeline)

<small>This project was vibe coded. This is my first big project ❤️</small>
