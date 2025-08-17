import pandas as pd
import os
from datetime import datetime, timedelta
import hashlib

class AttendanceService:
    def __init__(self):
        self.attendance_dir = 'data/PRESENTS'
        self.ensure_attendance_dir()

    def ensure_attendance_dir(self):
        """Vérifie et crée le répertoire de présence si nécessaire"""
        if not os.path.exists(self.attendance_dir):
            os.makedirs(self.attendance_dir)

    def get_holidays_file(self, year=None):
        """Retourne le chemin du fichier des jours fériés pour l'année donnée"""
        if year is None:
            year = datetime.now().year
        return os.path.join('data', 'FERIERS', f'feriers{year}.csv')

    def get_leaves_file(self, year=None):
        """Retourne le chemin du fichier des congés pour l'année donnée"""
        if year is None:
            year = datetime.now().year
        return os.path.join('data', 'CONGES', f'conges{year}.csv')

    def get_missions_file(self, year=None):
        """Retourne le chemin du fichier des missions pour l'année donnée"""
        if year is None:
            year = datetime.now().year
        return os.path.join('data', 'MISSIONS', f'missions{year}.csv')

    def is_holiday(self, date):
        """Vérifie si une date donnée est un jour férié"""
        try:
            if isinstance(date, str):
                date = datetime.strptime(date, '%Y-%m-%d')

            holidays_file = self.get_holidays_file(date.year)
            if not os.path.exists(holidays_file):
                return False

            df_holidays = pd.read_csv(holidays_file)

            for _, row in df_holidays.iterrows():
                start_date = datetime.strptime(row['date_debut'], '%Y-%m-%d')
                end_date = datetime.strptime(row['date_fin'], '%Y-%m-%d')

                if start_date <= date <= end_date:
                    return True

            return False
        except Exception as e:
            print(f"[ERREUR] Vérification jour férié: {str(e)}")
            return False

    def is_on_leave(self, matricule, date):
        """Vérifie si un employé est en congé à une date donnée"""
        try:
            if isinstance(date, str):
                date = datetime.strptime(date, '%Y-%m-%d')

            leaves_file = self.get_leaves_file(date.year)
            if not os.path.exists(leaves_file):
                return False

            df_leaves = pd.read_csv(leaves_file)

            for _, row in df_leaves.iterrows():
                if str(row['matricule']) == str(matricule):
                    start_date = datetime.strptime(row['date debut'], '%Y-%m-%d')
                    end_date = datetime.strptime(row['date fin'], '%Y-%m-%d')

                    if start_date <= date <= end_date:
                        return True

            return False
        except Exception as e:
            print(f"[ERREUR] Vérification congé: {str(e)}")
            return False

    def is_on_mission(self, matricule, date):
        """Vérifie si un employé est en mission à une date donnée"""
        try:
            if isinstance(date, str):
                date = datetime.strptime(date, '%Y-%m-%d')
    
            missions_file = self.get_missions_file(date.year)
            if not os.path.exists(missions_file):
                return False
    
            df_missions = pd.read_csv(missions_file)
    
            for _, row in df_missions.iterrows():
                if str(row['matricule']) == str(matricule):
                    start_date = datetime.strptime(row['date debut'], '%Y-%m-%d')
                    end_date = datetime.strptime(row['date fin'], '%Y-%m-%d')
                
                    if start_date <= date <= end_date:
                        return True
            
            return False
        except Exception as e:
            print(f"[ERREUR] Vérification mission: {str(e)}")
            return False

    def get_leave_period(self, matricule, date):
        """Retourne la période de congé d'un employé si elle existe"""
        try:
            if isinstance(date, str):
                date = datetime.strptime(date, '%Y-%m-%d')

            leaves_file = self.get_leaves_file(date.year)
            if not os.path.exists(leaves_file):
                return None

            df_leaves = pd.read_csv(leaves_file)

            for _, row in df_leaves.iterrows():
                if str(row['matricule']) == str(matricule):
                    start_date = datetime.strptime(row['date debut'], '%Y-%m-%d')
                    end_date = datetime.strptime(row['date fin'], '%Y-%m-%d')

                    if start_date <= date <= end_date:
                        return {
                            'start_date': start_date.strftime('%Y-%m-%d'),
                            'end_date': end_date.strftime('%Y-%m-%d'),
                            'full_name': row['nom complet']
                        }

            return None
        except Exception as e:
            print(f"[ERREUR] Récupération période congé: {str(e)}")
            return None

    def get_mission_period(self, matricule, date):
        """Retourne la période de mission d'un employé si elle existe"""
        try:
            if isinstance(date, str):
                date = datetime.strptime(date, '%Y-%m-%d')
            
            missions_file = self.get_missions_file(date.year)
            if not os.path.exists(missions_file):
                return None
            
            df_missions = pd.read_csv(missions_file)
            
            for _, row in df_missions.iterrows():
                if str(row['matricule']) == str(matricule):
                    start_date = datetime.strptime(row['date debut'], '%Y-%m-%d')
                    end_date = datetime.strptime(row['date fin'], '%Y-%m-%d')
                    
                    if start_date <= date <= end_date:
                        return {
                            'start_date': start_date.strftime('%Y-%m-%d'),
                            'end_date': end_date.strftime('%Y-%m-%d'),
                            'mission_name': row['nom mission'],
                            'full_name': row['nom complet']
                        }
                    
            return None
        except Exception as e:
            print(f"[ERREUR] Récupération période mission: {str(e)}")
            return None

    def get_holiday_name(self, date):
        """Retourne le nom du jour férié pour une date donnée"""
        try:
            if isinstance(date, str):
                date = datetime.strptime(date, '%Y-%m-%d')

            holidays_file = self.get_holidays_file(date.year)
            if not os.path.exists(holidays_file):
                return None

            df_holidays = pd.read_csv(holidays_file)

            for _, row in df_holidays.iterrows():
                start_date = datetime.strptime(row['date_debut'], '%Y-%m-%d')
                end_date = datetime.strptime(row['date_fin'], '%Y-%m-%d')

                if start_date <= date <= end_date:
                    return row['description']

            return None
        except Exception as e:
            print(f"[ERREUR] Récupération nom jour férié: {str(e)}")
            return None

    def get_monthly_filename(self, date=None):
        """Génère le nom du fichier mensuel"""
        if date is None:
            date = datetime.now()
        elif isinstance(date, str):
            try:
                date = datetime.strptime(date, '%Y-%m-%d')
            except ValueError:
                date = datetime.now()
        return f"presents{date.strftime('%B%Y')}.csv"

    def get_all_leaves(self, year=None):
        """Récupère tous les congés pour une année donnée"""
        try:
            if year is None:
                year = datetime.now().year

            leaves_file = self.get_leaves_file(year)
            if not os.path.exists(leaves_file):
                return []

            df = pd.read_csv(leaves_file)
            df['matricule'] = df['matricule'].astype(str).str.strip()
            df['nom complet'] = df['nom complet'].str.strip()
            return df.to_dict('records')
        except Exception as e:
            print(f"[ERREUR] Récupération congés: {str(e)}")
            return []

    def get_all_missions(self, year=None):
        """Récupère toutes les missions pour une année donnée"""
        try:
            if year is None:
                year = datetime.now().year
                
            missions_file = self.get_missions_file(year)
            if not os.path.exists(missions_file):
                return []
                
            df = pd.read_csv(missions_file)
            df['matricule'] = df['matricule'].astype(str).str.strip()
            df['nom complet'] = df['nom complet'].str.strip()
            df['nom mission'] = df['nom mission'].str.strip()
            return df.to_dict('records')
        except Exception as e:
            print(f"[ERREUR] Récupération missions: {str(e)}")
            return []

    def get_attendance_file(self, date=None):
        """Retourne le chemin complet du fichier de présence"""
        return os.path.join(self.attendance_dir, self.get_monthly_filename(date))

    def ensure_attendance_file(self, date=None):
        """Crée le fichier de présence s'il n'existe pas"""
        file_path = self.get_attendance_file(date)
        if not os.path.exists(file_path):
            df = pd.DataFrame(columns=[
                'matricule', 'nom_complet', 'departement', 'date', 
                'heure_arrivee', 'heure_depart', 'signature'
            ])
            df.to_csv(file_path, index=False)
        return file_path

    def generate_signature(self, matricule, date, time):
        """Génère une signature numérique pour l'enregistrement"""
        data = f"{matricule}_{date}_{time}_DB_CARBA"
        return hashlib.md5(data.encode()).hexdigest()[:8].upper()

    def record_attendance(self, matricule, full_name, department):
        """Enregistre la présence avec contrôle strict selon les règles spécifiées"""
        try:
            current_time = datetime.now()
            current_date = current_time.strftime('%Y-%m-%d')

            if self.is_holiday(current_date):
                return {
                    'status': 'error',
                    'action': 'holiday',
                    'message': f'✗ Jour férié ({self.get_holiday_name(current_date)}) - Aucun enregistrement possible',
                    'time': current_time.strftime('%H:%M:%S')
                }

            if self.is_on_leave(matricule, current_date):
                leave_period = self.get_leave_period(matricule, current_date)
                return {
                    'status': 'error',
                    'action': 'on_leave',
                    'message': f'✗ {full_name} est en congé du {leave_period["start_date"]} au {leave_period["end_date"]}',
                    'time': current_time.strftime('%H:%M:%S')
                }

            if self.is_on_mission(matricule, current_date):
                mission_period = self.get_mission_period(matricule, current_date)
                return {
                    'status': 'error',
                    'action': 'on_mission',
                    'message': f'✗ {full_name} est en mission ({mission_period["mission_name"]}) du {mission_period["start_date"]} au {mission_period["end_date"]}',
                    'time': current_time.strftime('%H:%M:%S')
                }

            current_time_str = current_time.strftime('%H:%M:%S')
            file_path = self.ensure_attendance_file(current_date)

            df = pd.read_csv(file_path)
            today_records = df[(df['matricule'] == matricule) & (df['date'] == current_date)]

            if len(today_records) == 0:
                signature = self.generate_signature(matricule, current_date, current_time_str)
                default_departure = (datetime.strptime(current_time_str, '%H:%M:%S') + timedelta(hours=1)).strftime('%H:%M:%S')

                new_record = {
                    'matricule': matricule,
                    'nom_complet': full_name,
                    'departement': department,
                    'date': current_date,
                    'heure_arrivee': current_time_str,
                    'heure_depart': default_departure,
                    'signature': signature
                }

                df = pd.concat([df, pd.DataFrame([new_record])], ignore_index=True)
                df.to_csv(file_path, index=False)

                return {
                    'status': 'success',
                    'action': 'arrivee',
                    'message': f'✓ Bonjour {full_name}, arrivée enregistrée à {current_time_str}. Sortie prévue à {default_departure}',
                    'time': current_time_str
                }

            record = today_records.iloc[0]
            arrival_time = datetime.strptime(record['heure_arrivee'], '%H:%M:%S')
            default_departure = (arrival_time + timedelta(hours=1)).strftime('%H:%M:%S')

            current_time_obj = datetime.strptime(current_time_str, '%H:%M:%S')
            default_departure_obj = datetime.strptime(default_departure, '%H:%M:%S')

            if current_time_obj < default_departure_obj:
                return {
                    'status': 'error',
                    'action': 'deja_present',
                    'message': f'✗ Désolé {full_name}, vous avez déjà validé votre entrée à {record["heure_arrivee"]}. Sortie prévue à {default_departure}',
                    'time': current_time_str
                }

            elif record['heure_depart'] == default_departure:
                df.loc[(df['matricule'] == matricule) & 
                    (df['date'] == current_date), 'heure_depart'] = current_time_str
                df.to_csv(file_path, index=False)

                time_worked = current_time_obj - arrival_time
                hours = time_worked.seconds // 3600
                minutes = (time_worked.seconds % 3600) // 60

                return {
                    'status': 'success',
                    'action': 'depart',
                    'message': f'✓ Au revoir {full_name}, sortie enregistrée à {current_time_str}. Temps travaillé: {hours}h{minutes:02d}min',
                    'time': current_time_str
                }

            else:
                return {
                    'status': 'error',
                    'action': 'deja_sorti',
                    'message': f'✗ Désolé {full_name}, vous avez déjà validé votre sortie aujourd\'hui à {record["heure_depart"]}',
                    'time': current_time_str
                }

        except Exception as e:
            print(f"[ERREUR] Enregistrement présence: {str(e)}")
            return {
                'status': 'error',
                'action': 'erreur',
                'message': f'✗ Erreur système: {str(e)}',
                'time': current_time_str if 'current_time_str' in locals() else '00:00:00'
            }

    def validate_leave_dates(self, start_date, end_date, matricule=None):
        """Valide qu'une période de congé est valide"""
        try:
            if isinstance(start_date, str):
                start_date = datetime.strptime(start_date, '%Y-%m-%d')
            if isinstance(end_date, str):
                end_date = datetime.strptime(end_date, '%Y-%m-%d')

            if end_date < start_date:
                return False, "La date de fin doit être après la date de début"

            if matricule:
                existing_leaves = self.get_all_leaves(start_date.year)
                for leave in existing_leaves:
                    if str(leave['matricule']) == str(matricule):
                        existing_start = datetime.strptime(leave['date debut'], '%Y-%m-%d')
                        existing_end = datetime.strptime(leave['date fin'], '%Y-%m-%d')
                        if not (end_date < existing_start or start_date > existing_end):
                            return False, "L'employé a déjà un congé pendant cette période"

            return True, None
        except Exception as e:
            print(f"[ERREUR] Validation congé: {str(e)}")
            return False, "Erreur de validation"

    def validate_mission_dates(self, start_date, end_date, matricule=None):
        """Valide qu'une période de mission est valide"""
        try:
            if isinstance(start_date, str):
                start_date = datetime.strptime(start_date, '%Y-%m-%d')
            if isinstance(end_date, str):
                end_date = datetime.strptime(end_date, '%Y-%m-%d')
                
            if end_date < start_date:
                return False, "La date de fin doit être après la date de début"
                
            if matricule:
                existing_missions = self.get_all_missions(start_date.year)
                for mission in existing_missions:
                    if str(mission['matricule']) == str(matricule):
                        existing_start = datetime.strptime(mission['date debut'], '%Y-%m-%d')
                        existing_end = datetime.strptime(mission['date fin'], '%Y-%m-%d')
                        if not (end_date < existing_start or start_date > existing_end):
                            return False, "L'employé a déjà une mission pendant cette période"
                            
            return True, None
        except Exception as e:
            print(f"[ERREUR] Validation mission: {str(e)}")
            return False, "Erreur de validation"

    def get_employees_on_leave(self, date=None):
        """Récupère la liste des employés en congé à une date donnée"""
        try:
            if date is None:
                date = datetime.now()
            elif isinstance(date, str):
                date = datetime.strptime(date, '%Y-%m-%d')

            leaves = self.get_all_leaves(date.year)
            on_leave = []

            for leave in leaves:
                start_date = datetime.strptime(leave['date debut'], '%Y-%m-%d')
                end_date = datetime.strptime(leave['date fin'], '%Y-%m-%d')

                if start_date <= date <= end_date:
                    on_leave.append({
                        'matricule': leave['matricule'],
                        'full_name': leave['nom complet'],
                        'start_date': leave['date debut'],
                        'end_date': leave['date fin']
                    })

            return on_leave
        except Exception as e:
            print(f"[ERREUR] Récupération employés en congé: {str(e)}")
            return []

    def get_employees_on_mission(self, date=None):
        """Récupère la liste des employés en mission à une date donnée"""
        try:
            if date is None:
                date = datetime.now()
            elif isinstance(date, str):
                date = datetime.strptime(date, '%Y-%m-%d')
                
            missions = self.get_all_missions(date.year)
            on_mission = []
            
            for mission in missions:
                start_date = datetime.strptime(mission['date debut'], '%Y-%m-%d')
                end_date = datetime.strptime(mission['date fin'], '%Y-%m-%d')
                
                if start_date <= date <= end_date:
                    on_mission.append({
                        'matricule': mission['matricule'],
                        'full_name': mission['nom complet'],
                        'mission_name': mission['nom mission'],
                        'start_date': mission['date debut'],
                        'end_date': mission['date fin']
                    })
                    
            return on_mission
        except Exception as e:
            print(f"[ERREUR] Récupération employés en mission: {str(e)}")
            return []

    def validate_attendance(self, matricule, date):
        """Vérifie si l'employé a déjà une entrée et une sortie"""
        file_path = self.get_attendance_file(date)
        if not os.path.exists(file_path):
            return False

        df = pd.read_csv(file_path)
        records = df[(df['matricule'] == matricule) & (df['date'] == date)]

        if len(records) == 1:
            record = records.iloc[0]
            return pd.notna(record['heure_arrivee']) and pd.notna(record['heure_depart'])
        return False

    def determine_status(self, record):
        """Détermine le statut de présence selon les règles"""
        try:
            if pd.isna(record['heure_arrivee']):
                return {'status': 'absent', 'css_class': 'absent-row'}

            arrival = datetime.strptime(record['heure_arrivee'], '%H:%M:%S').time()

            if pd.isna(record['heure_depart']) or record['heure_depart'] == '':
                return {'status': 'missing-departure', 'css_class': 'missing-departure-row'}

            departure = datetime.strptime(record['heure_depart'], '%H:%M:%S').time()

            max_arrival = datetime.strptime('08:15:00', '%H:%M:%S').time()
            min_departure = datetime.strptime('16:45:00', '%H:%M:%S').time()
            early_threshold = datetime.strptime('07:15:00', '%H:%M:%S').time()
            late_threshold = datetime.strptime('17:45:00', '%H:%M:%S').time()

            if arrival <= max_arrival and departure >= late_threshold:
                return {'status': 'overtime', 'css_class': 'overtime-row'}

            late_arrival = arrival > max_arrival
            early_departure = departure < min_departure

            if late_arrival and early_departure:
                return {'status': 'irregular', 'css_class': 'irregular-row'}
            elif late_arrival:
                return {'status': 'late', 'css_class': 'late-row'}
            elif early_departure:
                return {'status': 'early', 'css_class': 'early-row'}

            return {'status': 'normal', 'css_class': 'normal-row'}

        except Exception as e:
            print(f"[ERREUR] Détermination statut: {str(e)}")
            return {'status': 'error', 'css_class': 'error-row'}

    def get_absent_employees(self, date=None, department=None, matricule=None):
        """Récupère la liste des employés absents (hors congés)"""
        try:
            if not date:
                date = datetime.now().strftime('%Y-%m-%d')

            if self.is_holiday(date):
                return [{
                    'status': 'holiday',
                    'message': f'Aucune absence signalée - {self.get_holiday_name(date)}',
                    'is_holiday': True
                }]

            db_path = os.path.join('data', 'database.csv')
            if not os.path.exists(db_path):
                return []

            df_employees = pd.read_csv(db_path)

            if matricule:
                df_employees = df_employees[df_employees['matricule'].astype(str) == str(matricule)]

            present_employees = []
            attendance_file = self.get_attendance_file(date)

            if os.path.exists(attendance_file):
                df_attendance = pd.read_csv(attendance_file)
                present_employees = df_attendance[df_attendance['date'] == date]['matricule'].tolist()

            absent_employees = []

            for _, emp in df_employees.iterrows():
                emp_dict = emp.to_dict()
                # Exclure les employés en congé OU en mission

                if self.is_on_leave(emp_dict['matricule'], date) or self.is_on_mission(emp_dict['matricule'], date):
                    continue

                if str(emp_dict['matricule']) not in present_employees:
                    emp_dict['status'] = 'absent'
                    emp_dict['css_class'] = 'absent-row'
                    emp_dict['message'] = 'Absent'
                    emp_dict['date'] = date
                    emp_dict['heure_arrivee'] = None
                    emp_dict['heure_depart'] = None
                    emp_dict['duree'] = '0h00min'
                    absent_employees.append(emp_dict)
        
            if department and department.lower() != 'tous départements':
                absent_employees = [
                    emp for emp in absent_employees
                    if str(emp['departement']).lower() == str(department).lower()
                ]
        
            return absent_employees
        
        except Exception as e:
            print(f"[ERREUR] Récupération employés absents: {str(e)}")
            return []

    def get_employee_tracking(self, matricule=None, departement=None, month=None):
        """Récupère le suivi des employés avec filtres"""
        try:
            all_files = [f for f in os.listdir(self.attendance_dir)
                    if f.startswith('presents') and f.endswith('.csv')]
            
            if not all_files:
                return []
            
            if month:
                try:
                    month_name = datetime.strptime(month, '%Y-%m').strftime('%B%Y')
                    target_file = f'presents{month_name}.csv'
                    if target_file in all_files:
                        all_files = [target_file]
                    else:
                        return []
                except ValueError as e:
                    print(f"[ERREUR] Format de mois invalide: {month} - {str(e)}")
                    return []
            
            records = []
            
            for file in all_files:
                file_path = os.path.join(self.attendance_dir, file)
                df = pd.read_csv(file_path, dtype={
                    'matricule': str,
                    'nom_complet': str,
                    'departement': str,
                    'heure_arrivee': str,
                    'heure_depart': str,
                    'signature': str
                })
                
                if matricule:
                    df = df[df['matricule'].astype(str) == str(matricule)]
                if departement and str(departement).lower() != 'tous départements':
                    df = df[df['departement'].str.lower() == str(departement).lower()]
                
                df['date'] = pd.to_datetime(df['date'], errors='coerce')
                df = df.dropna(subset=['date'])
                
                for _, row in df.iterrows():
                    if not self.is_holiday(row['date']) and not self.is_on_leave(row['matricule'], row['date']):
                        status_info = self.determine_status(row)
                        
                        heure_arrivee = self.format_time(row['heure_arrivee'])
                        heure_depart = self.format_time(row['heure_depart'])
                        
                        duree = self.calculate_duration(heure_arrivee, heure_depart)
                        
                        record = {
                            'matricule': str(row['matricule']),
                            'nom_complet': str(row['nom_complet']),
                            'departement': str(row['departement']),
                            'date': row['date'].strftime('%Y-%m-%d'),
                            'heure_arrivee': heure_arrivee,
                            'heure_depart': heure_depart,
                            'duree': duree,
                            'signature': str(row.get('signature', '')),
                            'status': status_info['status'],
                            'css_class': status_info['css_class']
                        }
                        records.append(record)
            
            records.sort(key=lambda x: x['date'], reverse=True)
            
            return records
            
        except Exception as e:
            print(f"[ERREUR] Suivi employé: {str(e)}")
            return []

    def get_daily_attendance(self, date):
        """Récupère les présences pour une date donnée"""
        try:
            file_path = self.get_attendance_file(date)
            if not os.path.exists(file_path):
                return []
            
            df = pd.read_csv(file_path)
            daily_records = df[df['date'] == date]
            
            records = []
            for _, row in daily_records.iterrows():
                record = {
                    'matricule': str(row['matricule']),
                    'nom_complet': str(row['nom_complet']),
                    'departement': str(row['departement']),
                    'heure_arrivee': self.format_time(row['heure_arrivee']),
                    'heure_depart': self.format_time(row['heure_depart']),
                    'duree': self.calculate_duration(
                        row['heure_arrivee'], 
                        row['heure_depart']
                    ),
                    'signature': str(row.get('signature', ''))
                }
                records.append(record)
            
            return records
        
        except Exception as e:
            print(f"[ERREUR] Récupération présences: {str(e)}")
            return []

    def get_current_present_employees(self):
        """Récupère les employés actuellement présents"""
        try:
            current_date = datetime.now().strftime('%Y-%m-%d')
            
            if self.is_holiday(current_date):
                return [{
                    'status': 'holiday',
                    'message': f'Aucun employé présent - {self.get_holiday_name(current_date)}',
                    'is_holiday': True
                }]
            
            file_path = self.get_attendance_file(current_date)
            
            if not os.path.exists(file_path):
                return []
            
            df = pd.read_csv(file_path)
            present_today = df[df['date'] == current_date]
            
            db_path = os.path.join('data', 'database.csv')
            if not os.path.exists(db_path):
                return present_today.to_dict('records')
            
            df_employees = pd.read_csv(db_path)
            results = []
            
            for _, row in present_today.iterrows():
                emp_data = df_employees[df_employees['matricule'] == row['matricule']]
                if not emp_data.empty:
                    results.append({
                        'matricule': row['matricule'],
                        'nom_complet': row['nom_complet'],
                        'departement': row['departement'],
                        'heure_arrivee': row['heure_arrivee'],
                        'date': row['date']
                    })
            
            return results
            
        except Exception as e:
            print(f"[ERREUR] Récupération employés présents: {str(e)}")
            return []

    def get_employee_stats(self, matricule, start_date=None, end_date=None):
        """Récupère les statistiques de présence d'un employé"""
        try:
            stats = {
                'total_days': 0,
                'total_hours': 0,
                'average_hours_per_day': 0
            }
            
            attendance_files = [f for f in os.listdir(self.attendance_dir) if f.startswith('presents') and f.endswith('.csv')]
            
            for file in attendance_files:
                file_path = os.path.join(self.attendance_dir, file)
                df = pd.read_csv(file_path)
                employee_records = df[df['matricule'] == matricule]
                
                if start_date:
                    employee_records = employee_records[employee_records['date'] >= start_date]
                if end_date:
                    employee_records = employee_records[employee_records['date'] <= end_date]
                
                employee_records = employee_records[
                    ~employee_records['date'].apply(lambda d: self.is_holiday(d) or self.is_on_leave(matricule, d))
                ]
                
                stats['total_days'] += len(employee_records['date'].unique())
                
                for _, record in employee_records.iterrows():
                    if pd.notna(record['heure_depart']) and record['heure_depart'] != '':
                        arrival = datetime.strptime(f"{record['date']} {record['heure_arrivee']}", '%Y-%m-%d %H:%M:%S')
                        departure = datetime.strptime(f"{record['date']} {record['heure_depart']}", '%Y-%m-%d %H:%M:%S')
                        stats['total_hours'] += (departure - arrival).total_seconds() / 3600
            
            if stats['total_days'] > 0:
                stats['average_hours_per_day'] = round(stats['total_hours'] / stats['total_days'], 2)
            stats['total_hours'] = round(stats['total_hours'], 2)
            
            return stats
        
        except Exception as e:
            print(f"[ERREUR] Statistiques employé: {str(e)}")
            return {}

    def format_time(self, time_str):
        """Formate une heure en string HH:MM:SS"""
        if pd.isna(time_str) or not str(time_str).strip():
            return None
        try:
            return datetime.strptime(str(time_str).strip(), '%H:%M:%S').strftime('%H:%M:%S')
        except ValueError:
            return None

    def calculate_duration(self, start, end):
        """Calcule la durée entre deux heures"""
        if not start or pd.isna(start) or not end or pd.isna(end):
            return '0h00min'
            
        try:
            start_time = datetime.strptime(str(start), '%H:%M:%S')
            end_time = datetime.strptime(str(end), '%H:%M:%S')
            
            if end_time < start_time:
                end_time += timedelta(days=1)
                
            duration = end_time - start_time
            hours = int(duration.total_seconds() // 3600)
            minutes = int((duration.total_seconds() % 3600) // 60)
            
            return f"{hours}h{minutes:02d}min"
        except Exception as e:
            print(f"Erreur calcul durée: {str(e)}")
            return '0h00min'

    def get_advanced_reports(self, date=None, departement=None):
        """Génère des rapports avancés sur les présences"""
        try:
            if not date:
                date = datetime.now().strftime('%Y-%m-%d')
            
            if self.is_holiday(date):
                return {
                    'status': 'holiday',
                    'message': f'Aucun rapport généré - {self.get_holiday_name(date)}',
                    'is_holiday': True
                }
            
            daily_attendance = self.get_daily_attendance(date)
            
            db_path = os.path.join('data', 'database.csv')
            if not os.path.exists(db_path):
                return {
                    'total_employees': 0,
                    'present_today': 0,
                    'absent_today': 0,
                    'late_arrivals': 0,
                    'early_departures': 0,
                    'missing_departures': 0
                }
            
            df_employees = pd.read_csv(db_path)
            
            if departement:
                df_employees = df_employees[df_employees['departement'] == departement]
                daily_attendance = [r for r in daily_attendance if r['departement'] == departement]
            
            total_employees = len(df_employees)
            
            present_employees = 0
            for emp in df_employees.to_dict('records'):
                # Ne pas compter les employés en mission comme présents ou absents
                if not self.is_on_leave(emp['matricule'], date) or not self.is_on_mission(emp['matricule'], date):
                    if any(r['matricule'] == emp['matricule'] for r in daily_attendance if r.get('heure_arrivee')):
                        present_employees += 1
            
            absent_employees = 0
            for emp in df_employees.to_dict('records'):
                # Ne pas compter les employés en mission comme absents
                if not self.is_on_leave(emp['matricule'], date) and not self.is_on_mission(emp['matricule'], date):
                    if not any(r['matricule'] == emp['matricule'] for r in daily_attendance if r.get('heure_arrivee')):
                        absent_employees += 1
            
            late_arrivals = len([r for r in daily_attendance 
                            if r.get('heure_arrivee') and datetime.strptime(r['heure_arrivee'], '%H:%M:%S').time() > datetime.strptime('08:15:00', '%H:%M:%S').time()])
            
            early_departures = len([r for r in daily_attendance 
                                if r.get('heure_depart') and datetime.strptime(r['heure_depart'], '%H:%M:%S').time() < datetime.strptime('16:45:00', '%H:%M:%S').time()])
            
            missing_departures = len([r for r in daily_attendance 
                                    if r.get('heure_arrivee') and (not r.get('heure_depart') or r['heure_depart'] == '')])
            
            return {
                'total_employees': total_employees,
                'present_today': present_employees,
                'absent_today': absent_employees,
                'late_arrivals': late_arrivals,
                'early_departures': early_departures,
                'missing_departures': missing_departures
            }
        except Exception as e:
            print(f"[ERREUR] Génération rapport: {str(e)}")
            return {
                'status': 'error',
                'message': f"Erreur lors de la génération du rapport: {str(e)}"
            }