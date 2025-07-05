/*
 * TRADUX AI - Main JavaScript
 * Author: Manus AI
 * Date: July 3, 2025
 */

document.addEventListener('DOMContentLoaded', function() {
    // Initialize all components
    initHeader();
    initFAQ();
    initTestimonialSlider();
    initOrderForm();
    initMobileMenu();
});

// Header scroll effect
function initHeader() {
    const header = document.querySelector('.header');
    
    window.addEventListener('scroll', function() {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });
}

// FAQ accordion
function initFAQ() {
    const faqItems = document.querySelectorAll('.faq-item');
    
    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        
        question.addEventListener('click', function() {
            // Close all other items
            faqItems.forEach(otherItem => {
                if (otherItem !== item) {
                    otherItem.classList.remove('active');
                }
            });
            
            // Toggle current item
            item.classList.toggle('active');
        });
    });
    
    // Open first FAQ item by default
    if (faqItems.length > 0) {
        faqItems[0].classList.add('active');
    }
}

// Testimonial slider
function initTestimonialSlider() {
    const testimonials = document.querySelectorAll('.testimonial');
    const dots = document.querySelectorAll('.dot');
    const prevBtn = document.querySelector('.prev-btn');
    const nextBtn = document.querySelector('.next-btn');
    let currentIndex = 0;
    
    // Hide all testimonials except the first one
    testimonials.forEach((testimonial, index) => {
        if (index !== 0) {
            testimonial.style.display = 'none';
        }
    });
    
    // Next button click
    nextBtn.addEventListener('click', function() {
        testimonials[currentIndex].style.display = 'none';
        dots[currentIndex].classList.remove('active');
        
        currentIndex = (currentIndex + 1) % testimonials.length;
        
        testimonials[currentIndex].style.display = 'block';
        dots[currentIndex].classList.add('active');
    });
    
    // Previous button click
    prevBtn.addEventListener('click', function() {
        testimonials[currentIndex].style.display = 'none';
        dots[currentIndex].classList.remove('active');
        
        currentIndex = (currentIndex - 1 + testimonials.length) % testimonials.length;
        
        testimonials[currentIndex].style.display = 'block';
        dots[currentIndex].classList.add('active');
    });
    
    // Dot clicks
    dots.forEach((dot, index) => {
        dot.addEventListener('click', function() {
            if (index !== currentIndex) {
                testimonials[currentIndex].style.display = 'none';
                dots[currentIndex].classList.remove('active');
                
                currentIndex = index;
                
                testimonials[currentIndex].style.display = 'block';
                dots[currentIndex].classList.add('active');
            }
        });
    });
}

