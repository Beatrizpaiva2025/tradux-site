// Header scroll effect
window.addEventListener('scroll', function() {
  const header = document.getElementById('header');
  if (window.scrollY > 100) {
    header.classList.add('scrolled');
  } else {
    header.classList.remove('scrolled');
  }
});

// Enterprise form submission
function submitEnterpriseForm(event) {
  event.preventDefault();
  const submitBtn = event.target.querySelector('.submit-enterprise-btn');
  const originalText = submitBtn.innerHTML;

  // Show loading state
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
  submitBtn.disabled = true;
  submitBtn.classList.add('loading');

  // Simulate processing
  setTimeout(() => {
    submitBtn.innerHTML = '<i class="fas fa-check"></i> Quote Sent!';
    submitBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';

    // Show success message
    alert('Thank you! Your enterprise quote request has been sent. Our sales team will contact you within 1 hour to discuss your custom solution.');

    // Reset form
    setTimeout(() => {
      event.target.reset();
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
      submitBtn.classList.remove('loading');
      submitBtn.style.background = '';
    }, 3000);
  }, 2500);
}

// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      target.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  });
});

// Scroll animations
const observerOptions = {
  threshold: 0.1,
  rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('animated');
    }
  });
}, observerOptions);

// Observe all elements with animation class
document.querySelectorAll('.fade-in').forEach(el => {
  observer.observe(el);
});

// Add loading animation to buttons
document.querySelectorAll('.cta-btn, .plan-cta').forEach(btn => {
  btn.addEventListener('click', function() {
    this.classList.add('loading');
    setTimeout(() => {
      this.classList.remove('loading');
    }, 500);
  });
});

// ROI Calculator functionality
function calculateROI() {
  const currentCost = parseFloat(document.getElementById('current-cost').value) || 5000;
  const monthlyWords = parseInt(document.getElementById('monthly-words').value) || 50000;
  const teamSize = parseInt(document.getElementById('team-size').value) || 5;
  const languages = parseInt(document.getElementById('languages').value) || 5;

  // TRADUX pricing calculation (simplified)
  const costPerWord = 0.02; // Average cost per word with TRADUX
  const newMonthlyCost = monthlyWords * costPerWord;
  const monthlySavings = currentCost - newMonthlyCost;
  const annualSavings = monthlySavings * 12;
  const timeSaved = Math.round(teamSize * languages * 2.5); // Hours saved per month
  const roiPercentage = Math.round((monthlySavings / currentCost) * 100);

  // Update display
  document.getElementById('monthly-savings').textContent = `$${monthlySavings.toLocaleString()}`;
  document.getElementById('annual-savings').textContent = `$${annualSavings.toLocaleString()}`;
  document.getElementById('time-saved').textContent = timeSaved;
  document.getElementById('roi-percentage').textContent = `${roiPercentage}%`;
}

// Add event listeners for ROI calculator
document.addEventListener('DOMContentLoaded', function() {
  const calculatorInputs = document.querySelectorAll('.calculator-input input, .calculator-input select');
  calculatorInputs.forEach(input => {
    input.addEventListener('change', calculateROI);
    input.addEventListener('input', calculateROI);
  });

  // Initial calculation
  calculateROI();
});

// Dynamic year update and final initialization
document.addEventListener('DOMContentLoaded', function() {
  const currentYear = new Date().getFullYear();
  const footerBottom = document.querySelector('.footer-bottom p');
  if (footerBottom) {
    footerBottom.innerHTML = `&copy; ${currentYear} TRADUX Business. All rights reserved. | Enterprise translation solutions.`;
  }
});
