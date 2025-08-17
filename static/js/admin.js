class AdminManager {
    constructor() {
        this.currentSection = 'employees';
        this.init();
    }

    init() {
        this.initNavigation();
        this.initModals();
        this.initEventListeners();
        this.initLeavesEventListeners();
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



    // Ajouter cette méthode utilitaire à la classe AdminManager
capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
}

    initModals() {
        // Modal pour les employés
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

// Dans la méthode initModals() de AdminManager
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
    
            const formData = new FormData(form);
    
            try {
                const result = await this.addEmployee(formData);
                if (result.status === 'success') {
                    this.showMessage(`✓ ${result.message}`, 'success');
                    form.reset();
                    modal.classList.remove('active');
                    await this.loadEmployees();
                }
            } catch (error) {
                console.error('Erreur:', error);
            }
   });


        // Modal pour les congés
        const leaveModal = document.getElementById('addLeaveModal');
        const addLeaveBtn = document.getElementById('addLeaveBtn');
        const closeLeaveBtn = leaveModal.querySelector('.modal-close');
        const cancelLeaveBtn = document.getElementById('cancelAddLeave');
        const leaveForm = document.getElementById('addLeaveForm');

        addLeaveBtn.addEventListener('click', () => {
            leaveForm.reset();
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('leaveStartDate').min = today;
            document.getElementById('leaveEndDate').min = today;
            leaveModal.classList.add('active');
        });

        const closeModal = () => leaveModal.classList.remove('active');
        closeLeaveBtn.addEventListener('click', closeModal);
        cancelLeaveBtn.addEventListener('click', closeModal);
        leaveModal.addEventListener('click', (e) => {
            if (e.target === leaveModal) closeModal();
        });

        leaveForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const matricule = document.getElementById('leaveMatricule').value.trim();
            const dateDebut = document.getElementById('leaveStartDate').value;
            const dateFin = document.getElementById('leaveEndDate').value;
            
            if (!matricule || !dateDebut || !dateFin) {
                this.showMessage('✗ Tous les champs sont obligatoires', 'error');
                return;
            }
            
            try {
                // Vérifier que l'employé existe
                const response = await fetch('/api/employees');
                if (!response.ok) throw new Error('Erreur de récupération des employés');
                
                const employees = await response.json();
                const employee = employees.find(emp => emp.matricule === matricule);
                
                if (!employee) {
                    this.showMessage('✗ Matricule non trouvé', 'error');
                    return;
                }

                // Préparer les données à envoyer
                const leaveData = {
                    matricule: matricule,
                    nom_complet: `${employee.prenom} ${employee.nom}`,
                    date_debut: dateDebut,
                    date_fin: dateFin
                };
                
                // Envoyer la requête
                const addResponse = await fetch('/api/leaves/add', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(leaveData),
                    credentials: 'same-origin'
                });
                
                // Gérer la réponse
                if (addResponse.status === 400) {
                    const errorData = await addResponse.json();
                    throw new Error(errorData.error || 'Requête incorrecte');
                }
                
                if (!addResponse.ok) {
                    throw new Error(`Erreur HTTP: ${addResponse.status}`);
                }
                
                const result = await addResponse.json();
                
                if (result.status === 'success') {
                    this.showMessage('✓ Congé ajouté avec succès', 'success');
                    closeModal();
                    await this.loadLeaves();
                } else {
                    throw new Error(result.error || 'Erreur inconnue');
                }
            } catch (error) {
                console.error('Erreur ajout congé:', error);
                this.showMessage(`✗ ${error.message || 'Erreur lors de l\'ajout'}`, 'error');
            }
        });

        // Modal pour les missions
        const missionModal = document.getElementById('addMissionModal');
        const addMissionBtn = document.getElementById('addMissionBtn');
        const closeMissionBtn = missionModal.querySelector('.modal-close');
        const cancelMissionBtn = document.getElementById('cancelAddMission');
        const missionForm = document.getElementById('addMissionForm');

        addMissionBtn.addEventListener('click', () => {
            missionForm.reset();
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('missionStartDate').min = today;
            document.getElementById('missionEndDate').min = today;
            missionModal.classList.add('active');
        });

        const closeMissionModal = () => missionModal.classList.remove('active');
        closeMissionBtn.addEventListener('click', closeMissionModal);
        cancelMissionBtn.addEventListener('click', closeMissionModal);
        missionModal.addEventListener('click', (e) => {
            if (e.target === missionModal) closeMissionModal();
        });

        missionForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const matricule = document.getElementById('missionMatricule').value.trim();
            const missionName = document.getElementById('missionName').value.trim();
            const dateDebut = document.getElementById('missionStartDate').value;
            const dateFin = document.getElementById('missionEndDate').value;
            
            if (!matricule || !missionName || !dateDebut || !dateFin) {
                this.showMessage('✗ Tous les champs sont obligatoires', 'error');
                return;
            }
            
            try {
                // Vérifier que l'employé existe
                const response = await fetch('/api/employees');
                if (!response.ok) throw new Error('Erreur de récupération des employés');
                
                const employees = await response.json();
                const employee = employees.find(emp => emp.matricule === matricule);
                
                if (!employee) {
                    this.showMessage('✗ Matricule non trouvé', 'error');
                    return;
                }
                
                // Préparer les données à envoyer
                const missionData = {
                    matricule: matricule,
                    nom_complet: `${employee.prenom} ${employee.nom}`,
                    nom_mission: missionName,
                    date_debut: dateDebut,
                    date_fin: dateFin
                };
                
                // Envoyer la requête
                const addResponse = await fetch('/api/missions/add', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(missionData),
                    credentials: 'same-origin'
                });
                
                // Gérer la réponse
                if (addResponse.status === 400) {
                    const errorData = await addResponse.json();
                    throw new Error(errorData.error || 'Requête incorrecte');
                }
                
                if (!addResponse.ok) {
                    throw new Error(`Erreur HTTP: ${addResponse.status}`);
                }
                
                const result = await addResponse.json();
                
                if (result.status === 'success') {
                    this.showMessage('✓ Mission ajoutée avec succès', 'success');
                    closeMissionModal();
                    await this.loadMissions();
                } else {
                    throw new Error(result.error || 'Erreur inconnue');
                }
            } catch (error) {
                console.error('Erreur ajout mission:', error);
                this.showMessage(`✗ ${error.message || 'Erreur lors de l\'ajout'}`, 'error');
            }
        });



        // Modal pour la mise à jour des employés
    const updateModal = document.getElementById('updateEmployeeModal');
    const updateForm = document.getElementById('updateEmployeeForm');
    const updateCloseBtn = updateModal.querySelector('.modal-close');
    const cancelUpdateBtn = document.getElementById('cancelUpdateEmployee');



     // Gestion de la fermeture du modal
    const closeUpdateModal = () => updateModal.classList.remove('active');
    updateCloseBtn.addEventListener('click', closeUpdateModal);
    cancelUpdateBtn.addEventListener('click', closeUpdateModal);
    updateModal.addEventListener('click', (e) => {
        if (e.target === updateModal) closeUpdateModal();

    });    