// Order form functionality
function initOrderForm() {
    // Step navigation
    const nextButtons = document.querySelectorAll('.next-step');
    const prevButtons = document.querySelectorAll('.prev-step');
    
    nextButtons.forEach(button => {
        button.addEventListener('click', function() {
            const currentStep = this.closest('.order-step');
            const nextStepId = this.getAttribute('data-next');
            const nextStep = document.getElementById(nextStepId);
            
            currentStep.classList.remove('active');
            nextStep.classList.add('active');
            
            updateOrderSummary();
        });
    });
    
    prevButtons.forEach(button => {
        button.addEventListener('click', function() {
            const currentStep = this.closest('.order-step');
            const prevStepId = this.getAttribute('data-prev');
            const prevStep = document.getElementById(prevStepId);
            
            currentStep.classList.remove('active');
            prevStep.classList.add('active');
        });
    });
    
    // Service selection
    const serviceOptions = document.querySelectorAll('input[name="service"]');
    serviceOptions.forEach(option => {
        option.addEventListener('change', function() {
            const serviceType = this.value;
            
            // Show/hide appropriate quantity fields
            const pagesField = document.getElementById('pages-field');
            const wordsField = document.getElementById('words-field');
            
            if (serviceType === 'certified') {
                pagesField.style.display = 'block';
                wordsField.style.display = 'none';
            } else {
                pagesField.style.display = 'none';
                wordsField.style.display = 'block';
            }
            
            updateOrderSummary();
        });
    });
    
    // Quantity buttons
    const quantityBtns = document.querySelectorAll('.quantity-btn');
    quantityBtns.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            
            const field = this.getAttribute('data-field');
            const input = document.getElementById(field);
            const currentValue = parseInt(input.value);
            
            if (this.classList.contains('plus')) {
                input.value = currentValue + 1;
            } else if (this.classList.contains('minus')) {
                if (field === 'pages' && currentValue > 1) {
                    input.value = currentValue - 1;
                } else if (field === 'words' && currentValue > 100) {
                    input.value = currentValue - 100;
                }
            }
            
            updateOrderSummary();
        });
    });
    
    // Quantity input change
    const quantityInputs = document.querySelectorAll('#pages, #words');
    quantityInputs.forEach(input => {
        input.addEventListener('change', function() {
            if (this.id === 'pages' && this.value < 1) {
                this.value = 1;
            } else if (this.id === 'words' && this.value < 100) {
                this.value = 100;
            }
            
            updateOrderSummary();
        });
    });
    
    // Delivery option selection
    const deliveryOptions = document.querySelectorAll('input[name="delivery"]');
    deliveryOptions.forEach(option => {
        option.addEventListener('change', function() {
            updateOrderSummary();
        });
    });
    
    // Language selection
    const languageSelects = document.querySelectorAll('#from-language, #to-language');
    languageSelects.forEach(select => {
        select.addEventListener('change', function() {
            updateOrderSummary();
        });
    });
    
    // File upload
    const fileInput = document.getElementById('file-upload');
    const fileName = document.getElementById('file-name');
    const uploadArea = document.getElementById('upload-area');
    
    fileInput.addEventListener('change', function() {
        if (this.files.length > 0) {
            fileName.textContent = this.files[0].name;
            uploadArea.classList.add('has-file');
        } else {
            fileName.textContent = '';
            uploadArea.classList.remove('has-file');
        }
    });
    
    // Drag and drop for file upload
    uploadArea.addEventListener('dragover', function(e) {
        e.preventDefault();
        this.classList.add('dragover');
    });
    
    uploadArea.addEventListener('dragleave', function() {
        this.classList.remove('dragover');
    });
    
    uploadArea.addEventListener('drop', function(e) {
        e.preventDefault();
        this.classList.remove('dragover');
        
        if (e.dataTransfer.files.length > 0) {
            fileInput.files = e.dataTransfer.files;
            fileName.textContent = e.dataTransfer.files[0].name;
            uploadArea.classList.add('has-file');
        }
    });
    
    // Order confirmation buttons
    const confirmOrderBtn = document.getElementById('submit-order');
    const summaryConfirmBtn = document.getElementById('summary-confirm');
    
    confirmOrderBtn.addEventListener('click', function(e) {
        e.preventDefault();
        submitOrder();
    });
    
    summaryConfirmBtn.addEventListener('click', function(e) {
        e.preventDefault();
        submitOrder();
    });
    
    // Contact support button
    const contactSupportBtn = document.getElementById('summary-contact');
    contactSupportBtn.addEventListener('click', function(e) {
        e.preventDefault();
        window.location.href = '#contact';
    });
    
    // Service selection from service section
    const serviceLinks = document.querySelectorAll('.service-card .btn');
    serviceLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            const serviceType = this.getAttribute('data-service');
            const serviceRadio = document.getElementById('service-' + serviceType);
            
            if (serviceRadio) {
                serviceRadio.checked = true;
                
                // Trigger change event
                const event = new Event('change');
                serviceRadio.dispatchEvent(event);
            }
        });
    });
    
    // Initialize order summary
    updateOrderSummary();
}

