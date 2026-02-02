import { useState, useEffect, useRef, useCallback, type FormEvent, type ChangeEvent } from 'react';
import { toast } from 'sonner';
import { Link } from 'wouter';

const API_URL = import.meta.env.VITE_API_URL || 'https://tradux-api.onrender.com/api';

export default function Home() {
  const [headerScrolled, setHeaderScrolled] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const formSuccess = false; // Redirects to Stripe, success shown on /success page
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadedDocs, setUploadedDocs] = useState<{id: string; filename: string; page_count: number}[]>([]);
  const [uploading, setUploading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Order form state
  const [serviceTier, setServiceTier] = useState('standard');
  const [certType, setCertType] = useState('certified');

  const fadeRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const handleScroll = () => setHeaderScrolled(window.scrollY > 80);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => { entries.forEach((entry) => { if (entry.isIntersecting) entry.target.classList.add('animated'); }); },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );
    fadeRefs.current.forEach((el) => { if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, []);

  const addFadeRef = (el: HTMLDivElement | null) => {
    if (el && !fadeRefs.current.includes(el)) fadeRefs.current.push(el);
  };

  const scrollTo = useCallback((e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>, id: string) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files);
    setSelectedFiles(files);
    setUploading(true);

    const uploaded: typeof uploadedDocs = [];
    for (const file of files) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        const resp = await fetch(`${API_URL}/upload-document`, { method: 'POST', body: formData });
        if (resp.ok) {
          const data = await resp.json();
          uploaded.push({ id: data.document_id, filename: data.filename, page_count: data.page_count });
        } else {
          toast.error(`Failed to upload ${file.name}`);
        }
      } catch {
        toast.error(`Upload error for ${file.name}`);
      }
    }
    setUploadedDocs(uploaded);
    setUploading(false);
    if (uploaded.length > 0) {
      toast.success(`${uploaded.length} document(s) uploaded successfully`);
    }
  };

  const handleOrderSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (selectedFiles.length === 0) {
      toast.error('Please upload at least one document.');
      return;
    }
    setFormLoading(true);

    try {
      const form = e.target as HTMLFormElement;
      const totalPages = uploadedDocs.reduce((sum, d) => sum + d.page_count, 0) || 1;

      // Step 1: Create quote
      const quoteResp = await fetch(`${API_URL}/calculate-quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_tier: serviceTier,
          cert_type: certType,
          delivery_speed: (form.querySelector('#order-delivery') as HTMLSelectElement)?.value || 'standard',
          delivery_method: (form.querySelector('#order-delivery-method') as HTMLSelectElement)?.value || 'email',
          source_language: (form.querySelector('#order-source') as HTMLSelectElement)?.value || 'portuguese',
          target_language: (form.querySelector('#order-target') as HTMLSelectElement)?.value || 'english',
          document_type: (form.querySelector('#order-doc-type') as HTMLSelectElement)?.value || '',
          purpose: (form.querySelector('#order-purpose') as HTMLSelectElement)?.value || '',
          full_name: (form.querySelector('#full-name') as HTMLInputElement)?.value || '',
          email: (form.querySelector('#email') as HTMLInputElement)?.value || '',
          phone: (form.querySelector('#phone') as HTMLInputElement)?.value || '',
          notes: (form.querySelector('#order-notes') as HTMLTextAreaElement)?.value || '',
          page_count: totalPages,
          document_ids: uploadedDocs.map(d => d.id),
        }),
      });

      if (!quoteResp.ok) throw new Error('Failed to calculate quote');
      const quote = await quoteResp.json();

      // Step 2: Create Stripe checkout session
      const checkoutResp = await fetch(`${API_URL}/create-payment-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quote_id: quote.id,
          origin_url: window.location.origin,
          customer_email: (form.querySelector('#email') as HTMLInputElement)?.value || '',
          customer_name: (form.querySelector('#full-name') as HTMLInputElement)?.value || '',
        }),
      });

      if (!checkoutResp.ok) throw new Error('Failed to create payment session');
      const checkout = await checkoutResp.json();

      // Step 3: Redirect to Stripe
      if (checkout.checkout_url) {
        window.location.href = checkout.checkout_url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      toast.error(message);
      setFormLoading(false);
    }
  };

  const tierPrices: Record<string, number> = { standard: 19.00, professional: 29.00, specialist: 39.00 };
  const currentYear = new Date().getFullYear();

  return (
    <>
      {/* Header */}
      <header id="header" className={`cert-header ${headerScrolled ? 'scrolled' : ''}`}>
        <nav className="container">
          <div className="logo">
            <a href="#hero" onClick={(e) => scrollTo(e, 'hero')}>
              <span className="logo-text">TRADUX</span>
              <span className="logo-badge">Certified</span>
            </a>
          </div>
          <button className="mobile-menu-btn" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Toggle menu">
            <i className={`fas ${mobileMenuOpen ? 'fa-times' : 'fa-bars'}`}></i>
          </button>
          <ul className={`nav-links ${mobileMenuOpen ? 'active' : ''}`}>
            <li><a href="#services" onClick={(e) => scrollTo(e, 'services')}>Services</a></li>
            <li><a href="#how-it-works" onClick={(e) => scrollTo(e, 'how-it-works')}>How It Works</a></li>
            <li><a href="#documents" onClick={(e) => scrollTo(e, 'documents')}>Documents</a></li>
            <li><a href="#pricing" onClick={(e) => scrollTo(e, 'pricing')}>Pricing</a></li>
            <li><a href="#faq" onClick={(e) => scrollTo(e, 'faq')}>FAQ</a></li>
            <li><Link href="/professionals" className="nav-pro-link">For Translators</Link></li>
          </ul>
          <a href="#order" className="cta-btn cert-cta" onClick={(e) => scrollTo(e, 'order')}>
            <i className="fas fa-shopping-cart"></i> Order Now
          </a>
        </nav>
      </header>

      {/* Hero */}
      <section className="cert-hero" id="hero">
        <div className="container">
          <div className="cert-hero-content">
            <div className="cert-hero-text fade-in" ref={addFadeRef}>
              <div className="cert-badge">
                <i className="fas fa-award"></i>
                ATA Member &bull; USCIS Accepted &bull; 100% Acceptance Guarantee
              </div>
              <h1>Certified & Official Translation Services</h1>
              <p className="cert-subtitle">
                Professional, certified, notarized, and apostille translations for immigration, legal, academic, and business use. Trusted by 10,000+ customers across 100+ countries.
              </p>

              <div className="cert-trust-row">
                <div className="trust-item"><i className="fas fa-shield-alt"></i><span>100% Acceptance Guarantee</span></div>
                <div className="trust-item"><i className="fas fa-bolt"></i><span>Same-Day Delivery Available</span></div>
                <div className="trust-item"><i className="fas fa-users"></i><span>Human Translators</span></div>
                <div className="trust-item"><i className="fas fa-lock"></i><span>NDA Protected</span></div>
              </div>

              <div className="cert-hero-stats">
                <div className="cert-stat"><div className="cert-stat-number">10,000+</div><div className="cert-stat-label">Customers Served</div></div>
                <div className="cert-stat"><div className="cert-stat-number">50+</div><div className="cert-stat-label">Languages</div></div>
                <div className="cert-stat"><div className="cert-stat-number">100+</div><div className="cert-stat-label">Countries</div></div>
                <div className="cert-stat"><div className="cert-stat-number">4.9/5</div><div className="cert-stat-label">Client Rating</div></div>
              </div>

              <div className="cert-hero-actions">
                <a href="#order" className="btn-cert-primary" onClick={(e) => scrollTo(e, 'order')}>
                  <i className="fas fa-shopping-cart"></i> Order Your Translation
                </a>
                <a href="#how-it-works" className="btn-cert-outline" onClick={(e) => scrollTo(e, 'how-it-works')}>
                  <i className="fas fa-play-circle"></i> How It Works
                </a>
              </div>
            </div>

            {/* Accepted By Card */}
            <div className="cert-hero-card fade-in" ref={addFadeRef}>
              <div className="quick-quote-card">
                <h3><i className="fas fa-check-double"></i> Accepted By</h3>
                <div className="accepted-grid">
                  {[
                    { icon: 'fa-flag-usa', label: 'USCIS' },
                    { icon: 'fa-gavel', label: 'US Courts' },
                    { icon: 'fa-university', label: 'Universities' },
                    { icon: 'fa-landmark', label: 'Government' },
                    { icon: 'fa-building', label: 'Banks' },
                    { icon: 'fa-globe-americas', label: 'Embassies' },
                    { icon: 'fa-hospital', label: 'Hospitals' },
                    { icon: 'fa-briefcase', label: 'Employers' },
                  ].map((item, i) => (
                    <div key={i} className="accepted-item">
                      <i className={`fas ${item.icon}`}></i>
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>
                <div className="accepted-guarantee">
                  <i className="fas fa-certificate"></i>
                  <div>
                    <strong>100% Acceptance Guarantee</strong>
                    <small>If your translation is not accepted, we refund you in full.</small>
                  </div>
                </div>
                <a href="#order" className="btn-cert-primary btn-sm" onClick={(e) => scrollTo(e, 'order')}>
                  Order Now &mdash; From $19.00/page <i className="fas fa-arrow-right"></i>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="cert-services">
        <div className="container">
          <h2 className="cert-section-title fade-in" ref={addFadeRef}>Translation & Certification Services</h2>
          <p className="cert-section-subtitle fade-in" ref={addFadeRef}>Whatever you need, we have the right solution for you</p>

          <div className="services-grid">
            {[
              { icon: 'fa-stamp', title: 'Certified Translations', desc: 'Completed on our letterhead with a signed Certificate of Accuracy, stamp, and contact details. Accepted by USCIS, courts, universities, and government agencies.', color: '#ff6b35' },
              { icon: 'fa-gavel', title: 'Notarized Translations', desc: 'Certified translation presented to a Notary Public who appends their signature and stamp. Required by some courts, embassies, and foreign institutions.', color: '#667eea' },
              { icon: 'fa-stamp', title: 'Apostille Services', desc: 'Legalized translations with an Apostille from the Secretary of State, making them admissible in any Hague Convention country.', color: '#8b5cf6' },
              { icon: 'fa-graduation-cap', title: 'Academic Translations', desc: 'Diplomas, transcripts, and academic records translated for university admissions, credential evaluation (WES, ECE), and professional licensing.', color: '#11998e' },
              { icon: 'fa-passport', title: 'Immigration Documents', desc: 'Birth certificates, marriage certificates, divorce decrees, police clearances, and all USCIS-required documents with guaranteed acceptance.', color: '#f59e0b' },
              { icon: 'fa-briefcase', title: 'Business Translations', desc: 'Contracts, financial statements, articles of incorporation, patents, and corporate documents for international operations.', color: '#ef4444' },
            ].map((service, i) => (
              <div key={i} className="service-card fade-in" ref={addFadeRef}>
                <div className="service-icon" style={{ background: service.color }}>
                  <i className={`fas ${service.icon}`}></i>
                </div>
                <h3>{service.title}</h3>
                <p>{service.desc}</p>
                <a href="#order" className="service-link" onClick={(e) => scrollTo(e, 'order')}>
                  Order Now <i className="fas fa-arrow-right"></i>
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works - 4 Steps */}
      <section id="how-it-works" className="cert-how">
        <div className="container">
          <h2 className="cert-section-title fade-in" ref={addFadeRef}>How It Works</h2>
          <p className="cert-section-subtitle fade-in" ref={addFadeRef}>Receive accurate translations quickly in 4 easy steps</p>

          <div className="steps-grid four-steps">
            {[
              { step: '1', icon: 'fa-cloud-upload-alt', title: 'Upload Your Documents', desc: 'Upload scans or photos of your documents. We accept PDF, JPG, PNG, and Word formats. All files are encrypted.' },
              { step: '2', icon: 'fa-sliders-h', title: 'Choose Options & Pay', desc: 'Select languages, certification type, service tier, and delivery speed. Pay securely online with transparent pricing.' },
              { step: '3', icon: 'fa-language', title: 'Professional Translation', desc: 'A certified human translator works on your document. A second linguist proofreads for accuracy and quality assurance.' },
              { step: '4', icon: 'fa-file-download', title: 'Receive Your Translation', desc: 'Get your certified translation delivered via email as a signed PDF. Physical copies with hard stamps available via FedEx.' },
            ].map((item, i) => (
              <div key={i} className="step-card fade-in" ref={addFadeRef}>
                <div className="step-number">{item.step}</div>
                <div className="step-icon"><i className={`fas ${item.icon}`}></i></div>
                <h3>{item.title}</h3>
                <p>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Tiers */}
      <section id="pricing" className="cert-pricing">
        <div className="container">
          <h2 className="cert-section-title fade-in" ref={addFadeRef}>Transparent Pricing</h2>
          <p className="cert-section-subtitle fade-in" ref={addFadeRef}>Choose the service tier that fits your needs. No hidden fees.</p>

          <div className="pricing-grid">
            <div className="pricing-card fade-in" ref={addFadeRef}>
              <h3>Standard</h3>
              <div className="pricing-amount">$19.00</div>
              <div className="pricing-per">per page</div>
              <p className="tier-desc">Accurate, certified translations for straightforward personal documents.</p>
              <ul className="pricing-features">
                <li><i className="fas fa-check"></i> Certified translation</li>
                <li><i className="fas fa-check"></i> Certificate of Accuracy</li>
                <li><i className="fas fa-check"></i> USCIS / Courts accepted</li>
                <li><i className="fas fa-check"></i> 2-3 business days</li>
                <li><i className="fas fa-check"></i> Digital delivery (PDF)</li>
                <li><i className="fas fa-check"></i> Free revisions</li>
              </ul>
              <p className="tier-best">Best for: Birth, marriage, police, or academic certificates</p>
              <button className="btn-pricing" onClick={(e) => { setServiceTier('standard'); scrollTo(e, 'order'); }}>Order Now</button>
            </div>

            <div className="pricing-card featured fade-in" ref={addFadeRef}>
              <div className="popular-badge">Most Popular</div>
              <h3>Professional</h3>
              <div className="pricing-amount">$29.00</div>
              <div className="pricing-per">per page</div>
              <p className="tier-desc">Translated and proofread by a second linguist for error-free, polished results.</p>
              <ul className="pricing-features">
                <li><i className="fas fa-check"></i> Everything in Standard</li>
                <li><i className="fas fa-check"></i> Second linguist proofreading</li>
                <li><i className="fas fa-check"></i> 24-hour delivery available</li>
                <li><i className="fas fa-check"></i> Direct translator contact</li>
                <li><i className="fas fa-check"></i> Notarization available</li>
                <li><i className="fas fa-check"></i> Hard copy mailing included</li>
              </ul>
              <p className="tier-best">Best for: Contracts, business proposals, government docs</p>
              <button className="btn-pricing featured" onClick={(e) => { setServiceTier('professional'); scrollTo(e, 'order'); }}>Order Now</button>
            </div>

            <div className="pricing-card fade-in" ref={addFadeRef}>
              <h3>Specialist</h3>
              <div className="pricing-amount">$39.00</div>
              <div className="pricing-per">per page</div>
              <p className="tier-desc">Field-specific experts handle complex or technical translations.</p>
              <ul className="pricing-features">
                <li><i className="fas fa-check"></i> Everything in Professional</li>
                <li><i className="fas fa-check"></i> Field-specific expert translator</li>
                <li><i className="fas fa-check"></i> Same-day delivery available</li>
                <li><i className="fas fa-check"></i> Dedicated project manager</li>
                <li><i className="fas fa-check"></i> Apostille available</li>
                <li><i className="fas fa-check"></i> Hard copy via FedEx Express</li>
              </ul>
              <p className="tier-best">Best for: Medical records, legal docs, technical manuals</p>
              <button className="btn-pricing" onClick={(e) => { setServiceTier('specialist'); scrollTo(e, 'order'); }}>Order Now</button>
            </div>
          </div>
        </div>
      </section>

      {/* Documents */}
      <section id="documents" className="cert-documents">
        <div className="container">
          <h2 className="cert-section-title fade-in" ref={addFadeRef}>Accepted Document Types</h2>
          <p className="cert-section-subtitle fade-in" ref={addFadeRef}>We translate all types of personal, legal, academic, and business documents</p>

          <div className="docs-grid fade-in" ref={addFadeRef}>
            {[
              { icon: 'fa-baby', label: 'Birth Certificates' },
              { icon: 'fa-ring', label: 'Marriage Certificates' },
              { icon: 'fa-heart-broken', label: 'Divorce Decrees' },
              { icon: 'fa-skull-crossbones', label: 'Death Certificates' },
              { icon: 'fa-graduation-cap', label: 'Diplomas & Degrees' },
              { icon: 'fa-file-alt', label: 'Academic Transcripts' },
              { icon: 'fa-passport', label: 'Passports' },
              { icon: 'fa-id-card', label: "Driver's Licenses" },
              { icon: 'fa-file-contract', label: 'Legal Contracts' },
              { icon: 'fa-gavel', label: 'Court Documents' },
              { icon: 'fa-file-medical', label: 'Medical Records' },
              { icon: 'fa-university', label: 'Bank Statements' },
              { icon: 'fa-building', label: 'Business Licenses' },
              { icon: 'fa-file-invoice-dollar', label: 'Financial Documents' },
              { icon: 'fa-shield-alt', label: 'Police Clearances' },
              { icon: 'fa-file-signature', label: 'Power of Attorney' },
              { icon: 'fa-certificate', label: 'Professional Certificates' },
              { icon: 'fa-vote-yea', label: 'Immigration Forms' },
            ].map((doc, i) => (
              <div key={i} className="doc-item">
                <i className={`fas ${doc.icon}`}></i>
                <span>{doc.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* USCIS Section */}
      <section className="cert-uscis">
        <div className="container">
          <div className="uscis-content fade-in" ref={addFadeRef}>
            <div className="uscis-text">
              <h2><i className="fas fa-flag-usa"></i> USCIS Certified Translations</h2>
              <p>
                All our certified translations comply with USCIS requirements as stated in the
                Code of Federal Regulations, 8 CFR 103.2(b)(3). Every translation includes a
                signed Certificate of Accuracy guaranteeing completeness and accuracy.
              </p>
              <ul className="uscis-list">
                <li><i className="fas fa-check-circle"></i> Compliant with 8 CFR 103.2(b)(3)</li>
                <li><i className="fas fa-check-circle"></i> Signed Certificate of Accuracy included</li>
                <li><i className="fas fa-check-circle"></i> Accepted by all USCIS offices nationwide</li>
                <li><i className="fas fa-check-circle"></i> Accepted by courts, universities, and banks</li>
                <li><i className="fas fa-check-circle"></i> Notarization & Apostille available</li>
              </ul>
              <a href="#order" className="btn-cert-primary" onClick={(e) => scrollTo(e, 'order')}>
                <i className="fas fa-shopping-cart"></i> Order Your Translation
              </a>
            </div>
            <div className="uscis-badge">
              <div className="big-badge">
                <i className="fas fa-certificate"></i>
                <span>100%</span>
                <small>Acceptance Guarantee or Full Refund</small>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="cert-why">
        <div className="container">
          <h2 className="cert-section-title fade-in" ref={addFadeRef}>Why Choose TRADUX</h2>
          <p className="cert-section-subtitle fade-in" ref={addFadeRef}>Here are some reasons to choose us for your translation needs</p>

          <div className="why-grid">
            {[
              { icon: 'fa-laptop', title: 'Order Online Easily', desc: 'Order all services online with ease. No need to contact us for a quote — get instant transparent pricing.' },
              { icon: 'fa-dollar-sign', title: 'Transparent Fixed Prices', desc: 'Know the cost upfront. No hidden fees, no surprises. Fixed per-page pricing for all services.' },
              { icon: 'fa-clock', title: '24/7 Support & Delivery', desc: 'Round-the-clock support powered by a global team. Same-day and 24-hour delivery options available.' },
              { icon: 'fa-robot', title: 'Fast & Efficient Process', desc: 'Over 50% of our delivery process is automated, ensuring fast and efficient service every time.' },
              { icon: 'fa-comments', title: 'Direct Translator Contact', desc: 'Communicate directly with your assigned translator or project manager to ensure clarity and accuracy.' },
              { icon: 'fa-user-shield', title: 'Data Security & NDA', desc: 'Industry-leading practices ensure confidential data remains secure. All staff bound by strict NDAs.' },
            ].map((item, i) => (
              <div key={i} className="why-card fade-in" ref={addFadeRef}>
                <div className="why-icon"><i className={`fas ${item.icon}`}></i></div>
                <h3>{item.title}</h3>
                <p>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ORDER FORM - Direct Order */}
      <section id="order" className="cert-order">
        <div className="container">
          <h2 className="cert-section-title fade-in" ref={addFadeRef}>Place Your Order</h2>
          <p className="cert-section-subtitle fade-in" ref={addFadeRef}>Upload your documents, choose your options, and submit your order</p>

          <div className="order-container fade-in" ref={addFadeRef}>
            <form onSubmit={handleOrderSubmit} className="order-form">

              {/* Step 1: Upload */}
              <div className="order-section">
                <h3><span className="order-step-num">1</span> Upload Your Documents</h3>
                <div className="upload-area">
                  <input type="file" id="file-upload" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={handleFileChange} className="file-input" />
                  <label htmlFor="file-upload" className="upload-label">
                    <i className="fas fa-cloud-upload-alt"></i>
                    <span>Click to upload or drag files here</span>
                    <small>PDF, JPG, PNG, DOC (Max 20MB each)</small>
                  </label>
                  {uploading && (
                    <div className="file-list">
                      <div className="file-item"><i className="fas fa-spinner fa-spin"></i><span>Uploading and analyzing documents...</span></div>
                    </div>
                  )}
                  {!uploading && selectedFiles.length > 0 && (
                    <div className="file-list">
                      {uploadedDocs.map((doc, i) => (
                        <div key={i} className="file-item">
                          <i className="fas fa-check-circle" style={{ color: '#38a169' }}></i>
                          <span>{doc.filename}</span>
                          <small>({doc.page_count} page{doc.page_count > 1 ? 's' : ''})</small>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Step 2: Translation Details */}
              <div className="order-section">
                <h3><span className="order-step-num">2</span> Translation Details</h3>
                <div className="order-row">
                  <div className="order-field">
                    <label htmlFor="order-source">Source Language *</label>
                    <select id="order-source" required defaultValue="portuguese">
                      <option value="portuguese">Portuguese</option>
                      <option value="spanish">Spanish</option>
                      <option value="french">French</option>
                      <option value="german">German</option>
                      <option value="italian">Italian</option>
                      <option value="chinese">Chinese (Simplified)</option>
                      <option value="chinese-trad">Chinese (Traditional)</option>
                      <option value="japanese">Japanese</option>
                      <option value="korean">Korean</option>
                      <option value="arabic">Arabic</option>
                      <option value="russian">Russian</option>
                      <option value="hindi">Hindi</option>
                      <option value="polish">Polish</option>
                      <option value="dutch">Dutch</option>
                      <option value="turkish">Turkish</option>
                      <option value="vietnamese">Vietnamese</option>
                      <option value="thai">Thai</option>
                      <option value="english">English</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="order-field">
                    <label htmlFor="order-target">Target Language *</label>
                    <select id="order-target" required defaultValue="english">
                      <option value="english">English</option>
                      <option value="portuguese">Portuguese</option>
                      <option value="spanish">Spanish</option>
                      <option value="french">French</option>
                      <option value="german">German</option>
                      <option value="italian">Italian</option>
                      <option value="chinese">Chinese (Simplified)</option>
                      <option value="japanese">Japanese</option>
                      <option value="korean">Korean</option>
                      <option value="arabic">Arabic</option>
                      <option value="russian">Russian</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
                <div className="order-row">
                  <div className="order-field">
                    <label htmlFor="order-doc-type">Document Type *</label>
                    <select id="order-doc-type" required defaultValue="">
                      <option value="" disabled>Select document type</option>
                      <option value="birth-certificate">Birth Certificate</option>
                      <option value="marriage-certificate">Marriage Certificate</option>
                      <option value="divorce-decree">Divorce Decree</option>
                      <option value="death-certificate">Death Certificate</option>
                      <option value="diploma">Diploma / Degree</option>
                      <option value="transcript">Academic Transcript</option>
                      <option value="passport">Passport</option>
                      <option value="drivers-license">Driver's License</option>
                      <option value="police-clearance">Police Clearance</option>
                      <option value="medical-record">Medical Record</option>
                      <option value="legal-document">Legal Document / Contract</option>
                      <option value="court-document">Court Document</option>
                      <option value="bank-statement">Bank Statement</option>
                      <option value="business-document">Business Document</option>
                      <option value="immigration-form">Immigration Form</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="order-field">
                    <label htmlFor="order-purpose">Purpose *</label>
                    <select id="order-purpose" required defaultValue="">
                      <option value="" disabled>Select purpose</option>
                      <option value="uscis">USCIS / Immigration</option>
                      <option value="university">University / Education (WES, ECE)</option>
                      <option value="legal">Legal / Court</option>
                      <option value="embassy">Embassy / Consulate</option>
                      <option value="business">Business / Corporate</option>
                      <option value="personal">Personal Use</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Step 3: Service Options */}
              <div className="order-section">
                <h3><span className="order-step-num">3</span> Service Options</h3>

                <label className="field-label">Service Tier *</label>
                <div className="tier-selector">
                  {[
                    { value: 'standard', label: 'Standard', price: '$19/pg', desc: 'Certified translation' },
                    { value: 'professional', label: 'Professional', price: '$29/pg', desc: 'Translated + Proofread' },
                    { value: 'specialist', label: 'Specialist', price: '$39/pg', desc: 'Field-specific expert' },
                  ].map((tier) => (
                    <label key={tier.value} className={`tier-option ${serviceTier === tier.value ? 'selected' : ''}`}>
                      <input type="radio" name="service-tier" value={tier.value} checked={serviceTier === tier.value} onChange={(e) => setServiceTier(e.target.value)} />
                      <div className="tier-option-content">
                        <strong>{tier.label}</strong>
                        <span className="tier-price-tag">{tier.price}</span>
                        <small>{tier.desc}</small>
                      </div>
                    </label>
                  ))}
                </div>

                <div className="order-row" style={{ marginTop: '1rem' }}>
                  <div className="order-field">
                    <label htmlFor="order-cert-type">Certification Type *</label>
                    <select id="order-cert-type" value={certType} onChange={(e) => setCertType(e.target.value)} required>
                      <option value="certified">Company Certified (included)</option>
                      <option value="notarized">Notarized (+$15)</option>
                      <option value="apostille">Apostille (+$75)</option>
                    </select>
                  </div>
                  <div className="order-field">
                    <label htmlFor="order-delivery">Delivery Speed *</label>
                    <select id="order-delivery" required defaultValue="standard">
                      <option value="standard">Standard (2-3 business days)</option>
                      <option value="urgent">Urgent (24 hours)</option>
                      <option value="same-day">Same Day (12 hours)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Step 4: Your Info */}
              <div className="order-section">
                <h3><span className="order-step-num">4</span> Your Information</h3>
                <div className="order-row">
                  <div className="order-field">
                    <label htmlFor="full-name">Full Name *</label>
                    <input type="text" id="full-name" placeholder="John Smith" required />
                  </div>
                  <div className="order-field">
                    <label htmlFor="email">Email *</label>
                    <input type="email" id="email" placeholder="john@email.com" required />
                  </div>
                </div>
                <div className="order-row">
                  <div className="order-field">
                    <label htmlFor="phone">Phone (optional)</label>
                    <input type="tel" id="phone" placeholder="+1 (555) 123-4567" />
                  </div>
                  <div className="order-field">
                    <label htmlFor="order-delivery-method">Delivery Method</label>
                    <select id="order-delivery-method" defaultValue="email">
                      <option value="email">Email (PDF) - Free</option>
                      <option value="mail">Mail Hard Copy (+$15)</option>
                      <option value="fedex">FedEx Express (+$35)</option>
                    </select>
                  </div>
                </div>
                <div className="order-field" style={{ marginBottom: '1rem' }}>
                  <label htmlFor="order-notes">Additional Notes</label>
                  <textarea id="order-notes" rows={3} placeholder="Name spellings, special instructions, or any details about your documents..."></textarea>
                </div>
              </div>

              {/* Summary */}
              <div className="order-summary">
                <div className="summary-row">
                  <span>Service Tier</span>
                  <strong>{serviceTier.charAt(0).toUpperCase() + serviceTier.slice(1)} — ${tierPrices[serviceTier]?.toFixed(2)}/page</strong>
                </div>
                <div className="summary-row">
                  <span>Certification</span>
                  <strong>{certType === 'certified' ? 'Company Certified (included)' : certType === 'notarized' ? 'Notarized (+$15)' : 'Apostille (+$75)'}</strong>
                </div>
                <div className="summary-row">
                  <span>Documents</span>
                  <strong>{uploadedDocs.length} file(s) — {uploadedDocs.reduce((s, d) => s + d.page_count, 0) || 0} page(s)</strong>
                </div>
              </div>

              <div className="order-security">
                <i className="fas fa-lock"></i>
                <span>Your files are encrypted with 256-bit SSL. Only essential staff with NDAs have access to your documents.</span>
              </div>

              <button
                type="submit"
                className={`btn-order-submit ${formLoading ? 'loading' : ''}`}
                disabled={formLoading}
                style={formSuccess ? { background: 'linear-gradient(135deg, #10b981, #059669)' } : undefined}
              >
                {formLoading ? (
                  <><i className="fas fa-spinner fa-spin"></i> Processing Order...</>
                ) : formSuccess ? (
                  <><i className="fas fa-check"></i> Order Placed Successfully!</>
                ) : (
                  <><i className="fas fa-shopping-cart"></i> Place Order</>
                )}
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="cert-testimonials">
        <div className="container">
          <h2 className="cert-section-title fade-in" ref={addFadeRef}>What Our Clients Say</h2>
          <p className="cert-section-subtitle fade-in" ref={addFadeRef}>Rated 4.9/5 by thousands of satisfied clients</p>

          <div className="testimonials-grid">
            {[
              { name: 'Maria S.', location: 'Boston, MA', rating: 5, text: 'I needed a certified translation of my Brazilian birth certificate for USCIS. The translation was ready the next day and USCIS accepted it without any issues. Amazing service!' },
              { name: 'Carlos R.', location: 'Miami, FL', rating: 5, text: 'Translated my marriage certificate and diploma from Portuguese to English. The process was so easy — just uploaded the docs and paid. Everything accepted by USCIS!' },
              { name: 'Ana P.', location: 'New York, NY', rating: 5, text: 'Needed rush notarized translations for court documents and they delivered same day. The quality was impeccable and the notarization was done professionally.' },
              { name: 'Roberto M.', location: 'Los Angeles, CA', rating: 5, text: 'Best translation service I\'ve used. They translated my medical records from Spanish with incredible accuracy. Direct contact with the translator made all the difference.' },
            ].map((review, i) => (
              <div key={i} className="testimonial-card fade-in" ref={addFadeRef}>
                <div className="stars">
                  {[...Array(review.rating)].map((_, j) => (<i key={j} className="fas fa-star"></i>))}
                </div>
                <p>"{review.text}"</p>
                <div className="reviewer">
                  <div className="reviewer-avatar">{review.name.charAt(0)}</div>
                  <div><strong>{review.name}</strong><span>{review.location}</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="cert-faq">
        <div className="container">
          <h2 className="cert-section-title fade-in" ref={addFadeRef}>Frequently Asked Questions</h2>
          <p className="cert-section-subtitle fade-in" ref={addFadeRef}>Find answers to common questions about our services</p>

          <div className="faq-list fade-in" ref={addFadeRef}>
            {[
              { q: 'What is a certified translation?', a: 'A certified translation includes a signed Certificate of Accuracy from the translation company, confirming that the translation is complete and accurate. It is required by USCIS, courts, universities, and other official institutions.' },
              { q: 'Will my translation be accepted by USCIS?', a: 'Yes. All our certified translations comply with USCIS requirements as stated in the Code of Federal Regulations, 8 CFR 103.2(b)(3). We offer a 100% acceptance guarantee — if your translation is not accepted, we provide a full refund.' },
              { q: 'How long does a certified translation take?', a: 'Standard delivery is 2-3 business days. We also offer Urgent (24-hour) and Same-Day (12-hour) delivery options for an additional fee. Most single-page documents can be completed within 24 hours.' },
              { q: 'What is the difference between Standard, Professional, and Specialist tiers?', a: 'Standard provides accurate certified translations for straightforward documents. Professional adds a second linguist review for error-free, polished results. Specialist uses field-specific experts for complex materials like medical records, legal documents, or technical manuals.' },
              { q: 'Do you offer notarized or apostille translations?', a: 'Yes. Notarized translations include a Notary Public signature and stamp. Apostille translations are legalized by the Secretary of State for use in Hague Convention countries. Both options are available during the order process.' },
              { q: 'What languages do you support?', a: 'We support 50+ languages including Portuguese, Spanish, French, German, Italian, Chinese, Japanese, Korean, Arabic, Russian, Hindi, Polish, Dutch, Turkish, Vietnamese, Thai, and many more.' },
              { q: 'How do I receive my translated document?', a: 'By default, you receive a digitally signed and stamped PDF via email. You can also request a physical hard copy mailed to you, or FedEx Express delivery for faster receipt.' },
              { q: 'Is my data secure?', a: 'Absolutely. Your files are encrypted with 256-bit SSL. All team members are bound by strict Non-Disclosure Agreements (NDAs). Files are only accessible during the active order period and deleted upon completion.' },
            ].map((item, i) => (
              <div key={i} className={`faq-item ${openFaq === i ? 'open' : ''}`}>
                <button className="faq-question" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                  <span>{item.q}</span>
                  <i className={`fas ${openFaq === i ? 'fa-minus' : 'fa-plus'}`}></i>
                </button>
                {openFaq === i && <div className="faq-answer"><p>{item.a}</p></div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cert-cta-section">
        <div className="container">
          <div className="cert-cta-content fade-in" ref={addFadeRef}>
            <h2>Ready to Get Your Translation?</h2>
            <p>Upload your documents, choose your options, and receive your certified translation. 100% acceptance guaranteed.</p>
            <div className="cert-cta-buttons">
              <a href="#order" className="btn-cert-primary" onClick={(e) => scrollTo(e, 'order')}>
                <i className="fas fa-shopping-cart"></i> Order Now &mdash; From $19.00/page
              </a>
              <a href="tel:+16893094980" className="btn-cert-outline-dark">
                <i className="fas fa-phone"></i> Call (689) 309-4980
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" className="cert-footer">
        <div className="container">
          <div className="footer-grid">
            <div className="footer-col">
              <h3>TRADUX</h3>
              <p>Professional certified, notarized, and apostille translation services for immigration, legal, academic, and business documents.</p>
              <p><i className="fas fa-envelope"></i> contact@tradux.online</p>
              <p><i className="fas fa-phone"></i> +1 (689) 309-4980</p>
              <p><i className="fas fa-map-marker-alt"></i> Boston, MA, United States</p>
            </div>
            <div className="footer-col">
              <h3>Services</h3>
              <a href="#services" onClick={(e) => scrollTo(e, 'services')}>Certified Translations</a>
              <a href="#services" onClick={(e) => scrollTo(e, 'services')}>Notarized Translations</a>
              <a href="#services" onClick={(e) => scrollTo(e, 'services')}>Apostille Services</a>
              <a href="#services" onClick={(e) => scrollTo(e, 'services')}>Academic Translations</a>
              <a href="#services" onClick={(e) => scrollTo(e, 'services')}>Immigration Documents</a>
              <a href="#services" onClick={(e) => scrollTo(e, 'services')}>Business Translations</a>
            </div>
            <div className="footer-col">
              <h3>Information</h3>
              <a href="#how-it-works" onClick={(e) => scrollTo(e, 'how-it-works')}>How It Works</a>
              <a href="#pricing" onClick={(e) => scrollTo(e, 'pricing')}>Pricing</a>
              <a href="#documents" onClick={(e) => scrollTo(e, 'documents')}>Accepted Documents</a>
              <a href="#faq" onClick={(e) => scrollTo(e, 'faq')}>FAQ</a>
              <Link href="/professionals">For Translators</Link>
            </div>
            <div className="footer-col">
              <h3>Trust & Security</h3>
              <div className="trust-badges">
                <div className="trust-badge-item"><i className="fas fa-shield-alt"></i><span>USCIS Compliant</span></div>
                <div className="trust-badge-item"><i className="fas fa-lock"></i><span>256-bit Encryption</span></div>
                <div className="trust-badge-item"><i className="fas fa-user-shield"></i><span>NDA Protected</span></div>
                <div className="trust-badge-item"><i className="fas fa-certificate"></i><span>ATA Member</span></div>
                <div className="trust-badge-item"><i className="fas fa-award"></i><span>100% Acceptance Guarantee</span></div>
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; {currentYear} TRADUX. All rights reserved. | Professional Certified Translation Services.</p>
          </div>
        </div>
      </footer>
    </>
  );
}
