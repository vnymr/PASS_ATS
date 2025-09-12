// Authentication handler
const API_BASE = 'https://passats-production.up.railway.app';

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const showSignupLink = document.getElementById('showSignup');
    const showLoginLink = document.getElementById('showLogin');
    const loginFormElement = document.getElementById('loginFormElement');
    const signupFormElement = document.getElementById('signupFormElement');
    const errorMessage = document.getElementById('errorMessage');

    // Toggle between login and signup
    showSignupLink.addEventListener('click', (e) => {
        e.preventDefault();
        loginForm.classList.add('hidden');
        signupForm.classList.remove('hidden');
        errorMessage.classList.add('hidden');
    });

    showLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        signupForm.classList.add('hidden');
        loginForm.classList.remove('hidden');
        errorMessage.classList.add('hidden');
    });

    // Handle login
    loginFormElement.addEventListener('submit', async (e) => {
        e.preventDefault();
        const button = e.target.querySelector('button');
        button.classList.add('loading');
        errorMessage.classList.add('hidden');

        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        try {
            const response = await fetch(`${API_BASE}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok) {
                // Store auth token and user data
                await chrome.storage.local.set({
                    authToken: data.token,
                    userId: data.userId,
                    userEmail: email,
                    isAuthenticated: true,
                    hasCompletedOnboarding: data.hasCompletedOnboarding
                });

                // Redirect based on onboarding status
                if (data.hasCompletedOnboarding) {
                    window.location.href = 'sidepanel_new.html';
                } else {
                    window.location.href = 'onboarding.html';
                }
            } else {
                showError(data.error || 'Invalid email or password');
            }
        } catch (error) {
            showError('Unable to connect to server');
        } finally {
            button.classList.remove('loading');
        }
    });

    // Handle signup
    signupFormElement.addEventListener('submit', async (e) => {
        e.preventDefault();
        const button = e.target.querySelector('button');
        button.classList.add('loading');
        errorMessage.classList.add('hidden');

        const name = document.getElementById('signupName').value;
        const email = document.getElementById('signupEmail').value;
        const password = document.getElementById('signupPassword').value;

        try {
            const response = await fetch(`${API_BASE}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password })
            });

            const data = await response.json();

            if (response.ok) {
                // Store auth token and user data
                await chrome.storage.local.set({
                    authToken: data.token,
                    userId: data.userId,
                    userEmail: email,
                    userName: name,
                    isAuthenticated: true,
                    hasCompletedOnboarding: false
                });

                // Redirect to onboarding
                window.location.href = 'onboarding_new.html';
            } else {
                showError(data.error || 'Failed to create account');
            }
        } catch (error) {
            showError('Unable to connect to server');
        } finally {
            button.classList.remove('loading');
        }
    });

    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.classList.remove('hidden');
    }
});