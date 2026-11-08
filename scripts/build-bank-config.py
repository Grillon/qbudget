#!/usr/bin/env python3
"""Intègre les profils de banques.json au site statique (utilisable via file:// sans fetch)."""
import argparse
import json
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
def content():
    data = json.loads((ROOT / 'banques.json').read_text(encoding='utf-8'))
    return ('// Fichier généré depuis banques.json ; ne pas éditer directement.\n'
            '(function(root){"use strict";root.QBudgetBankConfig=' +
            json.dumps(data, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c') +
            ';})(typeof globalThis!=="undefined"?globalThis:this);\n')
if __name__ == '__main__':
    p=argparse.ArgumentParser();p.add_argument('--check',action='store_true');args=p.parse_args()
    dest=ROOT/'src'/'bank-config.js';target=content()
    if args.check:
        if not dest.exists() or dest.read_text(encoding='utf-8') != target:
            print('ERREUR : src/bank-config.js désynchronisé de banques.json',file=sys.stderr);sys.exit(1)
        print('Configuration bancaire navigateur / Python cohérente')
    else:
        dest.write_text(target,encoding='utf-8');print('Configuration navigateur générée')
