#!/usr/bin/env python3
"""
Test de charge Teranga School — simule une grande école (~1000 élèves,
46 professeurs, 12 membres du personnel, 6ème à Terminale) en tapant
directement l'API Supabase (REST + Auth + RPC) exactement comme le fait
l'application React, pour vérifier que le système tient à l'échelle.

Ce script crée réellement des données dans le projet Supabase configuré
via .env — mais tout est isolé sous UNE SEULE école de test (nouvelle,
créée par ce script). Nettoyage : scripts/cleanup_test_school.py <school_id>
(suppression en cascade, une seule ligne DELETE FROM schools).

Simplifications assumées (documentées dans le rapport final) :
- Les matières sont posées directement par niveau/filière (curriculum
  simplifié codé ci-dessous) plutôt que via le moteur de filières complet
  (qui est amorcé par le frontend React à la première ouverture de l'appli,
  donc invisible pour un script qui ne passe jamais par le navigateur).
  Toutes les matières sont "obligatoire" (pas de choix/facultatif) — ça
  suffit à tester notes, classement, bulletin, emploi du temps, présences,
  paiements en profondeur.
- Élèves et professeurs n'ont pas de compte de connexion portail (ce n'est
  pas nécessaire à leur inscription réelle dans l'appli — c'est une
  fonctionnalité séparée). Le personnel (staff), lui, EST créé avec un
  vrai compte (nécessaire pour accéder au dashboard), via le même chemin
  que la vraie appli (school_accounts + edge function create-staff-account).
- Les présences ne sont générées que sur un échantillon d'une semaine
  (pas toute l'année) — assez pour tester le système, pas pour saturer la
  base avec des données inutiles.

Usage :
    python3 scripts/load_test.py
"""

import concurrent.futures
import datetime
import json
import os
import random
import string
import sys
import time
import uuid

import requests

# ─────────────────────────────────────────────────────────────────────────
# CONFIGURATION — lue depuis .env à la racine du projet
# ─────────────────────────────────────────────────────────────────────────

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)


def load_env(path: str) -> dict:
    env = {}
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            env[key.strip()] = value.strip().strip('"').strip("'")
    return env


ENV = load_env(os.path.join(PROJECT_ROOT, ".env"))
SUPABASE_URL = ENV["VITE_SUPABASE_URL"].rstrip("/")
ANON_KEY = ENV["VITE_SUPABASE_PUBLISHABLE_KEY"]
SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")  # optionnel, fallback si confirmation email active

REST_URL = f"{SUPABASE_URL}/rest/v1"
AUTH_URL = f"{SUPABASE_URL}/auth/v1"
FUNCTIONS_URL = f"{SUPABASE_URL}/functions/v1"

RUN_ID = datetime.datetime.now().strftime("%Y%m%d%H%M%S")
ACADEMIC_YEAR_START = 2026  # année scolaire courante : 2026-2027
ACADEMIC_YEAR_LABEL = f"{ACADEMIC_YEAR_START}-{ACADEMIC_YEAR_START + 1}"

TARGET_STUDENTS = int(os.environ.get("LOAD_TEST_STUDENTS", 1000))
TARGET_TEACHERS = int(os.environ.get("LOAD_TEST_TEACHERS", 46))
TARGET_STAFF = int(os.environ.get("LOAD_TEST_STAFF", 12))
MAX_WORKERS = 16
CHUNK_SIZE = 200  # taille des lots pour les inserts en masse

session = requests.Session()


# ─────────────────────────────────────────────────────────────────────────
# RAPPORT — collecte structurée, écrite en JSON + résumé lisible à la fin
# ─────────────────────────────────────────────────────────────────────────

class Report:
    def __init__(self):
        self.phases = []
        self.started_at = time.time()

    def phase(self, name):
        return _PhaseTimer(self, name)

    def finish_phase(self, name, ok, count, duration, errors, extra=None):
        self.phases.append({
            "phase": name,
            "ok": ok,
            "count": count,
            "duration_s": round(duration, 2),
            "errors": errors[:20],
            "error_count": len(errors),
            "extra": extra or {},
        })
        status = "OK" if ok else "ÉCHEC"
        print(f"[{status}] {name} — {count} élément(s) en {duration:.1f}s"
              + (f" — {len(errors)} erreur(s)" if errors else ""))
        if errors:
            for e in errors[:5]:
                print(f"    ⚠ {e}")

    def save(self, path):
        total_duration = time.time() - self.started_at
        payload = {
            "run_id": RUN_ID,
            "academic_year": ACADEMIC_YEAR_LABEL,
            "total_duration_s": round(total_duration, 2),
            "phases": self.phases,
        }
        with open(path, "w") as f:
            json.dump(payload, f, indent=2, ensure_ascii=False)
        return payload


class _PhaseTimer:
    def __init__(self, report, name):
        self.report = report
        self.name = name
        self.errors = []

    def __enter__(self):
        self.t0 = time.time()
        print(f"\n=== {self.name} ===")
        return self

    def error(self, msg):
        self.errors.append(msg)

    def __exit__(self, exc_type, exc, tb):
        duration = time.time() - self.t0
        if exc_type is not None:
            self.errors.append(f"Exception non gérée : {exc}")
            self.report.finish_phase(self.name, False, 0, duration, self.errors)
            return False  # laisse remonter l'exception
        return None  # rempli par l'appelant via finish()


REPORT = Report()


# ─────────────────────────────────────────────────────────────────────────
# HTTP helpers — REST / RPC / Auth, avec petites relances sur 429/5xx
# ─────────────────────────────────────────────────────────────────────────

def _request(method, url, headers, **kwargs):
    for attempt in range(4):
        resp = session.request(method, url, headers=headers, timeout=30, **kwargs)
        if resp.status_code in (429, 500, 502, 503, 504) and attempt < 3:
            time.sleep(1.5 * (attempt + 1))
            continue
        return resp
    return resp


def auth_headers(access_token: str) -> dict:
    return {
        "apikey": ANON_KEY,
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }


