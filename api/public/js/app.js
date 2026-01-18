// Global state
let currentEmail = null;
let currentApiKey = null;
let currentDashboardLink = null;

// Toastr configuration
toastr.options = {
    "closeButton": true,
    "progressBar": true,
    "positionClass": "toast-top-right",
    "timeOut": "5000"
};

// Theme toggle
function toggleTheme() {
    document.body.classList.toggle('dark-theme');
    const theme = document.body.classList.contains('dark-theme') ? 'dark' : 'light';
    localStorage.setItem('theme', theme);
    toastr.success(`Switched to ${theme} theme`);
}

// Load saved theme
window.onload = function() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
    }
};

// Create temporary email
async function createTempEmail() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const expires = document.getElementById('expires').value;
    
    if (password && password.length < 6) {
        toastr.error('Password must be at least 6 characters long');
        return;
    }
    
    const btn = document.querySelector('.btn-primary');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
    btn.disabled = true;
    
    try {
        const response = await fetch('/api/create-email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: username || undefined,
                password: password || undefined,
                expiresIn: parseInt(expires)
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Save data globally
            currentEmail = data.email;
            currentApiKey = data.api_key;
            currentDashboardLink = data.dashboard_link;
            
            // Update UI
            document.getElementById('generated-email').value = data.email;
            document.getElementById('expiry-time').textContent = formatExpiry(data.expires_at);
            document.getElementById('api-key').textContent = data.api_key;
            document.getElementById('dashboard-link').href = data.dashboard_link;
            
            // Generate QR code
            QRCode.toCanvas(document.getElementById('qr-code'), data.dashboard_link, {
                width: 200,
                height: 200,
                color: {
                    dark: '#4361ee',
                    light: '#ffffff'
                }
            });
            
            // Show result section
            document.getElementById('result').style.display = 'block';
            document.getElementById('result').scrollIntoView({ behavior: 'smooth' });
            
            toastr.success('Temporary email created successfully!');
            
            // Copy email to clipboard automatically
            copyEmail();
        } else {
            toastr.error(data.error || 'Failed to create email');
        }
    } catch (error) {
        console.error('Error:', error);
        toastr.error('Network error. Please try again.');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

// Copy email to clipboard
function copyEmail() {
    const emailInput = document.getElementById('generated-email');
    emailInput.select();
    emailInput.setSelectionRange(0, 99999); // For mobile devices
    
    try {
        navigator.clipboard.writeText(emailInput.value);
        toastr.success('Email address copied to clipboard!');
    } catch (err) {
        // Fallback for older browsers
        document.execCommand('copy');
        toastr.success('Email address copied to clipboard!');
    }
}

// Format expiry time
function formatExpiry(expiryDate) {
    const now = new Date();
    const expiry = new Date(expiryDate);
    const diffMs = expiry - now;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 1) {
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        return `${diffMinutes} minutes`;
    } else if (diffHours < 24) {
        return `${diffHours} hours`;
    } else {
        const diffDays = Math.floor(diffHours / 24);
        return `${diffDays} days`;
    }
}

// Show QR modal
function showQR() {
    document.getElementById('qr-modal').style.display = 'flex';
}

// Close QR modal
function closeQR() {
    document.getElementById('qr-modal').style.display = 'none';
}

// Show API modal
function showAPI() {
    document.getElementById('api-modal').style.display = 'flex';
}

// Close API modal
function closeAPI() {
    document.getElementById('api-modal').style.display = 'none';
}

// Close modals when clicking outside
window.onclick = function(event) {
    const qrModal = document.getElementById('qr-modal');
    const apiModal = document.getElementById('api-modal');
    
    if (event.target === qrModal) {
        qrModal.style.display = 'none';
    }
    if (event.target === apiModal) {
        apiModal.style.display = 'none';
    }
};

// Auto-refresh email list (for dashboard page)
if (window.location.pathname.includes('dashboard.html')) {
    let refreshInterval;
    
    async function loadEmails() {
        const urlParams = new URLSearchParams(window.location.search);
        const email = urlParams.get('email');
        const key = urlParams.get('key');
        
        if (!email || !key) {
            window.location.href = '/';
            return;
        }
        
        try {
            const response = await fetch(`/api/check-email?email=${encodeURIComponent(email)}&key=${key}`);
            const data = await response.json();
            
            if (data.success) {
                updateEmailList(data.emails);
                updateStats(data.stats);
            } else {
                toastr.error(data.error);
                if (data.error.includes('expired') || data.error.includes('Invalid')) {
                    setTimeout(() => window.location.href = '/', 3000);
                }
            }
        } catch (error) {
            console.error('Error loading emails:', error);
        }
    }
    
    function updateEmailList(emails) {
        const container = document.getElementById('emails-container');
        if (!container) return;
        
        if (emails.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-envelope-open"></i>
                    <h3>No emails yet</h3>
                    <p>Share your temporary email address to receive emails here</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = emails.map(email => `
            <div class="email-item ${email.is_read ? '' : 'unread'}" onclick="viewEmail('${email.id}')">
                <div class="email-header">
                    <strong>${email.from_email}</strong>
                    <span class="email-time">${new Date(email.received_at).toLocaleTimeString()}</span>
                </div>
                <div class="email-subject">${email.subject}</div>
                <div class="email-preview">${email.body_text.substring(0, 100)}...</div>
            </div>
        `).join('');
    }
    
    function updateStats(stats) {
        document.getElementById('total-emails').textContent = stats.total_received;
        document.getElementById('unread-count').textContent = stats.unread;
    }
    
    // Start auto-refresh every 10 seconds
    refreshInterval = setInterval(loadEmails, 10000);
    
    // Load emails on page load
    loadEmails();
    
    // Clear interval on page unload
    window.addEventListener('beforeunload', () => {
        clearInterval(refreshInterval);
    });
}
