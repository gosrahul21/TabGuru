import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import {
  WELCOME_FEEDBACK_WEBHOOK,
  WEB3FORMS_ACCESS_KEY,
  DODO_PRODUCT_ID,
  DODO_CHECKOUT_BASE,
  PAYWALL_URL
} from '../config';
import { setInstallTime, setLicenseKey } from '../storage/storage';
import { useProductPrice } from '../hooks/useProductPrice';

interface OptionItem {
  id: string;
  label: string;
  iconSrc?: string;
  iconSvg?: ReactNode;
}

const DISCOVERY_SOURCES: OptionItem[] = [
  { id: 'twitter', label: 'Twitter / X', iconSrc: '/icons/socials/X_logo_2023.svg' },
  { id: 'instagram', label: 'Instagram', iconSrc: '/icons/socials/instagram-2-1-logo-svgrepo-com.svg' },
  { id: 'youtube', label: 'YouTube', iconSrc: '/icons/socials/youtube-color-svgrepo-com.svg' },
  { id: 'reddit', label: 'Reddit', iconSrc: '/icons/socials/reddit-svgrepo-com.svg' },
  { id: 'chromestore', label: 'Chrome Web Store', iconSrc: '/icons/socials/chrome-color-svgrepo-com.svg' },
  { id: 'linkedin', label: 'LinkedIn', iconSrc: '/icons/socials/linkedin-svgrepo-com.svg' },
  { id: 'whatsapp', label: 'WhatsApp / Friends', iconSrc: '/icons/socials/whatsapp-color-svgrepo-com.svg' },
  {
    id: 'other',
    label: 'Other Source',
    iconSvg: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4M12 8h.01" />
      </svg>
    )
  },
];

