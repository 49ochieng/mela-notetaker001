# Mela Notetaker001

An AI-powered **note-taking assistant** designed to integrate with SQL Server and SQL Database for efficient data management and storage. This assistant is tailored for creating, managing, and storing notes effectively.

## 🚀 Key Capabilities

### 📋 Intelligent Note Management
- Create, edit, and organize notes efficiently.
- Store notes securely in SQL Server and SQL Database.
- Retrieve notes using advanced search capabilities.

### 🔍 Search and Retrieve
- Perform semantic search across stored notes.
- Use natural language queries to find specific notes.

## 📦 Supported Contexts

The Mela Notetaker001 is designed to work in various environments and can be extended to integrate with other systems as needed.

## 🏗️ Architecture

The application is built with a focus on SQL Server and SQL Database for backend storage, ensuring robust and scalable data management.

## 🛠️ Prerequisites

### Required Tools
- [Node.js](https://nodejs.org/) version 20 or 22
- [npm](https://www.npmjs.com/) (comes with Node.js)
- [Visual Studio Code](https://code.visualstudio.com/)
- [Microsoft 365 Agents Toolkit](https://marketplace.visualstudio.com/items?itemName=TeamsDevApp.ms-teams-vscode-extension)

### Required Azure Resources
- **Azure OpenAI** - GPT-4.1 deployment
- **Azure SQL Database** - For conversation and meeting storage
- **Azure AD App Registration** - For Microsoft Graph API access

### Optional Azure Resources (for advanced features)
- **Azure AI Search** - For semantic document search
- **Azure Speech Service** - For audio processing
- **Application Insights** - For monitoring and telemetry

## ⚙️ Configuration

### 1. Azure AD App Registration

Create an Azure AD App Registration with the following **API Permissions**:

| Permission | Type | Description |
|------------|------|-------------|
| `OnlineMeetings.Read.All` | Application | Read meeting details |
| `OnlineMeetingTranscript.Read.All` | Application | Read meeting transcripts |
| `Mail.Send` | Application | Send emails |
| `Tasks.ReadWrite` | Application | Manage Planner tasks |
| `User.Read.All` | Application | Read user profiles |
| `Chat.Read.All` | Application | Read chat messages |
| `Group.Read.All` | Application | Read group information |

> **Important**: Grant admin consent for these permissions in the Azure Portal.

### 2. Environment Variables

#### `.env.dev` - Public configuration
```env
# Azure AD App Registration for Microsoft Graph
AAD_APP_CLIENT_ID=<your-app-client-id>
AAD_APP_TENANT_ID=<your-tenant-id>
AAD_APP_OBJECT_ID=<your-app-object-id>

# Azure OpenAI Configuration
AZURE_OPENAI_ENDPOINT=https://<your-resource>.cognitiveservices.azure.com
AZURE_OPENAI_CHAT_DEPLOYMENT=gpt-4.1
AZURE_OPENAI_EMBEDDING_DEPLOYMENT=text-embedding-3-large
AZURE_OPENAI_API_VERSION=2024-05-01-preview

# SQL Database Configuration
EXISTING_SQL_SERVER_FQDN=<your-server>.database.windows.net
EXISTING_SQL_DATABASE_NAME=<your-database>
SQL_ADMIN_LOGIN=<your-username>

# Azure AI Search (optional)
AZURE_SEARCH_ENDPOINT=https://<your-search>.search.windows.net
AZURE_SEARCH_INDEX_NAME=<your-index>

# Azure Speech Service (optional)
AZURE_SPEECH_ENDPOINT=https://<region>.api.cognitive.microsoft.com/
AZURE_SPEECH_REGION=<your-region>

# Application Insights (optional)
APPINSIGHTS_INSTRUMENTATIONKEY=<your-key>
```

#### `.env.dev.user` - Secrets (not committed to git)
```env
# SQL Password
SQL_ADMIN_PASSWORD=<your-password>

# Azure OpenAI
SECRET_AZURE_OPENAI_API_KEY=<your-api-key>

# Azure AD App Secret
SECRET_AAD_APP_CLIENT_SECRET=<your-client-secret>

# Azure AI Search (optional)
SECRET_AZURE_SEARCH_KEY=<your-search-key>

# Azure Speech (optional)
SECRET_AZURE_SPEECH_KEY=<your-speech-key>
```

## 🚀 Running the Agent

### Local Development

1. **Open in VS Code** with Microsoft 365 Agents Toolkit installed

2. **Configure environment variables** in `env/.env.dev` and `env/.env.dev.user`

3. **Start the agent** using one of these methods:

   **Option A: Microsoft 365 Agents Playground (Recommended for testing)**
   - Press `F5` and select "Debug in Microsoft 365 Agents Playground"
   - A browser opens with the test environment
   - No Microsoft 365 account required

   **Option B: Teams Desktop/Web**
   - Press `F5` and select "Debug in Teams (Edge)" or "Debug in Teams (Chrome)"
   - Signs in and sideloads the app automatically
   - Requires Microsoft 365 developer account

### Running Tasks Manually

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run in development mode
npm run dev
```

## 💬 Sample Commands

### Meeting Intelligence
```
@Collaborator get the transcript from this meeting
@Collaborator who were the main speakers?
@Collaborator summarize what John said in the meeting
@Collaborator what were the key decisions made?
```

### Action Items & Planner
```
@Collaborator find action items from yesterday's discussion
@Collaborator create a task "Review proposal" and assign to alice@company.com
@Collaborator list my current tasks
@Collaborator create Planner tasks for all action items
@Collaborator mark task as complete
```

### Email
```
@Collaborator send a meeting summary to the team
@Collaborator compose an email about the project status
@Collaborator email the action items to the assignees
```

### Summarization
```
@Collaborator summarize yesterday's discussion
@Collaborator what were the main topics from last week?
@Collaborator give me an overview of the past 3 days
```

### Search
```
@Collaborator find messages about the budget
@Collaborator search for discussions from Monday about the deadline
@Collaborator locate conversations between Alice and Bob
```

## 📁 Project Structure

```
MelaNotetaker001/
├── appPackage/              # Teams app manifest and icons
│   └── manifest.json        # App permissions and configuration
├── env/                     # Environment configuration
│   ├── .env.dev            # Development settings
│   └── .env.dev.user       # Secrets (git-ignored)
├── infra/                   # Azure infrastructure (Bicep)
│   ├── azure.bicep         # Main infrastructure
│   └── botRegistration/    # Bot Framework registration
├── src/
│   ├── index.ts            # Application entry point
│   ├── agent/
│   │   ├── manager.ts      # Request routing manager
│   │   └── prompt.ts       # Manager prompt generation
│   ├── capabilities/
│   │   ├── registry.ts     # Capability registration
│   │   ├── capability.ts   # Base capability interface
│   │   ├── summarizer/     # Conversation summarization
│   │   ├── actionItems/    # Action item management
│   │   ├── search/         # Semantic search
│   │   ├── meetings/       # Meeting transcript analysis
│   │   ├── email/          # Email composition & sending
│   │   └── planner/        # Microsoft Planner integration
│   ├── services/
│   │   └── graphClient.ts  # Microsoft Graph API client
│   ├── storage/            # Database layer (SQL/SQLite)
│   └── utils/              # Utilities and configuration
└── package.json
```

## 🔒 Security & Permissions

### RSC (Resource-Specific Consent) Permissions

The app uses RSC permissions defined in `manifest.json` to access resources:

**Chat Permissions:**
- `ChatMessage.Read.Chat` - Read chat messages
- `ChatMember.Read.Chat` - Read chat members
- `TeamsActivity.Send.Chat` - Send activity notifications

**Meeting Permissions:**
- `OnlineMeeting.ReadBasic.Chat` - Read meeting info
- `OnlineMeetingTranscript.Read.Chat` - Read transcripts
- `OnlineMeetingRecording.Read.Chat` - Read recordings
- `Calls.AccessMedia.Chat` - Access call media
- `Calls.JoinGroupCalls.Chat` - Join group calls

**Team Permissions:**
- `ChannelMessage.Read.Group` - Read channel messages
- `ChannelMeeting.ReadBasic.Group` - Read channel meetings
- `TeamMember.Read.Group` - Read team members
- `TeamsActivity.Send.Group` - Send team notifications

### Graph API Permissions

Configure these in your Azure AD App Registration:
- `OnlineMeetings.Read.All`
- `OnlineMeetingTranscript.Read.All`
- `Mail.Send`
- `Tasks.ReadWrite`
- `User.Read.All`
- `Chat.Read.All`
- `Group.Read.All`

## ☁️ Deployment to Azure

### Using Microsoft 365 Agents Toolkit

1. **Provision cloud resources:**
   - Open the Agents Toolkit sidebar
   - Click "Provision" to create Azure resources

2. **Deploy the code:**
   - Click "Deploy" to publish to Azure App Service

3. **Publish to Teams:**
   - Click "Publish" to submit to your organization's app catalog

### Manual Deployment

```bash
# Build for production
npm run build

# Azure CLI deployment
az webapp deployment source config-zip \
  --resource-group <your-rg> \
  --name <your-app-name> \
  --src dist.zip
```

## 🧩 Adding Custom Capabilities

1. **Copy the template:**
   ```bash
   cp -r src/capabilities/template src/capabilities/myCapability
   ```

2. **Customize your capability:**
   - Edit the prompt in `prompt.ts`
   - Define function schemas in `schema.ts`
   - Implement handlers in `myCapability.ts`
   - Export a `CapabilityDefinition`

3. **Register your capability:**
   ```typescript
   // In src/capabilities/registry.ts
   import { MY_CAPABILITY_DEFINITION } from "./myCapability/myCapability";
   
   export const CAPABILITY_DEFINITIONS = [
     // ... existing capabilities
     MY_CAPABILITY_DEFINITION,
   ];
   ```

4. **Build and test:**
   ```bash
   npm run build
   npm run dev
   ```

## 🐛 Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| Bot not responding | Check Azure OpenAI API key and endpoint |
| Graph API 401 errors | Verify Azure AD app secret hasn't expired |
| No transcripts found | Ensure meeting has ended and transcript is generated |
| Planner tasks not created | Check Tasks.ReadWrite permission is granted |
| Email not sent | Verify Mail.Send permission and admin consent |

### Debug Logging

The app uses `ConsoleLogger` with debug level. Check the terminal output for detailed logs:
- `✅` - Successful operations
- `⚠️` - Warnings
- `❌` - Errors

## 📄 License

Copyright © 2026 Armely. All rights reserved.

## 🤝 Support

For support, please contact [support@armely.com](mailto:support@armely.com) or visit [www.armely.com](https://www.armely.com).
