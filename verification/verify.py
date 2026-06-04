
from playwright.sync_api import sync_playwright

def verify():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            # We can't really login or bypass auth easily in some environments,
            # but we can try to at least see if the page loads or has any immediate JS errors.
            page.goto("http://localhost:5173")
            page.wait_for_timeout(3000)
            page.screenshot(path="verification/landing.png")
            print("Landing page captured.")
        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    verify()
