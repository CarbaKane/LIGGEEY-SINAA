// Gestion de la caméra et reconnaissance faciale améliorée

class CameraManager {
    constructor() {
        this.video = document.getElementById('camera');
        this.canvas = document.getElementById('canvas');
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.captureBtn = document.getElementById('captureBtn');
        this.cameraStatus = document.getElementById('cameraStatus');
        this.messageContainer = document.getElementById('messageContainer');
        
        this.stream = null;
        this.isCapturing = false;
        this.autoScanInterval = null;
        this.lastCaptureTime = 0;
        this.captureDelay = 3000; // 3 secondes entre les captures
        this.isMobile = Utils.isMobile();
        
        this.init();
    }

    init() {
        // Détection de plateforme
        this.detectPlatform();
        
        // Événements des boutons
        this.startBtn.addEventListener('click', () => this.startCamera());
        this.stopBtn.addEventListener('click', () => this.stopCamera());
        this.captureBtn.addEventListener('click', () => this.captureAndRecognize());

        // Gestion des erreurs vidéo
        this.video.addEventListener('error', (e) => {
            console.error('Erreur vidéo:', e);
            this.showScanMessage('Erreur lors du chargement de la vidéo', false);
        });

        // Mise à jour du statut
        this.video.addEventListener('loadedmetadata', () => {
            this.updateCameraStatus(true);
        });

        console.log('CameraManager initialisé');
    }

