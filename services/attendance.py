import pandas as pd
import os
from datetime import datetime, timedelta
import hashlib

class AttendanceService:
    def __init__(self):
        self.attendance_dir = 'data/'
        self.ensure_attendance_dir()
    
    def ensure_attendance_dir(self):
        """S'assure que le répertoire de présence existe"""
        if not os.path.exists(self.attendance_dir):
            os.makedirs(self.attendance_dir)
    
    def get_monthly_filename(self, date=None):
        """Retourne le nom du fichier mensuel basé sur la date"""
        if date is None:
            date = datetime.now()
        elif isinstance(date, str):
            date = datetime.strptime(date, '%Y-%m-%d')
        
        return f"presents{date.strftime('%B%Y')}.csv"
    
    def get_attendance_file(self, date=None):
        """Retourne le chemin complet du fichier de présence"""
        return os.path.join(self.attendance_dir, self.get_monthly_filename(date))
    
    def ensure_attendance_file(self, date=None):
        """S'assure que le fichier de présence existe avec les bonnes colonnes"""
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
        """Enregistre la présence d'un employé avec gestion intelligente des entrées/sorties"""
        try:
            current_time = datetime.now()
            current_date = current_time.strftime('%Y-%m-%d')
            current_time_str = current_time.strftime('%H:%M:%S')
            file_path = self.ensure_attendance_file(current_date)
            
            df = pd.read_csv(file_path)
            
            today_records = df[
                (df['matricule'] == matricule) & 
                (df['date'] == current_date)
            ].copy()
            
            active_session = today_records[
                (today_records['heure_arrivee'].notna()) & 
                ((today_records['heure_depart'].isna()) | 
                 (today_records['heure_depart'] == '') |
                 (pd.to_datetime(today_records['heure_depart']) == 
                  pd.to_datetime(today_records['heure_arrivee']) + timedelta(hours=1)))
            ]
            
            complete_sessions = today_records[
                (today_records['heure_arrivee'].notna()) & 
                (today_records['heure_depart'].notna()) & 
                (today_records['heure_depart'] != '') &
                (pd.to_datetime(today_records['heure_depart']) != 
                 pd.to_datetime(today_records['heure_arrivee']) + timedelta(hours=1))
            ]
            
            if not complete_sessions.empty:
                return {
                    'status': 'error',
                    'action': 'limite_atteinte',
                    'message': f'Désolé {full_name}, vous avez déjà enregistré votre présence aujourd\'hui.',
                    'time': current_time_str
                }
            
            if active_session.empty:
                if not today_records.empty:
                    return {
                        'status': 'error',
                        'action': 'limite_atteinte',
                        'message': f'Désolé {full_name}, vous avez déjà enregistré votre présence aujourd\'hui.',
                        'time': current_time_str
                    }
                
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
                    'message': f'Bonjour {full_name}, vous venez d\'arriver à {current_time_str}. Heure de sortie prévue: {default_departure}',
                    'time': current_time_str
                }
            else:
                latest_record = active_session.iloc[-1]
                arrival_time = datetime.strptime(latest_record['heure_arrivee'], '%H:%M:%S')
                default_departure = (arrival_time + timedelta(hours=1)).strftime('%H:%M:%S')
                current_departure_time = datetime.strptime(current_time_str, '%H:%M:%S')
                
                if current_departure_time > datetime.strptime(default_departure, '%H:%M:%S'):
                    df.loc[
                        (df['matricule'] == matricule) & 
                        (df['date'] == current_date) & 
                        (df['heure_arrivee'] == latest_record['heure_arrivee']),
                        'heure_depart'
                    ] = current_time_str
                    
                    df.to_csv(file_path, index=False)
                    
                    arrival_datetime = datetime.strptime(f"{current_date} {latest_record['heure_arrivee']}", '%Y-%m-%d %H:%M:%S')
                    time_diff = current_time - arrival_datetime
                    hours = int(time_diff.total_seconds() // 3600)
                    minutes = int((time_diff.total_seconds() % 3600) // 60)
                    
                    return {
                        'status': 'success',
                        'action': 'depart',
                        'message': f'Au revoir {full_name}, vous partez à {current_time_str}. Temps de travail: {hours}h{minutes:02d}min.',
                        'time': current_time_str
                    }
                else:
                    return {
                        'status': 'error',
                        'action': 'depart_anticipé',
                        'message': f'Votre heure de sortie prévue est à {default_departure}. Veuillez scanner après cette heure.',
                        'time': current_time_str
                    }
        
        except Exception as e:
            print(f"[ERREUR] Enregistrement présence: {str(e)}")
            return {
                'status': 'error',
                'action': 'erreur',
                'message': f'Erreur lors de l\'enregistrement: {str(e)}',
                'time': datetime.now().strftime('%H:%M:%S')
            }
    
    def get_daily_attendance(self, date):
        """Récupère les présences pour une date donnée"""
        try:
            file_path = self.get_attendance_file(date)
            if not os.path.exists(file_path):
                return []
            
            df = pd.read_csv(file_path)
            daily_records = df[df['date'] == date]
            
            return daily_records.to_dict('records')
        
        except Exception as e:
            print(f"[ERREUR] Récupération présences: {str(e)}")
            return []
    
    def get_current_present_employees(self):
        """Récupère les employés actuellement présents avec leurs informations complètes"""
        try:
            file_path = self.get_attendance_file()
            if not os.path.exists(file_path):
                return []
            
            df = pd.read_csv(file_path)
            current_date = datetime.now().strftime('%Y-%m-%d')
            
            present_employees = df[
                (df['date'] == current_date) & 
                (df['heure_arrivee'].notna()) & 
                ((df['heure_depart'].isna()) | 
                 (df['heure_depart'] == '') |
                 (pd.to_datetime(df['heure_depart']) == 
                  pd.to_datetime(df['heure_arrivee']) + timedelta(hours=1)))
            ]
            
            # Récupérer les informations complètes depuis la base de données
            db_path = os.path.join('data', 'database.csv')
            if os.path.exists(db_path):
                df_employees = pd.read_csv(db_path)
                results = []
                for _, row in present_employees.iterrows():
                    emp_data = df_employees[df_employees['matricule'] == row['matricule']]
                    if not emp_data.empty:
                        results.append({
                            'matricule': row['matricule'],
                            'nom_complet': row['nom_complet'],
                            'nom': emp_data.iloc[0]['nom'],
                            'prenom': emp_data.iloc[0]['prenom'],
                            'departement': row['departement'],
                            'heure_arrivee': row['heure_arrivee'],
                            'date': row['date']
                        })
                return results
            
            return present_employees.to_dict('records')
        
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

    def get_employee_tracking(self, matricule=None, departement=None, month=None):
        """Récupère le suivi mensuel d'un employé ou d'un département"""
        try:
            if not month:
                month = datetime.now().strftime('%Y-%m')
            
            month_name = datetime.strptime(month, '%Y-%m').strftime('%B%Y')
            file_path = os.path.join(self.attendance_dir, f'presents{month_name}.csv')
            
            if not os.path.exists(file_path):
                return []
            
            df = pd.read_csv(file_path)
            
            if matricule:
                df = df[df['matricule'] == matricule]
            
            if departement:
                df = df[df['departement'] == departement]
            
            df['date'] = pd.to_datetime(df['date'])
            df['heure_arrivee'] = pd.to_datetime(df['heure_arrivee'], errors='coerce')
            df['heure_depart'] = pd.to_datetime(df['heure_depart'], errors='coerce')
            
            df = df.sort_values('date')
            
            records = []
            for _, row in df.iterrows():
                record = {
                    'matricule': row['matricule'],
                    'nom_complet': row['nom_complet'],
                    'departement': row['departement'],
                    'date': row['date'].strftime('%Y-%m-%d'),
                    'heure_arrivee': row['heure_arrivee'].strftime('%H:%M:%S') if pd.notna(row['heure_arrivee']) else None,
                    'heure_depart': row['heure_depart'].strftime('%H:%M:%S') if pd.notna(row['heure_depart']) else None,
                    'signature': row['signature']
                }
                records.append(record)
            
            return records
            
        except Exception as e:
            print(f"[ERREUR] Suivi employé: {str(e)}")
            return []

    def get_advanced_reports(self, date=None, departement=None):
        """Génère des rapports avancés sur les présences avec données cohérentes"""
        try:
            if not date:
                date = datetime.now().strftime('%Y-%m-%d')
            
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
            present_employees = len(set(r['matricule'] for r in daily_attendance if r['heure_arrivee']))
            absent_employees = total_employees - present_employees
            
            late_arrivals = len([r for r in daily_attendance 
                               if r['heure_arrivee'] and r['heure_arrivee'] > '08:00:00'])
            
            early_departures = len([r for r in daily_attendance 
                                  if r['heure_depart'] and r['heure_depart'] < '17:00:00' and 
                                  (pd.to_datetime(r['heure_depart']) - pd.to_datetime(r['heure_arrivee'])).total_seconds() / 3600 > 1])
            
            missing_departures = len([r for r in daily_attendance 
                                    if r['heure_arrivee'] and r['heure_depart'] and 
                                    (pd.to_datetime(r['heure_depart']) - pd.to_datetime(r['heure_arrivee'])).total_seconds() / 3600 == 1])
            
            return {
                'total_employees': total_employees,
                'present_today': present_employees,
                'absent_today': absent_employees,
                'late_arrivals': late_arrivals,
                'early_departures': early_departures,
                'missing_departures': missing_departures
            }
            
        except Exception as e:
            print(f"[ERREUR] Génération rapports: {str(e)}")
            return {
                'total_employees': 0,
                'present_today': 0,
                'absent_today': 0,
                'late_arrivals': 0,
                'early_departures': 0,
                'missing_departures': 0
            }

    def get_absent_employees(self, date=None, departement=None):
        """Récupère la liste des employés absents pour une date donnée"""
        try:
            if not date:
                date = datetime.now().strftime('%Y-%m-%d')
            
            db_path = os.path.join('data', 'database.csv')
            if not os.path.exists(db_path):
                return []
            
            df_employees = pd.read_csv(db_path)
            
            if departement:
                df_employees = df_employees[df_employees['departement'] == departement]
            
            attendance_file = self.get_attendance_file(date)
            if not os.path.exists(attendance_file):
                return df_employees.to_dict('records')
            
            df_attendance = pd.read_csv(attendance_file)
            present_employees = df_attendance[df_attendance['date'] == date]['matricule'].unique()
            
            absent_employees = df_employees[~df_employees['matricule'].isin(present_employees)]
            
            result = []
            for _, row in absent_employees.iterrows():
                result.append({
                    'matricule': row['matricule'],
                    'nom': row['nom'],
                    'prenom': row['prenom'],
                    'telephone': row['telephone'],
                    'departement': row['departement']
                })
            
            return result
        
        except Exception as e:
            print(f"[ERREUR] Récupération employés absents: {str(e)}")
            return []