// Gestion de l'ouverture du modal de mise à jour
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('edit-btn')) {
        const matricule = e.target.dataset.matricule;
        this.openUpdateModal(matricule);
    }
});

// Dans la méthode initModals(), modification du gestionnaire d'événements pour updateForm
updateForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const matricule = document.getElementById('updateMatricule').value;
    const formData = new FormData(updateForm);
    
    // Verification des champs
    const requiredFields = ['nom', 'prenom', 'departement'];
    for (const field of requiredFields) {
        if (!formData.get(field)) {
            this.showMessage(`✗ Le champ ${field} est obligatoire`, 'error');
            return;
        }
    }

    try {
        const response = await fetch(`/api/employee/update/${matricule}`, {
            method: 'PUT',
            body: formData,
            credentials: 'same-origin'
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Erreur lors de la mise à jour');
        }

        const result = await response.json();
        
        if (result.status === 'success') {
            this.showMessage(`✓ ${result.message}`, 'success');
            await this.loadEmployees();
            
            // Fermer le modal après succès
            closeUpdateModal();
            
            // Recharger les visages si nécessaire
            if (window.faceService) {
                await window.faceService.loadKnownFaces();
            }
        } else {
            this.showMessage(`✗ ${result.message}`, 'error');
        }
    } catch (error) {
        console.error('Erreur mise à jour employé:', error);
        this.showMessage(`✗ ${error.message || 'Erreur lors de la mise à jour'}`, 'error');
    }
});




        // Modal pour les jours fériés
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

    initLeavesEventListeners() {
        document.getElementById('searchLeavesBtn')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.loadLeaves();
        });

        document.getElementById('refreshLeavesBtn')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.loadLeaves();
        });

        document.getElementById('leaveSearch').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.loadLeaves();
            }
        });

        document.getElementById('searchMissionsBtn')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.loadMissions();
        });

        document.getElementById('missionSearch').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.loadMissions();
            }
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




    async openUpdateModal(matricule) {
    try {
        const response = await fetch(`/api/employees`, { credentials: 'same-origin' });
        const employees = await response.json();
        const employee = employees.find(emp => emp.matricule === matricule);
        
        if (!employee) {
            throw new Error('Employé non trouvé');
        }
        
        // Remplir le formulaire
        document.getElementById('updateMatricule').value = employee.matricule;
        document.getElementById('updateNom').value = employee.nom;
        document.getElementById('updatePrenom').value = employee.prenom;
        document.getElementById('updateTelephone').value = employee.telephone || '';
        document.getElementById('updateLieuHabitation').value = employee.lieu_habitation || '';
        document.getElementById('updateDepartement').value = employee.departement;
        
        // Ouvrir le modal
        document.getElementById('updateEmployeeModal').classList.add('active');
    } catch (error) {
        console.error('Erreur ouverture modal mise à jour:', error);
        this.showMessage(`✗ ${error.message || 'Erreur lors du chargement des données'}`, 'error');
    }
}



    async updateEmployee(matricule, formData) {
    try {
        // Afficher un message de chargement
        this.showMessage('<i class="fas fa-spinner fa-spin"></i> Mise à jour en cours...', 'info');

        const response = await fetch(`/api/employee/update/${matricule}`, {
            method: 'PUT',
            body: formData,
            credentials: 'same-origin'
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.message || 'Erreur lors de la mise à jour');
        }

        if (result.status === 'success') {
            this.showMessage(`✓ ${result.message}`, 'success');
            await this.loadEmployees();
            
            // Recharger les visages si nécessaire
            if (window.faceService) {
                await window.faceService.loadKnownFaces();
            }
            
            return true;
        } else {
            this.showMessage(`✗ ${result.message}`, 'error');
            return false;
        }
    } catch (error) {
        console.error('Erreur mise à jour employé:', error);
        this.showMessage(`✗ ${error.message || 'Erreur lors de la mise à jour'}`, 'error');
        return false;
    }
}

    async loadInitialData() {
        await this.loadEmployees();
        await this.loadAttendance();
        await this.loadPresentEmployees();
        await this.loadAbsentEmployees();
        await this.loadHolidays();
        await this.loadLeaves();
        await this.loadMissions();
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
            case 'leaves':
                await this.loadLeaves();
                break;
            case 'missions':
                await this.loadMissions();
                break;
            case 'reports':
                await this.loadAdvancedReports();
                break;
        }
    }

    async loadMissions() {
    try {
        const tbody = document.querySelector('#missionsTable tbody');
        tbody.innerHTML = '<tr><td colspan="6" class="loading"><i class="fas fa-spinner fa-spin"></i> Chargement...</td></tr>';

        const matricule = document.getElementById('missionSearch').value;
        const month = document.getElementById('missionMonthSearch').value;
        
        let url = '/api/missions';
        const params = new URLSearchParams();
        if (matricule) params.append('matricule', matricule);
        if (month) params.append('month', month);
        
        if (params.toString()) {
            url += `?${params.toString()}`;
        }

        const response = await fetch(url, { 
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }
        
        const missions = await response.json();
        
        // Vérifier que la réponse est bien un tableau
        if (!Array.isArray(missions)) {
            throw new Error('Format de données invalide');
        }

        this.renderMissions(missions);
    } catch (error) {
        console.error('Erreur chargement missions:', error);
        document.querySelector('#missionsTable tbody').innerHTML = `
            <tr>
                <td colspan="6" class="error">
                    <i class="fas fa-exclamation-triangle"></i>
                    ${error.message || 'Erreur de chargement des missions'}
                </td>
            </tr>
        `;
    }
}

    renderMissions(missions) {
        const tbody = document.querySelector('#missionsTable tbody');
        const today = new Date();
        
        if (!missions || missions.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="empty">
                        <i class="fas fa-calendar-times"></i>
                        Aucune mission trouvée
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = missions.map(mission => {
            const startDate = new Date(mission['date debut']);
            const endDate = new Date(mission['date fin']);
            const isCurrent = today >= startDate && today <= endDate;
            const isPast = today > endDate;
            
            let statusClass = '';
            let statusText = '';
            
            if (isCurrent) {
                statusClass = 'on-mission';
                statusText = 'En cours';
            } else if (isPast) {
                statusClass = 'past-mission';
                statusText = 'Terminée';
            } else {
                statusClass = 'future-mission';
                statusText = 'À venir';
            }
            
            return `
            <tr class="${isCurrent ? 'current-mission' : ''}">
                <td>${mission.matricule || '-'}</td>
                <td>${mission['nom complet'] || '-'}</td>
                <td>${mission['nom mission'] || '-'}</td>
                <td>${mission['date debut'] || '-'}</td>
                <td>${mission['date fin'] || '-'}</td>
                <td>
                    <span class="status-badge ${statusClass}">
                        ${statusText}
                    </span>
                    <button class="btn btn-danger delete-mission-btn" 
                            data-matricule="${mission.matricule}" 
                            data-date="${mission['date debut']}">
                        <i class="fas fa-trash"></i> Supprimer
                    </button>
                </td>
            </tr>
            `;
        }).join('');

        document.querySelectorAll('.delete-mission-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                if (confirm(`Voulez-vous vraiment supprimer cette mission ?`)) {
                    this.deleteMission(btn.dataset.matricule, btn.dataset.date);
                }
            });
        });
    }

    async deleteMission(matricule, date_debut) {
        try {
            const response = await fetch(`/api/missions/delete/${matricule}/${date_debut}`, {
                method: 'DELETE',
                credentials: 'same-origin'
            });
            
            const result = await response.json();
            
            if (result.status === 'success') {
                this.showMessage('✓ Mission supprimée avec succès', 'success');
                await this.loadMissions();
            } else {
                this.showMessage(`✗ ${result.error || 'Erreur lors de la suppression'}`, 'error');
            }
        } catch (error) {
            console.error('Erreur suppression mission:', error);
            this.showMessage('✗ Erreur lors de la suppression', 'error');
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
                <button class="btn btn-primary edit-btn" data-matricule="${employee.matricule}">
                    <i class="fas fa-edit"></i> Modifier
                </button>
                <button class="btn btn-danger delete-btn" data-matricule="${employee.matricule}">
                    <i class="fas fa-trash"></i> Supprimer
                </button>
            </div>
        </div>
        `;
    }).join('');

    // Gestion des événements pour les boutons
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            if (confirm(`Voulez-vous vraiment supprimer l'employé ${btn.dataset.matricule} ?`)) {
                this.deleteEmployee(btn.dataset.matricule);
            }
        });
    });

    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            this.openUpdateModal(btn.dataset.matricule);
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

    async loadLeaves() {
        try {
            const tbody = document.querySelector('#leavesTable tbody');
            tbody.innerHTML = '<tr><td colspan="5" class="loading"><i class="fas fa-spinner fa-spin"></i> Chargement...</td></tr>';

            const matricule = document.getElementById('leaveSearch').value;
            const month = document.getElementById('leaveMonthSearch').value;
            
            let url = '/api/leaves';
            const params = new URLSearchParams();
            if (matricule) params.append('matricule', matricule);
            if (month) params.append('month', month);
            
            if (params.toString()) {
                url += `?${params.toString()}`;
            }

            const response = await fetch(url, { credentials: 'same-origin' });
            if (!response.ok) throw new Error(`Erreur HTTP: ${response.status}`);
            
            const leaves = await response.json();
            if (!Array.isArray(leaves)) {
                throw new Error('Les données reçues ne sont pas un tableau');
            }

            this.renderLeaves(leaves);
        } catch (error) {
            console.error('Erreur chargement congés:', error);
            document.querySelector('#leavesTable tbody').innerHTML = `
                <tr>
                    <td colspan="5" class="error">
                        <i class="fas fa-exclamation-triangle"></i>
                        ${error.message || 'Erreur de chargement'}
                    </td>
                </tr>
            `;
        }
    }

    renderLeaves(leaves) {
        const tbody = document.querySelector('#leavesTable tbody');
        const today = new Date();
        
        if (!leaves || leaves.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="empty">
                        <i class="fas fa-calendar-times"></i>
                        Aucun congé trouvé
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = leaves.map(leave => {
            const startDate = new Date(leave['date debut']);
            const endDate = new Date(leave['date fin']);
            const isCurrent = today >= startDate && today <= endDate;
            const isPast = today > endDate;
            
            let statusClass = '';
            let statusText = '';
            
            if (isCurrent) {
                statusClass = 'on-leave';
                statusText = 'En cours';
            } else if (isPast) {
                statusClass = 'past-leave';
                statusText = 'Terminé';
            } else {
                statusClass = 'future-leave';
                statusText = 'À venir';
            }
            
            return `
            <tr class="${isCurrent ? 'current-leave' : ''}">
                <td>${leave.matricule || '-'}</td>
                <td>${leave['nom complet'] || '-'}</td>
                <td>${leave['date debut'] || '-'}</td>
                <td>${leave['date fin'] || '-'}</td>
                <td>
                    <span class="status-badge ${statusClass}">
                        ${statusText}
                    </span>
                    <button class="btn btn-danger delete-leave-btn" 
                            data-matricule="${leave.matricule}" 
                            data-date="${leave['date debut']}">
                        <i class="fas fa-trash"></i> Supprimer
                    </button>
                </td>
            </tr>
            `;
        }).join('');

        document.querySelectorAll('.delete-leave-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                if (confirm(`Voulez-vous vraiment supprimer ce congé ?`)) {
                    this.deleteLeave(btn.dataset.matricule, btn.dataset.date);
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
        this.showMessage('<i class="fas fa-spinner fa-spin"></i> Enregistrement en cours...', 'info');

        const response = await fetch('/api/employee/add', {
            method: 'POST',
            body: formData,
            credentials: 'same-origin'
            // Ne pas mettre de Content-Type, le navigateur le fera automatiquement
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Erreur serveur');
        }

        return await response.json();
    } catch (error) {
        this.showMessage(`✗ ${error.message}`, 'error');
        throw error;
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

    async deleteLeave(matricule, date_debut) {
        try {
            const response = await fetch(`/api/leaves/delete/${matricule}/${date_debut}`, {
                method: 'DELETE',
                credentials: 'same-origin'
            });
            
            const result = await response.json();
            
            if (result.status === 'success') {
                this.showMessage('✓ Congé supprimé avec succès', 'success');
                await this.loadLeaves();
                await this.loadAbsentEmployees();
            } else {
                this.showMessage(`✗ ${result.error || 'Erreur lors de la suppression'}`, 'error');
            }
        } catch (error) {
            console.error('Erreur suppression congé:', error);
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

    async loadAdvancedReports() {
        try {
            const date = document.getElementById('reportDate')?.value || new Date().toISOString().split('T')[0];
            const department = document.getElementById('reportDepartment')?.value || '';
            
            const response = await fetch(`/api/advanced-reports?date=${date}&department=${department}`, {
                credentials: 'same-origin'
            });
            
            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }
            
            const reportData = await response.json();
            
            if (reportData.status === 'holiday') {
                document.getElementById('reportsContainer').innerHTML = `
                    <div class="holiday-message">
                        <i class="fas fa-calendar-star"></i>
                        <h3>${reportData.message}</h3>
                        <p>Aucun rapport généré pour les jours fériés</p>
                    </div>
                `;
                return;
            }
            
            this.renderAdvancedReports(reportData);
        } catch (error) {
            console.error('Erreur chargement rapports:', error);
            document.getElementById('reportsContainer').innerHTML = `
                <div class="error">
                    <i class="fas fa-exclamation-triangle"></i>
                    ${error.message || 'Erreur de chargement des rapports'}
                </div>
            `;
        }
    }

    renderAdvancedReports(reportData) {
        const container = document.getElementById('reportsContainer');
        
        container.innerHTML = `
            <div class="report-cards">
                <div class="report-card">
                    <div class="report-icon total">
                        <i class="fas fa-users"></i>
                    </div>
                    <div class="report-content">
                        <h3>${reportData.total_employees}</h3>
                        <p>Employés total</p>
                    </div>
                </div>
                
                <div class="report-card">
                    <div class="report-icon present">
                        <i class="fas fa-user-check"></i>
                    </div>
                    <div class="report-content">
                        <h3>${reportData.present_today}</h3>
                        <p>Présents aujourd'hui</p>
                    </div>
                </div>
                
                <div class="report-card">
                    <div class="report-icon absent">
                        <i class="fas fa-user-times"></i>
                    </div>
                    <div class="report-content">
                        <h3>${reportData.absent_today}</h3>
                        <p>Absents aujourd'hui</p>
                    </div>
                </div>
                
                <div class="report-card">
                    <div class="report-icon late">
                        <i class="fas fa-clock"></i>
                    </div>
                    <div class="report-content">
                        <h3>${reportData.late_arrivals}</h3>
                        <p>Retards</p>
                    </div>
                </div>
                
                <div class="report-card">
                    <div class="report-icon early">
                        <i class="fas fa-running"></i>
                    </div>
                    <div class="report-content">
                        <h3>${reportData.early_departures}</h3>
                        <p>Sorties anticipées</p>
                    </div>
                </div>
                
                <div class="report-card">
                    <div class="report-icon missing">
                        <i class="fas fa-question-circle"></i>
                    </div>
                    <div class="report-content">
                        <h3>${reportData.missing_departures}</h3>
                        <p>Sorties non enregistrées</p>
                    </div>
                </div>
            </div>
        `;
    }

    async downloadAttendance(date) {
        try {
            const response = await fetch(`/api/attendance/download?date=${date}`, {
                credentials: 'same-origin'
            });
            
            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }
            
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `presences_${date}.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            this.showMessage('✓ Téléchargement terminé', 'success');
        } catch (error) {
            console.error('Erreur téléchargement:', error);
            this.showMessage(`✗ ${error.message || 'Erreur lors du téléchargement'}`, 'error');
        }
    }
}

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
    if (document.querySelector('.admin-container')) {
        window.adminManager = new AdminManager();
    }
});