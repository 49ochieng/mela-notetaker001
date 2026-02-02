# Collaborator Bot - Graph API Setup & Troubleshooting Guide

## Overview

This guide helps you set up and troubleshoot Microsoft Graph API integration for the Collaborator bot. The bot requires Graph API credentials to send emails, manage Planner tasks, and access meeting data.

## Required Environment Variables

To enable all features, add these environment variables to your `.env` file:

```env
# Azure AD / Graph API Credentials
AAD_APP_CLIENT_ID=<your-app-client-id>
SECRET_AAD_APP_CLIENT_SECRET=<your-app-client-secret>
AAD_APP_TENANT_ID=<your-tenant-id>

# Optional: Override default bot email
BOT_EMAIL=bot@yourdomain.onmicrosoft.com
```

## Step 1: Get Your Azure Credentials

### Option A: Using Azure CLI (Recommended)

```bash
# Login to Azure
az login

# Create an app registration
az ad app create --display-name "Collaborator Bot" --sign-in-audience AzureADMyOrg

# Note the appId (this is CLIENT_ID)
```

### Option B: Using Azure Portal

1. Go to **Azure Portal** → **App registrations**
2. Click **New registration**
3. Name: "Collaborator Bot"
4. Supported account types: "Accounts in this organizational directory only"
5. Click **Register**
6. Copy **Application (client) ID** → This is your `AAD_APP_CLIENT_ID`

## Step 2: Create Client Secret

### Azure CLI

```bash
az ad app credential create --id <APP_ID> --display-name "Collaborator Secret"
# Copy the 'password' value → This is your SECRET_AAD_APP_CLIENT_SECRET
```

### Azure Portal

1. Go to **App registrations** → your app → **Certificates & secrets**
2. Click **New client secret**
3. Description: "Collaborator Bot Secret"
4. Expires: 24 months
5. Click **Add**
6. Copy the **Value** → This is your `SECRET_AAD_APP_CLIENT_SECRET`

## Step 3: Grant API Permissions

### For Email Sending (Required)

1. Go to **App registrations** → your app → **API permissions**
2. Click **Add a permission**
3. Search for and select **Microsoft Graph**
4. Select **Application permissions**
5. Search and add these permissions:
   - **Mail.Send** (for sending emails)
   - **User.Read.All** (for user lookups)
6. Click **Grant admin consent**

### For Planner Integration (Optional)

Add these permissions:
- **Planner.ReadWrite.All** (for task management)
- **Group.Read.All** (for group access)

### For Meeting Intelligence (Optional)

Add these permissions:
- **OnlineMeetings.Read.All** (for meeting details)
- **Calendars.Read** (for calendar access)

## Step 4: Get Your Tenant ID

### Azure CLI

```bash
az account show --query tenantId -o tsv
# This is your AAD_APP_TENANT_ID
```

### Azure Portal

1. Go to **Azure Active Directory** → **Overview**
2. Copy **Tenant ID** → This is your `AAD_APP_TENANT_ID`

## Step 5: Update .env File

```env
AAD_APP_CLIENT_ID=12345678-1234-1234-1234-123456789012
SECRET_AAD_APP_CLIENT_SECRET=abc123XYZ~_-ABC123def456GHI789JKL~
AAD_APP_TENANT_ID=abcdef01-2345-6789-abcd-ef0123456789
```

## Step 6: Test the Connection

### Option A: Using the Test Utility

```bash
# In your bot code, use the GraphTestUtility
node -e "
const { GraphTestUtility } = require('./src/utils/graphTest.js');
const tester = new GraphTestUtility();
tester.runAllTests();
"
```

### Option B: Manual Testing in Teams

Send these messages to the bot:

```
@Collaborator check graph connectivity
@Collaborator test email to yourname@company.com
@Collaborator list my planner plans
```

## Troubleshooting

### ❌ "Graph API configuration incomplete"

**Problem:** Environment variables not set
**Solution:**
1. Verify `.env` file has all three variables
2. Restart the bot application
3. Check that variable names are spelled correctly (case-sensitive)

### ❌ "Failed to acquire access token"

**Problem:** Invalid credentials
**Solution:**
1. Verify `AAD_APP_CLIENT_ID` is correct (not the tenant ID)
2. Verify `SECRET_AAD_APP_CLIENT_SECRET` hasn't expired
3. Check that `AAD_APP_TENANT_ID` is the correct tenant
4. Verify app registration exists in your Azure tenant

### ❌ "Unauthorized" when sending emails

**Problem:** Missing Mail.Send permission
**Solution:**
1. Go to **App registrations** → your app → **API permissions**
2. Verify **Mail.Send** is listed
3. Verify **Grant admin consent** was clicked (shows blue checkmark)
4. Wait 5-10 minutes for permissions to propagate

### ❌ "Planner operations failing"

**Problem:** Missing Planner permissions
**Solution:**
1. Add **Planner.ReadWrite.All** permission (see Step 3)
2. Add **Group.Read.All** permission
3. Grant admin consent
4. Wait for permission propagation (5-10 minutes)

### ❌ "User not found" when creating tasks

**Problem:** User email incorrect or not in organization
**Solution:**
1. Use full UPN format: `username@company.com`
2. Verify user exists in your Azure AD
3. Check user has Planner license

### ⚠️ "Permission denied" with rate limiting

**Problem:** Too many API calls
**Solution:**
1. The bot includes automatic retry logic with exponential backoff
2. If still occurring, reduce concurrent operations
3. Check application logs for specific API limits

## Feature Status

Use these commands to check what's working:

```
@Collaborator check graph connectivity  - Tests basic connection
@Collaborator test email to user@company.com - Tests email sending
@Collaborator list planner plans - Tests Planner access
```

## Advanced: Manual Permission Grant

If admin consent isn't available:

```bash
# Azure CLI - Grant permissions manually
az ad app permission admin-consent --id <APP_ID>
```

## Security Best Practices

⚠️ **IMPORTANT:**
- Never commit `.env` file to GitHub (it's in `.gitignore`)
- Rotate client secrets every 6 months
- Use separate app registrations for dev/staging/production
- Grant minimal required permissions
- Monitor auth failures in Azure logs

## Debug Logging

To enable detailed Graph API logging:

```typescript
// In your code
const logger = new ConsoleLogger("GraphAPI", { level: "debug" });
const graphClient = getGraphClient(logger);

// Look for these in logs:
// ✅ Successfully acquired Graph API access token
// 📋 Getting available Planner plans
// 📧 Sending email to...
// ❌ Graph API error messages
```

## Contact & Support

If you encounter persistent issues:
1. Check the logs for specific error messages
2. Verify all environment variables are set
3. Confirm permissions are granted and propagated
4. Test with Azure CLI to isolate the issue:

```bash
# Test with Azure CLI
az account show
az ad user show --id yourname@company.com
```

## Related Documentation

- [Microsoft Graph API Docs](https://docs.microsoft.com/graph)
- [Azure App Registration Guide](https://docs.microsoft.com/azure/active-directory/develop/quickstart-register-app)
- [Graph API Permission Reference](https://docs.microsoft.com/graph/permissions-reference)
