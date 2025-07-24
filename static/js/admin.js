class AdminManager {
    constructor() {
        this.currentSection = 'employees';
        this.init();
    }

    init() {
        this.initNavigation();
        this.initModals();
        this.initEventListeners();
        this.loadInitialData();
    }

    initNavigation() {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const sectionName = btn.dataset.section;
                document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
                document.getElementById(`${sectionName}-section`).classList.add('active');
                
                this.currentSection = sectionName;
                this.loadSectionData(sectionName);
            });
        });
    }

    initModals() {
        // Initialisation des modals existants
        const modal = document.getElementById('addEmployeeModal');
        const addBtn = document.getElementById('addEmployeeBtn');
        const closeBtn = modal.querySelector('.modal-close');
        const cancelBtn = document.getElementById('cancelAddEmployee');
        const form = document.getElementById('addEmployeeForm');

        addBtn.addEventListener('click', () => modal.classList.add('active'));
        closeBtn.addEventListener('click', () => modal.classList.remove('active'));
        cancelBtn.addEventListener('click', () => modal.classList.remove('active'));
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('active');
        });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.addEmployee(new FormData(form));
            modal.classList.remove('active');
        });

        // Ajout du modal pour les jours fériés
        const holidayModal = document.getElementById('addHolidayModal');
        const addHolidayBtn = document.getElementById('addHolidayBtn');
        const closeHolidayBtn = holidayModal.querySelector('.modal-close');
        const cancelHolidayBtn = document.getElementById('cancelAddHoliday');
        const holidayForm = document.getElementById('addHolidayForm');

        addHolidayBtn.addEventListener('click', () => holidayModal.classList.add('active'));
        closeHolidayBtn.addEventListener('click', () => holidayModal.classList.remove('active'));
        cancelHolidayBtn.addEventListener('click', () => holidayModal.classList.remove('active'));
        
        holidayModal.addEventListener('click', (e) => {
            if (e.target === holidayModal) holidayModal.classList.remove('active');
        });

        holidayForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.addHoliday(new FormData(holidayForm));
            holidayModal.classList.remove('active');
        });
    }

    initEventListeners() {
        document.getElementById('attendanceDate')?.addEventListener('change', (e) => {
            this.loadAttendance(e.target.value);
        });

        document.getElementById('absenceDate')?.addEventListener('change', (e) => {
            this.loadAbsentEmployees();
        });

        document.getElementById('reportDate')?.addEventListener('change', (e) => {
            this.loadAdvancedReports();
        });

        document.getElementById('downloadAttendanceBtn')?.addEventListener('click', () => {
            const date = document.getElementById('attendanceDate').value;
            this.downloadAttendance(date);
        });

        document.getElementById('searchTrackingBtn')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.loadEmployeeTracking();
        });
    }

    async loadInitialData() {
        await this.loadEmployees();
        await this.loadAttendance();
        await this.loadPresentEmployees();
        await this.loadAbsentEmployees();
        await this.loadHolidays();
        this.updateReports();
    }

    async loadSectionData(section) {
        switch(section) {
            case 'employees':
                await this.loadEmployees();
                break;
            case 'present':
                await this.loadPresentEmployees();
                break;
            case 'attendance':
                await this.loadAttendance();
                break;
            case 'absence':
                await this.loadAbsentEmployees();
                break;
            case 'tracking':
                await this.loadEmployeeTracking();
                break;
            case 'holidays':
                await this.loadHolidays();
                break;
            case 'reports':
                await this.loadAdvancedReports();
                break;
        }
    }

    async loadEmployees() {
        try {
            const employeesGrid = document.getElementById('employeesGrid');
            employeesGrid.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Chargement...</div>';

            const response = await fetch('/api/employees', { credentials: 'same-origin' });
            const employees = await response.json();

            if (!Array.isArray(employees)) {
                throw new Error('Les données reçues ne sont pas un tableau');
            }

            this.renderEmployees(employees);
        } catch (error) {
            console.error('Erreur chargement employés:', error);
            document.getElementById('employeesGrid').innerHTML = `
                <div class="error">
                    <i class="fas fa-exclamation-triangle"></i>
                    ${error.message || 'Erreur de chargement'}
                </div>
            `;
        }
    }

    renderEmployees(employees) {
        const container = document.getElementById('employeesGrid');
        
        if (!employees || employees.length === 0) {
            container.innerHTML = '<div class="empty"><i class="fas fa-users-slash"></i> Aucun employé enregistré</div>';
            return;
        }

        container.innerHTML = employees.map(employee => {
            let photoPath = `/data/images/${employee.image_path || 'default.png'}`;
            
            return `
            <div class="employee-card">
                <div class="employee-photo-circle">
                    <img src="${photoPath}" 
                        alt="${employee.prenom} ${employee.nom}"
                        onerror="this.src='/static/images/user-default.png'">
                </div>
                <div class="employee-info">
                    <h3>${employee.prenom} ${employee.nom}</h3>
                    <p><strong>Matricule:</strong> ${employee.matricule}</p>
                    <p><strong>Département:</strong> ${employee.departement}</p>
                    <p><strong>Téléphone:</strong> ${employee.telephone || 'Non renseigné'}</p>
                    <p><strong>Lieu:</strong> ${employee.lieu_habitation || 'Non renseigné'}</p>
                </div>
                <div class="employee-actions">
                    <button class="btn btn-danger delete-btn" data-matricule="${employee.matricule}">
                        <i class="fas fa-trash"></i> Supprimer
                    </button>
                </div>
            </div>
            `;
        }).join('');

        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                if (confirm(`Voulez-vous vraiment supprimer l'employé ${btn.dataset.matricule} ?`)) {
                    this.deleteEmployee(btn.dataset.matricule);
                }
            });
        });
    }

    async loadPresentEmployees() {
        try {
            const presentGrid = document.getElementById('presentEmployeesGrid');
            presentGrid.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Chargement...</div>';

            const response = await fetch('/api/present-employees', { credentials: 'same-origin' });
            const presentEmployees = await response.json();

            if (!Array.isArray(presentEmployees)) {
                throw new Error('Les données reçues ne sont pas un tableau');
            }

            this.renderPresentEmployees(presentEmployees);
        } catch (error) {
            console.error('Erreur chargement présents:', error);
            document.getElementById('presentEmployeesGrid').innerHTML = `
                <div class="error">
                    <i class="fas fa-exclamation-triangle"></i>
                    ${error.message || 'Erreur de chargement'}
                </div>
            `;
        }
    }

    renderPresentEmployees(employees) {
        const container = document.getElementById('presentEmployeesGrid');
        
        if (!employees || employees.length === 0) {
            container.innerHTML = '<div class="empty">Aucun employé présent</div>';
            return;
        }

        container.innerHTML = employees.map(employee => `
            <div class="present-employee-card">
                <div class="employee-status present">
                    <i class="fas fa-user-check"></i>
                    <span>PRÉSENT</span>
                </div>
                <div class="employee-info">
                    <h3>${employee.nom_complet}</h3>
                    <p><i class="fas fa-id-badge"></i> ${employee.matricule}</p>
                    <p><i class="fas fa-building"></i> ${employee.departement}</p>
                    <p><i class="fas fa-clock"></i> Arrivé à ${employee.heure_arrivee}</p>
                </div>
            </div>
        `).join('');
    }

    async loadAbsentEmployees() {
        try {
            const dateEl = document.getElementById('absenceDate');
            const date = dateEl ? dateEl.value : new Date().toISOString().split('T')[0];
            const department = document.getElementById('absenceDepartment')?.value || '';
            
            const response = await fetch(`/api/absent-employees?date=${date}&department=${department}`, {
                credentials: 'same-origin'
            });
            
            const data = await response.json();
            
            if (!Array.isArray(data)) {
                throw new Error('Les données reçues ne sont pas un tableau');
            }

            // Vérifier si c'est un message de jour férié
            if (data.length === 1 && data[0].status === 'holiday') {
                this.renderHolidayMessage(data[0].message);
                return;
            }
            
            this.renderAbsentEmployees(data);
        } catch (error) {
            console.error('Erreur chargement absents:', error);
            const container = document.getElementById('absentEmployeesGrid');
            container.innerHTML = `
                <div class="error">
                    <i class="fas fa-exclamation-triangle"></i>
                    ${error.message || 'Erreur de chargement'}
                </div>
            `;
        }
    }

    renderHolidayMessage(message) {
        const container = document.getElementById('absentEmployeesGrid');
        container.innerHTML = `
            <div class="holiday-message">
                <i class="fas fa-calendar-day"></i>
                <h3>${message}</h3>
                <p>Aucune absence n'est comptabilisée pour les jours fériés.</p>
            </div>
        `;
    }

    renderAbsentEmployees(data) {
    const container = document.getElementById('absentEmployeesGrid');
    
    // Vérifier si c'est un jour férié
    if (Array.isArray(data) && data.length === 1 && data[0].is_holiday) {
        container.innerHTML = `
            <div class="holiday-message">
                <i class="fas fa-calendar-star"></i>
                <h3>${data[0].message}</h3>
                <p>Aucune absence n'est comptabilisée les jours fériés</p>
            </div>
        `;
        return;
    }
    
    // Debug
    console.log('Rendu des absents:', data);
    
    if (!data || data.length === 0) {
        container.innerHTML = `
            <div class="empty">
                <i class="fas fa-user-check"></i>
                Aucun employé absent pour cette date
            </div>
        `;
        return;
    }
    
    container.innerHTML = data.map(emp => `
        <div class="employee-card absent">
            <div class="employee-photo-circle">
                <img src="/data/images/${emp.image_path || 'default.png'}" 
                    alt="${emp.prenom} ${emp.nom}"
                    onerror="this.src='/static/images/user-default.png'">
            </div>
            <div class="employee-info">
                <h3>${emp.prenom} ${emp.nom}</h3>
                <p><strong>Matricule:</strong> ${emp.matricule}</p>
                <p><strong>Département:</strong> ${emp.departement}</p>
                <p><strong>Date:</strong> ${emp.date}</p>
                <p><strong>Téléphone:</strong> ${emp.telephone || 'Non renseigné'}</p>
            </div>
        </div>
    `).join('');
}

    async loadAttendance(date = null) {
        try {
            if (!date) date = new Date().toISOString().split('T')[0];
            
            const response = await fetch(`/api/attendance?date=${date}`, { credentials: 'same-origin' });
            const attendance = await response.json();

            if (!Array.isArray(attendance)) {
                throw new Error('Les données reçues ne sont pas un tableau');
            }

            this.renderAttendance(attendance);
        } catch (error) {
            console.error('Erreur chargement présences:', error);
            document.querySelector('#attendanceTable tbody').innerHTML = `
                <tr>
                    <td colspan="7" class="error">
                        <i class="fas fa-exclamation-triangle"></i>
                        ${error.message || 'Erreur de chargement'}
                    </td>
                </tr>
            `;
        }
    }

    renderAttendance(records) {
        const tbody = document.querySelector('#attendanceTable tbody');
        
        if (!records || records.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="empty">
                        <i class="fas fa-calendar-times"></i>
                        Aucune présence enregistrée
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = records.map(record => {
            return `
                <tr>
                    <td>${record.matricule || '-'}</td>
                    <td>${record.nom_complet || '-'}</td>
                    <td>${record.departement || '-'}</td>
                    <td>${record.heure_arrivee || '-'}</td>
                    <td>${record.heure_depart || '-'}</td>
                    <td>${record.duree || '-'}</td>
                    <td>${record.signature || '-'}</td>
                </tr>
            `;
        }).join('');
    }

    async loadEmployeeTracking() {
        try {
            const tbody = document.querySelector('#trackingTable tbody');
            tbody.innerHTML = '<tr><td colspan="9" class="loading"><i class="fas fa-spinner fa-spin"></i> Chargement...</td></tr>';

            const matricule = document.getElementById('employeeSearch').value;
            const departement = document.getElementById('departmentSearch').value;
            const month = document.getElementById('monthSearch').value;
            
            const response = await fetch(`/api/employee-tracking?matricule=${matricule}&departement=${departement}&month=${month}`, { 
                credentials: 'same-origin' 
            });
            
            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }
            
            const trackingData = await response.json();
            
            if (!Array.isArray(trackingData)) {
                throw new Error('Les données reçues ne sont pas un tableau');
            }

            this.renderEmployeeTracking(trackingData);
        } catch (error) {
            console.error('Erreur chargement suivi:', error);
            document.querySelector('#trackingTable tbody').innerHTML = `
                <tr>
                    <td colspan="9" class="error">
                        <i class="fas fa-exclamation-triangle"></i>
                        ${error.message || 'Erreur de chargement'}
                    </td>
                </tr>
            `;
        }
    }

    renderEmployeeTracking(data) {
        const tbody = document.querySelector('#trackingTable tbody');
        
        if (!data || data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" class="empty">
                        <i class="fas fa-calendar-times"></i>
                        Aucune donnée de présence trouvée
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = data.map(record => {
            let rowClass = '';
            let statusLabel = '';
            
            switch(record.status) {
                case 'absent':
                    rowClass = 'absent-row';
                    statusLabel = 'Absent';
                    break;
                case 'missing-departure':
                    rowClass = 'missing-departure-row';
                    statusLabel = 'Sortie manquante';
                    break;
                case 'irregular':
                    rowClass = 'irregular-row';
                    statusLabel = 'Irregularité';
                    break;
                case 'late':
                    rowClass = 'late-row';
                    statusLabel = 'Retard';
                    break;
                case 'early':
                    rowClass = 'early-row';
                    statusLabel = 'Sortie anticipée';
                    break;
                case 'overtime':
                    rowClass = 'overtime-row';
                    statusLabel = 'Heures supplémentaires';
                    break;
                case 'normal':
                    rowClass = 'normal-row';
                    statusLabel = 'Normal';
                    break;
                default:
                    rowClass = 'error-row';
                    statusLabel = 'Erreur';
            }

            return `
                <tr class="${rowClass}">
                    <td>${record.matricule || '-'}</td>
                    <td>${record.nom_complet || '-'}</td>
                    <td>${record.departement || '-'}</td>
                    <td>${record.date || '-'}</td>
                    <td class="${record.heure_arrivee && record.status.includes('late') ? 'late' : ''}">
                        ${record.heure_arrivee || '-'}
                    </td>
                    <td class="${record.heure_depart && record.status.includes('early') ? 'early' : ''}">
                        ${record.heure_depart || '-'}
                    </td>
                    <td>${record.duree || '-'}</td>
                    <td>${record.signature || '-'}</td>
                    <td>
                        <span class="status-badge ${record.status || ''}">
                            ${statusLabel}
                        </span>
                    </td>
                </tr>
            `;
        }).join('');
    }

    async loadHolidays() {
        try {
            const tbody = document.querySelector('#holidaysTable tbody');
            tbody.innerHTML = '<tr><td colspan="4" class="loading"><i class="fas fa-spinner fa-spin"></i> Chargement...</td></tr>';

            const response = await fetch('/api/holidays', { credentials: 'same-origin' });
            const holidays = await response.json();

            if (!Array.isArray(holidays)) {
                throw new Error('Les données reçues ne sont pas un tableau');
            }

            this.renderHolidays(holidays);
        } catch (error) {
            console.error('Erreur chargement jours fériés:', error);
            document.querySelector('#holidaysTable tbody').innerHTML = `
                <tr>
                    <td colspan="4" class="error">
                        <i class="fas fa-exclamation-triangle"></i>
                        ${error.message || 'Erreur de chargement'}
                    </td>
                </tr>
            `;
        }
    }

    renderHolidays(holidays) {
        const tbody = document.querySelector('#holidaysTable tbody');
        
        if (!holidays || holidays.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" class="empty">
                        <i class="fas fa-calendar-times"></i>
                        Aucun jour férié enregistré
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = holidays.map(holiday => `
            <tr>
                <td>${holiday.description}</td>
                <td>${holiday.date_debut}</td>
                <td>${holiday.date_fin}</td>
                <td>
                    <button class="btn btn-danger delete-holiday-btn" data-id="${holiday.description}">
                        <i class="fas fa-trash"></i> Supprimer
                    </button>
                </td>
            </tr>
        `).join('');

        document.querySelectorAll('.delete-holiday-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                if (confirm(`Voulez-vous vraiment supprimer ce jour férié ?`)) {
                    this.deleteHoliday(btn.dataset.id);
                }
            });
        });
    }

    async addHoliday(formData) {
        try {
            const response = await fetch('/api/holidays/add', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    description: formData.get('description'),
                    date_debut: formData.get('date_debut'),
                    date_fin: formData.get('date_fin')
                }),
                credentials: 'same-origin'
            });
            
            const result = await response.json();
            
            if (result.status === 'success') {
                this.showMessage(result.message, 'success');
                await this.loadHolidays();
            } else {
                this.showMessage(result.message, 'error');
            }
        } catch (error) {
            console.error('Erreur ajout jour férié:', error);
            this.showMessage('Erreur lors de l\'ajout', 'error');
        }
    }

    async deleteHoliday(description) {
        try {
            const response = await fetch(`/api/holidays/delete/${encodeURIComponent(description)}`, {
                method: 'DELETE',
                credentials: 'same-origin'
            });
            
            const result = await response.json();
            
            if (result.status === 'success') {
                this.showMessage(`✓ ${result.message}`, 'success');
                await this.loadHolidays();
            } else {
                this.showMessage(`✗ ${result.message}`, 'error');
            }
        } catch (error) {
            console.error('Erreur suppression jour férié:', error);
            this.showMessage('✗ Erreur lors de la suppression', 'error');
        }
    }

    async addEmployee(formData) {
        try {
            const response = await fetch('/api/employee/add', {
                method: 'POST',
                body: formData,
                credentials: 'same-origin'
            });
            
            const result = await response.json();
            
            if (result.status === 'success') {
                this.showMessage(result.message, 'success');
                await this.loadEmployees();
            } else {
                this.showMessage(result.message, 'error');
            }
        } catch (error) {
            console.error('Erreur ajout employé:', error);
            this.showMessage('Erreur lors de l\'ajout', 'error');
        }
    }

    async deleteEmployee(matricule) {
        try {
            const response = await fetch(`/api/employee/delete/${matricule}`, {
                method: 'DELETE',
                credentials: 'same-origin'
            });
            
            const result = await response.json();
            
            if (result.status === 'success') {
                this.showMessage(`✓ ${result.message}`, 'success');
                await this.loadEmployees();
            } else {
                this.showMessage(`✗ ${result.message}`, 'error');
            }
        } catch (error) {
            console.error('Erreur suppression employé:', error);
            this.showMessage('✗ Erreur lors de la suppression', 'error');
        }
    }

    showMessage(message, type) {
        const oldMessages = document.querySelectorAll('.message-center');
        oldMessages.forEach(msg => msg.remove());

        const messageDiv = document.createElement('div');
        messageDiv.className = `message-center ${type}`;
        messageDiv.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
            <div>${message}</div>
        `;
        
        document.body.appendChild(messageDiv);
        
        setTimeout(() => {
            messageDiv.style.opacity = '1';
        }, 10);
        
        setTimeout(() => {
            messageDiv.style.opacity = '0';
            setTimeout(() => messageDiv.remove(), 300);
        }, 5000);
    }

    updateReports() {
        // Mettre à jour les indicateurs des rapports
    }
}

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
    if (document.querySelector('.admin-container')) {
        window.adminManager = new AdminManager();
    }
});