import { useState, useEffect, useRef, useCallback, type FormEvent } from 'react';
import { toast } from 'sonner';

export default function Home() {
  const [headerScrolled, setHeaderScrolled] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formSuccess, setFormSuccess] = useState(false);

  // ROI Calculator state
  const [currentCost, setCurrentCost] = useState(5000);
  const [monthlyWords, setMonthlyWords] = useState(50000);
  const [teamSize, setTeamSize] = useState(5);
  const [languages, setLanguages] = useState(5);

  // Scroll animation refs
  const fadeRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Header scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setHeaderScrolled(window.scrollY > 100);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Intersection Observer for fade-in animations
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('animated');
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );

    fadeRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  // ROI calculations
  const costPerWord = 0.02;
  const newMonthlyCost = monthlyWords * costPerWord;
  const monthlySavings = currentCost - newMonthlyCost;
  const annualSavings = monthlySavings * 12;
  const timeSaved = Math.round(teamSize * languages * 2.5);
  const roiPercentage = currentCost > 0 ? Math.round((monthlySavings / currentCost) * 100) : 0;

  // Smooth scroll handler
  const scrollToSection = useCallback((e: React.MouseEvent<HTMLAnchorElement>, sectionId: string) => {
    e.preventDefault();
    const target = document.getElementById(sectionId);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  // Enterprise form submission
  const handleFormSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormLoading(true);

    setTimeout(() => {
      setFormLoading(false);
      setFormSuccess(true);
      toast.success('Quote Sent!', {
        description: 'Our sales team will contact you within 1 hour to discuss your custom solution.',
      });

      setTimeout(() => {
        setFormSuccess(false);
        (e.target as HTMLFormElement).reset();
      }, 3000);
    }, 2500);
  };

  // Plan button click handler
  const handlePlanClick = (planName: string) => {
    toast.success(`${planName} Plan Selected!`, {
      description: `You selected the ${planName} plan. Scroll up to fill the form and our team will set up your account.`,
    });
    const demoSection = document.getElementById('demo-form');
    if (demoSection) {
      demoSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const addFadeRef = (el: HTMLDivElement | null) => {
    if (el && !fadeRefs.current.includes(el)) {
      fadeRefs.current.push(el);
    }
  };

  const currentYear = new Date().getFullYear();

  return (
    <>
      {/* Header */}
      <header id="header" className={headerScrolled ? 'scrolled' : ''}>
        <nav className="container">
          <div className="logo">
            <img
              src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDMwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjwhLS0gVFJBRFVYIFRleHQgLS0+Cjx0ZXh0IHg9IjEwIiB5PSI2NSIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjQyIiBmb250LXdlaWdodD0iODAwIiBmaWxsPSIjMmQ0MDVhIj5UUkFEVVg8L3RleHQ+CjwhLS0gQ29ubmVjdGlvbiBJY29uIC0tPgo8Y2lyY2xlIGN4PSIyNTAiIGN5PSIzMCIgcj0iMTAiIGZpbGw9IiMyOTgwYjkiLz4KPGxpbmUgeDE9IjI0MCIgeTE9IjQwIiB4Mj0iMjYwIiB5Mj0iNjAiIHN0cm9rZT0iIzI5ODBiOSIgc3Ryb2tlLXdpZHRoPSI1IiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KPGNpcmNsZSBjeD0iMjY1IiBjeT0iNjUiIHI9IjgiIGZpbGw9IiMyOTgwYjkiLz4KPC9zdmc+"
              alt="TRADUX Logo"
            />
          </div>
          <ul className="nav-links">
            <li><a href="#solutions" onClick={(e) => scrollToSection(e, 'solutions')}>Solutions</a></li>
            <li><a href="#plans" onClick={(e) => scrollToSection(e, 'plans')}>Pricing</a></li>
            <li><a href="#case-studies" onClick={(e) => scrollToSection(e, 'case-studies')}>Case Studies</a></li>
            <li><a href="#contact" onClick={(e) => scrollToSection(e, 'contact')}>Contact</a></li>
          </ul>
          <a href="#demo-form" className="cta-btn" onClick={(e) => scrollToSection(e, 'demo-form')}>
            <i className="fas fa-calendar"></i>
            Book Demo
          </a>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="hero-business" id="demo-form">
        <div className="container">
          <div className="hero-business-content">
            <div className="hero-text fade-in" ref={addFadeRef}>
              <h1>Enterprise Translation Solutions</h1>
              <p className="subtitle">
                Scale your global operations with AI-powered translation services trusted by Fortune 500 companies.
                Reduce costs by 70% while maintaining enterprise-grade quality and security.
              </p>

              <div className="hero-stats">
                <div className="stat-item">
                  <div className="stat-number">500+</div>
                  <div className="stat-label">Enterprise Clients</div>
                </div>
                <div className="stat-item">
                  <div className="stat-number">70%</div>
                  <div className="stat-label">Cost Reduction</div>
                </div>
                <div className="stat-item">
                  <div className="stat-number">24h</div>
                  <div className="stat-label">Turnaround Time</div>
                </div>
              </div>

              <div className="cta-buttons">
                <a href="#demo-form" className="btn-white" onClick={(e) => scrollToSection(e, 'demo-form')}>
                  <i className="fas fa-rocket"></i>
                  Start Free Trial
                </a>
                <a href="#plans" className="btn-outline" onClick={(e) => scrollToSection(e, 'plans')}>
                  <i className="fas fa-chart-line"></i>
                  View Pricing
                </a>
              </div>
            </div>

            <div className="hero-form fade-in" ref={addFadeRef}>
              <h3 className="form-title">Get Started Today</h3>
              <form onSubmit={handleFormSubmit}>
                <div className="form-group">
                  <label htmlFor="company-name">Company Name *</label>
                  <input type="text" id="company-name" name="company-name" placeholder="Your Company" required />
                </div>
                <div className="form-group">
                  <label htmlFor="contact-name">Full Name *</label>
                  <input type="text" id="contact-name" name="contact-name" placeholder="John Smith" required />
                </div>
                <div className="form-group">
                  <label htmlFor="work-email">Work Email *</label>
                  <input type="email" id="work-email" name="work-email" placeholder="john@company.com" required />
                </div>
                <div className="form-group">
                  <label htmlFor="company-size">Company Size *</label>
                  <select id="company-size" name="company-size" required defaultValue="">
                    <option value="" disabled>Select company size</option>
                    <option value="1-50">1-50 employees</option>
                    <option value="51-200">51-200 employees</option>
                    <option value="201-1000">201-1,000 employees</option>
                    <option value="1000+">1,000+ employees</option>
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="monthly-volume">Monthly Translation Volume</label>
                  <select id="monthly-volume" name="monthly-volume" defaultValue="">
                    <option value="">Select volume</option>
                    <option value="under-10k">Under 10k words</option>
                    <option value="10k-50k">10k-50k words</option>
                    <option value="50k-200k">50k-200k words</option>
                    <option value="200k+">200k+ words</option>
                  </select>
                </div>
                <button
                  type="submit"
                  className={`submit-enterprise-btn ${formLoading ? 'loading' : ''}`}
                  disabled={formLoading}
                  style={formSuccess ? { background: 'linear-gradient(135deg, #10b981, #059669)' } : undefined}
                >
                  {formLoading ? (
                    <><i className="fas fa-spinner fa-spin"></i> Processing...</>
                  ) : formSuccess ? (
                    <><i className="fas fa-check"></i> Quote Sent!</>
                  ) : (
                    <><i className="fas fa-paper-plane"></i> Get Custom Quote</>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Enterprise Benefits */}
      <section id="solutions" className="enterprise-benefits">
        <div className="container">
          <h2 className="section-title fade-in" ref={addFadeRef}>Why Fortune 500 Companies Choose TRADUX</h2>
          <p className="section-subtitle fade-in" ref={addFadeRef}>Enterprise-grade translation solutions that scale with your business</p>

          <div className="benefits-grid">
            {[
              { icon: 'fa-shield-alt', title: 'Enterprise Security', desc: 'SOC 2 Type II compliant with bank-level encryption, SSO integration, and comprehensive audit trails for maximum data protection.' },
              { icon: 'fa-cogs', title: 'API Integration', desc: 'Seamlessly integrate with your existing workflow through our RESTful API, webhooks, and pre-built connectors for popular platforms.' },
              { icon: 'fa-users', title: 'Dedicated Support', desc: '24/7 dedicated customer success manager, priority support queue, and custom SLA agreements for mission-critical projects.' },
              { icon: 'fa-chart-line', title: 'Analytics Dashboard', desc: 'Real-time insights into translation quality, turnaround times, cost savings, and team productivity with exportable reports.' },
              { icon: 'fa-robot', title: 'AI Assistant', desc: 'Conversational AI assistant that understands your business context, learns from your brand voice, and automates translation workflows.' },
              { icon: 'fa-globe', title: '50+ Languages', desc: 'Support for 50+ language pairs with specialized translators for technical, legal, marketing, and medical content.' },
              { icon: 'fa-memory', title: 'Translation Memory', desc: "Build and maintain your company's translation memory for consistent terminology and significant cost savings on repeat content." },
              { icon: 'fa-bolt', title: 'Instant Processing', desc: '7.6x faster processing than competitors with GPU-accelerated architecture for real-time translation and content generation.' },
              { icon: 'fa-brain', title: 'Smart Learning', desc: 'AI learns your brand voice, writing style, and terminology preferences to maintain consistency across all translations.' },
            ].map((benefit, i) => (
              <div key={i} className="benefit-card fade-in" ref={addFadeRef}>
                <div className="benefit-icon">
                  <i className={`fas ${benefit.icon}`}></i>
                </div>
                <h3>{benefit.title}</h3>
                <p>{benefit.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Features Section */}
      <section className="ai-features">
        <div className="container">
          <h2 className="section-title fade-in" ref={addFadeRef}>Powered by Advanced AI Technology</h2>
          <p className="section-subtitle fade-in" ref={addFadeRef}>Experience the future of enterprise translation with our cutting-edge AI capabilities</p>

          <div className="ai-features-grid">
            {[
              {
                icon: 'fa-comments',
                title: 'Conversational AI Assistant',
                desc: 'Chat with your AI translator using natural language. Simply describe what you need, and our AI handles complex translation workflows automatically.',
                features: ['Natural language commands', 'Context-aware responses', 'Workflow automation', '24/7 availability'],
              },
              {
                icon: 'fa-magic',
                title: 'Content Generation',
                desc: 'Generate multilingual content, marketing copy, and product descriptions that match your brand voice across all languages.',
                features: ['Brand voice consistency', 'SEO-optimized content', 'Multi-format support', 'Instant generation'],
              },
              {
                icon: 'fa-search',
                title: 'Intelligent Analysis',
                desc: 'AI analyzes your content patterns, identifies optimization opportunities, and provides actionable insights for better global reach.',
                features: ['Content pattern analysis', 'Performance insights', 'ROI optimization', 'Predictive analytics'],
              },
            ].map((feature, i) => (
              <div key={i} className="ai-feature-card fade-in" ref={addFadeRef}>
                <div className="ai-feature-icon">
                  <i className={`fas ${feature.icon}`}></i>
                </div>
                <h3>{feature.title}</h3>
                <p>{feature.desc}</p>
                <ul className="feature-list">
                  {feature.features.map((f, j) => (
                    <li key={j}>{f}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ROI Calculator */}
      <section className="roi-calculator">
        <div className="container">
          <h2 className="section-title fade-in" ref={addFadeRef}>Calculate Your Translation ROI</h2>
          <p className="section-subtitle fade-in" ref={addFadeRef}>See how much time and money TRADUX can save your business</p>

          <div className="calculator-container fade-in" ref={addFadeRef}>
            <div className="calculator-form">
              <div className="calculator-input">
                <label htmlFor="current-cost">Current Monthly Translation Cost ($)</label>
                <input
                  type="number"
                  id="current-cost"
                  placeholder="5000"
                  value={currentCost}
                  onChange={(e) => setCurrentCost(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="calculator-input">
                <label htmlFor="monthly-words">Monthly Word Volume</label>
                <select id="monthly-words" value={monthlyWords} onChange={(e) => setMonthlyWords(parseInt(e.target.value))}>
                  <option value={50000}>50k words</option>
                  <option value={100000}>100k words</option>
                  <option value={200000}>200k words</option>
                  <option value={500000}>500k+ words</option>
                </select>
              </div>
              <div className="calculator-input">
                <label htmlFor="team-size">Team Size</label>
                <select id="team-size" value={teamSize} onChange={(e) => setTeamSize(parseInt(e.target.value))}>
                  <option value={5}>1-5 people</option>
                  <option value={20}>6-20 people</option>
                  <option value={50}>21-50 people</option>
                  <option value={100}>50+ people</option>
                </select>
              </div>
              <div className="calculator-input">
                <label htmlFor="languages">Number of Languages</label>
                <select id="languages" value={languages} onChange={(e) => setLanguages(parseInt(e.target.value))}>
                  <option value={5}>1-5 languages</option>
                  <option value={15}>6-15 languages</option>
                  <option value={25}>16-25 languages</option>
                  <option value={50}>25+ languages</option>
                </select>
              </div>
            </div>

            <div className="calculator-results">
              <h3>Your Potential Savings with TRADUX</h3>
              <div className="roi-metric">
                <span className="roi-number">${monthlySavings.toLocaleString()}</span>
                <span className="roi-label">Monthly Savings</span>
              </div>
              <div className="roi-metric">
                <span className="roi-number">${annualSavings.toLocaleString()}</span>
                <span className="roi-label">Annual Savings</span>
              </div>
              <div className="roi-metric">
                <span className="roi-number">{timeSaved}</span>
                <span className="roi-label">Hours Saved/Month</span>
              </div>
              <div className="roi-metric">
                <span className="roi-number">{roiPercentage}%</span>
                <span className="roi-label">Cost Reduction</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Free Trial Section */}
      <section className="free-trial">
        <div className="container">
          <div className="trial-content fade-in" ref={addFadeRef}>
            <h2>Start Your Free Enterprise Trial</h2>
            <p>Experience the power of TRADUX with a full-featured 14-day trial. No credit card required, no setup fees.</p>

            <div className="trial-features">
              {[
                { icon: 'fa-rocket', title: 'Instant Setup', desc: 'Get started in under 5 minutes' },
                { icon: 'fa-shield-alt', title: 'Full Security', desc: 'Enterprise-grade protection' },
                { icon: 'fa-headset', title: 'Priority Support', desc: 'Dedicated success manager' },
                { icon: 'fa-infinity', title: 'Unlimited Access', desc: 'All features included' },
              ].map((item, i) => (
                <div key={i} className="trial-feature">
                  <div className="trial-feature-icon">
                    <i className={`fas ${item.icon}`}></i>
                  </div>
                  <h4>{item.title}</h4>
                  <p>{item.desc}</p>
                </div>
              ))}
            </div>

            <div className="cta-buttons">
              <a href="#demo-form" className="btn-white" onClick={(e) => scrollToSection(e, 'demo-form')}>
                <i className="fas fa-play"></i>
                Start Free Trial
              </a>
              <a href="#contact" className="btn-outline" onClick={(e) => scrollToSection(e, 'contact')}>
                <i className="fas fa-calendar"></i>
                Book Demo Call
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Enterprise Plans */}
      <section id="plans" className="enterprise-plans">
        <div className="container">
          <h2 className="section-title fade-in" ref={addFadeRef}>Enterprise Plans</h2>
          <p className="section-subtitle fade-in" ref={addFadeRef}>Flexible solutions designed to meet your organization's unique needs</p>

          <div className="plans-grid">
            <div className="plan-card fade-in" ref={addFadeRef}>
              <h3 className="plan-name">Business</h3>
              <div className="plan-price">$299</div>
              <div className="plan-billing">per month</div>
              <ul className="plan-features">
                <li>Up to 50,000 words/month</li>
                <li>5 team members</li>
                <li>API access</li>
                <li>Basic analytics</li>
                <li>Email support</li>
                <li>Translation memory</li>
              </ul>
              <button className="plan-cta" onClick={() => handlePlanClick('Business')}>Start Business Plan</button>
            </div>

            <div className="plan-card featured fade-in" ref={addFadeRef}>
              <h3 className="plan-name">Enterprise</h3>
              <div className="plan-price">$999</div>
              <div className="plan-billing">per month</div>
              <ul className="plan-features">
                <li>Up to 200,000 words/month</li>
                <li>Unlimited team members</li>
                <li>Advanced API & webhooks</li>
                <li>Advanced analytics</li>
                <li>Priority support</li>
                <li>Custom integrations</li>
                <li>SSO & SAML</li>
                <li>Dedicated success manager</li>
              </ul>
              <button className="plan-cta" onClick={() => handlePlanClick('Enterprise')}>Start Enterprise Plan</button>
            </div>

            <div className="plan-card fade-in" ref={addFadeRef}>
              <h3 className="plan-name">Custom</h3>
              <div className="plan-price">Custom</div>
              <div className="plan-billing">pricing</div>
              <ul className="plan-features">
                <li>Unlimited words</li>
                <li>White-label solution</li>
                <li>On-premise deployment</li>
                <li>Custom SLA</li>
                <li>24/7 phone support</li>
                <li>Custom training</li>
                <li>Compliance certifications</li>
                <li>Dedicated infrastructure</li>
              </ul>
              <button className="plan-cta" onClick={() => handlePlanClick('Custom')}>Contact Sales</button>
            </div>
          </div>
        </div>
      </section>

      {/* Case Studies */}
      <section id="case-studies" className="case-studies">
        <div className="container">
          <h2 className="section-title fade-in" ref={addFadeRef}>Enterprise Success Stories</h2>
          <p className="section-subtitle fade-in" ref={addFadeRef}>See how leading companies transformed their global operations</p>

          <div className="case-grid">
            <div className="case-card fade-in" ref={addFadeRef}>
              <div className="case-logo">TechCorp</div>
              <h3>Global Software Company</h3>
              <p>"TRADUX helped us localize our software into 25 languages while reducing translation costs by 65%. The API integration was seamless and their quality is consistently excellent."</p>
              <div className="case-results">
                <div className="result-item">
                  <div className="result-number">65%</div>
                  <div className="result-label">Cost Reduction</div>
                </div>
                <div className="result-item">
                  <div className="result-number">25</div>
                  <div className="result-label">Languages</div>
                </div>
                <div className="result-item">
                  <div className="result-number">50%</div>
                  <div className="result-label">Faster TTM</div>
                </div>
                <div className="result-item">
                  <div className="result-number">99.5%</div>
                  <div className="result-label">Quality Score</div>
                </div>
              </div>
            </div>

            <div className="case-card fade-in" ref={addFadeRef}>
              <div className="case-logo">MedDev</div>
              <h3>Medical Device Manufacturer</h3>
              <p>"For regulatory compliance, we needed perfect translations of medical documentation. TRADUX's specialized medical translators and quality assurance exceeded our expectations."</p>
              <div className="case-results">
                <div className="result-item">
                  <div className="result-number">100%</div>
                  <div className="result-label">Regulatory Approval</div>
                </div>
                <div className="result-item">
                  <div className="result-number">15</div>
                  <div className="result-label">Countries</div>
                </div>
                <div className="result-item">
                  <div className="result-number">30%</div>
                  <div className="result-label">Time Savings</div>
                </div>
                <div className="result-item">
                  <div className="result-number">Zero</div>
                  <div className="result-label">Compliance Issues</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="container">
          <div className="cta-content">
            <h2>Ready to Scale Your Global Operations?</h2>
            <p>Join 500+ enterprise customers who trust TRADUX for their mission-critical translations. Start your free trial today.</p>
            <div className="cta-buttons">
              <a href="#demo-form" className="btn-white" onClick={(e) => scrollToSection(e, 'demo-form')}>
                <i className="fas fa-calendar"></i>
                Book Demo
              </a>
              <a href="#contact" className="btn-outline" onClick={(e) => scrollToSection(e, 'contact')}>
                <i className="fas fa-phone"></i>
                Talk to Sales
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact">
        <div className="container">
          <div className="footer-content">
            <div className="footer-section">
              <h3>TRADUX Business</h3>
              <p>Enterprise AI-powered translation solutions for global companies.</p>
              <p><i className="fas fa-envelope"></i> enterprise@tradux.online</p>
              <p><i className="fas fa-phone"></i> +1 (689) 309-4980</p>
            </div>
            <div className="footer-section">
              <h3>Solutions</h3>
              <a href="#solutions" onClick={(e) => scrollToSection(e, 'solutions')}>Enterprise Translation</a>
              <a href="#plans" onClick={(e) => scrollToSection(e, 'plans')}>API Integration</a>
              <a href="#case-studies" onClick={(e) => scrollToSection(e, 'case-studies')}>White-label</a>
              <a href="#contact" onClick={(e) => scrollToSection(e, 'contact')}>Custom Solutions</a>
            </div>
            <div className="footer-section">
              <h3>Resources</h3>
              <a href="#" onClick={(e) => { e.preventDefault(); toast.info('Documentation coming soon!'); }}>Documentation</a>
              <a href="#" onClick={(e) => { e.preventDefault(); toast.info('API Reference coming soon!'); }}>API Reference</a>
              <a href="#" onClick={(e) => { e.preventDefault(); toast.info('Best Practices coming soon!'); }}>Best Practices</a>
              <a href="#roi-calc" onClick={(e) => { e.preventDefault(); document.querySelector('.roi-calculator')?.scrollIntoView({ behavior: 'smooth' }); }}>ROI Calculator</a>
            </div>
            <div className="footer-section">
              <h3>Company</h3>
              <a href="#" onClick={(e) => { e.preventDefault(); toast.info('About Us page coming soon!'); }}>About Us</a>
              <a href="#" onClick={(e) => { e.preventDefault(); toast.info('Security page coming soon!'); }}>Security</a>
              <a href="#" onClick={(e) => { e.preventDefault(); toast.info('Compliance page coming soon!'); }}>Compliance</a>
              <a href="#contact" onClick={(e) => scrollToSection(e, 'contact')}>Contact Sales</a>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; {currentYear} TRADUX Business. All rights reserved. | Enterprise translation solutions.</p>
          </div>
        </div>
      </footer>
    </>
  );
}
