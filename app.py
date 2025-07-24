from flask import Flask, render_template, request, jsonify, send_from_directory, session, redirect, url_for, send_file, flash
from flask_cors import CORS
from services.face_service import FaceService
from services.attendance import AttendanceService
import os
from datetime import datetime
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

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']

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
        
        # Debug: Vérifions ce qui est renvoyé
        print(f"Absents pour {date}: {len(absent_employees)} employés")
        if absent_employees:
            print(f"Exemple: {absent_employees[0]}")
        
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
        return jsonify({'error': 'Non autorisé'}), 401
    
    try:
        print("Données reçues:", request.form)  # Debug
        print("Fichier reçu:", request.files.get('photo'))  # Debug
        
        matricule = request.form.get('matricule')
        nom = request.form.get('nom')
        prenom = request.form.get('prenom')
        telephone = request.form.get('telephone')
        lieu_habitation = request.form.get('lieu_habitation')
        departement = request.form.get('departement')
        photo = request.files.get('photo')
        
        if not all([matricule, nom, prenom, departement, photo]):
            return jsonify({'status': 'error', 'message': 'Tous les champs marqués * sont requis'}), 400
        
        if not allowed_file(photo.filename):
            return jsonify({'status': 'error', 'message': 'Type de fichier non autorisé (seuls JPG, JPEG et PNG sont acceptés)'}), 400
            
        success, message = face_service.add_employee(
            matricule=matricule,
            nom=nom,
            prenom=prenom,
            telephone=telephone,
            lieu_habitation=lieu_habitation,
            departement=departement,
            photo=photo
        )
        
        if success:
            return jsonify({'status': 'success', 'message': message})
        else:
            return jsonify({'status': 'error', 'message': message}), 400
    except Exception as e:
        print("Erreur complète:", str(e))  # Debug complet
        return jsonify({'status': 'error', 'message': str(e)}), 500
    
    
    
    
@app.route('/api/load-logs')
def get_load_logs():
    if 'admin_logged_in' not in session:
        return jsonify({'error': 'Non autorisé'}), 401
    
    logs = face_service.load_known_faces()
    return jsonify({'logs': logs})    
    
    
    
    
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