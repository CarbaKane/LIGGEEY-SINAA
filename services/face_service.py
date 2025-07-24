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
        self.load_known_faces()  # Charge les visages connus à l'initialisation

    def load_known_faces(self):
        """Charge les visages connus depuis la base de données et retourne les logs"""
        logs = []
        try:
            logs.append("\nChargement des visages connus depuis la base de données...")
            db_path = os.path.join('data', 'database.csv')
            
            # Vérifie si la base de données existe
            if not os.path.exists(db_path):
                df = pd.DataFrame(columns=['matricule', 'nom', 'prenom', 'telephone', 
                                        'lieu_habitation', 'departement', 'image_path'])
                df.to_csv(db_path, index=False)
                logs.append("Création d'une nouvelle base de données vide.")
                return logs

            df = pd.read_csv(db_path)
            self.known_face_encodings = []
            self.known_face_metadata = []
            loaded_count = 0
            missing_images = 0
            no_face_detected = 0
            
            header = f"\n{'Matricule':<10} | {'Nom complet':<25} | {'Fichier image':<20} | Statut"
            separator = "-" * 70
            logs.extend([header, separator])
            
            for _, row in df.iterrows():
                status = ""
                if pd.isna(row['image_path']):
                    status = "Aucune image associée"
                    logs.append(f"{row['matricule']:<10} | {row['prenom'] + ' ' + row['nom']:<25} | {'':<20} | {status}")
                    continue
                    
                image_path = os.path.join('data', 'images', row['image_path'])
                
                if not os.path.exists(image_path):
                    status = "Fichier image manquant"
                    missing_images += 1
                    logs.append(f"{row['matricule']:<10} | {row['prenom'] + ' ' + row['nom']:<25} | {row['image_path']:<20} | {status}")
                    continue
                    
                try:
                    image = face_recognition.load_image_file(image_path)
                    face_encodings = face_recognition.face_encodings(image)
                    
                    if len(face_encodings) > 0:
                        self.known_face_encodings.append(face_encodings[0])
                        self.known_face_metadata.append({
                            'matricule': row['matricule'],
                            'nom': row['nom'],
                            'prenom': row['prenom'],
                            'telephone': row['telephone'],
                            'lieu_habitation': row['lieu_habitation'],
                            'departement': row['departement'],
                            'image_path': row['image_path']
                        })
                        status = "Chargé avec succès"
                        loaded_count += 1
                    else:
                        status = "Aucun visage détecté"
                        no_face_detected += 1
                        
                    logs.append(f"{row['matricule']:<10} | {row['prenom'] + ' ' + row['nom']:<25} | {row['image_path']:<20} | {status}")
                    
                except Exception as e:
                    status = f"Erreur traitement: {str(e)}"
                    logs.append(f"{row['matricule']:<10} | {row['prenom'] + ' ' + row['nom']:<25} | {row['image_path']:<20} | {status}")
            
            # Récapitulatif du chargement des visages
            summary = [
                "\nRécapitulatif du chargement:",
                f"- Employés dans la base: {len(df)}",
                f"- Visages chargés avec succès: {loaded_count}",
                f"- Images manquantes: {missing_images}",
                f"- Aucun visage détecté: {no_face_detected}",
                f"- Sans image associée: {len(df) - loaded_count - missing_images - no_face_detected}"
            ]
            logs.extend(summary)
                
        except Exception as e:
            logs.append(f"\nERREUR lors du chargement des visages: {str(e)}")
        
        return logs

    def recognize_face(self, image_data):
        """Reconnaît un visage à partir des données d'image"""
        try:
            # Conversion des données d'image selon le format d'entrée
            if isinstance(image_data, str) and image_data.startswith('data:image/'):
                header, encoded = image_data.split(",", 1)
                binary_data = io.BytesIO(base64.b64decode(encoded))
                image = Image.open(binary_data)
                unknown_image = np.array(image)
                unknown_image = cv2.cvtColor(unknown_image, cv2.COLOR_RGB2BGR)
            else:
                nparr = np.frombuffer(image_data, np.uint8)
                unknown_image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
            # Détection des visages
            face_locations = face_recognition.face_locations(unknown_image)
        
            if len(face_locations) == 0:
                return {
                    'status': 'error',
                    'message': 'Aucun visage détecté'
                }
            
            # Encodage du visage détecté
            unknown_encoding = face_recognition.face_encodings(unknown_image, [face_locations[0]])[0]
        
            # Comparaison avec les visages connus avec une tolérance plus stricte
            face_distances = face_recognition.face_distance(self.known_face_encodings, unknown_encoding)
        
            # Trouver la meilleure correspondance avec une distance minimale
            best_match_index = np.argmin(face_distances)
        
            # Seuil de reconnaissance plus strict (0.5 par défaut, on passe à 0.4)
            if face_distances[best_match_index] < 0.4:
                metadata = self.known_face_metadata[best_match_index]
                
                return {
                    'status': 'success',
                    'employee_id': metadata['matricule'],
                    'full_name': f"{metadata['prenom']} {metadata['nom']}",
                    'department': metadata['departement']
                }
            else:
                return {
                    'status': 'error',
                    'message': 'Visage non reconnu'
                }
            
        except Exception as e:
            return {
                'status': 'error',
                'message': f'Erreur reconnaissance: {str(e)}'
            }

    def get_all_employees(self):
        """Récupère tous les employés de la base de données"""
        try:
            db_path = os.path.join('data', 'database.csv')
            if not os.path.exists(db_path):
                return []
                
            df = pd.read_csv(db_path)
            df = df.fillna('')
            return df.to_dict('records')
        except Exception as e:
            print(f"Erreur get_all_employees: {str(e)}")
            return []

    def add_employee(self, matricule, nom, prenom, telephone, lieu_habitation, departement, photo):
        """Ajoute un nouvel employé à la base de données"""
        try:
            db_path = os.path.join('data', 'database.csv')
            if os.path.exists(db_path):
                df = pd.read_csv(db_path)
                if matricule in df['matricule'].values:
                    return False, "Matricule existe déjà"
            else:
                df = pd.DataFrame(columns=['matricule', 'nom', 'prenom', 'telephone', 
                                         'lieu_habitation', 'departement', 'image_path'])
            
            # Création du répertoire images si nécessaire
            os.makedirs(os.path.join('data', 'images'), exist_ok=True)
            
            # Vérification du format de l'image
            file_ext = photo.filename.split('.')[-1].lower()
            if file_ext not in ['jpg', 'jpeg', 'png']:
                return False, "Format image non supporté (seuls JPG/JPEG/PNG sont acceptés)"
            
            # Génération du nom de fichier
            filename = f"{prenom.lower()}_{nom.lower()}.{file_ext}"
            image_path = os.path.join('data', 'images', filename)
            
            # Sauvegarde de l'image
            photo.save(image_path)
            
            # Vérification que l'image contient un visage
            try:
                image = face_recognition.load_image_file(image_path)
                face_locations = face_recognition.face_locations(image)
                if len(face_locations) == 0:
                    os.remove(image_path)
                    return False, "Aucun visage détecté dans la photo"
                    
            except Exception as e:
                if os.path.exists(image_path):
                    os.remove(image_path)
                return False, f"Erreur traitement image: {str(e)}"
            
            # Ajout de l'employé à la base de données
            new_employee = {
                'matricule': matricule,
                'nom': nom,
                'prenom': prenom,
                'telephone': telephone if telephone else '',
                'lieu_habitation': lieu_habitation if lieu_habitation else '',
                'departement': departement,
                'image_path': filename
            }
            
            df = pd.concat([df, pd.DataFrame([new_employee])], ignore_index=True)
            df.to_csv(db_path, index=False)
            
            # Rechargement des visages connus
            self.load_known_faces()
            
            return True, f"Employé {prenom} {nom} ajouté avec succès"
            
        except Exception as e:
            print(f"Erreur ajout employé: {str(e)}")
            return False, f"Erreur ajout: {str(e)}"
    
    def delete_employee(self, matricule):
        """Supprime un employé de la base de données"""
        try:
            db_path = os.path.join('data', 'database.csv')
            df = pd.read_csv(db_path)
            
            if matricule not in df['matricule'].values:
                return False, "Employé non trouvé"
                
            employee = df[df['matricule'] == matricule].iloc[0]
            
            # Suppression de l'image associée
            if not pd.isna(employee['image_path']):
                image_path = os.path.join('data', 'images', employee['image_path'])
                if os.path.exists(image_path):
                    os.remove(image_path)
            
            # Suppression de l'entrée dans la base de données
            df = df[df['matricule'] != matricule]
            df.to_csv(db_path, index=False)
            
            # Rechargement des visages connus
            self.load_known_faces()
            
            return True, "Employé supprimé avec succès"
            
        except Exception as e:
            print(f"Erreur suppression employé: {str(e)}")
            return False, f"Erreur suppression: {str(e)}"
