// Gestion de la caméra et reconnaissance faciale améliorée

class CameraManager {
    constructor() {
        this.video = document.getElementById('camera');
        this.canvas = document.getElementById('canvas');
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.captureBtn = document.getElementById('captureBtn');
        this.cameraStatus = document.getElementById('cameraStatus');
        
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
            Utils.showMessage('Erreur lors du chargement de la vidéo', 'error');
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
                    facingMode: 'user',
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
            
            Utils.showMessage('Caméra démarrée', 'success', 3000);
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
            
            Utils.showMessage(errorMessage, 'error');
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
            
            Utils.showMessage('Caméra arrêtée', 'success', 2000);
            
        } catch (error) {
            console.error('Erreur arrêt caméra:', error);
            Utils.showMessage('Erreur lors de l\'arrêt', 'error');
        }
    }

    async captureAndRecognize() {
        if (this.isCapturing) return;
        const currentTime = Date.now();
        
        if (currentTime - this.lastCaptureTime < this.captureDelay) {
            Utils.showMessage('Veuillez attendre avant un nouveau scan', 'warning');
            return;
        }
        
        try {
            this.isCapturing = true;
            this.lastCaptureTime = currentTime;
            
            Utils.setButtonLoading(this.captureBtn, true, 'Analyse...');
            
            // Capture optimisée
            const imageData = this.captureFrame();
            if (!imageData) {
                throw new Error('Impossible de capturer l\'image');
            }
            
            // Envoi avec timeout
            const result = await Promise.race([
                this.sendForRecognition(imageData),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Délai dépassé')), 10000))
            ]);
            
            if (result.status === 'success') {
                Utils.showMessage(result.message, 'success');
                this.video.classList.add('pulse');
                setTimeout(() => this.video.classList.remove('pulse'), 1000);
            } else {
                Utils.showMessage(result.message, 'error');
            }
            
        } catch (error) {
            console.error('Erreur reconnaissance:', error);
            Utils.showMessage(
                error.message === 'Délai dépassé' 
                    ? 'La reconnaissance prend trop de temps' 
                    : 'Erreur de reconnaissance',
                'error'
            );
        } finally {
            this.isCapturing = false;
            Utils.setButtonLoading(this.captureBtn, false);
        }
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