// Update order summary based on selections
function updateOrderSummary() {
    const summaryService = document.getElementById('summary-service');
    const summaryAmount = document.getElementById('summary-amount');
    const summaryDelivery = document.getElementById('summary-delivery');
    const summaryLanguages = document.getElementById('summary-languages');
    const summaryPrice = document.getElementById('summary-price');
    
    // Get selected service
    const selectedService = document.querySelector('input[name="service"]:checked');
    let serviceName = 'USA Certified';
    let basePrice = 23.99;
    let priceUnit = 'per page';
    
    if (selectedService) {
        if (selectedService.value === 'technical') {
            serviceName = 'Technical Translation';
            basePrice = 0.04;
            priceUnit = 'per word';
        } else if (selectedService.value === 'express') {
            serviceName = 'Express Translation';
            basePrice = 0.05;
            priceUnit = 'per word';
        }
    }
    
    summaryService.textContent = serviceName;
    
    // Get quantity
    let quantity = 1;
    let quantityUnit = 'page';
    
    if (selectedService && selectedService.value === 'certified') {
        quantity = parseInt(document.getElementById('pages').value) || 1;
        quantityUnit = quantity === 1 ? 'page' : 'pages';
    } else {
        quantity = parseInt(document.getElementById('words').value) || 100;
        quantityUnit = 'words';
    }
    
    summaryAmount.textContent = quantity + ' ' + quantityUnit;
    
    // Get delivery option
    const selectedDelivery = document.querySelector('input[name="delivery"]:checked');
    let deliveryText = '24 hours (Standard)';
    let deliveryMultiplier = 1;
    
    if (selectedDelivery) {
        if (selectedDelivery.value === 'fast') {
            deliveryText = '12 hours (Fast)';
            deliveryMultiplier = 1.5;
        } else if (selectedDelivery.value === 'urgent') {
            deliveryText = '4 hours (Urgent)';
            deliveryMultiplier = 2;
        }
    }
    
    summaryDelivery.textContent = deliveryText;
    
    // Get languages
    const fromLanguage = document.getElementById('from-language');
    const toLanguage = document.getElementById('to-language');
    
    let fromText = 'Auto';
    let toText = 'English';
    
    if (fromLanguage && fromLanguage.selectedOptions[0]) {
        fromText = fromLanguage.selectedOptions[0].text.split(' ')[1] || 'Auto';
    }
    
    if (toLanguage && toLanguage.selectedOptions[0]) {
        toText = toLanguage.selectedOptions[0].text.split(' ')[1] || 'English';
    }
    
    summaryLanguages.textContent = fromText + ' → ' + toText;
    
    // Calculate total price
    let totalPrice = basePrice * quantity * deliveryMultiplier;
    summaryPrice.textContent = '$' + totalPrice.toFixed(2);
}

// Submit order function
function submitOrder() {
    alert('Thank you for your order! We will process it immediately.');
    
    // Reset form
    document.querySelectorAll('.order-step').forEach(step => {
        step.classList.remove('active');
    });
    
    document.getElementById('step-1').classList.add('active');
    
    // Clear file upload
    document.getElementById('file-upload').value = '';
    document.getElementById('file-name').textContent = '';
    document.getElementById('upload-area').classList.remove('has-file');
    
    // Clear text area
    document.getElementById('translation-text').value = '';
    
    // Reset form fields
    document.getElementById('full-name').value = '';
    document.getElementById('email').value = '';
    document.getElementById('phone').value = '';
    document.getElementById('special-instructions').value = '';
    
    // Scroll to top of order form
    document.getElementById('order-form').scrollIntoView({ behavior: 'smooth' });
}

// Mobile menu
function initMobileMenu() {
    const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
    const navLinks = document.querySelector('.nav-links');
    
    mobileMenuToggle.addEventListener('click', function() {
        this.classList.toggle('active');
        navLinks.classList.toggle('active');
    });
    
    // Close mobile menu when clicking on a link
    const navLinksItems = document.querySelectorAll('.nav-links a');
    navLinksItems.forEach(link => {
        link.addEventListener('click', function() {
            mobileMenuToggle.classList.remove('active');
            navLinks.classList.remove('active');
        });
    });
}

