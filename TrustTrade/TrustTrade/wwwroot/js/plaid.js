// UPDATED VERSION - March 9, 2025
// Version 2.1 - with delete functionality and update connection improvements

// Add a version log to verify we're running the latest code
console.log("Running plaid.js version 2.1 - with delete functionality");

// Initialize the Plaid Link handler
let linkHandler = null;

async function initializePlaidLink() {
    try {
        const response = await fetch('/api/plaid/create-link-token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            // Add cache-busting query parameter
            cache: 'no-store'
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Error from server:', errorData);
            throw new Error(errorData.error || 'Failed to get link token');
        }

        const data = await response.json();

        if (!data.linkToken) {
            console.error('No link token in response:', data);
            throw new Error('Invalid server response - no link token');
        }

        // Initialize Plaid Link
        linkHandler = Plaid.create({
            token: data.linkToken,
            onSuccess: async (public_token, metadata) => {
                console.log('Link success - exchanging public token');
                try {
                    // First, exchange the public token
                    const exchangeResponse = await fetch('/api/plaid/exchange-public-token', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({publicToken: public_token})
                    });

                    if (!exchangeResponse.ok) {
                        const errorData = await exchangeResponse.json();
                        console.error('Server error:', errorData);
                        throw new Error(errorData.error || 'Failed to exchange public token');
                    }

                    const exchangeData = await exchangeResponse.json();
                    if (exchangeData.success) {
                        // NEW DISTINCTIVE MESSAGE to verify this code is running
                        alert('VERSION 2.1: Account linked! Now refreshing your holdings...');

                        // Directly submit form to refresh holdings
                        const formData = new FormData();

                        // Get any CSRF token that might be on the page
                        const tokenElement = document.querySelector('input[name="__RequestVerificationToken"]');
                        if (tokenElement) {
                            formData.append('__RequestVerificationToken', tokenElement.value);
                        }

                        // Log that we're about to refresh
                        console.log('Submitting refresh request to /Profile/RefreshHoldings');

                        // Use fetch for the refresh request
                        fetch('/Profile/RefreshHoldings', {
                            method: 'POST',
                            body: formData,
                            credentials: 'same-origin',
                            redirect: 'follow'
                        }).then(response => {
                            console.log('Refresh request completed with status:', response.status);
                            if (response.redirected) {
                                console.log('Redirecting to:', response.url);
                                window.location.href = response.url;
                            } else {
                                // If not redirected automatically, redirect to Profile
                                console.log('No redirect detected, manually navigating to /Profile');
                                window.location.href = '/Profile';
                            }
                        }).catch(error => {
                            console.error('Error during refresh:', error);
                            // Still redirect to profile
                            window.location.href = '/Profile';
                        });
                    } else {
                        throw new Error('Failed to process brokerage connection');
                    }
                } catch (error) {
                    console.error('Error exchanging public token:', error);
                    alert('There was an error connecting your account. Please try again.');
                }
            },
            onExit: (err, metadata) => {
                console.log('Link exit:', err, metadata);
                if (err != null) {
                    console.error('Link error:', err);
                    alert('Error connecting to Plaid. Please try again.');
                }
            },
            onEvent: (eventName, metadata) => {
                console.log('Link Event:', eventName, metadata);
            },
        });
    } catch (error) {
        console.error('Error initializing Plaid Link:', error);
        alert('Error initializing Plaid connection. Please try again later.');
    }
}

// Function to launch Plaid Link
function openPlaidLink() {
    if (linkHandler) {
        linkHandler.open();
    } else {
        console.error('Plaid Link not initialized');
        // Try to reinitialize
        initializePlaidLink().then(() => {
            if (linkHandler) {
                linkHandler.open();
            } else {
                alert('Unable to initialize Plaid connection. Please refresh the page and try again.');
            }
        });
    }
}

// Function to delete Plaid connection
async function deletePlaidConnection() {
    try {
        const confirmed = confirm("Are you sure you want to delete your brokerage connection? This will remove all your portfolio data.");

        if (!confirmed) {
            return false;
        }

        // Show loading state
        document.body.style.cursor = 'wait';

        const response = await fetch('/Brokerage/DeleteConnection', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            credentials: 'same-origin'
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Error deleting connection:', errorData);
            throw new Error(errorData.error || 'Failed to delete connection');
        }

        const data = await response.json();
        return data.success;
    } catch (error) {
        console.error('Error deleting Plaid connection:', error);
        alert('Error deleting connection. Please try again.');
        return false;
    } finally {
        document.body.style.cursor = 'default';
    }
}

// Initialize when the page loads
document.addEventListener('DOMContentLoaded', () => {
    const connectPlaidButton = document.getElementById('connect-plaid');
    const updatePlaidButton = document.getElementById('update-plaid');
    const deletePlaidButton = document.getElementById('delete-plaid');

    // Initialize Plaid Link for any button that might use it
    if (connectPlaidButton || updatePlaidButton) {
        initializePlaidLink();
    }

    // Regular connection button (new users)
    if (connectPlaidButton) {
        connectPlaidButton.addEventListener('click', openPlaidLink);
    }

    // Update connection button (existing users)
    if (updatePlaidButton) {
        updatePlaidButton.addEventListener('click', async (event) => {
            event.preventDefault();

            // First delete existing connection
            const deleteSuccess = await deletePlaidConnection();

            if (deleteSuccess) {
                // Then open Plaid Link to create a new connection
                openPlaidLink();
            }
        });
    }

    // Delete connection button
    if (deletePlaidButton) {
        deletePlaidButton.addEventListener('click', async (event) => {
            event.preventDefault();

            // Delete connection
            const deleteSuccess = await deletePlaidConnection();

            // Refresh the page to show updated UI
            if (deleteSuccess) {
                window.location.reload();
            }
        });
    }
});