def rest_insert(table: str, rows: list, access_token: str, on_conflict: str = None, merge: bool = False):
    """Insère (ou upsert si on_conflict) un lot de lignes ; retourne la liste des lignes créées."""
    if not rows:
        return []
    url = f"{REST_URL}/{table}"
    if on_conflict:
        url += f"?on_conflict={on_conflict}"
    prefer = "return=representation"
    if merge:
        prefer = "resolution=merge-duplicates," + prefer
    headers = {**auth_headers(access_token), "Prefer": prefer}
    resp = _request("POST", url, headers, data=json.dumps(rows))
    if resp.status_code >= 300:
        raise RuntimeError(f"INSERT {table} a échoué ({resp.status_code}) : {resp.text[:500]}")
    return resp.json()


def rest_select(table: str, access_token: str, params: dict):
    resp = _request("GET", f"{REST_URL}/{table}", auth_headers(access_token), params=params)
    if resp.status_code >= 300:
        raise RuntimeError(f"SELECT {table} a échoué ({resp.status_code}) : {resp.text[:500]}")
    return resp.json()


def rest_rpc(fn: str, params: dict, access_token: str):
    resp = _request("POST", f"{REST_URL}/rpc/{fn}", auth_headers(access_token), data=json.dumps(params))
    if resp.status_code >= 300:
        raise RuntimeError(f"RPC {fn} a échoué ({resp.status_code}) : {resp.text[:500]}")
    return resp.json() if resp.text else None


def chunked(items: list, size: int):
    for i in range(0, len(items), size):
        yield items[i:i + size]


def parallel(fn, items, max_workers=MAX_WORKERS):
    """Exécute fn(item) en parallèle, retourne (résultats, erreurs)."""
    results, errors = [], []
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = {pool.submit(fn, item): item for item in items}
        for fut in concurrent.futures.as_completed(futures):
            try:
                results.append(fut.result())
            except Exception as e:  # noqa: BLE001 — on collecte tout pour le rapport
                errors.append(str(e))
    return results, errors


# ─────────────────────────────────────────────────────────────────────────
# Générateurs de données réalistes (sans dépendance externe type Faker)
# ─────────────────────────────────────────────────────────────────────────

FIRST_NAMES_M = ["Mamadou", "Ousmane", "Ibrahima", "Cheikh", "Abdoulaye", "Moussa", "Modou",
                 "El Hadji", "Amadou", "Babacar", "Serigne", "Alioune", "Pape", "Souleymane",
                 "Mohamed", "Idrissa", "Lamine", "Malick", "Ndiaga", "Assane"]
FIRST_NAMES_F = ["Fatou", "Aminata", "Aissatou", "Awa", "Mariama", "Khady", "Ndeye", "Astou",
                  "Bineta", "Coumba", "Rokhaya", "Sokhna", "Adama", "Marieme", "Anta", "Diarra",
                  "Fatoumata", "Ramatoulaye", "Dieynaba", "Yacine"]
LAST_NAMES = ["Diop", "Ndiaye", "Fall", "Gueye", "Sarr", "Diallo", "Ba", "Sow", "Ndour", "Faye",
              "Kane", "Sy", "Cisse", "Thiam", "Diagne", "Mbaye", "Sene", "Toure", "Gomis", "Wade",
              "Camara", "Dieng", "Niang", "Sakho", "Diatta"]
PLACES = ["Dakar", "Thies", "Saint-Louis", "Kaolack", "Ziguinchor", "Mbour", "Rufisque", "Louga",
          "Tambacounda", "Kolda"]

_used_names = set()


def random_person(sex=None):
    sex = sex or random.choice(["homme", "femme"])
    first = random.choice(FIRST_NAMES_M if sex == "homme" else FIRST_NAMES_F)
    last = random.choice(LAST_NAMES)
    return first, last, sex


def random_dob(min_age, max_age):
    age = random.randint(min_age, max_age)
    year = datetime.date.today().year - age
    month = random.randint(1, 12)
    day = random.randint(1, 28)
    return f"{year:04d}-{month:02d}-{day:02d}"


def random_phone():
    return f"7{random.randint(0,7)}{random.randint(1000000,9999999)}"


# ─────────────────────────────────────────────────────────────────────────
# Curriculum simplifié — matières "obligatoire" par famille de niveau
# ─────────────────────────────────────────────────────────────────────────

COLLEGE_SUBJECTS = [
    ("Francais", 4), ("Mathematiques", 4), ("Anglais", 3),
    ("Histoire Geographie", 2), ("SVT", 2), ("Sciences Physiques", 2), ("EPS", 1),
]
SECONDE_SUBJECTS = [
    ("Francais", 4), ("Mathematiques", 4), ("Anglais", 3), ("Espagnol", 2),
    ("Histoire Geographie", 3), ("SVT", 3), ("Sciences Physiques", 3), ("EPS", 1),
]
S_FAMILY_SUBJECTS = [
    ("Mathematiques", 5), ("Sciences Physiques", 5), ("SVT", 4), ("Francais", 3),
    ("Anglais", 3), ("Histoire Geographie", 3), ("EPS", 1),
]
L_FAMILY_SUBJECTS = [
    ("Francais", 4), ("Histoire Geographie", 4), ("Anglais", 4), ("Espagnol", 4),
    ("Mathematiques", 2), ("SVT", 2), ("EPS", 1),
]

NIVEAUX_COLLEGE = ["6eme", "5eme", "4eme", "3eme"]
NIVEAUX_LYCEE = ["2nde", "1ere", "Tle"]

# (niveau, lettre_classe, famille) — famille détermine le programme de matières
CLASS_PLAN = []
for niv in NIVEAUX_COLLEGE:
    for letter in "ABCD":
        CLASS_PLAN.append((niv, f"{niv} {letter}", "college"))
for letter, famille in [("A", "S"), ("B", "S"), ("C", "L"), ("D", "L")]:
    CLASS_PLAN.append(("2nde", f"2nde {famille}{letter}", famille))
for niv in ["1ere", "Tle"]:
    for suffix, famille in [("S1", "S"), ("S2", "S"), ("L2", "L"), ("L1B", "L")]:
        CLASS_PLAN.append((niv, f"{niv} {suffix}", famille))


def subjects_for_class(niveau: str, famille: str):
    if famille == "college":
        return COLLEGE_SUBJECTS
    base = S_FAMILY_SUBJECTS if famille == "S" else L_FAMILY_SUBJECTS
    if niveau in ("1ere", "Tle"):
        return base + [("Philosophie", 4 if famille == "L" else 2)]
    return base


