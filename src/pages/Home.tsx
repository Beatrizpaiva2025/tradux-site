import { useState, useEffect, useRef, useCallback, type FormEvent, type ChangeEvent } from 'react';
import { toast } from 'sonner';
import { Link } from 'wouter';

export default function Home() {
  const [headerScrolled, setHeaderScrolled] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formSuccess, setFormSuccess] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Quote calculator state
  const [docType, setDocType] = useState('birth-certificate');
  const [numPages, setNumPages] = useState(1);
  const [sourceLang, setSourceLang] = useState('portuguese');
  const [targetLang, setTargetLang] = useState('english');
  const [urgency, setUrgency] = useState('standard');

  const fadeRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Header scroll
  useEffect(() => {
    const handleScroll = () => setHeaderScrolled(window.scrollY > 80);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Intersection Observer for animations
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('animated');
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );
    fadeRefs.current.forEach((el) => { if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, []);

  const addFadeRef = (el: HTMLDivElement | null) => {
    if (el && !fadeRefs.current.includes(el)) fadeRefs.current.push(el);
  };

  // Smooth scroll
  const scrollTo = useCallback((e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // Quote calculation
  const basePrice = 19.00;
  const urgencyMultiplier = urgency === 'rush' ? 1.5 : urgency === 'express' ? 1.25 : 1;
  const estimatedPrice = (basePrice * numPages * urgencyMultiplier).toFixed(2);

  // File upload handler
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(Array.from(e.target.files));
    }
  };

  // Order form submission
  const handleOrderSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormLoading(true);

    setTimeout(() => {
      setFormLoading(false);
      setFormSuccess(true);
      toast.success('Order Received!', {
        description: 'We will review your documents and send you a detailed quote within 15 minutes.',
      });

      setTimeout(() => {
        setFormSuccess(false);
        setSelectedFiles([]);
        (e.target as HTMLFormElement).reset();
      }, 3000);
    }, 2000);
  };

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
            <li><a href="#pricing" onClick={(e) => scrollTo(e, 'pricing')}>Pricing</a></li>
            <li><a href="#documents" onClick={(e) => scrollTo(e, 'documents')}>Documents</a></li>
            <li><a href="#contact" onClick={(e) => scrollTo(e, 'contact')}>Contact</a></li>
            <li>
              <Link href="/professionals" className="nav-pro-link">
                For Translators
              </Link>
            </li>
          </ul>
          <a href="#order" className="cta-btn cert-cta" onClick={(e) => scrollTo(e, 'order')}>
            <i className="fas fa-file-alt"></i>
            Get Quote
          </a>
        </nav>
      </header>

      {/* Hero */}
      <section className="cert-hero" id="hero">
        <div className="container">
          <div className="cert-hero-content">
            <div className="cert-hero-text fade-in" ref={addFadeRef}>
              <div className="cert-badge">
                <i className="fas fa-shield-alt"></i>
                USCIS Accepted &bull; ATA Member
              </div>
              <h1>Certified Translation Services</h1>
              <p className="cert-subtitle">
                Professional certified translations for immigration, legal, academic, and personal documents.
                Trusted by thousands of clients across the United States.
              </p>

              <div className="cert-trust-row">
                <div className="trust-item">
                  <i className="fas fa-check-circle"></i>
                  <span>100% USCIS Acceptance</span>
                </div>
                <div className="trust-item">
                  <i className="fas fa-clock"></i>
                  <span>24h Turnaround Available</span>
                </div>
                <div className="trust-item">
                  <i className="fas fa-users"></i>
                  <span>100% Human Translators</span>
                </div>
              </div>

              <div className="cert-hero-stats">
                <div className="cert-stat">
                  <div className="cert-stat-number">10,000+</div>
                  <div className="cert-stat-label">Documents Translated</div>
                </div>
                <div className="cert-stat">
                  <div className="cert-stat-number">50+</div>
                  <div className="cert-stat-label">Languages</div>
                </div>
                <div className="cert-stat">
                  <div className="cert-stat-number">4.9/5</div>
                  <div className="cert-stat-label">Client Rating</div>
                </div>
              </div>

              <div className="cert-hero-actions">
                <a href="#order" className="btn-cert-primary" onClick={(e) => scrollTo(e, 'order')}>
                  <i className="fas fa-paper-plane"></i>
                  Get Free Quote
                </a>
                <a href="#how-it-works" className="btn-cert-outline" onClick={(e) => scrollTo(e, 'how-it-works')}>
                  <i className="fas fa-play-circle"></i>
                  How It Works
                </a>
              </div>
            </div>

            <div className="cert-hero-card fade-in" ref={addFadeRef}>
              <div className="quick-quote-card">
                <h3><i className="fas fa-calculator"></i> Instant Quote</h3>
                <div className="quote-form">
                  <div className="quote-field">
                    <label>Document Type</label>
                    <select value={docType} onChange={(e) => setDocType(e.target.value)}>
                      <option value="birth-certificate">Birth Certificate</option>
                      <option value="marriage-certificate">Marriage Certificate</option>
                      <option value="divorce-decree">Divorce Decree</option>
                      <option value="diploma">Diploma / Degree</option>
                      <option value="transcript">Academic Transcript</option>
                      <option value="drivers-license">Driver's License</option>
                      <option value="passport">Passport</option>
                      <option value="bank-statement">Bank Statement</option>
                      <option value="medical-record">Medical Record</option>
                      <option value="legal-document">Legal Document</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="quote-row">
                    <div className="quote-field">
                      <label>From</label>
                      <select value={sourceLang} onChange={(e) => setSourceLang(e.target.value)}>
                        <option value="portuguese">Portuguese</option>
                        <option value="spanish">Spanish</option>
                        <option value="french">French</option>
                        <option value="german">German</option>
                        <option value="italian">Italian</option>
                        <option value="chinese">Chinese</option>
                        <option value="japanese">Japanese</option>
                        <option value="korean">Korean</option>
                        <option value="arabic">Arabic</option>
                        <option value="russian">Russian</option>
                        <option value="english">English</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div className="quote-field">
                      <label>To</label>
                      <select value={targetLang} onChange={(e) => setTargetLang(e.target.value)}>
                        <option value="english">English</option>
                        <option value="portuguese">Portuguese</option>
                        <option value="spanish">Spanish</option>
                        <option value="french">French</option>
                        <option value="german">German</option>
                        <option value="italian">Italian</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>
                  <div className="quote-row">
                    <div className="quote-field">
                      <label>Pages</label>
                      <input type="number" min={1} max={100} value={numPages} onChange={(e) => setNumPages(Math.max(1, parseInt(e.target.value) || 1))} />
                    </div>
                    <div className="quote-field">
                      <label>Delivery</label>
                      <select value={urgency} onChange={(e) => setUrgency(e.target.value)}>
                        <option value="standard">Standard (2-3 days)</option>
                        <option value="express">Express (24h) +25%</option>
                        <option value="rush">Rush (Same day) +50%</option>
                      </select>
                    </div>
                  </div>
                  <div className="quote-result">
                    <div className="quote-price">
                      <span className="price-label">Estimated Price</span>
                      <span className="price-amount">${estimatedPrice}</span>
                      <span className="price-note">Starting from $19.00/page</span>
                    </div>
                    <a href="#order" className="btn-cert-primary btn-sm" onClick={(e) => scrollTo(e, 'order')}>
                      Order Now <i className="fas fa-arrow-right"></i>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="cert-services">
        <div className="container">
          <h2 className="cert-section-title fade-in" ref={addFadeRef}>Our Translation Services</h2>
          <p className="cert-section-subtitle fade-in" ref={addFadeRef}>Professional human translations certified for official use</p>

          <div className="services-grid">
            {[
              { icon: 'fa-stamp', title: 'Certified Translations', desc: 'Translations with a signed Certificate of Accuracy, accepted by USCIS, courts, universities, and government agencies across the US.', color: '#ff6b35' },
              { icon: 'fa-gavel', title: 'Legal Translations', desc: 'Contracts, court documents, power of attorney, and legal correspondence translated with precision by specialized legal translators.', color: '#667eea' },
              { icon: 'fa-graduation-cap', title: 'Academic Translations', desc: 'Diplomas, transcripts, academic records, and educational certificates for university admissions and credential evaluation.', color: '#11998e' },
              { icon: 'fa-passport', title: 'Immigration Documents', desc: 'Birth certificates, marriage certificates, divorce decrees, and all documents required for USCIS applications and visa processing.', color: '#f59e0b' },
              { icon: 'fa-file-medical', title: 'Medical Translations', desc: 'Medical records, prescriptions, lab results, and healthcare documentation translated by medical translation specialists.', color: '#ef4444' },
              { icon: 'fa-briefcase', title: 'Business Translations', desc: 'Financial statements, business licenses, articles of incorporation, and corporate documents for international operations.', color: '#8b5cf6' },
            ].map((service, i) => (
              <div key={i} className="service-card fade-in" ref={addFadeRef}>
                <div className="service-icon" style={{ background: service.color }}>
                  <i className={`fas ${service.icon}`}></i>
                </div>
                <h3>{service.title}</h3>
                <p>{service.desc}</p>
                <a href="#order" className="service-link" onClick={(e) => scrollTo(e, 'order')}>
                  Get Quote <i className="fas fa-arrow-right"></i>
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="cert-how">
        <div className="container">
          <h2 className="cert-section-title fade-in" ref={addFadeRef}>How It Works</h2>
          <p className="cert-section-subtitle fade-in" ref={addFadeRef}>Get your certified translation in 3 simple steps</p>

          <div className="steps-grid">
            {[
              { step: '1', icon: 'fa-cloud-upload-alt', title: 'Upload Your Document', desc: 'Upload a clear scan or photo of your document. We accept PDF, JPG, PNG, and Word formats. Your files are encrypted and secure.' },
              { step: '2', icon: 'fa-language', title: 'Professional Translation', desc: 'Our certified human translators work on your document, ensuring accuracy and compliance with USCIS and official requirements.' },
              { step: '3', icon: 'fa-file-download', title: 'Receive Certified Translation', desc: 'Get your certified translation delivered digitally. Includes a signed Certificate of Accuracy. Physical copies available upon request.' },
            ].map((item, i) => (
              <div key={i} className="step-card fade-in" ref={addFadeRef}>
                <div className="step-number">{item.step}</div>
                <div className="step-icon">
                  <i className={`fas ${item.icon}`}></i>
                </div>
                <h3>{item.title}</h3>
                <p>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Accepted Documents */}
      <section id="documents" className="cert-documents">
        <div className="container">
          <h2 className="cert-section-title fade-in" ref={addFadeRef}>Accepted Document Types</h2>
          <p className="cert-section-subtitle fade-in" ref={addFadeRef}>We translate all types of personal, legal, and business documents</p>

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
              { icon: 'fa-vote-yea', label: 'Voter Registration' },
              { icon: 'fa-file-signature', label: 'Power of Attorney' },
            ].map((doc, i) => (
              <div key={i} className="doc-item">
                <i className={`fas ${doc.icon}`}></i>
                <span>{doc.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="cert-pricing">
        <div className="container">
          <h2 className="cert-section-title fade-in" ref={addFadeRef}>Transparent Pricing</h2>
          <p className="cert-section-subtitle fade-in" ref={addFadeRef}>No hidden fees. Price per page includes certification.</p>

          <div className="pricing-grid">
            <div className="pricing-card fade-in" ref={addFadeRef}>
              <h3>Standard</h3>
              <div className="pricing-amount">$19.00</div>
              <div className="pricing-per">per page</div>
              <ul className="pricing-features">
                <li><i className="fas fa-check"></i> Certified translation</li>
                <li><i className="fas fa-check"></i> Certificate of Accuracy</li>
                <li><i className="fas fa-check"></i> USCIS accepted</li>
                <li><i className="fas fa-check"></i> 2-3 business days</li>
                <li><i className="fas fa-check"></i> Digital delivery (PDF)</li>
                <li><i className="fas fa-check"></i> Free revisions</li>
              </ul>
              <button className="btn-pricing" onClick={() => { toast.success('Standard plan selected!'); document.getElementById('order')?.scrollIntoView({ behavior: 'smooth' }); }}>
                Order Now
              </button>
            </div>

            <div className="pricing-card featured fade-in" ref={addFadeRef}>
              <div className="popular-badge">Most Popular</div>
              <h3>Express</h3>
              <div className="pricing-amount">$23.75</div>
              <div className="pricing-per">per page</div>
              <ul className="pricing-features">
                <li><i className="fas fa-check"></i> Everything in Standard</li>
                <li><i className="fas fa-check"></i> 24-hour delivery</li>
                <li><i className="fas fa-check"></i> Priority processing</li>
                <li><i className="fas fa-check"></i> Email notifications</li>
                <li><i className="fas fa-check"></i> Direct translator contact</li>
                <li><i className="fas fa-check"></i> Free hard copy mailing</li>
              </ul>
              <button className="btn-pricing featured" onClick={() => { toast.success('Express plan selected!'); document.getElementById('order')?.scrollIntoView({ behavior: 'smooth' }); }}>
                Order Now
              </button>
            </div>

            <div className="pricing-card fade-in" ref={addFadeRef}>
              <h3>Rush</h3>
              <div className="pricing-amount">$28.50</div>
              <div className="pricing-per">per page</div>
              <ul className="pricing-features">
                <li><i className="fas fa-check"></i> Everything in Express</li>
                <li><i className="fas fa-check"></i> Same-day delivery</li>
                <li><i className="fas fa-check"></i> Dedicated translator</li>
                <li><i className="fas fa-check"></i> Phone support</li>
                <li><i className="fas fa-check"></i> Notarization available</li>
                <li><i className="fas fa-check"></i> Hard copy via FedEx</li>
              </ul>
              <button className="btn-pricing" onClick={() => { toast.success('Rush plan selected!'); document.getElementById('order')?.scrollIntoView({ behavior: 'smooth' }); }}>
                Order Now
              </button>
            </div>
          </div>

          <div className="pricing-note fade-in" ref={addFadeRef}>
            <i className="fas fa-info-circle"></i>
            <p>Need a high-volume or business discount? <a href="#contact" onClick={(e) => scrollTo(e, 'contact')}>Contact us</a> for custom pricing.</p>
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
                <li><i className="fas fa-check-circle"></i> Accepted by courts and government agencies</li>
                <li><i className="fas fa-check-circle"></i> Notarization available upon request</li>
              </ul>
              <a href="#order" className="btn-cert-primary" onClick={(e) => scrollTo(e, 'order')}>
                <i className="fas fa-file-alt"></i> Start Your Translation
              </a>
            </div>
            <div className="uscis-badge">
              <div className="big-badge">
                <i className="fas fa-certificate"></i>
                <span>100%</span>
                <small>USCIS Acceptance Guarantee</small>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Order Form */}
      <section id="order" className="cert-order">
        <div className="container">
          <h2 className="cert-section-title fade-in" ref={addFadeRef}>Place Your Order</h2>
          <p className="cert-section-subtitle fade-in" ref={addFadeRef}>Upload your documents and receive a quote within minutes</p>

          <div className="order-container fade-in" ref={addFadeRef}>
            <form onSubmit={handleOrderSubmit} className="order-form">
              <div className="order-section">
                <h3><i className="fas fa-user"></i> Your Information</h3>
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
                    <label htmlFor="phone">Phone</label>
                    <input type="tel" id="phone" placeholder="(555) 123-4567" />
                  </div>
                  <div className="order-field">
                    <label htmlFor="order-purpose">Purpose *</label>
                    <select id="order-purpose" required defaultValue="">
                      <option value="" disabled>Select purpose</option>
                      <option value="uscis">USCIS / Immigration</option>
                      <option value="university">University / Education</option>
                      <option value="legal">Legal / Court</option>
                      <option value="personal">Personal Use</option>
                      <option value="business">Business</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="order-section">
                <h3><i className="fas fa-language"></i> Translation Details</h3>
                <div className="order-row">
                  <div className="order-field">
                    <label htmlFor="order-source">Source Language *</label>
                    <select id="order-source" required defaultValue="portuguese">
                      <option value="portuguese">Portuguese</option>
                      <option value="spanish">Spanish</option>
                      <option value="french">French</option>
                      <option value="german">German</option>
                      <option value="italian">Italian</option>
                      <option value="chinese">Chinese</option>
                      <option value="japanese">Japanese</option>
                      <option value="korean">Korean</option>
                      <option value="arabic">Arabic</option>
                      <option value="russian">Russian</option>
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
                      <option value="medical-record">Medical Record</option>
                      <option value="legal-document">Legal Document</option>
                      <option value="bank-statement">Bank Statement</option>
                      <option value="business-document">Business Document</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="order-field">
                    <label htmlFor="order-delivery">Delivery Speed *</label>
                    <select id="order-delivery" required defaultValue="standard">
                      <option value="standard">Standard (2-3 days) - $19.00/pg</option>
                      <option value="express">Express (24h) - $23.75/pg</option>
                      <option value="rush">Rush (Same day) - $28.50/pg</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="order-section">
                <h3><i className="fas fa-upload"></i> Upload Documents</h3>
                <div className="upload-area">
                  <input
                    type="file"
                    id="file-upload"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    onChange={handleFileChange}
                    className="file-input"
                  />
                  <label htmlFor="file-upload" className="upload-label">
                    <i className="fas fa-cloud-upload-alt"></i>
                    <span>Click to upload or drag files here</span>
                    <small>PDF, JPG, PNG, DOC (Max 20MB each)</small>
                  </label>
                  {selectedFiles.length > 0 && (
                    <div className="file-list">
                      {selectedFiles.map((file, i) => (
                        <div key={i} className="file-item">
                          <i className="fas fa-file"></i>
                          <span>{file.name}</span>
                          <small>({(file.size / 1024).toFixed(1)} KB)</small>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="order-section">
                <h3><i className="fas fa-sticky-note"></i> Additional Notes</h3>
                <textarea
                  id="order-notes"
                  rows={3}
                  placeholder="Any specific instructions, name spellings, or special requirements..."
                ></textarea>
              </div>

              <div className="order-security">
                <i className="fas fa-lock"></i>
                <span>Your files are encrypted and secure. Only essential staff with NDAs have access.</span>
              </div>

              <button
                type="submit"
                className={`btn-order-submit ${formLoading ? 'loading' : ''}`}
                disabled={formLoading}
                style={formSuccess ? { background: 'linear-gradient(135deg, #10b981, #059669)' } : undefined}
              >
                {formLoading ? (
                  <><i className="fas fa-spinner fa-spin"></i> Submitting...</>
                ) : formSuccess ? (
                  <><i className="fas fa-check"></i> Order Received!</>
                ) : (
                  <><i className="fas fa-paper-plane"></i> Submit Order &amp; Get Quote</>
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
          <p className="cert-section-subtitle fade-in" ref={addFadeRef}>Trusted by thousands of clients for certified translations</p>

          <div className="testimonials-grid">
            {[
              { name: 'Maria S.', location: 'Boston, MA', rating: 5, text: 'I needed a certified translation of my Brazilian birth certificate for USCIS. The quote came in minutes and the translation was ready the next day. Perfect quality!' },
              { name: 'Carlos R.', location: 'Miami, FL', rating: 5, text: 'Excellent service for my immigration documents. They translated my marriage certificate and diploma from Portuguese. USCIS accepted everything without issues.' },
              { name: 'Ana P.', location: 'New York, NY', rating: 5, text: 'Fast, professional, and affordable. I needed rush translations for court documents and they delivered same day. Highly recommend for any legal translations.' },
              { name: 'Roberto M.', location: 'Los Angeles, CA', rating: 5, text: "The best translation service I've used. They translated my medical records from Spanish with incredible accuracy. The certified translation was accepted by my insurance company." },
            ].map((review, i) => (
              <div key={i} className="testimonial-card fade-in" ref={addFadeRef}>
                <div className="stars">
                  {[...Array(review.rating)].map((_, j) => (
                    <i key={j} className="fas fa-star"></i>
                  ))}
                </div>
                <p>"{review.text}"</p>
                <div className="reviewer">
                  <div className="reviewer-avatar">
                    {review.name.charAt(0)}
                  </div>
                  <div>
                    <strong>{review.name}</strong>
                    <span>{review.location}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cert-cta-section">
        <div className="container">
          <div className="cert-cta-content fade-in" ref={addFadeRef}>
            <h2>Need a Certified Translation?</h2>
            <p>Get started today. Upload your document and receive a quote within minutes. 100% USCIS acceptance guaranteed.</p>
            <div className="cert-cta-buttons">
              <a href="#order" className="btn-cert-primary" onClick={(e) => scrollTo(e, 'order')}>
                <i className="fas fa-paper-plane"></i>
                Get Free Quote
              </a>
              <a href="tel:+16893094980" className="btn-cert-outline-dark">
                <i className="fas fa-phone"></i>
                Call (689) 309-4980
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
              <p>Professional certified translation services for immigration, legal, academic, and personal documents.</p>
              <p><i className="fas fa-envelope"></i> contact@tradux.online</p>
              <p><i className="fas fa-phone"></i> +1 (689) 309-4980</p>
              <p><i className="fas fa-map-marker-alt"></i> Boston, MA, United States</p>
            </div>
            <div className="footer-col">
              <h3>Services</h3>
              <a href="#services" onClick={(e) => scrollTo(e, 'services')}>Certified Translations</a>
              <a href="#services" onClick={(e) => scrollTo(e, 'services')}>Legal Translations</a>
              <a href="#services" onClick={(e) => scrollTo(e, 'services')}>Academic Translations</a>
              <a href="#services" onClick={(e) => scrollTo(e, 'services')}>Immigration Documents</a>
              <a href="#services" onClick={(e) => scrollTo(e, 'services')}>Medical Translations</a>
            </div>
            <div className="footer-col">
              <h3>Information</h3>
              <a href="#how-it-works" onClick={(e) => scrollTo(e, 'how-it-works')}>How It Works</a>
              <a href="#pricing" onClick={(e) => scrollTo(e, 'pricing')}>Pricing</a>
              <a href="#documents" onClick={(e) => scrollTo(e, 'documents')}>Accepted Documents</a>
              <a href="#" onClick={(e) => { e.preventDefault(); toast.info('FAQ page coming soon!'); }}>FAQ</a>
              <Link href="/professionals">For Translators</Link>
            </div>
            <div className="footer-col">
              <h3>Trust & Security</h3>
              <div className="trust-badges">
                <div className="trust-badge-item">
                  <i className="fas fa-shield-alt"></i>
                  <span>USCIS Compliant</span>
                </div>
                <div className="trust-badge-item">
                  <i className="fas fa-lock"></i>
                  <span>256-bit Encryption</span>
                </div>
                <div className="trust-badge-item">
                  <i className="fas fa-user-shield"></i>
                  <span>NDA Protected</span>
                </div>
                <div className="trust-badge-item">
                  <i className="fas fa-certificate"></i>
                  <span>ATA Member</span>
                </div>
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
