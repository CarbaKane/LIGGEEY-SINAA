from flask import Flask, render_template, request, jsonify, send_from_directory, session, redirect, url_for, send_file, flash
from flask_cors import CORS
from services.face_service import FaceService
from services.attendance import AttendanceService
import os
from datetime import datetime, timedelta
import pandas as pd
import io
import base64
import cv2
import numpy as np

app = Flask(__name__)
CORS(app)
app.secret_key = 'DB_Carba_Secret_Key_2025'

# Initialisation des services
print("\n=== Initialisation du système LIGGUEY-SINAA ===")
print("Chargement des services...")
face_service = FaceService()
attendance_service = AttendanceService()
print("\nServices chargés avec succès!")

# Configuration
app.config['UPLOAD_FOLDER'] = 'data/images'
app.config['ALLOWED_EXTENSIONS'] = {'png', 'jpg', 'jpeg'}
# la taille limite des images
app.config['MAX_CONTENT_LENGTH'] = 2 * 1024 * 1024  # 2MB max

# un middleware pour vérifier le Content-Type

@app.before_request
def check_json():
    # Exclure les routes qui nécessitent multipart/form-data
    excluded_routes = ['/api/employee/add', '/api/employee/update/']
    
    if (request.method in ['POST', 'PUT'] 
        and request.path.startswith('/api')
        and not any(request.path.startswith(route) for route in excluded_routes)):
        if not request.is_json:
            return jsonify({'error': 'Content-Type doit être application/json'}), 400




def allowed_file(filename):
    return ('.' in filename and 
            filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS'] and
            len(filename) < 100)  # Limite la longueur du nom de fichier

def is_admin_user(matricule):
    """Vérifie si l'utilisateur est un administrateur"""
    return matricule == 'DB'

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/admin')
def admin():
    if 'admin_logged_in' not in session:
        return redirect(url_for('admin_login'))
    return render_template('admin.html')

@app.route('/admin/login', methods=['GET', 'POST'])
def admin_login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        
        if username == 'DB' and password == 'CarbaDB':
            session['admin_logged_in'] = True
            return redirect(url_for('admin'))
        else:
            return render_template('admin_login.html', error="Identifiants incorrects")
    
    return render_template('admin_login.html')

@app.route('/admin/logout')
def admin_logout():
    session.pop('admin_logged_in', None)
    return redirect(url_for('index'))

@app.route('/api/detect', methods=['POST'])
def detect_face():
    try:
        if not request.json or 'image' not in request.json:
            return jsonify({'status': 'error', 'message': 'Aucune image fournie'}), 400
        
        image_data = request.json['image']
        result = face_service.recognize_face(image_data)
        
        if result['status'] == 'success':
            if is_admin_user(result['employee_id']):
                return jsonify({
                    'status': 'success',
                    'message': f'Bonjour Administrateur {result["full_name"]}. Accès autorisé.',
                    'data': {
                        'employee_id': result['employee_id'],
                        'full_name': result['full_name'],
                        'department': result['department'],
                        'is_admin': True
                    }
                })
            
            attendance_result = attendance_service.record_attendance(
                result['employee_id'],
                result['full_name'],
                result['department']
            )
            
            return jsonify(attendance_result)
        else:
            return jsonify(result), 400
            
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500
    





    
    
@app.route('/api/holidays', methods=['GET'])
def get_holidays():
    if 'admin_logged_in' not in session:
        return jsonify({'error': 'Non autorisé'}), 401
    
    try:
        year = datetime.now().year  # Ajout de cette ligne
        holidays_file = os.path.join('data', 'FERIERS', f'feriers{year}.csv')
        if not os.path.exists(holidays_file):
            return jsonify([])
            
        df = pd.read_csv(holidays_file)
        return jsonify(df.to_dict('records'))
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/holidays/add', methods=['POST'])
def add_holiday():
    if 'admin_logged_in' not in session:
        return jsonify({'error': 'Non autorisé'}), 401
    
    try:
        data = request.get_json()
        description = data.get('description')
        date_debut = data.get('date_debut')
        date_fin = data.get('date_fin')
        
        if not all([description, date_debut, date_fin]):
            return jsonify({'error': 'Tous les champs sont requis'}), 400
            
        holidays_file = os.path.join('data', 'FERIERS', 'feriers2025.csv')
        os.makedirs(os.path.dirname(holidays_file), exist_ok=True)
        
        new_data = {
            'description': [description],
            'date_debut': [date_debut],
            'date_fin': [date_fin]
        }
        
        if os.path.exists(holidays_file):
            df = pd.read_csv(holidays_file)
            new_df = pd.concat([df, pd.DataFrame(new_data)], ignore_index=True)
        else:
            new_df = pd.DataFrame(new_data)
            
        new_df.to_csv(holidays_file, index=False)
        return jsonify({'status': 'success'})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500    
    
    
    # Dans app.py, ajoutez ces nouvelles routes juste après les routes pour les congés

