#!/usr/bin/env python3
"""Génère le module navigateur depuis package.json ; --check détecte tout décalage."""
import argparse
import json
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
def target_content():
    version = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))["version"]
    return ("// Fichier généré par scripts/sync-version.py depuis package.json.\n"
            "(function(root){'use strict';const meta=Object.freeze({version:" + json.dumps(version) + "});"
            "if(typeof module==='object'&&module.exports)module.exports=meta;"
            "root.QBudgetVersion=meta;})(typeof globalThis!=='undefined'?globalThis:this);\n")
if __name__ == "__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument('--check',action='store_true')
    args=parser.parse_args()
    target=ROOT / 'src' / 'version.js'
    content=target_content()
    if args.check:
        if not target.exists() or target.read_text(encoding='utf-8')!=content:
            print('ERREUR : src/version.js désynchronisé de package.json',file=sys.stderr)
            sys.exit(1)
        print('Version navigateur et package.json cohérentes')
    else:
        target.write_text(content,encoding='utf-8')
        print('Version synchronisée')
