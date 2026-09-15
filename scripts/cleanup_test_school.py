#!/usr/bin/env python3
"""
Supprime une école de test créée par load_test.py — une seule suppression,
tout le reste (classes, élèves, profs, notes, emploi du temps, présences,
paiements...) part en cascade (toutes les FK vers schools.id sont ON DELETE
CASCADE, vérifié en base avant d'écrire ce script).

N'utilise PAS de clé service_role : passe par l'API REST avec le token admin
que load_test.py a utilisé — il faut donc soit relancer une connexion avec le
même email/mot de passe (affichés dans le rapport JSON), soit fournir un
access_token directement.

Usage :
    python3 scripts/cleanup_test_school.py <school_id> --email <email> --password <password>

Limite connue : les comptes auth.users créés pendant le test (l'admin + le
personnel) ne sont PAS supprimés par ce script (l'API admin de suppression de
compte nécessite la clé service_role, que ce script n'utilise pas par choix
de sécurité). Ce sont des comptes de test sans données sensibles ; à
supprimer manuellement dans Dashboard Supabase → Authentication → Users si
souhaité (chercher "loadtest." ou "staff.<run_id>").
"""

import argparse
import json
import os
import sys

import requests

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


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("school_id")
    parser.add_argument("--email")
    parser.add_argument("--password")
    parser.add_argument("--access-token")
    args = parser.parse_args()

    env = load_env(os.path.join(PROJECT_ROOT, ".env"))
    supabase_url = env["VITE_SUPABASE_URL"].rstrip("/")
    anon_key = env["VITE_SUPABASE_PUBLISHABLE_KEY"]

    access_token = args.access_token
    if not access_token:
        if not (args.email and args.password):
            print("Fournis soit --access-token, soit --email + --password (voir report_*.json).")
            sys.exit(1)
        resp = requests.post(f"{supabase_url}/auth/v1/token?grant_type=password",
                              headers={"apikey": anon_key, "Content-Type": "application/json"},
                              data=json.dumps({"email": args.email, "password": args.password}))
        if resp.status_code >= 300:
            print(f"Connexion échouée ({resp.status_code}) : {resp.text}")
            sys.exit(1)
        access_token = resp.json()["access_token"]

    resp = requests.delete(
        f"{supabase_url}/rest/v1/schools",
        headers={"apikey": anon_key, "Authorization": f"Bearer {access_token}",
                 "Content-Type": "application/json", "Prefer": "return=representation"},
        params={"id": f"eq.{args.school_id}"},
    )
    if resp.status_code >= 300:
        print(f"Suppression échouée ({resp.status_code}) : {resp.text}")
        sys.exit(1)

    deleted = resp.json()
    if not deleted:
        print("Aucune école supprimée — vérifie le school_id et que ce compte y a bien accès.")
        sys.exit(1)
    print(f"École supprimée : {deleted[0].get('name')} (id={args.school_id})")
    print("Tout le reste (classes, élèves, profs, notes, présences, paiements...) est parti en cascade.")


if __name__ == "__main__":
    main()