# Dans app.py, modifiez la route /api/missions comme suit :
@app.route('/api/missions', methods=['GET'])
def get_missions():
    if 'admin_logged_in' not in session:
        return jsonify({'error': 'Non autorisé'}), 401
    
    try:
        missions_file = os.path.join('data', 'MISSIONS', 'missions2025.csv')
        
        if not os.path.exists(missions_file):
            return jsonify([])
            
        df = pd.read_csv(missions_file)
        
        # Remplacer les NaN par des chaînes vides
        df = df.fillna('')
        
        # Filtrage par matricule si spécifié
        matricule = request.args.get('matricule')
        if matricule:
            df = df[df['matricule'].astype(str) == str(matricule)]
            
        # Filtrage par mois si spécifié
        month = request.args.get('month')
        if month:
            try:
                target_month = datetime.strptime(month, '%Y-%m').month
                df['date_debut'] = pd.to_datetime(df['date debut'])
                df = df[df['date_debut'].dt.month == target_month]
                df = df.drop(columns=['date_debut'])
            except ValueError:
                pass
                
        # Convertir les dates en format string
        if 'date debut' in df.columns:
            df['date debut'] = pd.to_datetime(df['date debut']).dt.strftime('%Y-%m-%d')
        if 'date fin' in df.columns:
            df['date fin'] = pd.to_datetime(df['date fin']).dt.strftime('%Y-%m-%d')
                
        return jsonify(df.to_dict('records'))
    except Exception as e:
        app.logger.error(f"Erreur récupération missions: {str(e)}")
        return jsonify({'error': str(e)}), 500
    
    # trunk-ignore(git-diff-check/error)
    
@app.route('/api/missions/add', methods=['POST'])
def add_mission():
    if 'admin_logged_in' not in session:
        return jsonify({'error': 'Non autorisé'}), 401
    
    # Vérifier que la requête contient bien du JSON
    if not request.is_json:
        return jsonify({'error': 'Content-Type doit être application/json'}), 400
    
    try:
        data = request.get_json()

        # Vérification des champs obligatoires
        required_fields = ['matricule', 'nom_complet', 'nom_mission', 'date_debut', 'date_fin']
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({'error': f'Le champ {field} est requis'}), 400

        matricule = str(data['matricule']).strip()
        full_name = str(data['nom_complet']).strip()
        mission_name = str(data['nom_mission']).strip()
        date_debut = str(data['date_debut']).strip()
        date_fin = str(data['date_fin']).strip()

        # Validation des dates
        try:
            debut_dt = datetime.strptime(date_debut, '%Y-%m-%d')
            fin_dt = datetime.strptime(date_fin, '%Y-%m-%d')
            today = datetime.now().date()

            if fin_dt.date() < debut_dt.date():
                return jsonify({'error': 'La date de fin doit être après la date de début'}), 400
                
            if debut_dt.date() < today:
                return jsonify({'error': 'La date de début ne peut pas être dans le passé'}), 400
                
        except ValueError as e:
            return jsonify({'error': f'Format de date invalide: {str(e)}'}), 400
            
        # Vérifier que l'employé existe
        db_path = os.path.join('data', 'database.csv')
        if not os.path.exists(db_path):
            return jsonify({'error': 'Base de données des employés introuvable'}), 404
            
        df_employees = pd.read_csv(db_path)
        if matricule not in df_employees['matricule'].values:
            return jsonify({'error': f'Matricule {matricule} non trouvé'}), 404
            
        # Vérifier les chevauchements de missions
        missions_file = os.path.join('data', 'MISSIONS', 'missions2025.csv')
        if os.path.exists(missions_file):
            df_missions = pd.read_csv(missions_file)
            
            # Convertir les dates existantes en objets date pour comparaison
            for _, row in df_missions.iterrows():
                if str(row['matricule']) == matricule:
                    existing_start = datetime.strptime(row['date debut'], '%Y-%m-%d').date()
                    existing_end = datetime.strptime(row['date fin'], '%Y-%m-%d').date()
                    
                    # Vérifier le chevauchement
                    if not (fin_dt.date() < existing_start or debut_dt.date() > existing_end):
                        return jsonify({
                            'error': f'Mission existante du {existing_start} au {existing_end}'
                        }), 400
        
        # Créer le répertoire si nécessaire
        os.makedirs(os.path.dirname(missions_file), exist_ok=True)
        
        # Ajouter la nouvelle mission
        new_mission = {
            'matricule': [matricule],
            'nom complet': [full_name],
            'nom mission': [mission_name],
            'date debut': [date_debut],
            'date fin': [date_fin]
        }
        
        new_df = pd.DataFrame(new_mission)
        if os.path.exists(missions_file):
            df_missions = pd.read_csv(missions_file)
            new_df = pd.concat([df_missions, new_df], ignore_index=True)
        
        new_df.to_csv(missions_file, index=False)
        
        return jsonify({'status': 'success'})
        
    except Exception as e:
        app.logger.error(f"Erreur ajout mission: {str(e)}")
        return jsonify({'error': f'Erreur serveur: {str(e)}'}), 500

