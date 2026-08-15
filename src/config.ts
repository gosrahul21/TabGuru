export const DODO_IS_TEST_MODE = false;

// Placeholders for TabGuru - update these with real ones
export const DODO_PRODUCT_ID = DODO_IS_TEST_MODE
  ? 'pdt_0NlSgmWBQ2KuoNRnEpfee' // Test product ID (can be updated if you have a separate test ID)
  : 'pdt_0NlSgmWBQ2KuoNRnEpfee';         // Live product ID

export const DODO_CHECKOUT_BASE = DODO_IS_TEST_MODE
  ? 'https://test.checkout.dodopayments.com'
  : 'https://checkout.dodopayments.com';

export const DODO_API_BASE = DODO_IS_TEST_MODE
  ? 'https://test.dodopayments.com'
  : 'https://live.dodopayments.com';

// Replace with a readonly API key valid for TabGuru's Dodo product
export const DODO_READONLY_API_KEY = 'Sk42NEP2PcvIZ4ij.0tdMPJb2Gzy1LsSPZhnWwMwMDydvdCu7rm7LK1NVORps6VRB';

// URLs
export const PAYWALL_URL = chrome.runtime.getURL('src/paywall/index.html');
export const WELCOME_ONBOARDING_URL = chrome.runtime.getURL('src/welcome/index.html');

// Optional Webhook / Form endpoint to automatically collect install survey responses
// Using the same as XSnapper based on user's request
export const WELCOME_FEEDBACK_WEBHOOK = 'https://api.web3forms.com/submit';
export const WEB3FORMS_ACCESS_KEY = 'd93e1cf2-8cb7-4cc1-bb2c-a1cb9f203690';

// Redirect user to this URL when they uninstall the extension
export const UNINSTALL_URL = 'https://tabguru.truemindlabs.com/uninstall';
