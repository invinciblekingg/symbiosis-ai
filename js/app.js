import { db } from './firebase-config.js';
import { collection, addDoc, getDocs, setDoc, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { registerUser, monitorAuthState, logoutUser } from './auth.js';
import { Chatbot } from './chatbot.js';

// Global State
let currentUser = null;
let chatbotInstance = null;

// --- Form Handling ---
function createRepresentativeRow() {
    const div = document.createElement('div');
    div.className = 'dynamic-list-item';
    div.innerHTML = `
        <div class="form-group">
            <label>Name *</label>
            <input type="text" name="repName" required>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>Phone *</label>
                <input type="tel" name="repPhone" pattern="[0-9]{10}" placeholder="9876543210" required>
            </div>
            <div class="form-group">
                <label>Email *</label>
                <input type="email" name="repEmail" required>
            </div>
        </div>
        <button type="button" class="remove-btn">Remove Representative</button>
    `;
    div.querySelector('.remove-btn').addEventListener('click', function () {
        this.parentElement.remove();
    });
    return div;
}

function createMaterialRow(type = 'material') {
    const div = document.createElement('div');
    div.className = 'dynamic-list-item';

    let options = '';
    if (type === 'material') {
        options = `
            <option value="Organic Waste">Organic Waste</option>
            <option value="Scrap Metal">Scrap Metal</option>
            <option value="Plastic Waste">Plastic Waste</option>
            <option value="Paper Waste">Paper Waste</option>
            <option value="Textile Scraps">Textile Scraps</option>
            <option value="Fly Ash">Fly Ash</option>
            <option value="Construction Debris">Construction Debris</option>
            <option value="E-waste">E-waste</option>
        `;
    } else if (type === 'waste') {
        options = `
            <option value="Vegetable Peels">Vegetable Peels</option>
            <option value="Plastic Scrap">Plastic Scrap</option>
            <option value="Metal Scrap">Metal Scrap</option>
            <option value="Sludge">Sludge</option>
            <option value="Ash">Ash</option>
            <option value="Glass Waste">Glass Waste</option>
        `;
    } else {
        options = `
            <option value="Wastewater">Wastewater</option>
            <option value="Heat/Energy">Heat/Energy</option>
            <option value="Carbon Dioxide">Carbon Dioxide</option>
            <option value="Ash">Ash</option>
        `;
    }

    div.innerHTML = `
        <div class="form-grid-4">
            <div class="form-group" style="margin-bottom: 0;">
                <label>Type</label>
                <select name="${type}Type" required>
                    <option value="" disabled selected>Select Type</option>
                    ${options}
                </select>
            </div>
            <div class="form-group" style="margin-bottom: 0;">
                <label>Min Qty</label>
                <input type="number" name="${type}Min" placeholder="Min" required>
            </div>
            <div class="form-group" style="margin-bottom: 0;">
                <label>Max Qty</label>
                <input type="number" name="${type}Max" placeholder="Max" required>
            </div>
            <div class="form-group" style="margin-bottom: 0;">
                <label>Unit</label>
                <select name="${type}Unit">
                    <option value="Tons/Month">Tons/Month</option>
                    <option value="Kg/Month">Kg/Month</option>
                    <option value="Cubic Meters/Month">m³/Month</option>
                </select>
            </div>
        </div>
        <button type="button" class="remove-btn">Remove</button>
    `;
    div.querySelector('.remove-btn').addEventListener('click', function () {
        this.parentElement.remove();
    });
    return div;
}

function initForm() {
    const form = document.getElementById('registerForm');
    if (!form) return;

    // Check URL params for mode
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');
    const isCompleteProfile = mode === 'complete_profile';

    // If completing profile, hide account fields and change button text
    if (isCompleteProfile) {
        const accountSection = document.getElementById('accountSection');
        if (accountSection) accountSection.style.display = 'none';

        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.innerText = 'Complete Profile';

        document.getElementById('formTitle').innerText = 'Complete Company Profile';
    }

    if (document.getElementById('materialsContainer').children.length === 0) {
        document.getElementById('materialsContainer').appendChild(createMaterialRow('material'));
    }
    if (document.getElementById('majorWasteContainer').children.length === 0) {
        document.getElementById('majorWasteContainer').appendChild(createMaterialRow('waste'));
    }
    if (document.getElementById('byproductsContainer').children.length === 0) {
        document.getElementById('byproductsContainer').appendChild(createMaterialRow('byproduct'));
    }

    document.getElementById('addRepBtn').addEventListener('click', () => {
        document.getElementById('representativesContainer').appendChild(createRepresentativeRow());
    });
    document.getElementById('addMaterialBtn').addEventListener('click', () => {
        document.getElementById('materialsContainer').appendChild(createMaterialRow('material'));
    });
    document.getElementById('addMajorWasteBtn').addEventListener('click', () => {
        document.getElementById('majorWasteContainer').appendChild(createMaterialRow('waste'));
    });
    document.getElementById('addByproductBtn').addEventListener('click', () => {
        document.getElementById('byproductsContainer').appendChild(createMaterialRow('byproduct'));
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerText = 'Saving...';

        try {
            let uid;

            if (isCompleteProfile) {
                // User should be logged in already
                if (!currentUser) {
                    throw new Error("You must be logged in to complete your profile.");
                }
                uid = currentUser.uid;
            } else {
                // Legacy / Direct Registration Flow
                const email = document.getElementById('accountEmail').value;
                const password = document.getElementById('accountPassword').value;
                const user = await registerUser(email, password, "Admin", ""); // Default name/phone for legacy
                uid = user.uid;
            }

            const company = {
                uid: uid,
                name: document.getElementById('companyName').value,
                gst: document.getElementById('gstNumber').value,
                industry: document.getElementById('industryType').value,
                location: {
                    lat: parseFloat(document.getElementById('latitude').value),
                    lng: parseFloat(document.getElementById('longitude').value)
                },
                representatives: [],
                materials: [],
                waste: [],
                byproducts: [],
                updatedAt: new Date(),
                profileCompleted: true
            };

            // If completing profile, merge with existing data (like initial rep info)
            // For simplicity, we overwrite representatives here based on form, 
            // but we should probably pre-fill them if we wanted to be fancy.
            // Let's just overwrite for now as the form is the source of truth.

            document.querySelectorAll('#representativesContainer .dynamic-list-item').forEach(row => {
                company.representatives.push({
                    name: row.querySelector('[name="repName"]').value,
                    phone: row.querySelector('[name="repPhone"]').value,
                    email: row.querySelector('[name="repEmail"]').value
                });
            });

            document.querySelectorAll('#materialsContainer .dynamic-list-item').forEach(row => {
                company.materials.push({
                    type: row.querySelector('[name="materialType"]').value,
                    min: row.querySelector('[name="materialMin"]').value,
                    max: row.querySelector('[name="materialMax"]').value,
                    unit: row.querySelector('[name="materialUnit"]').value
                });
            });

            document.querySelectorAll('#majorWasteContainer .dynamic-list-item').forEach(row => {
                company.waste.push({
                    type: row.querySelector('[name="wasteType"]').value,
                    min: row.querySelector('[name="wasteMin"]').value,
                    max: row.querySelector('[name="wasteMax"]').value,
                    unit: row.querySelector('[name="wasteUnit"]').value
                });
            });

            document.querySelectorAll('#byproductsContainer .dynamic-list-item').forEach(row => {
                company.byproducts.push({
                    type: row.querySelector('[name="byproductType"]').value,
                    min: row.querySelector('[name="byproductMin"]').value,
                    max: row.querySelector('[name="byproductMax"]').value,
                    unit: row.querySelector('[name="byproductUnit"]').value
                });
            });

            // Use setDoc with merge: true to avoid losing initial data if any
            await setDoc(doc(db, "companies", uid), company, { merge: true });

            alert("Profile Saved Successfully!");
            window.location.href = 'dashboard.html';

        } catch (error) {
            console.error("Registration Error:", error);
            alert("Failed: " + error.message);
            submitBtn.disabled = false;
            submitBtn.innerText = isCompleteProfile ? 'Complete Profile' : 'Submit Company Registration';
        }
    });
}

// --- Dashboard Logic ---
async function initDashboard(user) {
    const dashboardContent = document.getElementById('dashboardContent');
    if (!dashboardContent) return; // Not on dashboard page

    const loading = document.getElementById('dashboardLoading');
    const noProfile = document.getElementById('noProfileContent');
    const welcome = document.getElementById('companyNameHeader');

    try {
        const docRef = doc(db, "companies", user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            welcome.innerText = `Welcome, ${data.name}`;

            // Populate Stats
            document.getElementById('statMaterials').innerText = data.materials.length;
            document.getElementById('statWaste').innerText = (data.waste.length + data.byproducts.length);

            // Populate Lists
            const matList = document.getElementById('myMaterialsList');
            matList.innerHTML = data.materials.map(m => `
                <li style="padding: 0.5rem 0; border-bottom: 1px solid #eee; display: flex; justify-content: space-between;">
                    <span>${m.type}</span>
                    <span style="color: #7f8c8d; font-size: 0.9rem;">${m.min}-${m.max} ${m.unit}</span>
                </li>
            `).join('');

            const wasteList = document.getElementById('myWasteList');
            const allWaste = [...data.waste, ...data.byproducts];
            wasteList.innerHTML = allWaste.map(w => `
                <li style="padding: 0.5rem 0; border-bottom: 1px solid #eee; display: flex; justify-content: space-between;">
                    <span>${w.type}</span>
                    <span style="color: #7f8c8d; font-size: 0.9rem;">${w.min}-${w.max} ${w.unit}</span>
                </li>
            `).join('');

            loading.style.display = 'none';
            dashboardContent.style.display = 'block';

            // Find Matches
            findMatches(data);

        } else {
            loading.style.display = 'none';
            noProfile.style.display = 'block';
            welcome.innerText = "Welcome";
        }
    } catch (error) {
        console.error("Error loading dashboard:", error);
        loading.innerText = "Error loading data.";
    }
}

async function findMatches(myProfile) {
    const container = document.getElementById('matchesContainer');
    if (!container) return;

    try {
        const querySnapshot = await getDocs(collection(db, "companies"));
        const matches = [];

        querySnapshot.forEach((doc) => {
            const other = doc.data();
            if (other.uid === myProfile.uid) return; // Skip self

            // Logic: 
            // 1. Do they have waste I need?
            // 2. Do they need waste I have?

            const myNeeds = myProfile.materials.map(m => m.type);
            const myWaste = [...myProfile.waste, ...myProfile.byproducts].map(w => w.type);

            const otherNeeds = other.materials.map(m => m.type);
            const otherWaste = [...other.waste, ...other.byproducts].map(w => w.type);

            const theyHaveWhatINeed = otherWaste.filter(w => myNeeds.includes(w));
            const iHaveWhatTheyNeed = myWaste.filter(w => otherNeeds.includes(w));

            if (theyHaveWhatINeed.length > 0 || iHaveWhatTheyNeed.length > 0) {
                matches.push({
                    company: other,
                    incoming: theyHaveWhatINeed,
                    outgoing: iHaveWhatTheyNeed
                });
            }
        });

        document.getElementById('statMatches').innerText = matches.length;

        if (matches.length === 0) {
            container.innerHTML = `<div style="text-align: center; color: #7f8c8d; padding: 2rem;">No matches found yet.</div>`;
            return;
        }

        container.innerHTML = matches.map(match => `
            <div class="company-card" style="margin-bottom: 1rem;">
                <div class="company-header">
                    <h4>${match.company.name}</h4>
                    <span style="font-size: 0.8rem;">${match.company.industry}</span>
                </div>
                <div class="company-body">
                    ${match.incoming.length > 0 ? `
                        <div style="margin-bottom: 0.5rem;">
                            <small style="color: var(--primary-green);">They can supply:</small>
                            <div>${match.incoming.map(i => `<span class="badge badge-green">${i}</span>`).join('')}</div>
                        </div>
                    ` : ''}
                    ${match.outgoing.length > 0 ? `
                        <div>
                            <small style="color: var(--primary-blue);">You can supply:</small>
                            <div>${match.outgoing.map(i => `<span class="badge badge-blue">${i}</span>`).join('')}</div>
                        </div>
                    ` : ''}
                    <button class="btn btn-outline view-details-btn" data-uid="${match.company.uid}" style="width: 100%; margin-top: 1rem; padding: 0.5rem;">Contact</button>
                </div>
            </div>
        `).join('');

        // Attach listeners
        container.querySelectorAll('.view-details-btn').forEach(btn => {
            btn.addEventListener('click', () => showCompanyDetails(matches.find(m => m.company.uid === btn.dataset.uid).company));
        });

    } catch (error) {
        console.error("Error matching:", error);
    }
}

// --- Browse Page Logic ---
async function initBrowse() {
    const grid = document.getElementById('companiesGrid');
    if (!grid) return;

    try {
        const querySnapshot = await getDocs(collection(db, "companies"));
        const companies = [];
        querySnapshot.forEach((doc) => {
            companies.push(doc.data());
        });

        if (companies.length === 0) {
            grid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 4rem;">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">🏭</div>
                    <h3>No companies registered yet.</h3>
                    <p>Be the first to join the network!</p>
                    <a href="register.html" class="btn btn-green mt-1">Register Company</a>
                </div>
            `;
            return;
        }

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const userLat = position.coords.latitude;
                    const userLng = position.coords.longitude;
                    document.getElementById('locationStatus').innerText = "📍 Location detected. Distances shown relative to you.";
                    renderCompanies(companies, userLat, userLng);
                },
                () => {
                    document.getElementById('locationStatus').innerText = "📍 Location denied. Distances not available.";
                    renderCompanies(companies, null, null);
                }
            );
        } else {
            renderCompanies(companies, null, null);
        }
    } catch (error) {
        console.error("Error fetching companies:", error);
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: red;">Error loading companies: ${error.message}</div>`;
    }
}

function renderCompanies(companies, userLat, userLng) {
    const grid = document.getElementById('companiesGrid');
    grid.innerHTML = '';

    companies.forEach(company => {
        let distanceText = '';
        if (userLat && userLng && company.location) {
            if (typeof window.calculateDistance === 'function') {
                const dist = window.calculateDistance(userLat, userLng, company.location.lat, company.location.lng);
                distanceText = `<div class="company-info-item" style="color: var(--primary-blue); font-weight: 600;">
                    <span>📍 Distance</span>
                    <span>${dist.toFixed(1)} km</span>
                </div>`;
            }
        }

        const card = document.createElement('div');
        card.className = 'company-card';
        card.innerHTML = `
            <div class="company-header">
                <h3 style="font-size: 1.25rem; margin-bottom: 0.25rem;">${company.name}</h3>
                <span style="font-size: 0.85rem; opacity: 0.9;">${company.industry}</span>
            </div>
            <div class="company-body">
                ${distanceText}
                <div class="company-info-item">
                    <span>Needs</span>
                    <span class="badge badge-blue">${company.materials.length} Materials</span>
                </div>
                <div class="company-info-item">
                    <span>Produces</span>
                    <span class="badge badge-green">${company.waste.length + company.byproducts.length} Waste Items</span>
                </div>
                <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #eee;">
                    <small style="display: block; color: #7f8c8d; margin-bottom: 0.5rem;">Major Waste:</small>
                    <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                        ${company.waste.slice(0, 3).map(w => `<span class="badge" style="background: #f0f0f0;">${w.type}</span>`).join('')}
                        ${company.waste.length > 3 ? `<span class="badge" style="background: #f0f0f0;">+${company.waste.length - 3}</span>` : ''}
                    </div>
                </div>
                <button class="btn btn-outline view-details-btn" style="width: 100%; margin-top: 1.5rem;">View Details</button>
            </div>
        `;

        card.querySelector('.view-details-btn').addEventListener('click', () => {
            showCompanyDetails(company);
        });

        grid.appendChild(card);
    });
}

function showCompanyDetails(company) {
    // Simple alert for now, or better, a modal.
    // Let's create a modal dynamically.
    let modal = document.getElementById('detailsModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'detailsModal';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center;
            z-index: 2000;
        `;
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div style="background: white; padding: 2rem; border-radius: 12px; max-width: 500px; width: 90%; max-height: 90vh; overflow-y: auto; position: relative;">
            <button onclick="document.getElementById('detailsModal').style.display='none'" style="position: absolute; top: 1rem; right: 1rem; border: none; background: none; font-size: 1.5rem; cursor: pointer;">&times;</button>
            <h2 style="color: var(--primary-blue); margin-bottom: 0.5rem;">${company.name}</h2>
            <p style="color: #7f8c8d; margin-bottom: 1.5rem;">${company.industry}</p>
            
            <h4 style="border-bottom: 1px solid #eee; padding-bottom: 0.5rem; margin-bottom: 1rem;">Contact Info</h4>
            ${company.representatives.map(rep => `
                <div style="margin-bottom: 0.5rem;">
                    <strong>${rep.name}</strong><br>
                    <a href="tel:${rep.phone}">${rep.phone}</a> | <a href="mailto:${rep.email}">${rep.email}</a>
                </div>
            `).join('')}

            <h4 style="border-bottom: 1px solid #eee; padding-bottom: 0.5rem; margin-bottom: 1rem; margin-top: 1.5rem;">Materials Needed</h4>
            <ul style="padding-left: 1.2rem;">
                ${company.materials.map(m => `<li>${m.type} (${m.min}-${m.max} ${m.unit})</li>`).join('')}
            </ul>

            <h4 style="border-bottom: 1px solid #eee; padding-bottom: 0.5rem; margin-bottom: 1rem; margin-top: 1.5rem;">Waste Available</h4>
            <ul style="padding-left: 1.2rem;">
                ${[...company.waste, ...company.byproducts].map(w => `<li>${w.type} (${w.min}-${w.max} ${w.unit})</li>`).join('')}
            </ul>
        </div>
    `;
    modal.style.display = 'flex';
}

// --- Auth State & Navigation ---
function updateNavigation(user) {
    const navLinks = document.querySelector('.nav-links');
    if (!navLinks) return;

    const existingAuthLinks = navLinks.querySelectorAll('.auth-link');
    existingAuthLinks.forEach(el => el.remove());

    if (user) {
        const logoutLink = document.createElement('a');
        logoutLink.href = "#";
        logoutLink.className = "auth-link";
        logoutLink.innerText = "Logout";
        logoutLink.addEventListener('click', (e) => {
            e.preventDefault();
            logoutUser();
        });
        navLinks.appendChild(logoutLink);

        // Update Dashboard User Name if on dashboard
        const userWelcome = document.getElementById('userWelcome');
        if (userWelcome) userWelcome.innerText = "Logged In"; // Will be updated by initDashboard

        // Logout button in dashboard nav
        const dbLogout = document.getElementById('logoutBtn');
        if (dbLogout) {
            dbLogout.addEventListener('click', (e) => {
                e.preventDefault();
                logoutUser();
            });
        }

    } else {
        const loginLink = document.createElement('a');
        loginLink.href = "login.html";
        loginLink.className = "auth-link";
        loginLink.innerText = "Login";
        navLinks.appendChild(loginLink);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initForm();
    initBrowse();

    monitorAuthState((user) => {
        currentUser = user;
        updateNavigation(user);

        if (user) {
            // Initialize Chatbot
            if (!chatbotInstance) {
                chatbotInstance = new Chatbot(user);
            }
            // Initialize Dashboard
            initDashboard(user);
        } else {
            // Redirect if on protected pages
            const path = window.location.pathname;
            if (path.includes('dashboard.html')) {
                window.location.href = 'login.html';
            }
        }
    });
});
