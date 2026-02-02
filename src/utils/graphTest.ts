import { ILogger } from "@microsoft/teams.common";
import { ConsoleLogger } from "@microsoft/teams.common";
import { getGraphClient } from "../services/graphClient";

/**
 * Utility for testing Graph API connectivity and capabilities
 * Use this to verify that your Graph API credentials and permissions are set up correctly
 */
export class GraphTestUtility {
  private logger: ILogger;

  constructor(logger?: ILogger) {
    this.logger = logger || new ConsoleLogger("GraphTest");
  }

  /**
   * Run all Graph API tests
   */
  async runAllTests(): Promise<void> {
    console.log("\n" + "=".repeat(60));
    console.log("🧪 GRAPH API CONNECTIVITY TEST SUITE");
    console.log("=".repeat(60) + "\n");

    const graphClient = getGraphClient(this.logger);

    // Test 1: Connectivity
    console.log("Test 1: Graph API Connectivity");
    console.log("-".repeat(60));
    const connectivityResult = await graphClient.testConnectivity();
    console.log(connectivityResult.message);
    if (!connectivityResult.success) {
      console.log("❌ FAILED: Cannot connect to Graph API");
      console.log("📋 Required environment variables:");
      console.log("   - AAD_APP_CLIENT_ID");
      console.log("   - SECRET_AAD_APP_CLIENT_SECRET");
      console.log("   - AAD_APP_TENANT_ID\n");
      return;
    }
    console.log("✅ PASSED\n");

    // Test 2: User Profile
    console.log("Test 2: Current User Profile");
    console.log("-".repeat(60));
    try {
      const user = await graphClient.getCurrentUser();
      if (user) {
        console.log(`✅ User: ${user.displayName}`);
        console.log(`   Email: ${user.mail}`);
        console.log(`   ID: ${user.id}`);
        console.log("✅ PASSED\n");
      } else {
        console.log("❌ Could not retrieve user profile\n");
      }
    } catch (error) {
      console.log(`❌ Error: ${error instanceof Error ? error.message : "Unknown error"}\n`);
    }

    // Test 3: Email Sending
    if (connectivityResult.userEmail) {
      console.log("Test 3: Email Sending Capability");
      console.log("-".repeat(60));
      const emailResult = await graphClient.sendTestEmail(connectivityResult.userEmail);
      console.log(emailResult.message);
      if (emailResult.success) {
        console.log("✅ PASSED\n");
      } else {
        console.log("❌ FAILED\n");
        console.log("📋 Email Troubleshooting:");
        console.log("   - Check that Mail.Send permission is granted");
        console.log("   - Verify service principal has exchange permissions");
        console.log("   - Ensure mailbox is properly configured\n");
      }
    }

    // Test 4: Planner Access
    console.log("Test 4: Planner Access");
    console.log("-".repeat(60));
    try {
      const plans = await graphClient.getUserPlans(connectivityResult.userEmail || "");
      if (plans && plans.length > 0) {
        console.log(`✅ Found ${plans.length} Planner plan(s)`);
        plans.forEach(plan => {
          console.log(`   - ${plan.title}`);
        });
        console.log("✅ PASSED\n");
      } else {
        console.log("⚠️ No Planner plans found (but permission might be OK)");
        console.log("   This is normal if no plans have been created yet\n");
      }
    } catch (error) {
      console.log(`❌ Planner access failed: ${error instanceof Error ? error.message : "Unknown error"}`);
      console.log("📋 Planner Troubleshooting:");
      console.log("   - Check that Planner.ReadWrite.All permission is granted");
      console.log("   - Verify user has Planner license\n");
    }

    // Summary
    console.log("=".repeat(60));
    console.log("📊 TEST SUMMARY");
    console.log("=".repeat(60));
    console.log("If all tests passed:");
    console.log("✅ Email sending will work");
    console.log("✅ Planner task creation will work");
    console.log("✅ Meeting intelligence features will work");
    console.log("\nIf tests failed:");
    console.log("❌ Check .env configuration");
    console.log("❌ Verify Graph API permissions in Azure Portal");
    console.log("❌ Ensure credentials have not expired");
    console.log("\n" + "=".repeat(60) + "\n");
  }

  /**
   * Test specific capability
   */
  async testCapability(capability: "email" | "planner" | "meetings"): Promise<void> {
    const graphClient = getGraphClient(this.logger);

    console.log(`\n🧪 Testing ${capability} capability...\n`);

    switch (capability) {
      case "email":
        const connectivityResult = await graphClient.testConnectivity();
        if (connectivityResult.userEmail) {
          const result = await graphClient.sendTestEmail(connectivityResult.userEmail);
          console.log(result.message);
        }
        break;

      case "planner":
        try {
          const user = await graphClient.getCurrentUser();
          if (user?.mail) {
            const plans = await graphClient.getUserPlans(user.mail);
            console.log(`Found ${plans.length} plans`);
            plans.forEach(plan => console.log(`  - ${plan.title}`));
          }
        } catch (error) {
          console.log(`Error: ${error}`);
        }
        break;

      case "meetings":
        console.log("Meeting capabilities test - requires active meeting context");
        break;
    }
  }
}

/**
 * Quick function to run tests from command line
 */
export async function runGraphTests(): Promise<void> {
  const tester = new GraphTestUtility();
  await tester.runAllTests();
}