@app.route('/api/missions/delete/<matricule>/<date_debut>', methods=['DELETE'])
def delete_mission(matricule, date_debut):
    if 'admin_logged_in' not in session:
        return jsonify({'error': 'Non autorisé'}), 401
    
    try:
        missions_file = os.path.join('data', 'MISSIONS', 'missions2025.csv')
        
        if not os.path.exists(missions_file):
            return jsonify({'error': 'Aucune mission enregistrée'}), 404
            
        df = pd.read_csv(missions_file)
        initial_count = len(df)
        
        # Suppression avec vérification du format de date
        df = df[~((df['matricule'] == matricule) & 
                (df['date debut'] == date_debut))]
        
        if len(df) == initial_count:
            return jsonify({'error': 'Mission non trouvée'}), 404
            
        df.to_csv(missions_file, index=False)
        return jsonify({'status': 'success'})
        
    except Exception as e:
        app.logger.error(f"Erreur suppression mission: {str(e)}")
        return jsonify({'error': str(e)}), 500
    
    
    
@app.route('/api/employees', methods=['GET'])
def get_employees():
    if 'admin_logged_in' not in session:
        return jsonify({'error': 'Non autorisé'}), 401
    
    try:
        employees = face_service.get_all_employees()
        return jsonify(employees)
    except Exception as e:
        print(f"[ERREUR] Récupération employés: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/present-employees', methods=['GET'])
def get_present_employees():
    if 'admin_logged_in' not in session:
        return jsonify({'error': 'Non autorisé'}), 401
    
    try:
        present_employees = attendance_service.get_current_present_employees()
        return jsonify(present_employees)
    except Exception as e:
        print(f"[ERREUR] Récupération employés présents: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/absent-employees', methods=['GET'])
def get_absent_employees():
    if 'admin_logged_in' not in session:
        return jsonify({'error': 'Non autorisé'}), 401
    
    try:
        date = request.args.get('date', datetime.now().strftime('%Y-%m-%d'))
        department = request.args.get('department', '')
        absent_employees = attendance_service.get_absent_employees(date, department)
        return jsonify(absent_employees)
    except Exception as e:
        print(f"[ERREUR] Récupération employés absents: {str(e)}")
        return jsonify({'error': str(e)}), 500   

@app.route('/api/attendance', methods=['GET'])
def get_attendance():
    if 'admin_logged_in' not in session:
        return jsonify({'error': 'Non autorisé'}), 401
    
    try:
        date = request.args.get('date', datetime.now().strftime('%Y-%m-%d'))
        attendance_data = attendance_service.get_daily_attendance(date)
        return jsonify(attendance_data)
    except Exception as e:
        print(f"[ERREUR] Récupération présences: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/employee-tracking', methods=['GET'])
def get_employee_tracking():
    if 'admin_logged_in' not in session:
        return jsonify({'error': 'Non autorisé'}), 401
    
    try:
        matricule = request.args.get('matricule', None)
        departement = request.args.get('departement', None)
        month = request.args.get('month', datetime.now().strftime('%Y-%m'))
        tracking_data = attendance_service.get_employee_tracking(matricule, departement, month)
        return jsonify(tracking_data)
    except Exception as e:
        print(f"[ERREUR] Suivi employé: {str(e)}")
        return jsonify({'error': str(e)}), 500
    
@app.route('/api/advanced-reports', methods=['GET'])
def get_advanced_reports():
    if 'admin_logged_in' not in session:
        return jsonify({'error': 'Non autorisé'}), 401
    
    try:
        date = request.args.get('date', datetime.now().strftime('%Y-%m-%d'))
        departement = request.args.get('departement', None)
        report_data = attendance_service.get_advanced_reports(date, departement)
        return jsonify(report_data)
    except Exception as e:
        print(f"[ERREUR] Génération rapports: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/data/images/<filename>')
def serve_employee_image(filename):
    return send_from_directory('data/images', filename)



@app.route('/api/employee/add', methods=['POST'])
def add_employee():
    if 'admin_logged_in' not in session:
        return jsonify({'status': 'error', 'message': 'Non autorisé'}), 401
    
    try:
        # Vérifier que c'est bien une requête multipart
        if not request.content_type.startswith('multipart/form-data'):
            return jsonify({
                'status': 'error',
                'message': 'Content-Type doit être multipart/form-data'
            }), 400

        # Récupérer les données du formulaire
        matricule = request.form.get('matricule', '').strip()
        nom = request.form.get('nom', '').strip().upper()
        prenom = request.form.get('prenom', '').strip()
        telephone = request.form.get('telephone', '').strip()
        lieu_habitation = request.form.get('lieu_habitation', '').strip()
        departement = request.form.get('departement', '').strip()
        
        # Gestion de la photo
        filename = 'default.png'
        if 'photo' in request.files:
            photo = request.files['photo']
            if photo.filename != '' and allowed_file(photo.filename):
                filename = f"{prenom.lower()}_{nom.lower()}{os.path.splitext(photo.filename)[1].lower()}"
                photo.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))

        # Validation
        if not all([matricule, nom, prenom, departement]):
            return jsonify({'status': 'error', 'message': 'Tous les champs obligatoires doivent être remplis'}), 400

        # Vérification matricule existant
        db_path = os.path.join('data', 'database.csv')
        if os.path.exists(db_path):
            df = pd.read_csv(db_path)
            if not df[df['matricule'].str.strip() == matricule].empty:
                return jsonify({'status': 'error', 'message': 'Matricule déjà utilisé'}), 400

        # Ajout à la base de données
        new_employee = {
            'matricule': matricule,
            'nom': nom,
            'prenom': prenom,
            'telephone': telephone,
            'lieu_habitation': lieu_habitation,
            'departement': departement,
            'image_path': filename
        }

        new_df = pd.DataFrame([new_employee])
        if os.path.exists(db_path):
            df = pd.read_csv(db_path)
            new_df = pd.concat([df, new_df], ignore_index=True)
        
        new_df.to_csv(db_path, index=False)
        face_service.load_known_faces()

        return jsonify({
            'status': 'success',
            'message': f'Employé {prenom} {nom} ajouté avec succès',
            'data': new_employee
        })

    except Exception as e:
        print(f"Erreur ajout employé: {str(e)}")
        return jsonify({'status': 'error', 'message': str(e)}), 500
        

@app.route('/api/employee/update/<matricule>', methods=['PUT'])
def update_employee(matricule):
    if 'admin_logged_in' not in session:
        return jsonify({'status': 'error', 'message': 'Non autorisé'}), 401
    
    try:
        # Vérification du type de contenu
        if not request.content_type.startswith('multipart/form-data'):
            return jsonify({
                'status': 'error',
                'message': 'Content-Type doit être multipart/form-data'
            }), 400

        # Vérifier que l'employé existe
        db_path = os.path.join('data', 'database.csv')
        if not os.path.exists(db_path):
            return jsonify({
                'status': 'error',
                'message': 'Base de données des employés introuvable'
            }), 404
            
        df = pd.read_csv(db_path)
        employee_index = df.index[df['matricule'] == matricule].tolist()
        
        if not employee_index:
            return jsonify({
                'status': 'error',
                'message': 'Employé non trouvé'
            }), 404

        # Récupération des données
        nom = request.form.get('nom', '').strip().upper()
        prenom = request.form.get('prenom', '').strip()
        telephone = request.form.get('telephone', '').strip()
        lieu_habitation = request.form.get('lieu_habitation', '').strip()
        departement = request.form.get('departement', '').strip()
        photo = request.files.get('photo')

        # Validation des champs obligatoires
        required_fields = {
            'nom': nom,
            'prenom': prenom,
            'departement': departement
        }
        
        for field, value in required_fields.items():
            if not value:
                return jsonify({
                    'status': 'error',
                    'message': f'Le champ {field} est obligatoire'
                }), 400

        # Validation du numéro de téléphone
        if telephone and not telephone.replace(' ', '').isdigit():
            return jsonify({
                'status': 'error',
                'message': 'Le téléphone doit contenir uniquement des chiffres'
            }), 400

        # Mise à jour des informations de base
        df.at[employee_index[0], 'nom'] = nom
        df.at[employee_index[0], 'prenom'] = prenom.capitalize()
        df.at[employee_index[0], 'telephone'] = telephone
        df.at[employee_index[0], 'lieu_habitation'] = lieu_habitation
        df.at[employee_index[0], 'departement'] = departement

        # Gestion de la photo si fournie
        if photo and photo.filename != '':
            # Validation de la photo
            if not allowed_file(photo.filename):
                return jsonify({
                    'status': 'error',
                    'message': 'Type de fichier non autorisé (PNG, JPG, JPEG uniquement)'
                }), 400

            # Supprimer l'ancienne photo si elle existe
            old_photo = df.at[employee_index[0], 'image_path']
            if old_photo and os.path.exists(os.path.join(app.config['UPLOAD_FOLDER'], old_photo)):
                try:
                    os.remove(os.path.join(app.config['UPLOAD_FOLDER'], old_photo))
                except Exception as e:
                    print(f"Erreur suppression ancienne photo: {str(e)}")

            # Création du nouveau nom de fichier
            file_extension = photo.filename.rsplit('.', 1)[1].lower()
            filename = f"{prenom.lower().replace(' ', '_')}_{nom.lower().replace(' ', '_')}.{file_extension}"
            
            # Sauvegarde de la nouvelle photo
            photo_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            photo.save(photo_path)
            
            # Mise à jour du chemin de l'image
            df.at[employee_index[0], 'image_path'] = filename

        # Sauvegarde des modifications
        df.to_csv(db_path, index=False)

        # Mise à jour dans les autres fichiers CSV
        update_employee_in_all_files(matricule, {
            'nom_complet': f"{prenom} {nom}",
            'departement': departement
        })

        # Rechargement des visages
        try:
            face_service.load_known_faces()
        except Exception as e:
            print(f"Attention: erreur lors du rechargement des visages - {str(e)}")

        return jsonify({
            'status': 'success',
            'message': f'Employé {prenom} {nom} mis à jour avec succès',
            'data': {
                'matricule': matricule,
                'image_path': df.at[employee_index[0], 'image_path']
            }
        })

    except Exception as e:
        print(f"Erreur lors de la mise à jour de l'employé: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Une erreur est survenue: {str(e)}'
        }), 500

def update_employee_in_all_files(matricule, new_data):
    """Met à jour les informations de l'employé dans tous les fichiers CSV"""
    # Mise à jour dans missions.csv
    missions_file = os.path.join('data', 'MISSIONS', 'missions2025.csv')
    if os.path.exists(missions_file):
        df_missions = pd.read_csv(missions_file)
        if 'matricule' in df_missions.columns:
            df_missions.loc[df_missions['matricule'] == matricule, 'nom complet'] = new_data['nom_complet']
            df_missions.loc[df_missions['matricule'] == matricule, 'departement'] = new_data['departement']
            df_missions.to_csv(missions_file, index=False)

    # Mise à jour dans conges.csv
    leaves_file = os.path.join('data', 'CONGES', f'conges{datetime.now().year}.csv')
    if os.path.exists(leaves_file):
        df_leaves = pd.read_csv(leaves_file)
        if 'matricule' in df_leaves.columns:
            df_leaves.loc[df_leaves['matricule'] == matricule, 'nom complet'] = new_data['nom_complet']
            df_leaves.to_csv(leaves_file, index=False)

    # Mise à jour dans presents.csv
    attendance_files = [f for f in os.listdir('data/PRESENTS') if f.startswith('presents')]
    for file in attendance_files:
        file_path = os.path.join('data/PRESENTS', file)
        df_attendance = pd.read_csv(file_path)
        if 'matricule' in df_attendance.columns:
            df_attendance.loc[df_attendance['matricule'] == matricule, 'nom_complet'] = new_data['nom_complet']
            df_attendance.loc[df_attendance['matricule'] == matricule, 'departement'] = new_data['departement']
            df_attendance.to_csv(file_path, index=False)
            
@app.route('/api/employee/check/<matricule>', methods=['GET'])
def check_matricule(matricule):
    if 'admin_logged_in' not in session:
        return jsonify({'error': 'Non autorisé'}), 401
    
    try:
        db_path = os.path.join('data', 'database.csv')
        exists = False
        
        if os.path.exists(db_path):
            df = pd.read_csv(db_path)
            exists = not df[df['matricule'].str.strip() == matricule.strip()].empty
            
        return jsonify({
            'exists': exists,
            'matricule': matricule
        })
        
    except Exception as e:
        return jsonify({
            'error': str(e)
        }), 500    
    
    
    
@app.route('/api/load-logs')
def get_load_logs():
    if 'admin_logged_in' not in session:
        return jsonify({'error': 'Non autorisé'}), 401
    
    logs = face_service.load_known_faces()
    return jsonify({'logs': logs})    
    
    
    


@app.route('/api/leaves/add', methods=['POST'])
def add_leave():
    if 'admin_logged_in' not in session:
        return jsonify({'error': 'Non autorisé'}), 401
    
    # Vérifier que la requête contient bien du JSON
    if not request.is_json:
        return jsonify({'error': 'Content-Type doit être application/json'}), 400
    
    try:
        data = request.get_json()
        
        # Vérification des champs obligatoires
        required_fields = ['matricule', 'nom_complet', 'date_debut', 'date_fin']
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({'error': f'Le champ {field} est requis'}), 400
        
        matricule = str(data['matricule']).strip()
        full_name = str(data['nom_complet']).strip()
        date_debut = str(data['date_debut']).strip()
        date_fin = str(data['date_fin']).strip()
        
        # Validation des dates
        try:
            debut_dt = datetime.strptime(date_debut, '%Y-%m-%d')
            fin_dt = datetime.strptime(date_fin, '%Y-%m-%d')
            today = datetime.now().date()
            
            if fin_dt.date() < debut_dt.date():
                return jsonify({'error': 'La date de fin doit être après la date de début'}), 400
                
            if debut_dt.date() < today:
                return jsonify({'error': 'La date de début ne peut pas être dans le passé'}), 400
                
        except ValueError as e:
            return jsonify({'error': f'Format de date invalide: {str(e)}'}), 400
            
        # Vérifier que l'employé existe
        db_path = os.path.join('data', 'database.csv')
        if not os.path.exists(db_path):
            return jsonify({'error': 'Base de données des employés introuvable'}), 404
            
        df_employees = pd.read_csv(db_path)
        if matricule not in df_employees['matricule'].values:
            return jsonify({'error': f'Matricule {matricule} non trouvé'}), 404
            
        # Vérifier les chevauchements de congés
        leaves_file = os.path.join('data', 'CONGES', f'conges{datetime.now().year}.csv')
        if os.path.exists(leaves_file):
            df_leaves = pd.read_csv(leaves_file)
            
            # Convertir les dates existantes en objets date pour comparaison
            for _, row in df_leaves.iterrows():
                if str(row['matricule']) == matricule:
                    existing_start = datetime.strptime(row['date debut'], '%Y-%m-%d').date()
                    existing_end = datetime.strptime(row['date fin'], '%Y-%m-%d').date()
                    
                    # Vérifier le chevauchement
                    if not (fin_dt.date() < existing_start or debut_dt.date() > existing_end):
                        return jsonify({
                            'error': f'Congé existant du {existing_start} au {existing_end}'
                        }), 400
        
        # Créer le répertoire si nécessaire
        os.makedirs(os.path.dirname(leaves_file), exist_ok=True)
        
        # Ajouter le nouveau congé
        new_leave = {
            'matricule': [matricule],
            'nom complet': [full_name],
            'date debut': [date_debut],
            'date fin': [date_fin]
        }
        
        new_df = pd.DataFrame(new_leave)
        if os.path.exists(leaves_file):
            df_leaves = pd.read_csv(leaves_file)
            new_df = pd.concat([df_leaves, new_df], ignore_index=True)
        
        new_df.to_csv(leaves_file, index=False)
        
        return jsonify({'status': 'success'})
        
    except Exception as e:
        app.logger.error(f"Erreur ajout congé: {str(e)}")
        return jsonify({'error': f'Erreur serveur: {str(e)}'}), 500

@app.route('/api/leaves/delete/<matricule>/<date_debut>', methods=['DELETE'])
def delete_leave(matricule, date_debut):
    if 'admin_logged_in' not in session:
        return jsonify({'error': 'Non autorisé'}), 401
    
    try:
        year = datetime.now().year
        leaves_file = os.path.join('data', 'CONGES', f'conges{year}.csv')
        
        if not os.path.exists(leaves_file):
            return jsonify({'error': 'Aucun congé enregistré'}), 404
            
        df = pd.read_csv(leaves_file)
        initial_count = len(df)
        
        # Suppression avec vérification du format de date
        df = df[~((df['matricule'] == matricule) & 
                 (df['date debut'] == date_debut))]
        
        if len(df) == initial_count:
            return jsonify({'error': 'Congé non trouvé'}), 404
            
        df.to_csv(leaves_file, index=False)
        return jsonify({'status': 'success'})
        
    except Exception as e:
        app.logger.error(f"Erreur suppression congé: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/leaves', methods=['GET'])
def get_leaves():
    
    if 'admin_logged_in' not in session:
        return jsonify({'error': 'Non autorisé'}), 401
    
    try:
        year = datetime.now().year
        leaves_file = os.path.join('data', 'CONGES', f'conges{year}.csv')
        if not os.path.exists(leaves_file):
            return jsonify([])
            
        df = pd.read_csv(leaves_file)
        
        # Filtrage par matricule si spécifié
        matricule = request.args.get('matricule')
        if matricule:
            df = df[df['matricule'] == matricule]
            
        # Filtrage par mois si spécifié
        month = request.args.get('month')
        if month:
            try:
                target_month = datetime.strptime(month, '%Y-%m').month
                df['date_debut'] = pd.to_datetime(df['date debut'])
                df = df[df['date_debut'].dt.month == target_month]
            except ValueError:
                pass
                
        return jsonify(df.to_dict('records'))
    except Exception as e:
        app.logger.error(f"Erreur récupération congés: {str(e)}")
        return jsonify({'error': str(e)}), 500
    
    
    
    
    
@app.route('/api/employee/delete/<matricule>', methods=['DELETE'])
def delete_employee(matricule):
    if 'admin_logged_in' not in session:
        return jsonify({'error': 'Non autorisé'}), 401
    
    try:
        # Vérifier d'abord si l'employé existe
        db_path = os.path.join('data', 'database.csv')
        if not os.path.exists(db_path):
            return jsonify({'status': 'error', 'message': 'Base de données non trouvée'}), 404
            
        df = pd.read_csv(db_path)
        if matricule not in df['matricule'].values:
            return jsonify({'status': 'error', 'message': 'Employé non trouvé'}), 404
        
        # Récupérer le chemin de l'image avant suppression
        employee_data = df[df['matricule'] == matricule].iloc[0]
        image_path = os.path.join('data', 'images', employee_data['image_path'])
        
        # Supprimer l'entrée de la base de données
        df = df[df['matricule'] != matricule]
        df.to_csv(db_path, index=False)
        
        # Supprimer l'image si elle existe
        if os.path.exists(image_path):
            try:
                os.remove(image_path)
            except Exception as e:
                print(f"Erreur suppression image: {str(e)}")
        
        # Recharger les visages connus
        face_service.load_known_faces()
        
        return jsonify({
            'status': 'success', 
            'message': f'Employé {matricule} supprimé avec succès'
        })
        
    except Exception as e:
        print(f"[ERREUR] Suppression employé: {str(e)}")
        return jsonify({
            'status': 'error', 
            'message': f'Erreur lors de la suppression: {str(e)}'
        }), 500

if __name__ == '__main__':
    print("\nVérification des répertoires...")
    os.makedirs('data/images', exist_ok=True)
    os.makedirs('static/css', exist_ok=True)
    os.makedirs('static/js', exist_ok=True)
    os.makedirs('static/images', exist_ok=True)
    
    if not os.path.exists('data/database.csv'):
        print("Création de la base de données initiale...")
        df = pd.DataFrame(columns=['matricule', 'nom', 'prenom', 'telephone', 'lieu_habitation', 'departement', 'image_path'])
        df.to_csv('data/database.csv', index=False)
    
    print("\n=== Système prêt à fonctionner ===\n")


    app.run(debug=True, host='0.0.0.0', port=8000)