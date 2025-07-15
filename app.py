from flask import Flask, render_template, request, jsonify, session, redirect, url_for, send_file, flash
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
    return '.' in filename and \
        filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']

def is_admin_user(matricule):
    """Vérifie si l'utilisateur est un administrateur"""
    admin_file = os.path.join('data/images', 'admin_admin.jpg')
    admin_file_png = os.path.join('data/images', 'admin_admin.png')
    admin_file_jpeg = os.path.join('data/images', 'admin_admin.jpeg')
    
    admin_exists = (os.path.exists(admin_file) or 
                os.path.exists(admin_file_png) or 
                os.path.exists(admin_file_jpeg))
    
    return (matricule == 'DB' or admin_exists)

def validate_image(image_data):
    """Valide et traite l'image avant reconnaissance"""
    try:
        if isinstance(image_data, np.ndarray):
            return image_data
            
        if isinstance(image_data, str) and image_data.startswith('data:image/'):
            header, encoded = image_data.split(",", 1)
            binary_data = io.BytesIO(base64.b64decode(encoded))
            image = cv2.imdecode(np.frombuffer(binary_data.read(), np.uint8), cv2.IMREAD_COLOR)
        else:
            nparr = np.frombuffer(image_data, np.uint8)
            image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if image is None or image.size == 0:
            raise ValueError("Image invalide ou corrompue")
            
        if image.shape[0] < 100 or image.shape[1] < 100:
            raise ValueError("Image trop petite pour la reconnaissance (min 100x100 pixels)")
            
        image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            
        return image
        
    except Exception as e:
        raise ValueError(f"Erreur de traitement d'image: {str(e)}")

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
        
        try:
            image = validate_image(image_data)
            _, buffer = cv2.imencode('.jpg', cv2.cvtColor(image, cv2.COLOR_RGB2BGR))
            img_str = base64.b64encode(buffer).decode('utf-8')
            processed_image = f"data:image/jpeg;base64,{img_str}"
            
            result = face_service.recognize_face(processed_image)
        except ValueError as e:
            return jsonify({'status': 'error', 'message': str(e)}), 400
        
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
            
            return jsonify({
                'status': attendance_result['status'],
                'message': attendance_result['message'],
                'data': {
                    'employee_id': result['employee_id'],
                    'full_name': result['full_name'],
                    'department': result['department'],
                    'time': attendance_result['time'],
                    'action': attendance_result['action']
                }
            })
        else:
            return jsonify(result), 400
            
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500
    
    
    

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
        departement = request.args.get('departement', None)
        absent_employees = attendance_service.get_absent_employees(date, departement)
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
        matricule = request.args.get('matricule', None)
        attendance_data = attendance_service.get_daily_attendance(date)
        
        if matricule:
            attendance_data = [r for r in attendance_data if r['matricule'] == matricule]
        
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

@app.route('/api/employee-tracking/download', methods=['GET'])
def download_employee_tracking():
    if 'admin_logged_in' not in session:
        return jsonify({'error': 'Non autorisé'}), 401
    
    try:
        matricule = request.args.get('matricule', None)
        departement = request.args.get('departement', None)
        month = request.args.get('month', datetime.now().strftime('%Y-%m'))
        
        tracking_data = attendance_service.get_employee_tracking(matricule, departement, month)
        df = pd.DataFrame(tracking_data)
        
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Suivi Agent')
        
        output.seek(0)
        filename = f"suivi_agent_{matricule if matricule else departement}_{month}.xlsx"
        
        return send_file(
            output,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name=filename
        )
    except Exception as e:
        print(f"[ERREUR] Téléchargement suivi: {str(e)}")
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

@app.route('/api/employee/add', methods=['POST'])
def add_employee():
    if 'admin_logged_in' not in session:
        return jsonify({'error': 'Non autorisé'}), 401
    
    try:
        matricule = request.form.get('matricule')
        nom = request.form.get('nom')
        prenom = request.form.get('prenom')
        telephone = request.form.get('telephone')
        departement = request.form.get('departement')
        photo = request.files.get('photo')
        
        if not all([matricule, nom, prenom, departement, photo]):
            return jsonify({'status': 'error', 'message': 'Tous les champs sont requis'}), 400
        
        if not allowed_file(photo.filename):
            return jsonify({'status': 'error', 'message': 'Type de fichier non autorisé (seuls JPG, JPEG et PNG sont acceptés)'}), 400
            
        success, message = face_service.add_employee(matricule, nom, prenom, telephone, departement, photo)
        
        if success:
            return jsonify({'status': 'success', 'message': message})
        else:
            return jsonify({'status': 'error', 'message': message}), 400
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/employee/delete/<matricule>', methods=['DELETE'])
def delete_employee(matricule):
    if 'admin_logged_in' not in session:
        return jsonify({'error': 'Non autorisé'}), 401
    
    try:
        success, message = face_service.delete_employee(matricule)
        
        if success:
            return jsonify({'status': 'success', 'message': message})
        else:
            return jsonify({'status': 'error', 'message': message}), 500
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/attendance/download', methods=['GET'])
def download_attendance():
    if 'admin_logged_in' not in session:
        return jsonify({'error': 'Non autorisé'}), 401
    
    try:
        date = request.args.get('date', datetime.now().strftime('%Y-%m-%d'))
        attendance_data = attendance_service.get_daily_attendance(date)
        df = pd.DataFrame(attendance_data)
        
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Présences')
        
        output.seek(0)
        return send_file(
            output,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name=f'presences_{date}.xlsx'
        )
    except Exception as e:
        print(f"[ERREUR] Téléchargement présences: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/employees/download', methods=['GET'])
def download_employees():
    if 'admin_logged_in' not in session:
        return jsonify({'error': 'Non autorisé'}), 401
    
    try:
        employees = face_service.get_all_employees()
        df = pd.DataFrame(employees)
        
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Employés')
        
        output.seek(0)
        return send_file(
            output,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name='liste_employes.xlsx'
        )
    except Exception as e:
        print(f"[ERREUR] Téléchargement employés: {str(e)}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    print("\nVérification des répertoires...")
    os.makedirs('data/images', exist_ok=True)
    os.makedirs('static/css', exist_ok=True)
    os.makedirs('static/js', exist_ok=True)
    os.makedirs('static/images', exist_ok=True)
    
    if not os.path.exists('data/database.csv'):
        print("Création de la base de données initiale...")
        df = pd.DataFrame(columns=['matricule', 'nom', 'prenom', 'telephone', 'departement', 'image_path'])
        df.to_csv('data/database.csv', index=False)
    
    print("\n=== Système prêt à fonctionner ===\n")
    app.run(debug=True, host='0.0.0.0', port=8000)