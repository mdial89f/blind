import { test, expect } from "@playwright/test";
import { testUsers } from "e2e/utils/users";
import dotenv from "dotenv";

const test = dotenv.config();
console.log(test);
const password = import.meta.env.VITE_BOOTSTRAP_USERS_PW as string;

test("has title", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/CMS MAKO/);
});

test("see frequesntly asked questions header when in faq page", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "FAQ" }).click();

  const foundFaqHeading = await page
    .getByRole("heading", { name: "Frequently Asked Questions" })
    .isVisible();
  expect(foundFaqHeading).toBeTruthy();
});

test("see dahsboard link when log in", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Sign In" }).click();
  await page
    .getByRole("textbox", { name: "name@host.com" })
    .type(testUsers.state);
  await page.getByRole("textbox", { name: "Password" }).type(password);
  await page.getByRole("button", { name: "submit" }).click();
  await page.getByRole("link", { name: "Dashboard" }).click();

  const dashboardLinkVisible = await page
    .getByRole("link", { name: "Dashboard" })
    .isVisible();
  expect(dashboardLinkVisible).toBeTruthy();
});

test("failed incorrect login username", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.getByRole("textbox", { name: "name@host.com" }).type(".");
  await page.getByRole("textbox", { name: "Password" }).type(password);
  await page.getByRole("button", { name: "submit" }).click();
  await page.getByRole("paragraph").isVisible();
  const invalidInputTest = await page.$(
    'p:has-text("The username or password you entered is invalid")'
  );
  expect(invalidInputTest).toBeTruthy();
});