# ─────────────────────────────────────────────────────────────────────────
# ÉTAPE 1 — Inscription de l'école de test (admin) + session authentifiée
# ─────────────────────────────────────────────────────────────────────────

def signup_admin():
    email = f"loadtest.admin.{RUN_ID}@example.com"
    password = "LoadTest_" + "".join(random.choices(string.ascii_letters + string.digits, k=12))
    school_name = f"Ecole Test Charge {RUN_ID}"

    resp = _request("POST", f"{AUTH_URL}/signup", {"apikey": ANON_KEY, "Content-Type": "application/json"},
                     data=json.dumps({
                         "email": email, "password": password,
                         "data": {"full_name": "Admin Test Charge", "school_name": school_name},
                     }))
    if resp.status_code >= 300:
        raise RuntimeError(f"Signup admin a échoué ({resp.status_code}) : {resp.text[:500]}")
    body = resp.json()
    access_token = (body.get("access_token")
                     or (body.get("session") or {}).get("access_token"))

    if not access_token:
        # Confirmation email probablement activée — tente une connexion directe
        # (fonctionne si l'auto-confirmation est en fait active côté Supabase).
        resp2 = _request("POST", f"{AUTH_URL}/token?grant_type=password",
                          {"apikey": ANON_KEY, "Content-Type": "application/json"},
                          data=json.dumps({"email": email, "password": password}))
        if resp2.status_code < 300:
            access_token = resp2.json().get("access_token")

    if not access_token and SERVICE_ROLE_KEY:
        # Fallback : création admin via l'API Auth avec la clé service_role
        # (confirme l'email automatiquement), puis connexion normale.
        admin_headers = {"apikey": SERVICE_ROLE_KEY, "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
                          "Content-Type": "application/json"}
        _request("POST", f"{AUTH_URL}/admin/users", admin_headers, data=json.dumps({
            "email": email, "password": password, "email_confirm": True,
            "user_metadata": {"full_name": "Admin Test Charge", "school_name": school_name},
        }))
        resp3 = _request("POST", f"{AUTH_URL}/token?grant_type=password",
                          {"apikey": ANON_KEY, "Content-Type": "application/json"},
                          data=json.dumps({"email": email, "password": password}))
        if resp3.status_code < 300:
            access_token = resp3.json().get("access_token")

    if not access_token:
        raise RuntimeError(
            "Impossible d'obtenir une session après inscription — la confirmation "
            "par email est probablement activée sur ce projet Supabase. Désactive-la "
            "temporairement (Dashboard → Authentication → Providers → Email → "
            "\"Confirm email\") ou fournis SUPABASE_SERVICE_ROLE_KEY en variable "
            "d'environnement pour contourner via l'API admin."
        )

    # Le trigger handle_new_user() crée school_members (admin_school) — on va le chercher.
    for _ in range(5):
        members = rest_select("school_members", access_token, {"select": "school_id", "limit": 1})
        if members:
            return {"email": email, "password": password, "access_token": access_token,
                    "school_id": members[0]["school_id"], "school_name": school_name}
        time.sleep(1)
    raise RuntimeError("school_members introuvable après inscription (trigger handle_new_user non déclenché ?)")


# ─────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────

