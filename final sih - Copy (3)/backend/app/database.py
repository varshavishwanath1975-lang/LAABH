import os
import sqlite3
import pandas as pd
import json
import bcrypt

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "laabh.db")

def hash_password(password: str) -> str:
    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    pwd_bytes = plain_password.encode('utf-8')
    hash_bytes = hashed_password.encode('utf-8')
    return bcrypt.checkpw(pwd_bytes, hash_bytes)

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # 1. Users Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        hashed_password TEXT NOT NULL,
        role TEXT NOT NULL,
        ministry TEXT,
        agency TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)
    
    # 2. Projects Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY,
        project_name TEXT NOT NULL,
        sector_name TEXT,
        line_ministry TEXT,
        company_name TEXT,
        sanction_date TEXT,
        original_cost REAL
    );
    """)
    
    # 3. Monthly Snapshots Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS monthly_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        snapshot_month TEXT NOT NULL,
        physical_progress REAL,
        expenditure REAL,
        revised_cost REAL,
        revised_end_date TEXT,
        predictive_risk_index REAL,
        recoverability_score REAL,
        raw_data_json TEXT,
        FOREIGN KEY (project_id) REFERENCES projects(id)
    );
    """)
    
    # 4. Scenarios Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS scenarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        project_id INTEGER NOT NULL,
        scenario_name TEXT NOT NULL,
        input_levers_json TEXT NOT NULL,
        result_json TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (project_id) REFERENCES projects(id)
    );
    """)
    
    # 5. Audit Log Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        username TEXT,
        role TEXT,
        action TEXT NOT NULL,
        endpoint TEXT NOT NULL,
        details_json TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)
    
    # Seed default test users if empty
    cursor.execute("SELECT COUNT(*) FROM users;")
    if cursor.fetchone()[0] == 0:
        default_users = [
            ("admin_user", "admin123", "admin", None, None),
            ("civil_aviation_officer", "officer123", "ministry_officer", "Ministry of Civil Aviation", None),
            ("railways_officer", "officer123", "ministry_officer", "Ministry of Railways", None),
            ("aai_pm", "pm123", "agency_pm", "Ministry of Civil Aviation", "Airport Authority of India [AAI]"),
            ("analyst_user", "analyst123", "analyst", None, None),
            ("viewer_user", "viewer123", "viewer", None, None),
        ]
        for uname, pwd, role, min_val, ag_val in default_users:
            hpwd = hash_password(pwd)
            cursor.execute(
                "INSERT INTO users (username, hashed_password, role, ministry, agency) VALUES (?, ?, ?, ?, ?)",
                (uname, hpwd, role, min_val, ag_val)
            )
        print("Default users seeded successfully with direct bcrypt.")
        
    # Populate projects & monthly_snapshots from modeled_projects.csv if empty
    cursor.execute("SELECT COUNT(*) FROM projects;")
    if cursor.fetchone()[0] == 0:
        csv_path = os.path.join(os.path.dirname(__file__), "..", "..", "data", "modeled_projects.csv")
        if os.path.exists(csv_path):
            df = pd.read_csv(csv_path)
            for _, row in df.iterrows():
                pid = int(row['ProjectId'])
                cursor.execute("""
                INSERT OR REPLACE INTO projects (id, project_name, sector_name, line_ministry, company_name, sanction_date, original_cost)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (
                    pid,
                    str(row.get('ProjectName_june', '')),
                    str(row.get('SectorName_june', '')),
                    str(row.get('LineMinistry_june', '')),
                    str(row.get('COMPANYNAME_june', '')),
                    str(row.get('SanctionDate_june', '')),
                    float(row.get('original_cost', 0.0))
                ))
                
                # June Snapshot
                cursor.execute("""
                INSERT INTO monthly_snapshots (project_id, snapshot_month, physical_progress, expenditure, revised_cost, revised_end_date, predictive_risk_index, recoverability_score, raw_data_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    pid,
                    "2026-06",
                    float(row.get('physical_progress', 0.0)),
                    float(row.get('expenditure', 0.0)),
                    float(row.get('revised_cost', 0.0)),
                    str(row.get('RevisedDate_june', '')),
                    float(row.get('predictive_risk_index', 0.0)),
                    float(row.get('recoverability_score', 0.0)),
                    json.dumps({
                        "monsoon_overlap": float(row.get('monsoon_overlap', 0)),
                        "execution_velocity": float(row.get('execution_velocity', 0)),
                        "months_to_anticipated_completion": float(row.get('months_to_anticipated_completion', 0))
                    })
                ))
            print(f"Seeded {len(df)} projects and June snapshots into SQLite DB.")
            
    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()
