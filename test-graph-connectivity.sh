#!/bin/bash
# Quick diagnostic script for Graph API connectivity
# Run this to quickly test if your Graph API setup is working

echo "🧪 Graph API Connectivity Diagnostic"
echo "===================================="
echo ""

# Check environment variables
echo "1️⃣  Checking environment variables..."
if [ -z "$AAD_APP_CLIENT_ID" ]; then
  echo "   ❌ AAD_APP_CLIENT_ID not set"
else
  echo "   ✅ AAD_APP_CLIENT_ID: ${AAD_APP_CLIENT_ID:0:20}..."
fi

if [ -z "$SECRET_AAD_APP_CLIENT_SECRET" ]; then
  echo "   ❌ SECRET_AAD_APP_CLIENT_SECRET not set"
else
  echo "   ✅ SECRET_AAD_APP_CLIENT_SECRET: (hidden)"
fi

if [ -z "$AAD_APP_TENANT_ID" ]; then
  echo "   ❌ AAD_APP_TENANT_ID not set"
else
  echo "   ✅ AAD_APP_TENANT_ID: $AAD_APP_TENANT_ID"
fi

echo ""
echo "2️⃣  Quick verification checklist:"
echo "   - All three variables set? Check above ✓"
echo "   - Values without quotes or extra spaces? ✓"
echo "   - CLIENT_ID is not TENANT_ID? ✓"
echo "   - SECRET not expired? Check Azure Portal"
echo "   - Permissions granted with admin consent? Check Azure Portal"

echo ""
echo "3️⃣  Test with bot:"
echo "   - Send: @Collaborator check graph connectivity"
echo "   - Send: @Collaborator test email to yourname@company.com"
echo "   - Send: @Collaborator list planner plans"

echo ""
echo "4️⃣  View detailed logs:"
echo "   - Look for: '✅ Successfully acquired Graph API access token'"
echo "   - Look for: '📧 Sending email to...'"
echo "   - Look for: Error details if something fails"

echo ""
echo "📖 For more help, see: GRAPH_API_SETUP.md"
