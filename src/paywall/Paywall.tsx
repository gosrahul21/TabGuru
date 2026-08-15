import { useState, useEffect } from 'react';
import {
  DODO_PRODUCT_ID,
  DODO_CHECKOUT_BASE,
  PAYWALL_URL
} from '../config';
import { setLicenseKey } from '../storage/storage';
import { useProductPrice } from '../hooks/useProductPrice';

export default function Paywall() {
  const { productPrice, originalPrice, productCurrency, isLoadingPrice } = useProductPrice();

  const [showModal, setShowModal] = useState(false);
  const [licenseKey, setLicenseKeyInput] = useState('');
  const [isActivating, setIsActivating] = useState(false);
  const [activateStatus, setActivateStatus] = useState<{ msg: string; type: 'success' | 'error' | 'loading' } | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState('');

  useEffect(() => {
    // Generate checkout URL
    const redirect = encodeURIComponent(PAYWALL_URL + '?activate=1');
    setCheckoutUrl(`${DODO_CHECKOUT_BASE}/buy/${DODO_PRODUCT_ID}?redirect_url=${redirect}`);

    // Check if redirect from checkout
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('activate') === '1') {
      setShowModal(true);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const activateLicense = () => {
    if (!licenseKey || licenseKey.length < 4) {
      setActivateStatus({ msg: 'Please enter a valid license key.', type: 'error' });
      return;
    }

    setIsActivating(true);
    setActivateStatus({ msg: 'Verifying license key with Dodo Payments…', type: 'loading' });

    chrome.runtime.sendMessage({ type: 'ACTIVATE_LICENSE', licenseKey }, async (result) => {
      setIsActivating(false);
      if (result && result.success) {
        setActivateStatus({ msg: '✓ License activated! TabGuru Pro is unlocked.', type: 'success' });
        await setLicenseKey(licenseKey);
        setTimeout(() => {
          // Send message to refresh state in all tabs
          chrome.runtime.sendMessage({ type: 'BROADCAST_REFRESH' });
          window.close();
        }, 1500);
      } else {
        setActivateStatus({ msg: result?.error || 'Invalid license key. Please check and try again.', type: 'error' });
      }
    });
  };

  return (
    <div className="paywall-container">
      <div className="paywall-header">
        <img src="/icons/icon128.png" alt="TabGuru Logo" className="logo" />
        <h1 className="title">Your 3-Day Free Trial Has Ended</h1>
        <p className="subtitle">
          We hope you enjoyed browsing with intention. To continue using TabGuru, please purchase a lifetime license.
        </p>
      </div>

      <div className="card">
        <div className="price-block">
          <div className="price">
            {isLoadingPrice ? (
              <span style={{ opacity: 0.5 }}>...</span>
            ) : (
              <>
                {originalPrice && productPrice && originalPrice > productPrice && (
                  <span style={{ textDecoration: 'line-through', opacity: 0.5, fontSize: '0.7em', marginRight: '8px' }}>
                    {productCurrency === 'USD' ? '$' : `${productCurrency} `}{originalPrice.toFixed(2)}
                  </span>
                )}
                {productCurrency === 'USD' ? '$' : `${productCurrency} `}{(productPrice ?? 29).toFixed(2)}
              </>
            )}
            <span> / forever</span>
          </div>
        </div>

        <ul className="features">
          <li><span className="check">✓</span> <span>Unlimited Intentional Tabs</span></li>
          <li><span className="check">✓</span> <span>Advanced Time Tracking & Analytics</span></li>
          <li><span className="check">✓</span> <span>Deep Work Shortcuts</span></li>
          <li><span className="check">✓</span> <span>All Future Updates</span></li>
          <li><span className="check">✓</span> <span>One-time payment, no subscriptions</span></li>
        </ul>

        <a href={checkoutUrl} className="pay-btn" target="_blank" rel="noopener noreferrer">
          Get Lifetime Access
        </a>

        <div className="activate-section">
          <a href="#" className="activate-link" onClick={(e) => { e.preventDefault(); setShowModal(true); }}>
            Already paid? Enter your license key
          </a>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="activate-header">
              <div className="activate-icon">🔑</div>
              <div className="activate-title">Activate TabGuru Pro</div>
              <div className="activate-sub">Enter your license key from the email Dodo sent you</div>
            </div>
            <input
              type="text"
              className="activate-input"
              value={licenseKey}
              onChange={e => setLicenseKeyInput(e.target.value.trim())}
              onKeyDown={e => e.key === 'Enter' && activateLicense()}
              placeholder="Paste your license key here..."
              spellCheck="false"
            />
            <button onClick={activateLicense} disabled={isActivating} className="activate-btn">
              {isActivating ? 'Activating…' : 'Activate License'}
            </button>
            {activateStatus && (
              <div className={`key-status ${activateStatus.type}`}>
                {activateStatus.msg}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