def main():
    print(f"Teranga School — test de charge (run {RUN_ID})")
    print(f"Cible : {TARGET_STUDENTS} élèves, {TARGET_TEACHERS} professeurs, {TARGET_STAFF} personnel")
    print(f"Année scolaire simulée : {ACADEMIC_YEAR_LABEL}\n")

    # ── 1. École + admin ────────────────────────────────────────────────
    with REPORT.phase("1. Inscription école + admin") as p:
        try:
            ctx = signup_admin()
            REPORT.finish_phase(p.name, True, 1, time.time() - p.t0, p.errors,
                                 {"school_id": ctx["school_id"], "school_name": ctx["school_name"],
                                  "admin_email": ctx["email"]})
        except Exception as e:
            REPORT.finish_phase(p.name, False, 0, time.time() - p.t0, [str(e)])
            print("\n✗ Impossible de continuer sans école de test. Arrêt.")
            REPORT.save(os.path.join(SCRIPT_DIR, f"report_{RUN_ID}.json"))
            sys.exit(1)

    token = ctx["access_token"]
    school_id = ctx["school_id"]

    # ── 2. Année scolaire ────────────────────────────────────────────────
    with REPORT.phase("2. Année scolaire") as p:
        try:
            rest_insert("school_years", [{
                "school_id": school_id, "label": ACADEMIC_YEAR_LABEL,
                "name": f"Annee Scolaire {ACADEMIC_YEAR_LABEL}",
                "start_date": f"{ACADEMIC_YEAR_START}-09-01",
                "end_date": f"{ACADEMIC_YEAR_START + 1}-07-31",
                "is_closed": False,
            }], token)
            REPORT.finish_phase(p.name, True, 1, time.time() - p.t0, p.errors)
        except Exception as e:
            REPORT.finish_phase(p.name, False, 0, time.time() - p.t0, [str(e)])

    # ── 3. Classes ───────────────────────────────────────────────────────
    class_ids = {}  # class_name -> {id, niveau, famille}
    with REPORT.phase("3. Classes") as p:
        try:
            rows = [{"school_id": school_id, "name": name, "student_limit": 60, "niveau": niveau}
                    for niveau, name, famille in CLASS_PLAN]
            created = rest_insert("classes", rows, token)
            for row, (niveau, name, famille) in zip(created, CLASS_PLAN):
                class_ids[name] = {"id": row["id"], "niveau": niveau, "famille": famille}
            REPORT.finish_phase(p.name, True, len(created), time.time() - p.t0, p.errors)
        except Exception as e:
            REPORT.finish_phase(p.name, False, 0, time.time() - p.t0, [str(e)])
            sys.exit(1)

    # ── 4. Périodes (2 semestres) + association à toutes les classes ────
    period_ids = []
    with REPORT.phase("4. Périodes (semestres)") as p:
        try:
            periods_def = [
                {"name": "Premier Semestre", "ordering": 0,
                 "start_date": f"{ACADEMIC_YEAR_START}-10-01", "end_date": f"{ACADEMIC_YEAR_START}-12-20"},
                {"name": "Deuxieme Semestre", "ordering": 1,
                 "start_date": f"{ACADEMIC_YEAR_START + 1}-01-05", "end_date": f"{ACADEMIC_YEAR_START + 1}-06-15"},
            ]
            rows = [{"school_id": school_id, "academic_year_label": ACADEMIC_YEAR_LABEL,
                     "name": d["name"], "type": "semester", "ordering": d["ordering"],
                     "start_date": d["start_date"], "end_date": d["end_date"]} for d in periods_def]
            created = rest_insert("grade_periods", rows, token)
            period_ids = [r["id"] for r in created]

            pc_rows = [{"school_id": school_id, "period_id": pid, "class_id": c["id"]}
                       for pid in period_ids for c in class_ids.values()]
            rest_insert("grade_period_classes", pc_rows, token)
            REPORT.finish_phase(p.name, True, len(created), time.time() - p.t0, p.errors,
                                 {"period_ids": period_ids})
        except Exception as e:
            REPORT.finish_phase(p.name, False, 0, time.time() - p.t0, [str(e)])
            sys.exit(1)

    # ── 5. Matières par classe × période ─────────────────────────────────
    subject_ids = {}  # (class_id, period_id, subject_name) -> subject_id
    with REPORT.phase("5. Matières") as p:
        try:
            rows = []
            for cname, c in class_ids.items():
                progs = subjects_for_class(c["niveau"], c["famille"])
                for pid in period_ids:
                    for ordering, (sname, coef) in enumerate(progs):
                        rows.append({"school_id": school_id, "class_id": c["id"], "period_id": pid,
                                     "name": sname, "coefficient": coef, "ordering": ordering,
                                     "subject_type": "obligatoire"})
            created = []
            for chunk in chunked(rows, CHUNK_SIZE):
                created.extend(rest_insert("subjects", chunk, token))
            for row in created:
                subject_ids[(row["class_id"], row["period_id"], row["name"])] = row["id"]
            REPORT.finish_phase(p.name, True, len(created), time.time() - p.t0, p.errors)
        except Exception as e:
            REPORT.finish_phase(p.name, False, 0, time.time() - p.t0, [str(e)])
            sys.exit(1)

    # ── 6. Professeurs ───────────────────────────────────────────────────
    teacher_ids = []
    with REPORT.phase("6. Professeurs") as p:
        try:
            all_subject_names = sorted({s for progs in (COLLEGE_SUBJECTS, S_FAMILY_SUBJECTS, L_FAMILY_SUBJECTS)
                                         for s, _ in progs} | {"Philosophie"})
            profile_rows, specialties = [], []
            for i in range(TARGET_TEACHERS):
                first, last, sex = random_person()
                specialty = all_subject_names[i % len(all_subject_names)]
                specialties.append(specialty)
                profile_rows.append({
                    "school_id": school_id, "unique_id": f"PROF-{ACADEMIC_YEAR_START}-{i+1:03d}",
                    "first_name": first, "last_name": last,
                    "date_of_birth": random_dob(25, 58), "place_of_birth": random.choice(PLACES),
                    "sex": sex, "phone": random_phone(), "residence": random.choice(PLACES),
                    "diploma": random.choice(["CAES", "CAEM", "Licence", "Master"]),
                    "emergency_phone": random_phone(),
                })
            profiles = rest_insert("teacher_profiles", profile_rows, token)

            enroll_rows = [{
                "school_id": school_id, "teacher_profile_id": prof["id"],
                "academic_year_label": ACADEMIC_YEAR_LABEL,
                "years_experience": random.randint(0, 25),
                "contract_type": random.choice(["cdi", "cdd", "vacataire"]),
                "payment_type": random.choice(["hourly", "fixed"]),
                "salary_amount": random.choice([150000, 200000, 250000, 300000, 400000]),
                "status": "active",
            } for prof in profiles]
            enrollments = rest_insert("teacher_enrollments", enroll_rows, token)

            for prof, enr, specialty in zip(profiles, enrollments, specialties):
                teacher_ids.append({"enrollment_id": enr["id"], "name": f"{prof['first_name']} {prof['last_name']}",
                                     "specialty": specialty})
            REPORT.finish_phase(p.name, True, len(teacher_ids), time.time() - p.t0, p.errors)
        except Exception as e:
            REPORT.finish_phase(p.name, False, 0, time.time() - p.t0, [str(e)])

    # ── 7. Personnel (staff, avec vrai compte de connexion) ──────────────
    with REPORT.phase("7. Personnel (staff)") as p:
        created_count = 0
        for i in range(TARGET_STAFF):
            try:
                first, last, sex = random_person()
                full_name = f"{first} {last}"
                staff_email = f"staff.{RUN_ID}.{i+1}@senclass.com"
                staff_password = "Staff_" + "".join(random.choices(string.ascii_letters + string.digits, k=10))
                account = rest_insert("school_accounts", [{
                    "school_id": school_id, "role": "staff", "email": staff_email,
                    "password_plain": staff_password, "display_name": full_name,
                    "display_id": f"STAFF-{i+1:03d}", "school_name": ctx["school_name"],
                }], token)
                account_id = account[0]["id"]
                permissions = random.sample(
                    ["students", "teachers", "classes", "grades", "schedule", "attendance", "payments"],
                    k=random.randint(2, 4),
                )
                resp = _request("POST", f"{FUNCTIONS_URL}/create-staff-account", auth_headers(token),
                                 data=json.dumps({"email": staff_email, "password": staff_password,
                                                   "accountId": account_id, "fullName": full_name,
                                                   "permissions": permissions}))
                if resp.status_code >= 300:
                    p.error(f"create-staff-account #{i+1} : {resp.status_code} {resp.text[:200]}")
                    continue
                created_count += 1
            except Exception as e:
                p.error(f"staff #{i+1} : {e}")
        REPORT.finish_phase(p.name, created_count == TARGET_STAFF, created_count, time.time() - p.t0, p.errors)

    # ── 8. Élèves (profils + inscriptions), répartis sur les classes ─────
    student_enrollments = []  # {enrollment_id, class_id}
    with REPORT.phase("8. Élèves (inscription)") as p:
        try:
            class_list = list(class_ids.values())
            per_class = TARGET_STUDENTS // len(class_list)
            remainder = TARGET_STUDENTS - per_class * len(class_list)
            assignments = []
            for idx, c in enumerate(class_list):
                n = per_class + (1 if idx < remainder else 0)
                assignments.extend([c["id"]] * n)
            random.shuffle(assignments)

            profile_rows = []
            for i, class_id in enumerate(assignments):
                first, last, sex = random_person()
                tutor_first, tutor_last, _ = random_person()
                profile_rows.append({
                    "school_id": school_id, "unique_id": f"ETU-{ACADEMIC_YEAR_START}-{i+1:05d}",
                    "first_name": first, "last_name": last,
                    "date_of_birth": random_dob(10, 20), "place_of_birth": random.choice(PLACES),
                    "sex": sex, "residence": random.choice(PLACES),
                    "tutor1_full_name": f"{tutor_first} {tutor_last}", "tutor1_phone": random_phone(),
                    "tutor1_status": random.choice(["pere", "mere", "tuteur"]),
                })

            profiles = []
            for chunk in chunked(profile_rows, CHUNK_SIZE):
                profiles.extend(rest_insert("student_profiles", chunk, token))

            enroll_rows = [{"school_id": school_id, "student_profile_id": prof["id"],
                             "academic_year_label": ACADEMIC_YEAR_LABEL, "class_id": class_id,
                             "status": "active"}
                            for prof, class_id in zip(profiles, assignments)]
            enrollments = []
            for chunk in chunked(enroll_rows, CHUNK_SIZE):
                enrollments.extend(rest_insert("student_enrollments", chunk, token))

            for enr, prof, class_id in zip(enrollments, profiles, assignments):
                student_enrollments.append({"enrollment_id": enr["id"], "class_id": class_id,
                                             "unique_id": prof["unique_id"]})
            REPORT.finish_phase(p.name, True, len(student_enrollments), time.time() - p.t0, p.errors)
        except Exception as e:
            REPORT.finish_phase(p.name, False, 0, time.time() - p.t0, [str(e)])
            sys.exit(1)

    # ── 9. Notes ──────────────────────────────────────────────────────────
    with REPORT.phase("9. Saisie des notes") as p:
        try:
            by_class = {}
            for se in student_enrollments:
                by_class.setdefault(se["class_id"], []).append(se["enrollment_id"])

            grade_rows = []
            for cname, c in class_ids.items():
                enr_ids = by_class.get(c["id"], [])
                for pid in period_ids:
                    for sname, _coef in subjects_for_class(c["niveau"], c["famille"]):
                        subj_id = subject_ids.get((c["id"], pid, sname))
                        if not subj_id:
                            continue
                        for enr_id in enr_ids:
                            grade_rows.append({
                                "school_id": school_id, "subject_id": subj_id, "student_enrollment_id": enr_id,
                                "devoir1": round(random.uniform(6, 19), 2),
                                "devoir2": round(random.uniform(6, 19), 2),
                                "devoir3": round(random.uniform(6, 19), 2),
                                "composition": round(random.uniform(6, 19), 2),
                            })

            def upsert_chunk(chunk):
                return rest_insert("grades", chunk, token,
                                    on_conflict="school_id,subject_id,student_enrollment_id", merge=True)

            chunks = list(chunked(grade_rows, 500))
            results, errors = parallel(upsert_chunk, chunks)
            total = sum(len(r) for r in results)
            REPORT.finish_phase(p.name, len(errors) == 0, total, time.time() - p.t0, errors,
                                 {"planned_rows": len(grade_rows)})
        except Exception as e:
            REPORT.finish_phase(p.name, False, 0, time.time() - p.t0, [str(e)])

    # ── 10. Emploi du temps ──────────────────────────────────────────────
    schedule_events = []  # cache local pour la phase présences
    with REPORT.phase("10. Emploi du temps") as p:
        try:
            colors = ["#3b82f6", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#06b6d4"]
            rows = []
            for cname, c in class_ids.items():
                progs = subjects_for_class(c["niveau"], c["famille"])
                slot = 0
                for day_index in range(6):  # lundi(0) à samedi(5)
                    slots_today = 2 if day_index < 5 else 1
                    for _ in range(slots_today):
                        sname, _coef = progs[slot % len(progs)]
                        teacher = next((t for t in teacher_ids if t["specialty"] == sname), None) \
                            or random.choice(teacher_ids) if teacher_ids else None
                        start_hour = 8 + (slot % 4) * 2
                        rows.append({
                            "school_id": school_id, "academic_year_label": ACADEMIC_YEAR_LABEL,
                            "day_index": day_index,
                            "start_time": f"{start_hour:02d}:00", "end_time": f"{start_hour + 2:02d}:00",
                            "subject_name": sname, "class_id": c["id"], "class_name": cname,
                            "teacher_id": teacher["enrollment_id"] if teacher else None,
                            "teacher_name": teacher["name"] if teacher else None,
                            "group_id": "all", "group_name": "Classe entiere",
                            "color": random.choice(colors),
                        })
                        slot += 1
            created = []
            for chunk in chunked(rows, CHUNK_SIZE):
                created.extend(rest_insert("schedule_events", chunk, token))
            schedule_events = created
            REPORT.finish_phase(p.name, True, len(created), time.time() - p.t0, p.errors)
        except Exception as e:
            REPORT.finish_phase(p.name, False, 0, time.time() - p.t0, [str(e)])

    # ── 11. Présences (échantillon d'une semaine) ────────────────────────
    with REPORT.phase("11. Présences (échantillon 1 semaine)") as p:
        try:
            monday = datetime.date(ACADEMIC_YEAR_START, 10, 5)  # un lundi d'octobre
            sample_dates = [monday + datetime.timedelta(days=d) for d in range(6)]  # lun-sam

            session_rows = []
            for ev in schedule_events:
                d = sample_dates[ev["day_index"]]
                session_rows.append({
                    "school_id": school_id, "academic_year_label": ACADEMIC_YEAR_LABEL,
                    "schedule_event_id": ev["id"], "date": d.isoformat(),
                    "day_index": ev["day_index"], "start_time": ev["start_time"], "end_time": ev["end_time"],
                    "class_id": ev["class_id"], "class_name": ev["class_name"],
                    "teacher_id": ev["teacher_id"], "teacher_name": ev["teacher_name"],
                    "subject_name": ev["subject_name"], "group_id": ev["group_id"], "group_name": ev["group_name"],
                })
            sessions = []
            for chunk in chunked(session_rows, CHUNK_SIZE):
                sessions.extend(rest_insert("attendance_sessions", chunk, token))

            by_class = {}
            for se in student_enrollments:
                by_class.setdefault(se["class_id"], []).append(se["enrollment_id"])

            student_att_rows = []
            for sess in sessions:
                for enr_id in by_class.get(sess["class_id"], []):
                    roll = random.random()
                    status = "present" if roll < 0.90 else ("absent" if roll < 0.97 else "late")
                    student_att_rows.append({
                        "school_id": school_id, "session_id": sess["id"], "student_enrollment_id": enr_id,
                        "status": status, "is_justified": status == "absent" and random.random() < 0.4,
                    })
            teacher_att_rows = [{
                "school_id": school_id, "session_id": sess["id"], "teacher_enrollment_id": sess["teacher_id"],
                "status": "present", "effective_minutes": 120, "theoretical_minutes": 120,
            } for sess in sessions if sess["teacher_id"]]

            sa_results, sa_errors = parallel(lambda c: rest_insert("student_attendances", c, token),
                                              list(chunked(student_att_rows, 500)))
            ta_results, ta_errors = parallel(lambda c: rest_insert("teacher_attendances", c, token,
                                                                    on_conflict="school_id,session_id,teacher_enrollment_id",
                                                                    merge=True),
                                              list(chunked(teacher_att_rows, 500)))
            total = sum(len(r) for r in sa_results) + sum(len(r) for r in ta_results)
            REPORT.finish_phase(p.name, not (sa_errors or ta_errors), total, time.time() - p.t0,
                                 sa_errors + ta_errors,
                                 {"sessions": len(sessions), "student_attendance_rows": len(student_att_rows),
                                  "teacher_attendance_rows": len(teacher_att_rows)})
        except Exception as e:
            REPORT.finish_phase(p.name, False, 0, time.time() - p.t0, [str(e)])

    # ── 12. Paiements ─────────────────────────────────────────────────────
    with REPORT.phase("12. Paiements") as p:
        try:
            tuition_rows = [{"school_id": school_id, "academic_year_label": ACADEMIC_YEAR_LABEL,
                              "class_id": c["id"], "inscription_fee": 50000,
                              "monthly_fee": 25000 if c["niveau"] in NIVEAUX_COLLEGE else 30000}
                             for c in class_ids.values()]
            rest_insert("tuition_configs", tuition_rows, token)

            methods = ["especes", "wave", "orange_money", "virement", "cheque"]
            payment_rows = []
            for se in student_enrollments:
                payment_rows.append({
                    "school_id": school_id, "academic_year_label": ACADEMIC_YEAR_LABEL,
                    "student_enrollment_id": se["enrollment_id"], "student_unique_id": se["unique_id"],
                    "type": "inscription",
                    "month_key": None, "amount": 50000, "method": random.choice(methods),
                })
                for month in ["2026-10", "2026-11"]:
                    if random.random() < 0.85:  # ~85% des familles à jour
                        payment_rows.append({
                            "school_id": school_id, "academic_year_label": ACADEMIC_YEAR_LABEL,
                            "student_enrollment_id": se["enrollment_id"], "student_unique_id": se["unique_id"],
                            "type": "tuition",
                            "month_key": month, "amount": 25000, "method": random.choice(methods),
                        })

            results, errors = parallel(lambda c: rest_insert("payments", c, token),
                                        list(chunked(payment_rows, 500)))
            total = sum(len(r) for r in results)
            REPORT.finish_phase(p.name, len(errors) == 0, total, time.time() - p.t0, errors,
                                 {"planned_rows": len(payment_rows)})
        except Exception as e:
            REPORT.finish_phase(p.name, False, 0, time.time() - p.t0, [str(e)])

    # ── 13. Vérification bulletin (recalcul Python de la formule) ────────
    with REPORT.phase("13. Vérification bulletin (recalcul moyennes)") as p:
        try:
            sample_classes = list(class_ids.items())[:5]
            anomalies = []
            checked = 0
            for cname, c in sample_classes:
                for pid in period_ids:
                    subj_rows = [(sname, subject_ids.get((c["id"], pid, sname)), coef)
                                 for sname, coef in subjects_for_class(c["niveau"], c["famille"])]
                    subj_ids = [sid for _, sid, _ in subj_rows if sid]
                    if not subj_ids:
                        continue
                    grades = rest_select("grades", token, {
                        "select": "student_enrollment_id,subject_id,devoir1,devoir2,devoir3,composition",
                        "subject_id": f"in.({','.join(subj_ids)})",
                    })
                    by_student = {}
                    for g in grades:
                        by_student.setdefault(g["student_enrollment_id"], []).append(g)
                    coef_by_subject = {sid: coef for _, sid, coef in subj_rows if sid}
                    for enr_id, glist in by_student.items():
                        total_p, total_c = 0.0, 0.0
                        for g in glist:
                            devoirs = [g[k] for k in ("devoir1", "devoir2", "devoir3") if g.get(k) is not None]
                            if not devoirs:
                                continue
                            mu_dev = sum(devoirs) / len(devoirs)
                            comp = g.get("composition")
                            mu_mat = (mu_dev + comp) / 2 if comp is not None else mu_dev
                            coef = coef_by_subject.get(g["subject_id"], 1)
                            total_p += mu_mat * coef
                            total_c += coef
                        checked += 1
                        if total_c > 0:
                            avg = total_p / total_c
                            if not (0 <= avg <= 20):
                                anomalies.append(f"{cname} enr={enr_id} moyenne hors bornes: {avg:.2f}")
            REPORT.finish_phase(p.name, len(anomalies) == 0, checked, time.time() - p.t0, anomalies,
                                 {"note": "Recalcul indépendant de la formule μ_dev/μ_mat/P_pond en Python, "
                                          "à partir des notes brutes en base — vérifie que les moyennes "
                                          "resteront cohérentes une fois calculées par l'appli (useClassRanking). "
                                          "Ne génère pas de PDF réel (jsPDF tourne côté navigateur)."})
        except Exception as e:
            REPORT.finish_phase(p.name, False, 0, time.time() - p.t0, [str(e)])

    # ── 14. Moteur de filières — test de non-régression du bug historique ─
    # (LV1/LV2 partageant Anglais+Espagnol dans les deux pools : résoudre LV2
    # ne doit PAS désactiver le choix LV1 s'il porte le même nom de matière —
    # exactement le bug corrigé plus tôt sur ce projet.)
    with REPORT.phase("14. Moteur de filières (régression LV1/LV2)") as p:
        try:
            test_class = rest_insert("classes", [{
                "school_id": school_id, "name": "1ere TEST-FILIERE", "student_limit": 10, "niveau": "1ere",
            }], token)[0]
            rest_insert("grade_period_classes",
                        [{"school_id": school_id, "period_id": pid, "class_id": test_class["id"]}
                         for pid in period_ids], token)

            filiere = rest_insert("filieres", [{
                "school_id": school_id, "name": "L2-TEST", "niveaux": ["1ere", "Tle"],
            }], token)[0]

            groups = rest_insert("filiere_choice_groups", [
                {"school_id": school_id, "filiere_id": filiere["id"], "niveau": "", "label": "LV1",
                 "coefficient": 4, "ordering": 0},
                {"school_id": school_id, "filiere_id": filiere["id"], "niveau": "", "label": "LV2",
                 "coefficient": 2, "ordering": 1},
            ], token)
            lv1_id, lv2_id = groups[0]["id"], groups[1]["id"]

            rest_insert("filiere_choice_options", [
                {"school_id": school_id, "choice_group_id": lv1_id, "subject_name": "Anglais", "ordering": 0},
                {"school_id": school_id, "choice_group_id": lv1_id, "subject_name": "Espagnol", "ordering": 1},
                {"school_id": school_id, "choice_group_id": lv2_id, "subject_name": "Anglais", "ordering": 0},
                {"school_id": school_id, "choice_group_id": lv2_id, "subject_name": "Espagnol", "ordering": 1},
            ], token)

            rest_rpc("assign_class_filiere", {
                "p_class_id": test_class["id"], "p_academic_year_label": ACADEMIC_YEAR_LABEL,
                "p_filiere_id": filiere["id"],
            }, token)

            # Deux élèves de test, inscrits dans cette classe, avec des choix
            # opposés — pour stresser les deux sens du bug.
            fil_profiles = rest_insert("student_profiles", [
                {"school_id": school_id, "unique_id": f"ETU-FIL-{RUN_ID}-1", "first_name": "Test",
                 "last_name": "AnglaisLV1", "date_of_birth": random_dob(15, 17),
                 "place_of_birth": "Dakar", "sex": "homme", "residence": "Dakar"},
                {"school_id": school_id, "unique_id": f"ETU-FIL-{RUN_ID}-2", "first_name": "Test",
                 "last_name": "EspagnolLV1", "date_of_birth": random_dob(15, 17),
                 "place_of_birth": "Dakar", "sex": "femme", "residence": "Dakar"},
            ], token)
            fil_enrollments = rest_insert("student_enrollments", [
                {"school_id": school_id, "student_profile_id": fil_profiles[0]["id"],
                 "academic_year_label": ACADEMIC_YEAR_LABEL, "class_id": test_class["id"], "status": "active"},
                {"school_id": school_id, "student_profile_id": fil_profiles[1]["id"],
                 "academic_year_label": ACADEMIC_YEAR_LABEL, "class_id": test_class["id"], "status": "active"},
            ], token)
            eleve_a, eleve_b = fil_enrollments[0]["id"], fil_enrollments[1]["id"]

            # Élève A : LV1=Anglais, LV2=Espagnol — Élève B : l'inverse.
            rest_rpc("resolve_filiere_choice", {"p_choice_group_id": lv1_id, "p_student_enrollment_id": eleve_a,
                                                 "p_subject_name": "Anglais", "p_actor": "load_test"}, token)
            rest_rpc("resolve_filiere_choice", {"p_choice_group_id": lv2_id, "p_student_enrollment_id": eleve_a,
                                                 "p_subject_name": "Espagnol", "p_actor": "load_test"}, token)
            rest_rpc("resolve_filiere_choice", {"p_choice_group_id": lv1_id, "p_student_enrollment_id": eleve_b,
                                                 "p_subject_name": "Espagnol", "p_actor": "load_test"}, token)
            rest_rpc("resolve_filiere_choice", {"p_choice_group_id": lv2_id, "p_student_enrollment_id": eleve_b,
                                                 "p_subject_name": "Anglais", "p_actor": "load_test"}, token)

            anomalies = []
            for label, enr_id, expect_active in [
                ("Élève A", eleve_a, {"Anglais", "Espagnol"}),
                ("Élève B", eleve_b, {"Anglais", "Espagnol"}),
            ]:
                settings = rest_select("student_subject_settings", token, {
                    "select": "active,subjects(name)", "student_enrollment_id": f"eq.{enr_id}",
                })
                active_names = {s["subjects"]["name"] for s in settings if s["active"]}
                if active_names != expect_active:
                    anomalies.append(f"{label} : matières actives = {active_names or '{}'}, "
                                      f"attendu {expect_active} (BUG DE CLOBBERING SI VIDE OU INCOMPLET)")

            REPORT.finish_phase(p.name, len(anomalies) == 0, 2, time.time() - p.t0, anomalies,
                                 {"note": "Reproduit exactement le scénario du bug historique : Anglais présent "
                                          "dans les pools LV1 ET LV2. Vérifie que résoudre LV2 ne désactive pas "
                                          "le choix LV1 de l'autre élève quand ils partagent un nom de matière."})
        except Exception as e:
            REPORT.finish_phase(p.name, False, 0, time.time() - p.t0, [str(e)])

    # ── 15. Compte portail élève + vérification RLS (isolation des données) ─
    with REPORT.phase("15. Portail élève + isolation RLS") as p:
        try:
            target = student_enrollments[0]
            portal_email = f"eleve.test.{RUN_ID}@senclass.com"
            portal_password = "Eleve_" + "".join(random.choices(string.ascii_letters + string.digits, k=10))
            acct = rest_insert("school_accounts", [{
                "school_id": school_id, "role": "student", "student_enrollment_id": target["enrollment_id"],
                "email": portal_email, "password_plain": portal_password,
                "display_name": "Eleve Test RLS", "display_id": target["unique_id"],
                "school_name": ctx["school_name"],
            }], token)[0]
            resp = _request("POST", f"{FUNCTIONS_URL}/create-school-account", auth_headers(token),
                             data=json.dumps({"email": portal_email, "password": portal_password,
                                               "accountId": acct["id"]}))
            if resp.status_code >= 300:
                raise RuntimeError(f"create-school-account a échoué ({resp.status_code}) : {resp.text[:300]}")

            login = _request("POST", f"{AUTH_URL}/token?grant_type=password",
                              {"apikey": ANON_KEY, "Content-Type": "application/json"},
                              data=json.dumps({"email": portal_email, "password": portal_password}))
            if login.status_code >= 300:
                raise RuntimeError(f"Connexion élève a échoué ({login.status_code}) : {login.text[:300]}")
            student_token = login.json()["access_token"]

            anomalies = []

            # (a) Doit voir SES PROPRES notes.
            own_grades = rest_select("grades", student_token,
                                      {"select": "id", "student_enrollment_id": f"eq.{target['enrollment_id']}"})
            if len(own_grades) == 0:
                anomalies.append("L'élève ne voit AUCUNE de ses propres notes (trop restrictif)")

            # (b) Ne doit PAS voir les notes d'un autre élève.
            other = next(se for se in student_enrollments if se["enrollment_id"] != target["enrollment_id"])
            other_grades = rest_select("grades", student_token,
                                        {"select": "id", "student_enrollment_id": f"eq.{other['enrollment_id']}"})
            if len(other_grades) > 0:
                anomalies.append(f"FUITE RLS : l'élève voit {len(other_grades)} note(s) d'un AUTRE élève")

            # (c) Ne doit voir QUE son propre profil (pas le trousseau des 1000 élèves).
            all_visible_profiles = rest_select("student_profiles", student_token, {"select": "id"})
            if len(all_visible_profiles) != 1:
                anomalies.append(f"FUITE RLS : l'élève voit {len(all_visible_profiles)} profil(s) élève "
                                  f"au lieu de 1 (le sien uniquement)")

            # (d) Ne doit PAS voir les données réservées au personnel.
            staff_view = rest_select("school_members", student_token, {"select": "id"})
            if len(staff_view) > 0:
                anomalies.append(f"FUITE RLS : l'élève voit {len(staff_view)} ligne(s) de school_members")

            # (e) Ne doit voir que SES PROPRES paiements.
            all_payments_visible = rest_select("payments", student_token, {"select": "id"})
            own_payments = rest_select("payments", student_token,
                                        {"select": "id", "student_enrollment_id": f"eq.{target['enrollment_id']}"})
            if len(all_payments_visible) != len(own_payments):
                anomalies.append(f"FUITE RLS : l'élève voit {len(all_payments_visible)} paiement(s) au total, "
                                  f"dont seulement {len(own_payments)} lui appartiennent")

            REPORT.finish_phase(p.name, len(anomalies) == 0, 5, time.time() - p.t0, anomalies,
                                 {"note": "Vérifie, avec un vrai jeton d'un compte élève (pas l'admin), que les "
                                          "policies RLS fusionnées plus tôt isolent bien correctement chaque élève.",
                                  "portal_email": portal_email})
        except Exception as e:
            REPORT.finish_phase(p.name, False, 0, time.time() - p.t0, [str(e)])

    # ── 16. Annulation de paiement + services annexes ────────────────────
    with REPORT.phase("16. Annulation paiement + services annexes") as p:
        try:
            existing_payments = rest_select("payments", token, {
                "select": "id,status", "student_enrollment_id": f"eq.{student_enrollments[0]['enrollment_id']}",
                "status": "eq.confirmed", "limit": "1",
            })
            if not existing_payments:
                raise RuntimeError("Aucun paiement confirmé trouvé à annuler")
            payment_id = existing_payments[0]["id"]
            rest_rpc("cancel_payment", {"p_payment_id": payment_id, "p_cancelled_by": "load_test"}, token)
            after = rest_select("payments", token, {"select": "status", "id": f"eq.{payment_id}"})
            if after[0]["status"] != "cancelled":
                raise RuntimeError(f"Le paiement {payment_id} n'est pas passé à 'cancelled' (statut={after[0]['status']})")

            service = rest_insert("annex_services", [{
                "school_id": school_id, "academic_year_label": ACADEMIC_YEAR_LABEL, "name": "Cantine",
                "description": "Repas du midi", "amount": 15000, "frequency": "monthly",
                "is_obligatory": False, "scope": "all", "class_ids": [],
            }], token)[0]
            sample = student_enrollments[:50]
            enroll_rows = [{"school_id": school_id, "academic_year_label": ACADEMIC_YEAR_LABEL,
                             "student_enrollment_id": se["enrollment_id"], "service_id": service["id"],
                             "start_month_index": 0, "end_month_index": None} for se in sample]
            created = rest_insert("service_enrollments", enroll_rows, token)
            REPORT.finish_phase(p.name, True, 1 + len(created), time.time() - p.t0, p.errors,
                                 {"cancelled_payment_id": payment_id, "service": "Cantine",
                                  "service_enrollments": len(created)})
        except Exception as e:
            REPORT.finish_phase(p.name, False, 0, time.time() - p.t0, [str(e)])

    # ── Session sauvegardée — pour ré-utilisation (connexion navigateur, etc.) ─
    session_path = os.path.join(SCRIPT_DIR, ".last_test_session.json")
    with open(session_path, "w") as f:
        json.dump({"school_id": school_id, "school_name": ctx["school_name"],
                    "admin_email": ctx["email"], "admin_password": ctx["password"]}, f, indent=2)
    print(f"\nSession admin sauvegardée dans {session_path} (pour connexion navigateur / scripts de suivi).")

    # ── Rapport final ─────────────────────────────────────────────────────
    report_path = os.path.join(SCRIPT_DIR, f"report_{RUN_ID}.json")
    payload = REPORT.save(report_path)

    print("\n" + "=" * 60)
    print("RÉSUMÉ")
    print("=" * 60)
    for ph in payload["phases"]:
        status = "✓" if ph["ok"] else "✗"
        print(f"{status} {ph['phase']:<45} {ph['count']:>6}  ({ph['duration_s']}s)"
              + (f"  [{ph['error_count']} erreurs]" if ph["error_count"] else ""))
    print(f"\nDurée totale : {payload['total_duration_s']}s")
    print(f"École de test : {ctx['school_name']}  (school_id={school_id})")
    print(f"Rapport détaillé : {report_path}")
    print(f"\nNettoyage : python3 scripts/cleanup_test_school.py {school_id}")


if __name__ == "__main__":
    main()