    detectPlatform() {
        const userAgent = navigator.userAgent || navigator.vendor || window.opera;
        
        // iOS detection
        if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
            this.platform = 'ios';
            document.getElementById('platformWarning').style.display = 'block';
        } 
        // Android detection
        else if (/android/i.test(userAgent)) {
            this.platform = 'android';
        } 
        // Desktop
        else {
            this.platform = 'desktop';
        }
    }

    async startCamera() {
        try {
            Utils.setButtonLoading(this.startBtn, true, 'Démarrage...');
            
            // Configuration optimisée pour mobile
            const constraints = {
                video: {
                    width: { ideal: this.isMobile ? 480 : 640 },
                    height: { ideal: this.isMobile ? 640 : 480 },
                    facingMode: 'user', // Changer pour 'environment' pour la caméra arrière
                    frameRate: { ideal: 15, max: 30 }
                },
                audio: false
            };

            // Solution pour iOS/Safari
            if (this.platform === 'ios') {
                constraints.video.facingMode = { exact: 'user' };
            }

            this.stream = await navigator.mediaDevices.getUserMedia(constraints)
                .catch(err => {
                    if (err.name === 'NotAllowedError') {
                        throw new Error('Permission refusée. Veuillez autoriser la caméra.');
                    }
                    throw err;
                });

            this.video.srcObject = this.stream;
            
            // Solution pour iOS qui ne déclenche pas toujours loadedmetadata
            await new Promise((resolve, reject) => {
                const timer = setTimeout(() => {
                    if (this.video.readyState >= 1) resolve();
                    else reject(new Error('Timeout chargement vidéo'));
                }, 2000);
                
                this.video.onloadedmetadata = () => {
                    clearTimeout(timer);
                    resolve();
                };
            });

            await this.video.play().catch(err => {
                console.error('Erreur lecture vidéo:', err);
                throw new Error('Erreur de démarrage de la caméra');
            });
            
            this.updateButtons(true);
            this.updateCameraStatus(true);
            
            this.showScanMessage('Caméra démarrée', true);
            this.startAutoScan();
            
        } catch (error) {
            console.error('Erreur démarrage caméra:', error);
            
            let errorMessage = 'Impossible d\'accéder à la caméra';
            
            if (error.name === 'NotAllowedError') {
                errorMessage = 'Permission caméra refusée. Autorisez dans les paramètres.';
            } else if (error.name === 'NotFoundError') {
                errorMessage = 'Aucune caméra trouvée.';
            } else if (error.name === 'NotReadableError') {
                errorMessage = 'Caméra déjà utilisée par une autre application.';
            } else if (error.message.includes('Timeout')) {
                errorMessage = 'Délai de démarrage dépassé. Réessayez.';
            }
            
            this.showScanMessage(errorMessage, false);
            this.updateCameraStatus(false);
        } finally {
            Utils.setButtonLoading(this.startBtn, false);
        }
    }

    stopCamera() {
        try {
            this.stopAutoScan();
            
            if (this.stream) {
                this.stream.getTracks().forEach(track => track.stop());
                this.stream = null;
            }
            
            this.video.srcObject = null;
            this.updateButtons(false);
            this.updateCameraStatus(false);
            
            this.showScanMessage('Caméra arrêtée', true);
            
        } catch (error) {
            console.error('Erreur arrêt caméra:', error);
            this.showScanMessage('Erreur lors de l\'arrêt', false);
        }
    }

    async captureAndRecognize() {
    if (this.isCapturing) return;
    
    try {
        this.isCapturing = true;
        const imageData = this.captureFrame();
        if (!imageData) throw new Error('Impossible de capturer l\'image');

        const response = await this.sendForRecognition(imageData);
        
        // Gestion spéciale pour le cas "déjà complet"
        if (response.action === 'deja_complet') {
            this.showScanMessage(response.message, false);
            return;
        }
        
        if (response.status === 'success') {
            this.showScanMessage(response.message, true);
            this.video.classList.add('pulse');
            setTimeout(() => this.video.classList.remove('pulse'), 1000);
        } else {
            this.showScanMessage(response.message, false);
        }
        
    } catch (error) {
        this.showScanMessage(
            error.message.includes('déjà complété') ? 
            error.message : 'Erreur de reconnaissance',
            false
        );
    } finally {
        this.isCapturing = false;
    }
}

    showScanMessage(message, isSuccess) {
        // Création du conteneur de message s'il n'existe pas
        if (!this.messageContainer) {
            this.messageContainer = document.createElement('div');
            this.messageContainer.id = 'messageContainer';
            this.messageContainer.style.position = 'fixed';
            this.messageContainer.style.bottom = '20px';
            this.messageContainer.style.left = '0';
            this.messageContainer.style.right = '0';
            this.messageContainer.style.display = 'flex';
            this.messageContainer.style.justifyContent = 'center';
            this.messageContainer.style.zIndex = '1000';
            document.body.appendChild(this.messageContainer);
        }

        // Création du message
        const messageDiv = document.createElement('div');
        messageDiv.className = `scan-message ${isSuccess ? 'success' : 'error'}`;
        messageDiv.style.maxWidth = '90%';
        messageDiv.style.padding = '12px 20px';
        messageDiv.style.borderRadius = '8px';
        messageDiv.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
        messageDiv.style.display = 'flex';
        messageDiv.style.alignItems = 'center';
        messageDiv.style.gap = '10px';
        messageDiv.style.color = '#000';
        messageDiv.style.backgroundColor = isSuccess ? 'rgba(16, 185, 129, 0.9)' : 'rgba(239, 68, 68, 0.9)';
        messageDiv.style.transform = 'translateY(30px)';
        messageDiv.style.opacity = '0';
        messageDiv.style.transition = 'all 0.3s ease-out';
        
        messageDiv.innerHTML = `
            <i class="fas fa-${isSuccess ? 'check-circle' : 'exclamation-circle'}" 
               style="font-size: 1.2rem;"></i>
            <span>${message}</span>
        `;

        // Ajout au conteneur
        this.messageContainer.innerHTML = '';
        this.messageContainer.appendChild(messageDiv);

        // Animation d'apparition
        setTimeout(() => {
            messageDiv.style.transform = 'translateY(0)';
            messageDiv.style.opacity = '1';
        }, 10);

        // Disparition après 5 secondes
        setTimeout(() => {
            messageDiv.style.opacity = '0';
            messageDiv.style.transform = 'translateY(30px)';
            setTimeout(() => {
                messageDiv.remove();
            }, 300);
        }, 5000);
    }

    captureFrame() {
        try {
            if (!this.video.videoWidth || !this.video.videoHeight) {
                return null;
            }
            
            // Dimensions optimisées pour mobile
            const maxWidth = this.isMobile ? 480 : 640;
            const maxHeight = this.isMobile ? 640 : 480;
            
            let { videoWidth, videoHeight } = this.video;
            
            // Maintien du ratio
            const aspectRatio = videoWidth / videoHeight;
            if (videoWidth > maxWidth) {
                videoWidth = maxWidth;
                videoHeight = videoWidth / aspectRatio;
            }
            if (videoHeight > maxHeight) {
                videoHeight = maxHeight;
                videoWidth = videoHeight * aspectRatio;
            }
            
            this.canvas.width = videoWidth;
            this.canvas.height = videoHeight;
            
            const ctx = this.canvas.getContext('2d');
            ctx.drawImage(this.video, 0, 0, videoWidth, videoHeight);
            
            // Qualité réduite sur mobile pour performance
            return this.canvas.toDataURL('image/jpeg', this.isMobile ? 0.6 : 0.8);
            
        } catch (error) {
            console.error('Erreur capture frame:', error);
            return null;
        }
    }

    async sendForRecognition(imageData) {
        try {
            const response = await Utils.apiRequest('/api/detect', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    image: imageData,
                    platform: this.platform 
                })
            });
            
            if (!response) {
                throw new Error('Réponse vide du serveur');
            }
            
            return response;
            
        } catch (error) {
            console.error('Erreur envoi reconnaissance:', error);
            throw error;
        }
    }

    startAutoScan() {
        if (this.autoScanInterval) clearInterval(this.autoScanInterval);
        
        this.autoScanInterval = setInterval(() => {
            if (!this.isCapturing && this.stream && this.video.readyState === 4) {
                this.captureAndRecognize();
            }
        }, 5000);  // Scan auto toutes les 5 secondes
    }

    stopAutoScan() {
        if (this.autoScanInterval) {
            clearInterval(this.autoScanInterval);
            this.autoScanInterval = null;
        }
    }

    updateButtons(cameraActive) {
        this.startBtn.disabled = cameraActive;
        this.stopBtn.disabled = !cameraActive;
        this.captureBtn.disabled = !cameraActive;
        
        if (cameraActive) {
            this.startBtn.style.display = 'none';
            this.stopBtn.style.display = 'inline-flex';
            this.captureBtn.style.display = 'inline-flex';
        } else {
            this.startBtn.style.display = 'inline-flex';
            this.stopBtn.style.display = 'none';
            this.captureBtn.style.display = 'none';
        }
    }

    updateCameraStatus(active) {
        if (active) {
            this.cameraStatus.innerHTML = `
                <i class="fas fa-video"></i>
                <span>Caméra active - Prêt à scanner</span>
            `;
            this.cameraStatus.style.background = 'rgba(16, 185, 129, 0.8)';
        } else {
            this.cameraStatus.innerHTML = `
                <i class="fas fa-video-slash"></i>
                <span>Caméra désactivée</span>
            `;
            this.cameraStatus.style.background = 'rgba(0, 0, 0, 0.7)';
        }
    }

    cleanup() {
        this.stopCamera();
    }
}

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
    // Ajout d'un avertissement pour iOS
    const platformWarning = document.createElement('div');
    platformWarning.id = 'platformWarning';
    platformWarning.style.display = 'none';
    platformWarning.style.background = 'rgba(239, 68, 68, 0.9)';
    platformWarning.style.color = 'white';
    platformWarning.style.padding = '1rem';
    platformWarning.style.borderRadius = '8px';
    platformWarning.style.marginBottom = '1rem';
    platformWarning.style.textAlign = 'center';
    platformWarning.innerHTML = `
        <i class="fas fa-exclamation-triangle"></i>
        <strong>iOS nécessite Safari pour accéder à la caméra.</strong>
        Veuillez utiliser Safari pour une meilleure expérience.
    `;
    
    const recognitionSection = document.querySelector('.recognition-section');
    if (recognitionSection) {
        recognitionSection.insertBefore(platformWarning, recognitionSection.firstChild);
    }

    if (!document.getElementById('camera')) return;
    
    const cameraManager = new CameraManager();
    
    window.addEventListener('beforeunload', () => cameraManager.cleanup());
    
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            cameraManager.stopAutoScan();
        } else if (cameraManager.stream) {
            cameraManager.startAutoScan();
        }
    });
    
    window.cameraManager = cameraManager;
});