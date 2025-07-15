class AdminManager {
    constructor() {
        this.currentSection = 'employees';
        this.employees = [];
        this.attendance = [];
        this.presentEmployees = [];
        this.absentEmployees = [];
        this.departments = ['informatique', 'rh', 'commercial', 'finance', 'administration', 'direction'];
        
        this.init();
    }

    init() {
        this.initNavigation();
        this.initModals();
        this.initEventListeners();
        this.loadInitialData();
        this.startRealTimeUpdates();
    }

    initNavigation() {
        const navButtons = document.querySelectorAll('.nav-btn');
        const sections = document.querySelectorAll('.admin-section');

        navButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const sectionName = btn.dataset.section;
                navButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                sections.forEach(s => s.classList.remove('active'));
                document.getElementById(`${sectionName}-section`).classList.add('active');
                
                this.currentSection = sectionName;
                this.loadSectionData(sectionName);
            });
        });
    }

    initModals() {
        const modal = document.getElementById('addEmployeeModal');
        const addBtn = document.getElementById('addEmployeeBtn');
        const closeBtn = modal.querySelector('.modal-close');
        const cancelBtn = document.getElementById('cancelAddEmployee');
        const form = document.getElementById('addEmployeeForm');

        addBtn.addEventListener('click', () => {
            modal.classList.add('active');
            form.reset();
        });

        const closeModal = () => modal.classList.remove('active');
        closeBtn.addEventListener('click', closeModal);
        cancelBtn.addEventListener('click', closeModal);
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.addEmployee(form);
        });
    }

    initEventListeners() {
        // Date pickers
        document.getElementById('attendanceDate')?.addEventListener('change', (e) => {
            this.loadAttendance(e.target.value);
        });

        document.getElementById('absenceDate')?.addEventListener('change', (e) => {
            this.loadAbsentEmployees();
        });

        document.getElementById('reportDate')?.addEventListener('change', (e) => {
            this.loadAdvancedReports();
        });

        // Department selectors - Charger les départements pour tous les select
        this.loadDepartments().then(() => {
            document.getElementById('departmentSearch')?.addEventListener('change', () => {
                this.loadEmployeeTracking();
            });

            document.getElementById('absenceDepartment')?.addEventListener('change', () => {
                this.loadAbsentEmployees();
            });

            document.getElementById('reportDepartment')?.addEventListener('change', () => {
                this.loadAdvancedReports();
            });
        });

        // Month selector
        document.getElementById('monthSearch')?.addEventListener('change', () => {
            this.loadEmployeeTracking();
        });

        // Search inputs
        document.getElementById('employeeSearch')?.addEventListener('input', Utils.debounce(() => {
            this.loadEmployeeTracking();
        }, 300));

        // Download buttons
        document.getElementById('downloadAttendanceBtn')?.addEventListener('click', () => {
            const date = document.getElementById('attendanceDate').value;
            this.downloadAttendance(date);
        });

        // Add download tracking button if not exists
        if (!document.getElementById('downloadTrackingBtn')) {
            const downloadBtn = document.createElement('button');
            downloadBtn.id = 'downloadTrackingBtn';
            downloadBtn.className = 'btn btn-secondary';
            downloadBtn.innerHTML = '<i class="fas fa-download"></i> Télécharger';
            downloadBtn.addEventListener('click', () => this.downloadEmployeeTracking());
            
            const trackingControls = document.querySelector('#tracking-section .search-controls');
            if (trackingControls) trackingControls.appendChild(downloadBtn);
        }
    }

    async loadDepartments() {
        try {
            const departmentSelects = [
                document.getElementById('departmentSearch'),
                document.getElementById('absenceDepartment'),
                document.getElementById('reportDepartment')
            ];

            // Ne charger qu'une seule fois si les options sont déjà présentes
            if (departmentSelects[0] && departmentSelects[0].options.length <= 1) {
                for (const select of departmentSelects) {
                    if (select) {
                        // Garder l'option "Tous départements"
                        while (select.options.length > 1) {
                            select.remove(1);
                        }

                        // Ajouter les départements
                        this.departments.forEach(dept => {
                            const option = document.createElement('option');
                            option.value = dept;
                            option.textContent = this.formatDepartmentName(dept);
                            select.appendChild(option);
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Erreur chargement départements:', error);
        }
    }

    formatDepartmentName(dept) {
        const names = {
            'informatique': 'Informatique',
            'rh': 'Ressources Humaines',
            'commercial': 'Commercial',
            'finance': 'Finance',
            'administration': 'Administration',
            'direction': 'Direction'
        };
        return names[dept] || dept;
    }

    async loadInitialData() {
        try {
            await this.loadDepartments();
            await this.loadEmployees();
            await Promise.all([
                this.loadAttendance(),
                this.loadPresentEmployees(),
                this.loadAbsentEmployees()
            ]);
            this.updateReports();
        } catch (error) {
            console.error('Erreur chargement initial:', error);
            Utils.showMessage('Erreur lors du chargement des données initiales', 'error');
        }
    }

    async loadSectionData(section) {
        await this.loadDepartments();
        switch(section) {
            case 'tracking':
                await this.loadEmployeeTracking();
                break;
            case 'reports':
                await this.loadAdvancedReports();
                break;
            case 'absence':
                await this.loadAbsentEmployees();
                break;
            default:
                break;
        }
    }

    async loadEmployees() {
        try {
            const employeesGrid = document.getElementById('employeesGrid');
            if (employeesGrid) {
                employeesGrid.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Chargement des employés...</div>';
            }

            const response = await Utils.apiRequest('/api/employees');
            this.employees = response;
            this.renderEmployees();
        } catch (error) {
            console.error('Erreur chargement employés:', error);
            const employeesGrid = document.getElementById('employeesGrid');
            if (employeesGrid) {
                employeesGrid.innerHTML = `
                    <div class="error-state">
                        <i class="fas fa-exclamation-triangle"></i>
                        <h3>Erreur de chargement</h3>
                        <p>${error.message || 'Impossible de charger la liste des employés'}</p>
                        <button class="btn btn-primary" onclick="adminManager.loadEmployees()">Réessayer</button>
                    </div>
                `;
            }
        }
    }

    renderEmployees() {
        const container = document.getElementById('employeesGrid');
        if (!container) return;

        if (!this.employees || this.employees.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-users"></i>
                    <h3>Aucun employé enregistré</h3>
                    <p>Commencez par ajouter des employés à la base de données</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.employees.map(employee => `
            <div class="employee-card" data-id="${employee.matricule}">
                <div class="employee-header">
                    <div class="employee-info">
                        <h3>${employee.prenom} ${employee.nom}</h3>
                        <p><i class="fas fa-id-badge"></i> ${employee.matricule}</p>
                        <p><i class="fas fa-building"></i> ${employee.departement}</p>
                        ${employee.telephone ? `<p><i class="fas fa-phone"></i> ${employee.telephone}</p>` : ''}
                    </div>
                    <div class="employee-actions">
                        <button class="btn btn-sm btn-danger" onclick="adminManager.deleteEmployee('${employee.matricule}')">
                            <i class="fas fa-trash"></i> Supprimer
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    async loadPresentEmployees() {
        try {
            const presentGrid = document.getElementById('presentEmployeesGrid');
            if (presentGrid) {
                presentGrid.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Chargement des employés présents...</div>';
            }

            const response = await Utils.apiRequest('/api/present-employees');
            this.presentEmployees = response;
            this.renderPresentEmployees();
            this.updateReports();
        } catch (error) {
            console.error('Erreur chargement employés présents:', error);
            const presentGrid = document.getElementById('presentEmployeesGrid');
            if (presentGrid) {
                presentGrid.innerHTML = `
                    <div class="error-state">
                        <i class="fas fa-exclamation-triangle"></i>
                        <h3>Erreur de chargement</h3>
                        <p>${error.message || 'Impossible de charger la liste des présents'}</p>
                        <button class="btn btn-primary" onclick="adminManager.loadPresentEmployees()">Réessayer</button>
                    </div>
                `;
            }
        }
    }

    renderPresentEmployees() {
        const container = document.getElementById('presentEmployeesGrid');
        if (!container) return;

        if (!this.presentEmployees || this.presentEmployees.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-user-clock"></i>
                    <h3>Aucun employé présent</h3>
                    <p>Aucun employé n'a enregistré sa présence aujourd'hui</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.presentEmployees.map(employee => `
            <div class="present-employee-card">
                <div class="employee-status">
                    <div class="status-indicator present"></div>
                    <div class="status-text">PRÉSENT</div>
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
            const date = document.getElementById('absenceDate')?.value || Utils.getCurrentDate();
            const department = document.getElementById('absenceDepartment')?.value || '';
            
            const response = await Utils.apiRequest(`/api/absent-employees?date=${date}&departement=${department}`);
            this.absentEmployees = response;
            this.renderAbsentEmployees();
            this.updateReports();
        } catch (error) {
            console.error('Erreur chargement absents:', error);
            Utils.showMessage('Erreur lors du chargement des absents', 'error');
        }
    }

    renderAbsentEmployees() {
        const container = document.getElementById('absentEmployeesGrid');
        if (!container) return;

        if (!this.absentEmployees || this.absentEmployees.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-user-slash"></i>
                    <h3>Aucun employé absent</h3>
                    <p>Tous les employés ont enregistré leur présence pour cette date</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.absentEmployees.map(employee => `
            <div class="employee-card">
                <div class="employee-status">
                    <div class="status-indicator absent"></div>
                    <div class="status-text">ABSENT</div>
                </div>
                <div class="employee-info">
                    <h3>${employee.prenom} ${employee.nom}</h3>
                    <p><i class="fas fa-id-badge"></i> ${employee.matricule}</p>
                    <p><i class="fas fa-building"></i> ${employee.departement}</p>
                    <p><i class="fas fa-phone"></i> ${employee.telephone || 'Non renseigné'}</p>
                </div>
            </div>
        `).join('');
    }

    async loadAttendance(date = null) {
        try {
            if (!date) date = Utils.getCurrentDate();
            
            const response = await Utils.apiRequest(`/api/attendance?date=${date}`);
            this.attendance = response;
            this.renderAttendance();
            this.updateReports();
        } catch (error) {
            console.error('Erreur chargement présences:', error);
            Utils.showMessage('Erreur lors du chargement des présences', 'error');
        }
    }

    renderAttendance() {
        const tbody = document.querySelector('#attendanceTable tbody');
        if (!tbody) return;

        if (!this.attendance || this.attendance.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="empty-state">
                        <i class="fas fa-calendar-times"></i>
                        <span>Aucune présence enregistrée pour cette date</span>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.attendance.map(record => {
            const arrivalLate = record.heure_arrivee && record.heure_arrivee > '08:00:00';
            const departureEarly = record.heure_depart && record.heure_depart < '17:00:00';
            const missingDeparture = record.heure_depart && 
                                   (new Date(`2000-01-01 ${record.heure_depart}`) - 
                                    new Date(`2000-01-01 ${record.heure_arrivee}`)) / (1000 * 60 * 60) === 1;

            return `
                <tr>
                    <td>${record.matricule}</td>
                    <td>${record.nom_complet}</td>
                    <td>${record.departement}</td>
                    <td class="${arrivalLate ? 'late' : ''}">${record.heure_arrivee || '-'}</td>
                    <td class="${departureEarly ? 'early' : ''}">${record.heure_depart || '-'}</td>
                    <td>${record.heure_arrivee && record.heure_depart ? 
                        Utils.calculateDuration(record.heure_arrivee, record.heure_depart) : '-'}</td>
                    <td><span class="signature-badge">${record.signature}</span></td>
                </tr>
            `;
        }).join('');
    }

    async loadEmployeeTracking() {
        try {
            const matricule = document.getElementById('employeeSearch')?.value;
            const department = document.getElementById('departmentSearch')?.value;
            const month = document.getElementById('monthSearch')?.value;

            const response = await Utils.apiRequest(`/api/employee-tracking?matricule=${matricule}&departement=${department}&month=${month}`);
            this.renderEmployeeTracking(response);
        } catch (error) {
            console.error('Erreur chargement suivi agent:', error);
            Utils.showMessage('Erreur lors du chargement du suivi', 'error');
        }
    }

    renderEmployeeTracking(data) {
        const container = document.querySelector('.tracking-table-container');
        if (!container) return;

        if (!data || data.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-user-clock"></i>
                    <h3>Aucune donnée de présence</h3>
                    <p>Aucun enregistrement trouvé pour les critères sélectionnés</p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <table class="tracking-table">
                <thead>
                    <tr>
                        <th>Matricule</th>
                        <th>Nom Complet</th>
                        <th>Département</th>
                        <th>Date</th>
                        <th>Arrivée</th>
                        <th>Départ</th>
                        <th>Temps</th>
                        <th>Statut</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.map(record => {
                        const arrivalLate = record.heure_arrivee && record.heure_arrivee > '08:00:00';
                        const departureEarly = record.heure_depart && record.heure_depart < '17:00:00';
                        const missingDeparture = record.heure_depart && 
                                               (new Date(`2000-01-01 ${record.heure_depart}`) - 
                                                new Date(`2000-01-01 ${record.heure_arrivee}`)) / (1000 * 60 * 60) === 1;

                        let rowClass = '';
                        let status = 'Normal';
                        let statusClass = 'status-badge normal';
                        
                        if (missingDeparture) {
                            rowClass = 'missing-departure';
                            status = 'Sortie non enregistrée';
                            statusClass = 'status-badge warning';
                        } else if (arrivalLate && departureEarly) {
                            rowClass = 'irregular';
                            status = 'Arrivée tardive et départ anticipé';
                            statusClass = 'status-badge error';
                        } else if (arrivalLate) {
                            rowClass = 'irregular';
                            status = 'Arrivée tardive';
                            statusClass = 'status-badge warning';
                        } else if (departureEarly) {
                            rowClass = 'irregular';
                            status = 'Départ anticipé';
                            statusClass = 'status-badge warning';
                        }

                        return `
                            <tr class="${rowClass}">
                                <td>${record.matricule}</td>
                                <td>${record.nom_complet}</td>
                                <td>${record.departement}</td>
                                <td>${Utils.formatDate(record.date)}</td>
                                <td class="${arrivalLate ? 'late' : ''}">${record.heure_arrivee || '-'}</td>
                                <td class="${departureEarly ? 'early' : ''}">${record.heure_depart || '-'}</td>
                                <td>${record.heure_arrivee && record.heure_depart ? 
                                    Utils.calculateDuration(record.heure_arrivee, record.heure_depart) : '-'}</td>
                                <td><span class="${statusClass}">${status}</span></td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
    }

    async loadAdvancedReports() {
        try {
            const date = document.getElementById('reportDate')?.value;
            const department = document.getElementById('reportDepartment')?.value;

            const response = await Utils.apiRequest(`/api/advanced-reports?date=${date}&departement=${department}`);
            this.renderAdvancedReports(response);
        } catch (error) {
            console.error('Erreur chargement rapports:', error);
            Utils.showMessage('Erreur lors du chargement des rapports', 'error');
        }
    }

    renderAdvancedReports(data) {
        document.getElementById('totalEmployees').textContent = data.total_employees;
        document.getElementById('presentToday').textContent = data.present_today;
        document.getElementById('absentToday').textContent = data.absent_today;
        
        const today = Utils.getCurrentDate();
        const todayAttendance = this.attendance.filter(record => record.date === today);
        const completedSessions = todayAttendance.filter(record => 
            record.heure_arrivee && record.heure_depart
        );
        
        if (completedSessions.length > 0) {
            const totalMinutes = completedSessions.reduce((total, record) => {
                const start = new Date(`2000-01-01 ${record.heure_arrivee}`);
                const end = new Date(`2000-01-01 ${record.heure_depart}`);
                return total + (end - start) / (1000 * 60);
            }, 0);
            
            const averageMinutes = totalMinutes / completedSessions.length;
            const hours = Math.floor(averageMinutes / 60);
            const minutes = Math.round(averageMinutes % 60);
            
            document.getElementById('averageTime').textContent = `${hours}h${minutes.toString().padStart(2, '0')}`;
        } else {
            document.getElementById('averageTime').textContent = '-';
        }
    }

    updateReports() {
        document.getElementById('totalEmployees').textContent = this.employees.length;
        document.getElementById('presentToday').textContent = this.presentEmployees.length;
        document.getElementById('absentToday').textContent = this.absentEmployees.length;
        
        const today = Utils.getCurrentDate();
        const todayAttendance = this.attendance.filter(record => record.date === today);
        const completedSessions = todayAttendance.filter(record => 
            record.heure_arrivee && record.heure_depart
        );
        
        if (completedSessions.length > 0) {
            const totalMinutes = completedSessions.reduce((total, record) => {
                const start = new Date(`2000-01-01 ${record.heure_arrivee}`);
                const end = new Date(`2000-01-01 ${record.heure_depart}`);
                return total + (end - start) / (1000 * 60);
            }, 0);
            
            const averageMinutes = totalMinutes / completedSessions.length;
            const hours = Math.floor(averageMinutes / 60);
            const minutes = Math.round(averageMinutes % 60);
            
            document.getElementById('averageTime').textContent = `${hours}h${minutes.toString().padStart(2, '0')}`;
        } else {
            document.getElementById('averageTime').textContent = '-';
        }
    }

    async addEmployee(form) {
        const formData = new FormData(form);
        const btn = form.querySelector('button[type="submit"]');
        
        try {
            Utils.setButtonLoading(btn, true, 'Enregistrement...');
            
            const response = await Utils.apiRequest('/api/employee/add', {
                method: 'POST',
                body: formData
            });
            
            if (response.status === 'success') {
                Utils.showMessage(response.message, 'success', 5000);
                this.loadEmployees();
                document.getElementById('addEmployeeModal').classList.remove('active');
            } else {
                Utils.showMessage(response.message, 'error', 5000);
            }
        } catch (error) {
            console.error('Erreur ajout employé:', error);
            Utils.showMessage('Erreur lors de l\'ajout de l\'employé: ' + (error.message || 'Veuillez vérifier les données'), 'error', 5000);
        } finally {
            Utils.setButtonLoading(btn, false);
        }
    }

    async deleteEmployee(matricule) {
        if (!confirm('Voulez-vous vraiment supprimer cet employé ? Cette action est irréversible.')) {
            return;
        }
        
        try {
            const response = await Utils.apiRequest(`/api/employee/delete/${matricule}`, {
                method: 'DELETE'
            });
            
            if (response.status === 'success') {
                Utils.showMessage(response.message, 'success', 5000);
                this.loadEmployees();
            } else {
                Utils.showMessage(response.message, 'error', 5000);
            }
        } catch (error) {
            console.error('Erreur suppression employé:', error);
            Utils.showMessage('Erreur lors de la suppression de l\'employé', 'error', 5000);
        }
    }

    async downloadAttendance(date) {
        const btn = document.getElementById('downloadAttendanceBtn');
        try {
            Utils.setButtonLoading(btn, true, 'Préparation...');
            
            const downloadLink = document.createElement('a');
            downloadLink.style.display = 'none';
            const timestamp = new Date().getTime();
            downloadLink.href = `/api/attendance/download?date=${date}&_=${timestamp}`;
            downloadLink.download = `presences_${date}.xlsx`;
            
            document.body.appendChild(downloadLink);
            downloadLink.click();
            
            setTimeout(() => {
                document.body.removeChild(downloadLink);
                Utils.setButtonLoading(btn, false);
                Utils.showMessage('Téléchargement démarré', 'success', 3000);
            }, 100);
        } catch (error) {
            console.error('Erreur téléchargement:', error);
            Utils.showMessage('Échec du téléchargement: ' + error.message, 'error');
            Utils.setButtonLoading(btn, false);
            window.open(`/api/attendance/download?date=${date}`, '_blank');
        }
    }

    async downloadEmployeeTracking() {
        const btn = document.getElementById('downloadTrackingBtn');
        try {
            Utils.setButtonLoading(btn, true, 'Préparation...');
            
            const matricule = document.getElementById('employeeSearch')?.value;
            const department = document.getElementById('departmentSearch')?.value;
            const month = document.getElementById('monthSearch')?.value;
            
            if (!matricule && !department) {
                Utils.showMessage('Veuillez sélectionner au moins un matricule ou un département', 'warning');
                return;
            }

            const downloadLink = document.createElement('a');
            downloadLink.style.display = 'none';
            const timestamp = new Date().getTime();
            downloadLink.href = `/api/employee-tracking/download?matricule=${matricule}&departement=${department}&month=${month}&_=${timestamp}`;
            downloadLink.download = `suivi_agent_${matricule || department}_${month}.xlsx`;
            
            document.body.appendChild(downloadLink);
            downloadLink.click();
            
            setTimeout(() => {
                document.body.removeChild(downloadLink);
                Utils.setButtonLoading(btn, false);
                Utils.showMessage('Téléchargement démarré', 'success', 3000);
            }, 100);
        } catch (error) {
            console.error('Erreur téléchargement suivi:', error);
            Utils.showMessage('Échec du téléchargement: ' + error.message, 'error');
            Utils.setButtonLoading(btn, false);
        }
    }

    startRealTimeUpdates() {
        setInterval(() => {
            if (this.currentSection === 'present') {
                this.loadPresentEmployees();
            }
        }, 30000); // Mise à jour toutes les 30 secondes
    }
}

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
    if (!document.querySelector('.admin-container')) return;
    
    window.adminManager = new AdminManager();
});