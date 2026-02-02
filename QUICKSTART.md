# 🚀 Quick Start - Get Your Bot Working in 5 Minutes

## Step 1: Get Credentials from Azure Portal (2 min)

1. Go to **Azure Portal** → **App registrations**
2. Find your "Collaborator Bot" app (or create new)
3. Copy these values:
   - **Application ID** → `AAD_APP_CLIENT_ID`
   - **Tenant ID** → `AAD_APP_TENANT_ID`

## Step 2: Create Client Secret (1 min)

1. Go to **Certificates & secrets**
2. Click **New client secret**
3. Copy the **Value** → `SECRET_AAD_APP_CLIENT_SECRET`

⚠️ **Note:** Secret shows only once! Copy it now.

## Step 3: Update .env File (1 min)

```env
AAD_APP_CLIENT_ID=your-client-id-here
SECRET_AAD_APP_CLIENT_SECRET=your-secret-here
AAD_APP_TENANT_ID=your-tenant-id-here
```

## Step 4: Grant Permissions (1 min)

1. Go to **API permissions**
2. Click **Add a permission** → **Microsoft Graph** → **Application permissions**
3. Add:
   - ✅ Mail.Send (for emails)
   - ✅ User.Read.All
   - ✅ Planner.ReadWrite.All (for tasks)
4. Click **Grant admin consent** (blue checkmark should appear)

## Step 5: Test (Bonus!)

Send these to the bot:
```
@Collaborator check graph connectivity
@Collaborator test email to yourname@company.com
@Collaborator list planner plans
```

Expected: ✅ All working!

---

## ❌ Not Working?

### Check 1: Variables Set?
```bash
# Should show your values, not empty
echo $AAD_APP_CLIENT_ID
echo $AAD_APP_TENANT_ID
```

### Check 2: Permissions Granted?
Look for blue checkmark ✅ on **Mail.Send** in Azure Portal → **API permissions**

### Check 3: Secret Not Expired?
In Azure Portal → **Certificates & secrets** → check expiry date

### Check 4: Wait for Propagation
Permissions can take 5-10 minutes to take effect

---

## 📚 Need More Help?

- Full setup guide: [GRAPH_API_SETUP.md](./GRAPH_API_SETUP.md)
- Summary of fixes: [FIXES_SUMMARY.md](./FIXES_SUMMARY.md)
- Test utility: [src/utils/graphTest.ts](./src/utils/graphTest.ts)

---

## What's Fixed

✅ **Infinite Loop** - Bot no longer repeats same questions  
✅ **Email Sending** - Now works with test verification  
✅ **Planner Tasks** - Creates tasks in your plans  
✅ **Error Messages** - Clear what's wrong and how to fix it  
✅ **Retry Logic** - Automatic recovery from network issues  

---

## Commands to Try

```
"Send an email to john@company.com with subject 'Hello'"
"Create a task 'Review proposal' in planner for alice@company.com"
"Summarize last week's meetings"
"What's my schedule for next Monday?"
```

---

**All set!** Your bot should now be fully functional. 🎉
