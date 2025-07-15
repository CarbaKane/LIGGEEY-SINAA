// Utilitaires généraux pour l'application DB-PRESENT

class Utils {
    /**
     * Affiche un message à l'utilisateur
     * @param {string} message - Le message à afficher
     * @param {string} type - Le type de message (success, error, warning)
     * @param {number} duration - Durée d'affichage en millisecondes (défaut 5000ms)
     */
    static showMessage(message, type = 'info', duration = 5000) {
        const messageContainer = document.getElementById('messageContainer') || document.getElementById('message');
        if (!messageContainer) return;

        const messageElement = document.getElementById('message') || messageContainer;
        
        // Nettoyage des classes précédentes
        messageElement.className = 'message';
        messageElement.classList.add(type);
        messageElement.textContent = message;
        messageElement.style.display = 'block';

        // Animation d'entrée
        messageElement.classList.add('bounce');
        
        // Masquage automatique
        if (duration > 0) {
            setTimeout(() => {
                messageElement.style.display = 'none';
                messageElement.classList.remove('bounce');
            }, duration);
        }
    }

    /**
     * Formate une date au format français
     * @param {Date|string} date - La date à formater
     * @returns {string} Date formatée
     */
    static formatDate(date) {
        if (typeof date === 'string') {
            date = new Date(date);
        }
        
        return date.toLocaleDateString('fr-FR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    }

    /**
     * Formate une heure au format français
     * @param {Date|string} time - L'heure à formater
     * @returns {string} Heure formatée
     */
    static formatTime(time) {
        if (typeof time === 'string') {
            // Si c'est déjà au format HH:MM:SS, on le retourne tel quel
            if (time.match(/^\d{2}:\d{2}:\d{2}$/)) {
                return time;
            }
            time = new Date(time);
        }
        
        return time.toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    /**
     * Calcule la durée entre deux heures
     * @param {string} startTime - Heure de début (HH:MM:SS)
     * @param {string} endTime - Heure de fin (HH:MM:SS)
     * @returns {string} Durée formatée
     */
    static calculateDuration(startTime, endTime) {
        if (!startTime || !endTime) return '-';
        
        try {
            const start = new Date(`2000-01-01 ${startTime}`);
            const end = new Date(`2000-01-01 ${endTime}`);
            
            const diffMs = end - start;
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
            
            return `${diffHours}h${diffMinutes.toString().padStart(2, '0')}min`;
        } catch (error) {
            console.error('Erreur calcul durée:', error);
            return '-';
        }
    }








static async downloadFile(url, filename) {
    try {
        // Solution de repli pour les navigateurs modernes
        const response = await fetch(url);
        if (!response.ok) throw new Error('Erreur réseau');
        
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = filename || 'download.xlsx';
        document.body.appendChild(a);
        a.click();
        
        // Nettoyage
        window.URL.revokeObjectURL(downloadUrl);
        document.body.removeChild(a);
        
        return true;
    } catch (error) {
        console.error('Échec du téléchargement moderne:', error);
        
        // Solution de repli pour les anciens navigateurs
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = url;
        document.body.appendChild(iframe);
        
        return new Promise((resolve) => {
            setTimeout(() => {
                document.body.removeChild(iframe);
                resolve(true);
            }, 1000);
        });
    }
}





    /**
     * Effectue une requête API
     * @param {string} url - URL de l'API
     * @param {Object} options - Options de la requête
     * @returns {Promise} Promesse de la réponse
     */
    static async apiRequest(url, options = {}) {
        try {
            const defaultOptions = {
                headers: {
                    'Content-Type': 'application/json',
                },
            };

            const finalOptions = { ...defaultOptions, ...options };
            
            const response = await fetch(url, finalOptions);
            
            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }
            
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            } else {
                return response;
            }
        } catch (error) {
            console.error('Erreur API:', error);
            throw error;
        }
    }

    /**
     * Convertit une image en base64
     * @param {File} file - Fichier image
     * @returns {Promise<string>} Image en base64
     */
    static fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    /**
     * Valide un format d'email
     * @param {string} email - Email à valider
     * @returns {boolean} True si valide
     */
    static isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Valide un numéro de téléphone sénégalais
     * @param {string} phone - Numéro à valider
     * @returns {boolean} True si valide
     */
    static isValidSenegalPhone(phone) {
        // Format: 7XXXXXXXX ou +221 7XXXXXXXX
        const phoneRegex = /^(\+221\s?)?[7][0-9]{8}$/;
        return phoneRegex.test(phone.replace(/\s/g, ''));
    }

    /**
     * Débounce une fonction
     * @param {Function} func - Fonction à débouncer
     * @param {number} wait - Délai d'attente en ms
     * @returns {Function} Fonction débouncée
     */
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Gère l'état de chargement d'un bouton
     * @param {HTMLElement} button - Bouton à modifier
     * @param {boolean} loading - État de chargement
     * @param {string} loadingText - Texte pendant le chargement
     */
    static setButtonLoading(button, loading, loadingText = 'Chargement...') {
        if (loading) {
            button.disabled = true;
            button.dataset.originalText = button.innerHTML;
            button.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${loadingText}`;
        } else {
            button.disabled = false;
            button.innerHTML = button.dataset.originalText || button.innerHTML;
        }
    }

    /**
     * Copie du texte dans le presse-papiers
     * @param {string} text - Texte à copier
     * @returns {Promise<boolean>} True si succès
     */
    static async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (error) {
            console.error('Erreur copie presse-papiers:', error);
            return false;
        }
    }

    /**
     * Télécharge un fichier
     * @param {string} url - URL du fichier
     * @param {string} filename - Nom du fichier
     */
    static downloadFile(url, filename) {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    /**
     * Génère un ID unique
     * @returns {string} ID unique
     */
    static generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    /**
     * Échappe les caractères HTML
     * @param {string} text - Texte à échapper
     * @returns {string} Texte échappé
     */
    static escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Vérifie si l'appareil est mobile
     * @returns {boolean} True si mobile
     */
    static isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

static async checkCameraPermission() {
    try {
        if (typeof navigator.permissions === 'undefined') return true;
        
        const result = await navigator.permissions.query({ name: 'camera' });
        return result.state === 'granted';
    } catch (error) {
        console.warn('Permission check error:', error);
        return false;
    }
}

static showPlatformWarning() {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isSafari = /Safari/.test(navigator.userAgent) && /Apple Computer/.test(navigator.vendor);
    
    if (isIOS && !isSafari) {
        const warning = document.createElement('div');
        warning.className = 'platform-warning';
        warning.innerHTML = `
            <i class="fas fa-exclamation-triangle"></i>
            <span>Pour une meilleure expérience, veuillez utiliser Safari sur iOS</span>
        `;
        document.body.prepend(warning);
    }
}
    /**
     * Obtient la date actuelle au format YYYY-MM-DD
     * @returns {string} Date actuelle
     */
    static getCurrentDate() {
        return new Date().toISOString().split('T')[0];
    }

    /**
     * Vérifie si une date est aujourd'hui
     * @param {string|Date} date - Date à vérifier
     * @returns {boolean} True si c'est aujourd'hui
     */
    static isToday(date) {
        const today = new Date();
        const checkDate = typeof date === 'string' ? new Date(date) : date;
        
        return today.toDateString() === checkDate.toDateString();
    }

    /**
     * Formate un nom complet
     * @param {string} prenom - Prénom
     * @param {string} nom - Nom
     * @returns {string} Nom formaté
     */
    static formatFullName(prenom, nom) {
        const formatName = (name) => {
            return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
        };
        
        return `${formatName(prenom)} ${formatName(nom)}`;
    }

    /**
     * Valide les permissions de caméra
     * @returns {Promise<boolean>} True si autorisé
     */
    static async checkCameraPermission() {
        try {
            const result = await navigator.permissions.query({ name: 'camera' });
            return result.state === 'granted';
        } catch (error) {
            console.warn('Impossible de vérifier les permissions caméra:', error);
            return false;
        }
    }

    /**
     * Redimensionne une image
     * @param {File} file - Fichier image
     * @param {number} maxWidth - Largeur maximale
     * @param {number} maxHeight - Hauteur maximale
     * @param {number} quality - Qualité (0-1)
     * @returns {Promise<Blob>} Image redimensionnée
     */
    static resizeImage(file, maxWidth = 800, maxHeight = 600, quality = 0.8) {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            img.onload = () => {
                // Calcul des nouvelles dimensions
                let { width, height } = img;
                
                if (width > height) {
                    if (width > maxWidth) {
                        height = (height * maxWidth) / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = (width * maxHeight) / height;
                        height = maxHeight;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                
                // Dessin de l'image redimensionnée
                ctx.drawImage(img, 0, 0, width, height);
                
                canvas.toBlob(resolve, 'image/jpeg', quality);
            };
            
            img.src = URL.createObjectURL(file);
        });
    }
}

// Export pour utilisation dans d'autres modules
window.Utils = Utils;

// Initialisation des utilitaires globaux
document.addEventListener('DOMContentLoaded', () => {
    console.log('DB-PRESENT Utils chargés');
    
    // Gestion globale des erreurs
    window.addEventListener('error', (event) => {
        console.error('Erreur globale:', event.error);
        Utils.showMessage('Une erreur inattendue s\'est produite', 'error');
    });
    
    // Gestion des erreurs de promesses non capturées
    window.addEventListener('unhandledrejection', (event) => {
        console.error('Promesse rejetée:', event.reason);
        Utils.showMessage('Erreur de connexion', 'error');
    });
});