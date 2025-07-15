import os
import cv2
import numpy as np
import face_recognition
import pandas as pd
from datetime import datetime
import base64
import io
from PIL import Image

class FaceService:
    def __init__(self):
        self.known_face_encodings = []
        self.known_face_metadata = []
        self.load_known_faces()

    def load_known_faces(self):
        """Charge les visages connus depuis la base de données"""
        try:
            # Charger la base de données CSV
            db_path = os.path.join('data', 'database.csv')
            if not os.path.exists(db_path):
                df = pd.DataFrame(columns=['matricule', 'nom', 'prenom', 'telephone', 'departement', 'image_path'])
                df.to_csv(db_path, index=False)
                print("[INFO] Base de données créée avec succès")
                return

            df = pd.read_csv(db_path)
            
            # Réinitialiser les données
            self.known_face_encodings = []
            self.known_face_metadata = []
            
            print("\n[INFO] Chargement des visages enregistrés:")
            for _, row in df.iterrows():
                image_path = os.path.join('data', 'images', row['image_path'])
                if not os.path.exists(image_path):
                    print(f"[WARNING] Fichier image manquant pour {row['prenom']} {row['nom']}: {image_path}")
                    continue
                
                # Charger l'image
                image = face_recognition.load_image_file(image_path)
                
                # Détecter les encodages faciaux
                face_encodings = face_recognition.face_encodings(image)
                if len(face_encodings) > 0:
                    self.known_face_encodings.append(face_encodings[0])
                    self.known_face_metadata.append({
                        'matricule': row['matricule'],
                        'nom': row['nom'],
                        'prenom': row['prenom'],
                        'telephone': row['telephone'],
                        'departement': row['departement'],
                        'image_path': row['image_path']
                    })
                    print(f"[SUCCESS] Visage validé: {row['prenom']} {row['nom']} ({row['matricule']})")
                else:
                    print(f"[WARNING] Aucun visage détecté dans l'image de {row['prenom']} {row['nom']}")
                    
            print(f"\n[INFO] Chargement terminé. {len(self.known_face_encodings)} visages valides enregistrés")
            
        except Exception as e:
            print(f"[ERROR] Erreur lors du chargement des visages connus: {str(e)}")

    def _is_object(self, image_data):
        """Détecte si l'image est un objet plutôt qu'un visage réel"""
        try:
            # Convertir l'image en numpy array
            image = self._convert_image_data(image_data)
            
            # Vérifier la présence de visages
            face_locations = face_recognition.face_locations(image)
            
            # Si aucun visage détecté ou si l'image est trop plate (photo de photo)
            if len(face_locations) == 0:
                return True
                
            # Vérifier la variance de l'image (photo de photo a souvent une variance faible)
            gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
            variance = cv2.Laplacian(gray, cv2.CV_64F).var()
            
            if variance < 100:  # Seuil empirique
                return True
                
            return False
            
        except Exception as e:
            print(f"[ERROR] Erreur détection objet: {str(e)}")
            return False

    def _convert_image_data(self, image_data):
        """Convertit les données d'image en format numpy array"""
        if isinstance(image_data, np.ndarray):
            return image_data
            
        if isinstance(image_data, str) and image_data.startswith('data:image/'):
            header, encoded = image_data.split(",", 1)
            binary_data = io.BytesIO(base64.b64decode(encoded))
            image = Image.open(binary_data)
            return np.array(image)
        else:
            nparr = np.frombuffer(image_data, np.uint8)
            return cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    def recognize_face(self, image_data):
        """Reconnaît un visage à partir des données d'image"""
        try:
            # Vérifier si c'est un objet
            if self._is_object(image_data):
                return {
                    'status': 'error',
                    'message': 'Vous essayez de tricher avec un objet.'
                }
            
            # Convertir l'image
            unknown_image = self._convert_image_data(image_data)
            
            # Trouver tous les visages dans l'image
            face_locations = face_recognition.face_locations(unknown_image)
            
            if len(face_locations) == 0:
                return {
                    'status': 'error',
                    'message': 'Aucun visage détecté. Placez-vous correctement devant la caméra.'
                }
                
            # Encoder le premier visage trouvé
            unknown_encoding = face_recognition.face_encodings(unknown_image, [face_locations[0]])[0]
            
            # Comparer avec les visages connus
            matches = face_recognition.compare_faces(self.known_face_encodings, unknown_encoding, tolerance=0.5)
            
            if True in matches:
                first_match_index = matches.index(True)
                metadata = self.known_face_metadata[first_match_index]
                
                return {
                    'status': 'success',
                    'employee_id': metadata['matricule'],
                    'full_name': f"{metadata['prenom']} {metadata['nom']}",
                    'department': metadata['departement']
                }
            else:
                return {
                    'status': 'error',
                    'message': 'Visage non reconnu. Vous n\'êtes pas enregistré dans le système.'
                }
                
        except Exception as e:
            return {
                'status': 'error',
                'message': f'Erreur de reconnaissance: {str(e)}'
            }

    def get_all_employees(self):
        try:
            db_path = os.path.join('data', 'database.csv')
            if not os.path.exists(db_path):
                return []  # Retourne une liste vide si le fichier n'existe pas
                
            df = pd.read_csv(db_path)
            # Convertir les NaN en chaînes vides
            df = df.fillna('')
            return df.to_dict('records')
        except Exception as e:
            print(f"[ERROR] Erreur get_all_employees: {str(e)}")
            return []  # Toujours retourner une liste même en cas d'erreur
    
    def add_employee(self, matricule, nom, prenom, telephone, departement, photo):
        """Ajoute un nouvel employé à la base de données"""
        try:
            # Vérifier si le matricule existe déjà
            db_path = os.path.join('data', 'database.csv')
            if os.path.exists(db_path):
                df = pd.read_csv(db_path)
                if matricule in df['matricule'].values:
                    return False, "Un employé avec ce matricule existe déjà"
            else:
                df = pd.DataFrame(columns=['matricule', 'nom', 'prenom', 'telephone', 'departement', 'image_path'])
            
            # Créer le répertoire images s'il n'existe pas
            os.makedirs(os.path.join('data', 'images'), exist_ok=True)
            
            # Vérifier et traiter la photo
            if not photo:
                return False, "Aucune photo fournie"
            
            # Générer le nom de fichier selon le format prenom_nom.ext
            file_ext = photo.filename.split('.')[-1].lower()
            if file_ext not in ['jpg', 'jpeg', 'png']:
                return False, "Format de fichier non supporté (seuls JPG, JPEG et PNG sont acceptés)"
            
            filename = f"{prenom.lower()}_{nom.lower()}.{file_ext}"
            image_path = os.path.join('data', 'images', filename)
            
            # Sauvegarder l'image
            photo.save(image_path)
            
            # Vérifier que l'image est valide et contient un visage
            try:
                img = cv2.imread(image_path)
                if img is None:
                    os.remove(image_path)
                    return False, "L'image est corrompue ou invalide"
                
                # Vérifier la présence d'un visage
                image = face_recognition.load_image_file(image_path)
                face_locations = face_recognition.face_locations(image)
                if len(face_locations) == 0:
                    os.remove(image_path)
                    return False, "Aucun visage détecté dans la photo. Veuillez fournir une photo claire de votre visage."
                    
            except Exception as e:
                if os.path.exists(image_path):
                    os.remove(image_path)
                return False, f"Erreur de traitement de l'image: {str(e)}"
            
            # Ajouter à la base de données
            new_employee = {
                'matricule': matricule,
                'nom': nom,
                'prenom': prenom,
                'telephone': telephone if telephone else '',
                'departement': departement,
                'image_path': filename
            }
            
            df = pd.concat([df, pd.DataFrame([new_employee])], ignore_index=True)
            df.to_csv(db_path, index=False)
            
            # Recharger les visages
            self.load_known_faces()
            
            return True, f"Employé {prenom} {nom} ajouté avec succès. Photo enregistrée sous {filename}"
            
        except Exception as e:
            print(f"[ERROR] Erreur ajout employé: {str(e)}")
            return False, f"Erreur lors de l'ajout: {str(e)}"

    def delete_employee(self, matricule):
        """Supprime un employé de la base de données"""
        try:
            db_path = os.path.join('data', 'database.csv')
            df = pd.read_csv(db_path)
            
            if matricule not in df['matricule'].values:
                return False, "Employé non trouvé"
                
            # Supprimer l'image associée
            employee = df[df['matricule'] == matricule].iloc[0]
            image_path = os.path.join('data', 'images', employee['image_path'])
            if os.path.exists(image_path):
                os.remove(image_path)
            
            # Supprimer de la base de données
            df = df[df['matricule'] != matricule]
            df.to_csv(db_path, index=False)
            
            # Recharger les visages
            self.load_known_faces()
            
            return True, "Employé supprimé avec succès"
            
        except Exception as e:
            print(f"[ERROR] Erreur suppression employé: {str(e)}")
            return False, f"Erreur lors de la suppression: {str(e)}"