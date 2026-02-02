@maxLength(20)
@minLength(4)
@description('Used to generate names for all resources in this file')
param resourceBaseName string

param webAppSKU string

@maxLength(42)
param botDisplayName string

param AZURE_OPENAI_ENDPOINT string
param AZURE_OPENAI_KEY string
param AZURE_OPENAI_CHAT_DEPLOYMENT string
param AZURE_OPENAI_EMBEDDING_DEPLOYMENT string
param AZURE_OPENAI_API_VERSION string

// Azure AD App Registration for Microsoft Graph
param AAD_APP_CLIENT_ID string
@secure()
param AAD_APP_CLIENT_SECRET string
param AAD_APP_TENANT_ID string

// Azure AI Search Configuration
param AZURE_SEARCH_ENDPOINT string
@secure()
param AZURE_SEARCH_KEY string
param AZURE_SEARCH_INDEX_NAME string

// Azure Speech Service Configuration
param AZURE_SPEECH_ENDPOINT string
@secure()
param AZURE_SPEECH_KEY string
param AZURE_SPEECH_REGION string

// Application Insights
param APPINSIGHTS_INSTRUMENTATIONKEY string

// Bot Email Configuration (for sending emails via Graph API)
param BOT_EMAIL_ADDRESS string = 'ai.solutions@armely.com'

// Existing SQL Server configuration (for cost savings - reusing existing resources)
param existingSqlServerFqdn string
param existingSqlDatabaseName string
@secure()
param sqlAdminLogin string = 'sqladmin'
@secure()
param sqlAdminPassword string

param serverfarmsName string = resourceBaseName
param webAppName string = resourceBaseName
param identityName string = resourceBaseName
param location string = resourceGroup().location

resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  location: location
  name: identityName
}

// NOTE: SQL Server and Database are NOT provisioned here
// Using existing SQL Server: ${existingSqlServerFqdn}
// Using existing Database: ${existingSqlDatabaseName}

// Compute resources for your Web App
resource serverfarm 'Microsoft.Web/serverfarms@2021-02-01' = {
  kind: 'app'
  location: location
  name: serverfarmsName
  sku: {
    name: webAppSKU
  }
}

// Web App that hosts your agent
resource webApp 'Microsoft.Web/sites@2021-02-01' = {
  kind: 'app'
  location: location
  name: webAppName
  properties: {
    serverFarmId: serverfarm.id
    httpsOnly: true
    siteConfig: {
      alwaysOn: true
      appSettings: [
        {
          name: 'WEBSITE_RUN_FROM_PACKAGE'
          value: '1' // Run Azure App Service from a package file
        }
        {
          name: 'WEBSITE_NODE_DEFAULT_VERSION'
          value: '~20' // Set NodeJS version to 20.x for your site
        }
        {
          name: 'RUNNING_ON_AZURE'
          value: '1'
        }
        {
          name: 'CLIENT_ID'
          value: identity.properties.clientId
        }
        {
          name: 'TENANT_ID'
          value: identity.properties.tenantId
        }
        { 
          name: 'BOT_TYPE' 
          value: 'UserAssignedMsi'
        }
        { 
          name: 'AZURE_OPENAI_ENDPOINT' 
          value: AZURE_OPENAI_ENDPOINT
        }
        { 
          name: 'AZURE_OPENAI_KEY' 
          value: AZURE_OPENAI_KEY
        }
        { 
          name: 'AZURE_OPENAI_CHAT_DEPLOYMENT' 
          value: AZURE_OPENAI_CHAT_DEPLOYMENT
        }
        { 
          name: 'AZURE_OPENAI_EMBEDDING_DEPLOYMENT' 
          value: AZURE_OPENAI_EMBEDDING_DEPLOYMENT
        }
        { 
          name: 'AZURE_OPENAI_API_VERSION' 
          value: AZURE_OPENAI_API_VERSION
        }
        {
          name: 'SQL_CONNECTION_STRING'
          value: 'Server=tcp:${existingSqlServerFqdn},1433;Initial Catalog=${existingSqlDatabaseName};Persist Security Info=False;User ID=${sqlAdminLogin};Password=${sqlAdminPassword};MultipleActiveResultSets=False;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;'
        }
        {
          name: 'SQL_SERVER'
          value: existingSqlServerFqdn
        }
        {
          name: 'SQL_DATABASE'
          value: existingSqlDatabaseName
        }
        {
          name: 'SQL_USERNAME'
          value: sqlAdminLogin
        }
        {
          name: 'SQL_PASSWORD'
          value: sqlAdminPassword
        }
        // Azure AD App Registration for Microsoft Graph
        {
          name: 'AAD_APP_CLIENT_ID'
          value: AAD_APP_CLIENT_ID
        }
        {
          name: 'SECRET_AAD_APP_CLIENT_SECRET'
          value: AAD_APP_CLIENT_SECRET
        }
        {
          name: 'AAD_APP_TENANT_ID'
          value: AAD_APP_TENANT_ID
        }
        // Azure AI Search
        {
          name: 'AZURE_SEARCH_ENDPOINT'
          value: AZURE_SEARCH_ENDPOINT
        }
        {
          name: 'SECRET_AZURE_SEARCH_KEY'
          value: AZURE_SEARCH_KEY
        }
        {
          name: 'AZURE_SEARCH_INDEX_NAME'
          value: AZURE_SEARCH_INDEX_NAME
        }
        // Azure Speech Service
        {
          name: 'AZURE_SPEECH_ENDPOINT'
          value: AZURE_SPEECH_ENDPOINT
        }
        {
          name: 'SECRET_AZURE_SPEECH_KEY'
          value: AZURE_SPEECH_KEY
        }
        {
          name: 'AZURE_SPEECH_REGION'
          value: AZURE_SPEECH_REGION
        }
        // Application Insights
        {
          name: 'APPINSIGHTS_INSTRUMENTATIONKEY'
          value: APPINSIGHTS_INSTRUMENTATIONKEY
        }
        // Bot Email Configuration
        {
          name: 'BOT_EMAIL_ADDRESS'
          value: BOT_EMAIL_ADDRESS
        }
      ]
      ftpsState: 'FtpsOnly'
    }
  }
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${identity.id}': {}
    }
  }
}

// Register your web service as a bot with the Bot Framework
module azureBotRegistration './botRegistration/azurebot.bicep' = {
  name: 'Azure-Bot-registration'
  params: {
    resourceBaseName: resourceBaseName
    identityClientId: identity.properties.clientId
    identityResourceId: identity.id
    identityTenantId: identity.properties.tenantId
    botAppDomain: webApp.properties.defaultHostName
    botDisplayName: botDisplayName
  }
}

// The output will be persisted in .env.{envName}. Visit https://aka.ms/teamsfx-actions/arm-deploy for more details.
output BOT_AZURE_APP_SERVICE_RESOURCE_ID string = webApp.id
output BOT_DOMAIN string = webApp.properties.defaultHostName
output BOT_ID string = identity.properties.clientId
output BOT_TENANT_ID string = identity.properties.tenantId
output SQL_SERVER_FQDN string = existingSqlServerFqdn
output SQL_DATABASE_NAME string = existingSqlDatabaseName