export default function Welcome() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [source, setSource] = useState<string>('');
  const [otherSourceText, setOtherSourceText] = useState<string>('');
  const [selectedPlan, setSelectedPlan] = useState<'trial' | 'lifetime'>('lifetime');
  const { productPrice, originalPrice, productCurrency, isLoadingPrice } = useProductPrice();

  const [showModal, setShowModal] = useState(false);
  const [licenseKey, setLicenseKeyInput] = useState('');
  const [isActivating, setIsActivating] = useState(false);
  const [activateStatus, setActivateStatus] = useState<{ msg: string; type: 'success' | 'error' | 'loading' } | null>(null);

  const handleStep1Submit = () => {
    const finalSource = source === 'other' && otherSourceText.trim() ? `other: ${otherSourceText.trim()}` : source;
    const surveyData: Record<string, any> = {
      source: finalSource,
      installedAt: new Date().toISOString(),
      timestamp: Date.now()
    };

    // Save locally
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.set({ onboarding_feedback: surveyData });
    }

    if (WELCOME_FEEDBACK_WEBHOOK) {
      const payload = { ...surveyData };
      if (WEB3FORMS_ACCESS_KEY) {
        payload.access_key = WEB3FORMS_ACCESS_KEY;
        payload.subject = 'New TabGuru Onboarding Survey Submission';
        payload.from_name = 'TabGuru Extension';
      }

      try {
        fetch(WELCOME_FEEDBACK_WEBHOOK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }).catch(() => { });
      } catch (e) { }
    }

    setStep(2);
  };

  const handleStep2Submit = () => {
    if (selectedPlan === 'trial') {
      startTrial();
    } else {
      buyLifetime();
    }
  };

  const startTrial = async () => {
    // Save install time for trial
    await setInstallTime(Date.now());
    setStep(3);
  };

  const buyLifetime = () => {
    const redirectUrl = encodeURIComponent(PAYWALL_URL);
    const checkoutUrl = `${DODO_CHECKOUT_BASE}/buy/${DODO_PRODUCT_ID}?redirect_url=${redirectUrl}`;
    window.open(checkoutUrl, '_blank');
  };

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
          setShowModal(false);
          setStep(3);
        }, 1500);
      } else {
        setActivateStatus({ msg: result?.error || 'Invalid license key. Please check and try again.', type: 'error' });
      }
    });
  };

  return (
    <div className="welcome-container">
      <div className="welcome-header">
        <div className="logo-wrap">
          <img src="/icons/icon128.png" alt="TabGuru Logo" className="logo-img" style={{ borderRadius: '8px' }} />
          <span className="logo-text">Tab<span>Guru</span></span>
        </div>
        <h1 className="welcome-title">Welcome aboard! 🎉</h1>
        <p className="welcome-sub">Browse with intention. Let's get you set up.</p>
      </div>

      <div className="step-bar">
        <div className={`step-dot ${step === 1 ? 'active' : 'completed'}`} />
        <div className={`step-dot ${step === 2 ? 'active' : step === 3 ? 'completed' : ''}`} />
      </div>

      {step === 1 && (
        <div className="step-content">
          <h2 className="question-title">1. How did you discover TabGuru?</h2>
          <div className="options-grid">
            {DISCOVERY_SOURCES.map(opt => (
              <button
                key={opt.id}
                type="button"
                className={`option-btn ${source === opt.id ? 'selected' : ''}`}
                onClick={() => setSource(opt.id)}
              >
                {opt.iconSrc ? (
                  <img src={opt.iconSrc} alt={opt.label} className="option-icon-img" />
                ) : (
                  <span className="option-icon-svg">{opt.iconSvg}</span>
                )}
                <span className="option-label">{opt.label}</span>
                <span className={`option-check ${source === opt.id ? 'visible' : ''}`}>✓</span>
              </button>
            ))}
          </div>

          {source === 'other' && (
            <div className="other-input-wrap">
              <input
                type="text"
                className="other-input"
                placeholder="Where did you hear about us?"
                value={otherSourceText}
                onChange={(e) => setOtherSourceText(e.target.value)}
              />
            </div>
          )}

          <div className="action-row">
            <button
              type="button"
              className="btn-next"
              disabled={!source || (source === 'other' && !otherSourceText.trim())}
              onClick={handleStep1Submit}
            >
              Continue →
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="step-content">
          <h2 className="question-title" style={{ textAlign: 'center' }}>Choose your path</h2>

          <div className="options-grid" style={{ gridTemplateColumns: '1fr', gap: '24px', maxWidth: '400px', margin: '0 auto 24px auto' }}>
            <div 
              className={`plan-btn ${selectedPlan === 'trial' ? 'selected' : ''}`} 
              onClick={() => setSelectedPlan('trial')}
            >
              <div className="plan-badge" style={{ background: 'var(--text-secondary)' }}>Free Trial</div>
              <div className="plan-title">3-Day Free Trial</div>
              <div className="plan-price">Free</div>
              <div className="plan-desc">Experience all premium features of TabGuru for 3 days with no commitment.</div>
            </div>

            <div 
              className={`plan-btn ${selectedPlan === 'lifetime' ? 'selected' : ''}`} 
              onClick={() => setSelectedPlan('lifetime')}
            >
              <div className="plan-badge">Most Popular</div>
              <div className="plan-title">Lifetime Access</div>
              <div className="plan-price">
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
              <div className="plan-desc">Pay once, use forever. Get unrestricted access to all current and future features.</div>
            </div>
          </div>

          <div className="action-row" style={{ justifyContent: 'center', borderTop: 'none', paddingTop: 0 }}>
            <button
              type="button"
              className="btn-next"
              onClick={handleStep2Submit}
              style={{ width: '100%', maxWidth: '400px' }}
            >
              Proceed →
            </button>
          </div>

          <a href="#" className="license-link" onClick={(e) => { e.preventDefault(); setShowModal(true); }}>
            🔑 Already have a license key? Activate here
          </a>

        </div>
      )}

      {step === 3 && (
        <div className="done-card">
          <div className="done-badge">✨</div>
          <h2 className="done-title">You're all set!</h2>
          <p className="done-desc">
            Thank you for installing TabGuru. Open a new tab to start browsing with intention!
          </p>
          <button
            className="btn-start"
            onClick={() => chrome.tabs.create({ url: 'chrome://newtab' })}
          >
            Open New Tab 🚀
          </button>
        </div>
      )}

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
