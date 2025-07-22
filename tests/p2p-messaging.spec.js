import { test, expect } from "@playwright/test";

test.describe("P2P Messaging", () => {
  test("should establish P2P connection and exchange messages between two browser instances", async ({
    browser,
  }) => {
    // Create two browser contexts to simulate two different users
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    // Navigate both pages to the app
    await page1.goto("http://localhost:3000");
    await page2.goto("http://localhost:3000");

    // Wait for both pages to load and connect to signaling server
    await expect(page1.locator(".connection-status")).toContainText(
      "Connected",
      { timeout: 10000 }
    );
    await expect(page2.locator(".connection-status")).toContainText(
      "Connected",
      { timeout: 10000 }
    );

    console.log("✅ Both pages connected to signaling server");

    // Join the same room from both pages
    const roomName = "test-room-" + Date.now();

    // Page 1 joins room
    await page1.fill('input[placeholder="Enter room ID"]', roomName);
    await page1.click('button:has-text("Join Room")');

    // Page 2 joins room
    await page2.fill('input[placeholder="Enter room ID"]', roomName);
    await page2.click('button:has-text("Join Room")');

    // Wait for room join confirmation
    await expect(page1.locator("text=Current Room:")).toContainText(roomName, {
      timeout: 5000,
    });
    await expect(page2.locator("text=Current Room:")).toContainText(roomName, {
      timeout: 5000,
    });

    console.log("✅ Both pages joined the same room");

    // Wait for P2P connection to be established
    // Look for "Connected Peers" count to be 1 on both pages
    await expect(page1.locator("text=Connected Peers")).toContainText("1", {
      timeout: 15000,
    });
    await expect(page2.locator("text=Connected Peers")).toContainText("1", {
      timeout: 15000,
    });

    console.log("✅ P2P connection established between peers");

    // Send message from page 1
    const testMessage1 = "Hello from peer 1! " + Date.now();
    await page1.fill('input[placeholder="Type a message..."]', testMessage1);
    await page1.click('button:has-text("Send")');

    // Verify message appears on page 1 (sender)
    await expect(page1.locator(".message-own").first()).toContainText(
      testMessage1,
      { timeout: 5000 }
    );

    // Verify message appears on page 2 (receiver)
    await expect(page2.locator(".message-peer").first()).toContainText(
      testMessage1,
      { timeout: 5000 }
    );

    console.log("✅ Message sent from peer 1 to peer 2");

    // Send message from page 2
    const testMessage2 = "Hello from peer 2! " + Date.now();
    await page2.fill('input[placeholder="Type a message..."]', testMessage2);
    await page2.click('button:has-text("Send")');

    // Verify message appears on page 2 (sender)
    await expect(page2.locator(".message-own").first()).toContainText(
      testMessage2,
      { timeout: 5000 }
    );

    // Verify message appears on page 1 (receiver)
    await expect(page1.locator(".message-peer").first()).toContainText(
      testMessage2,
      { timeout: 5000 }
    );

    console.log("✅ Message sent from peer 2 to peer 1");

    // Verify both messages are visible on both pages
    await expect(page1.locator(".messages")).toContainText(testMessage1);
    await expect(page1.locator(".messages")).toContainText(testMessage2);
    await expect(page2.locator(".messages")).toContainText(testMessage1);
    await expect(page2.locator(".messages")).toContainText(testMessage2);

    console.log(
      "✅ All messages visible on both pages - P2P messaging working!"
    );

    // Clean up
    await context1.close();
    await context2.close();
  });

  test("should handle connection failures gracefully", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Navigate to app
    await page.goto("http://localhost:3000");

    // Wait for connection
    await expect(page.locator(".connection-status")).toContainText(
      "Connected",
      { timeout: 10000 }
    );

    // Try to send message without any peers
    await page.fill('input[placeholder="Type a message..."]', "Test message");

    // Send button should be disabled when no peers are connected
    await expect(page.locator('button:has-text("Send")')).toBeDisabled();

    console.log("✅ Send button properly disabled when no peers connected");

    await context.close();
  });
});
